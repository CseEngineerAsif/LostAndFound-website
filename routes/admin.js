const express = require('express');
const adminModel = require('../models/admin');

const router = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.flash('info', 'Please log in to continue.');
    return res.redirect('/auth/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    req.flash('error', 'Admin access required.');
    return res.redirect('/dashboard');
  }
  next();
}

router.get('/', requireLogin, requireAdmin, async (req, res) => {
  try {
    const overview = await adminModel.getAdminOverview();
    const recentReports = await adminModel.getRecentReports(8);
    const recentUsers = await adminModel.getRecentUsers(6);
    const recentClaims = await adminModel.getRecentClaims(10);
    const pendingClaims = await adminModel.getPendingClaims(8);
    const multiClaimItems = await adminModel.getItemsWithMultipleClaims(6);

    res.render('admin', {
      title: 'Admin Dashboard',
      overview,
      recentReports,
      recentUsers,
      recentClaims,
      pendingClaims,
      multiClaimItems,
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    req.flash('error', 'Unable to load admin dashboard.');
    res.redirect('/dashboard');
  }
});

module.exports = router;
