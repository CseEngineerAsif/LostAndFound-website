const express = require('express');
const router = express.Router();
const itemModel = require('../models/item');
const { featuredItems } = require('../data/featured-items');

router.get('/', async (req, res) => {
  const items = await itemModel.findRecentItems(12);
  const stats = await itemModel.getStats();
  res.render('index', { title: 'Campus Lost & Found', items, stats, featuredItems });
});

router.get('/dashboard', async (req, res) => {
  if (!req.session.user) {
    req.flash('info', 'Please log in to access your dashboard');
    return res.redirect('/auth/login');
  }

  const userId = req.session.user.id;
  const isAdmin = req.session.user.role === 'admin';

  const [myItems, claimedItems, stats] = await Promise.all([
    itemModel.findByUserId(userId, { limit: 6 }),
    itemModel.findByUserId(userId, { limit: 6, status: 'resolved' }),
    itemModel.getUserStats(userId),
  ]);

  let adminItems = [];
  let adminStats = null;
  let adminFilters = { view: 'all', status: '', sort: 'newest', category: '', location: '', q: '', date: '' };

  if (isAdmin) {
    const { view = 'all', status, sort = 'newest', category, location, q, date } = req.query;
    const type = view === 'lost' ? 'lost' : view === 'found' ? 'found' : undefined;

    adminItems = await itemModel.searchItems({
      query: q,
      category,
      location,
      type,
      status,
      date,
      sort,
    });

    adminStats = await itemModel.getStats();
    adminFilters = { view, status, sort, category, location, q, date };
  }

  res.render('dashboard', {
    title: 'My Dashboard',
    myItems,
    claimedItems,
    stats,
    adminItems,
    adminStats,
    adminFilters,
  });
});

module.exports = router;
