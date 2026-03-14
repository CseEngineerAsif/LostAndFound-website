const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const itemModel = require('../models/item');
const { getFeaturedItem } = require('../data/featured-items');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const name = `${Date.now()}-${file.originalname}`;
    cb(null, name);
  },
});

const upload = multer({ storage });

function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.flash('info', 'Please log in to continue.');
    return res.redirect('/auth/login');
  }
  next();
}

router.get('/report', requireLogin, (req, res) => {
  const prefillType = req.query.type === 'found' ? 'found' : 'lost';
  res.render('report', { title: 'Post Item', prefillType });
});

router.post('/report', requireLogin, upload.single('photo'), async (req, res) => {
  const {
    type,
    name,
    description,
    location,
    dateLost,
    category,
    contactMethod,
    anonymous,
  } = req.body;
  const photoPath = req.file ? `/uploads/${req.file.filename}` : null;

  await itemModel.createItem({
    userId: req.session.user.id,
    type,
    name,
    description,
    location,
    dateLost,
    category,
    contactMethod,
    anonymous: anonymous === 'true',
    reportedByName: req.session.user.name,
    photoPath,
    status: 'reported',
  });

  req.flash('success', 'Item reported successfully.');
  const redirectUrl = type === 'found' ? '/items/found' : '/items/lost';
  res.redirect(redirectUrl);
});

router.get('/search', async (req, res) => {
  const { q, category, location, type, status, sort, date } = req.query;
  const items = await itemModel.searchItems({
    query: q,
    category,
    location,
    type,
    status,
    date,
    sort: sort || 'newest',
  });
  res.render('search', {
    title: 'Search Items',
    items,
    filters: { q, category, location, type, status, sort: sort || 'newest', date },
  });
});

router.get('/lost', async (req, res) => {
  const { q, category, location, status, sort, date } = req.query;
  const items = await itemModel.searchItems({
    query: q,
    category,
    location,
    type: 'lost',
    status,
    date,
    sort: sort || 'newest',
  });
  res.render('lost', {
    title: 'Lost Items',
    items,
    filters: { q, category, location, type: 'lost', status, sort: sort || 'newest', date },
  });
});

router.get('/found', async (req, res) => {
  const { q, category, location, status, sort, date } = req.query;
  const items = await itemModel.searchItems({
    query: q,
    category,
    location,
    type: 'found',
    status,
    date,
    sort: sort || 'newest',
  });
  res.render('found', {
    title: 'Found Items',
    items,
    filters: { q, category, location, type: 'found', status, sort: sort || 'newest', date },
  });
});

router.get('/featured/:slug', (req, res) => {
  const featured = getFeaturedItem(req.params.slug);
  if (!featured) return res.status(404).render('404', { title: 'Not Found' });

  const item = {
    id: `featured-${featured.slug}`,
    name: featured.name,
    type: featured.type,
    status: featured.status,
    category: featured.category,
    location: featured.location,
    dateLost: featured.dateLost,
    contactMethod: featured.contactMethod,
    anonymous: featured.anonymous,
    reportedByName: featured.reportedByName,
    description: featured.description,
    photoPath: featured.photoPath,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    userId: 0,
  };

  res.render('item', { title: featured.name, item, isOwner: false, matches: [] });
});

router.get('/:id', async (req, res) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) return res.status(404).render('404', { title: 'Not Found' });
  const isOwner = req.session.user && req.session.user.id === item.userId;
  const matches = await itemModel.findSimilarItems(item, 3);
  res.render('item', { title: item.name, item, isOwner, matches });
});

router.post('/:id/status', requireLogin, async (req, res) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) return res.status(404).render('404', { title: 'Not Found' });

  const isOwner = item.userId === req.session.user.id;
  const isAdmin = req.session.user && req.session.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    req.flash('error', 'You do not have permission to update this report.');
    return res.redirect(`/items/${item.id}`);
  }

  const { status } = req.body;
  const allowed = ['reported', 'resolved'];
  if (!allowed.includes(status)) {
    req.flash('error', 'Invalid status update.');
    return res.redirect(`/items/${item.id}`);
  }

  await itemModel.updateStatus(item.id, status);
  req.flash('success', 'Status updated successfully.');
  res.redirect(`/items/${item.id}`);
});

module.exports = router;
