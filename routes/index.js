const express = require('express');
const router = express.Router();
const itemModel = require('../models/item');

router.get('/', async (req, res) => {
  const items = await itemModel.findRecentItems(12);
  const stats = await itemModel.getStats();
  res.render('index', { title: 'Campus Lost & Found', items, stats });
});

router.get('/dashboard', async (req, res) => {
  if (!req.session.user) {
    req.flash('info', 'Please log in to access your dashboard');
    return res.redirect('/auth/login');
  }
  const userId = req.session.user.id;
  const [myItems, claimedItems, stats] = await Promise.all([
    itemModel.findByUserId(userId, { limit: 6 }),
    itemModel.findByUserId(userId, { limit: 6, status: 'resolved' }),
    itemModel.getUserStats(userId),
  ]);
  res.render('dashboard', {
    title: 'My Dashboard',
    myItems,
    claimedItems,
    stats,
  });
});

module.exports = router;
