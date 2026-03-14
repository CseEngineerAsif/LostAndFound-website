const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const itemModel = require('../models/item');

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
  res.render('report', { title: 'Post Item', prefillType: req.query.type || '' });
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
  res.redirect('/items/search');
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

  if (item.userId !== req.session.user.id) {
    req.flash('error', 'You can only update your own reports.');
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
