const express = require('express');
const router = express.Router();
const itemModel = require('../models/item');

router.get('/', async (req, res) => {
  const items = await itemModel.findRecentItems(12);
  res.render('index', { title: 'Campus Lost & Found', items });
});

router.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    req.flash('info', 'Please log in to access your dashboard');
    return res.redirect('/auth/login');
  }
  res.render('dashboard', { title: 'My Dashboard' });
});

module.exports = router;
