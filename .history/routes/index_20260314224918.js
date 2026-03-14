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
  let adminPagination = { page: 1, perPage: 12, totalPages: 0, totalItems: 0 };

  if (isAdmin) {
    const {
      view = 'all',
      status,
      sort = 'newest',
      category,
      location,
      q,
      date,
      page = '1',
      perPage = '12',
    } = req.query;

    const type = view === 'lost' ? 'lost' : view === 'found' ? 'found' : undefined;
    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedPerPage = Math.max(6, Number(perPage) || 12);

    const filteredItems = await itemModel.searchItems({
      query: q,
      category,
      location,
      type,
      status,
      date,
      sort,
    });

    const totalItems = filteredItems.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / parsedPerPage));
    const offset = (parsedPage - 1) * parsedPerPage;

    adminItems = filteredItems.slice(offset, offset + parsedPerPage);
    adminStats = await itemModel.getStats();
    adminFilters = { view, status, sort, category, location, q, date };
    adminPagination = { page: parsedPage, perPage: parsedPerPage, totalPages, totalItems };
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
