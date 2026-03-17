const express = require('express');
const router = express.Router();
const itemModel = require('../models/item');
const { featuredItems } = require('../data/featured-items');

router.get('/', async (req, res) => {
  const items = await itemModel.findRecentItems(12);
  const stats = await itemModel.getStats();
  res.render('index', { title: 'Lost2Found', items, stats, featuredItems });
});

module.exports = router;
