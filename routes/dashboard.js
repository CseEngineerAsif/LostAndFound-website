const express = require('express');
const router = express.Router();
const itemModel = require('../models/item');
const messageModel = require('../models/message');

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
  let claimRequests = [];
  let myClaims = [];
  let claimHistory = [];

  try {
    // Fetch items reported by the current user
    if (typeof itemModel.getItemsByUser === 'function') {
      myItems = await itemModel.getItemsByUser(userId);
    } else {
      console.warn('itemModel.getItemsByUser is not defined. Dashboard items may not load.');
    }

    if (typeof itemModel.getClaimRequestsForOwner === 'function') {
      claimRequests = await itemModel.getClaimRequestsForOwner(userId);
    }

    if (typeof itemModel.getClaimsByClaimant === 'function') {
      myClaims = await itemModel.getClaimsByClaimant(userId);
    }

    if (typeof itemModel.getClaimHistoryForOwner === 'function') {
      claimHistory = await itemModel.getClaimHistoryForOwner(userId);
    }

    if (typeof itemModel.markClaimDecisionsSeenForClaimant === 'function') {
      await itemModel.markClaimDecisionsSeenForClaimant(userId);
    }

    // Return reminder: 5-day deadline coming within 24 hours
    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;
    for (const item of myItems) {
      for (const claim of item.claims || []) {
        if (claim.returnStatus !== 'requested') continue;
        if (!claim.returnDueAt) continue;
        if (claim.returnReminderSentAt) continue;
        const dueAt = new Date(claim.returnDueAt);
        if (Number.isNaN(dueAt.getTime())) continue;
        if (dueAt.getTime() - now.getTime() > oneDayMs) continue;

        await messageModel.createMessage({
          senderId: 0,
          senderName: 'System',
          recipientId: userId,
          recipientName: req.session.user.name,
          content: `Reminder: Return for "${item.name}" is due by ${dueAt.toLocaleDateString()}. Please collect the item back.`,
        });

        if (typeof itemModel.markReturnReminderSent === 'function') {
          await itemModel.markReturnReminderSent(item.id, claim.id);
        }
      }
    }
  } catch (err) {
    console.error('Error fetching dashboard items:', err);
  }

  res.render('dashboard', {
    title: 'Dashboard',
    myItems,
    claimRequests,
    myClaims,
    claimHistory,
    user: req.session.user
  });
});

module.exports = router;
