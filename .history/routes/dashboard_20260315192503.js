const express = require('express');
const router = express.Router();
const itemModel = require('../models/item');

function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.flash('info', 'Please log in to continue.');
    return res.redirect('/auth/login');
  }
  next();
}

router.get('/', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  let myItems = [];

  try {
    // Fetch items reported by the current user
    if (typeof itemModel.getItemsByUser === 'function') {
      myItems = await itemModel.getItemsByUser(userId);
    } else {
      console.warn('itemModel.getItemsByUser is not defined. Dashboard items may not load.');
    }
  } catch (err) {
    console.error('Error fetching dashboard items:', err);
  }

  res.render('dashboard', {
    title: 'Dashboard',
    myItems,
    user: req.session.user
  });
});

module.exports = router;