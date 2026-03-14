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
  res.render('report', { title: 'Report Item' });
});

router.post('/report', requireLogin, upload.single('photo'), async (req, res) => {
  const { type, name, description, location, dateLost, category } = req.body;
  const photoPath = req.file ? `/uploads/${req.file.filename}` : null;

  await itemModel.createItem({
    userId: req.session.user.id,
    type,
    name,
    description,
    location,
    dateLost,
    category,
    photoPath,
    status: 'reported',
  });

  req.flash('success', 'Item reported successfully.');
  res.redirect('/items/search');
});

router.get('/search', async (req, res) => {
  const { q, category, location, type } = req.query;
  const items = await itemModel.searchItems({ query: q, category, location, type });
  res.render('search', { title: 'Search Items', items, filters: { q, category, location, type } });
});

router.get('/:id', async (req, res) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) return res.status(404).render('404', { title: 'Not Found' });
  res.render('item', { title: item.name, item });
});

module.exports = router;
