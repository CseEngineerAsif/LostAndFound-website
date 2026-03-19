const express = require('express');
const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../services/cloudinary');
const itemModel = require('../models/item');
const messageModel = require('../models/message');
const { getFeaturedItem } = require('../data/featured-items');

const router = express.Router();

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: process.env.CLOUDINARY_FOLDER || 'lost2found',
    resource_type: 'image',
    public_id: (req, file) => {
      const base = path.parse(file.originalname).name.replace(/\s+/g, '-');
      return `${Date.now()}-${base}`;
    },
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype) return cb(null, true);
    cb(new Error('Only images (jpeg, jpg, png, webp) are allowed!'));
  }
});

function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.flash('info', 'Please log in to continue.');
    return res.redirect('/auth/login');
  }
  next();
}

function normalizeAnswer(value) {
  return (value || '').trim().toLowerCase();
}

function computeConfidenceScore({ proofProvided, itemDate, claimedDate, expectedAnswers, claimantAnswers }) {
  const totalQuestions = expectedAnswers.length;
  let correctAnswers = 0;
  const answerMatches = expectedAnswers.map((expected, index) => {
    const expectedValue = normalizeAnswer(expected);
    const claimantValue = normalizeAnswer(claimantAnswers[index]);
    if (!expectedValue || !claimantValue) return false;
    const matched =
      claimantValue === expectedValue ||
      claimantValue.includes(expectedValue) ||
      expectedValue.includes(claimantValue);
    if (matched) correctAnswers += 1;
    return matched;
  });

  let timelineMatch = false;
  if (itemDate && claimedDate) {
    const itemTime = new Date(itemDate).getTime();
    const claimedTime = new Date(claimedDate).getTime();
    if (!Number.isNaN(itemTime) && !Number.isNaN(claimedTime)) {
      const diffDays = Math.abs(itemTime - claimedTime) / (1000 * 60 * 60 * 24);
      timelineMatch = diffDays <= 1;
    }
  }

  const proofPoints = proofProvided ? 40 : 0;
  const answerPoints = totalQuestions
    ? Math.round((correctAnswers / totalQuestions) * 40)
    : 0;
  const timelinePoints = timelineMatch ? 20 : 0;
  const total = proofPoints + answerPoints + timelinePoints;

  return {
    total,
    proofPoints,
    answerPoints,
    timelinePoints,
    correctAnswers,
    totalQuestions,
    answerMatches,
    timelineMatch,
  };
}

router.get('/report', requireLogin, (req, res) => {
  const prefillType = req.query.type === 'found' ? 'found' : 'lost';
  res.render('report', { title: 'Post Item', prefillType });
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
    returnInfo,
    returnBy,
    verifyQuestion1,
    verifyAnswer1,
  } = req.body;
  const photoPath = req.file ? req.file.path : null;
  const verificationQuestions = [
    { question: (verifyQuestion1 || '').trim(), answer: (verifyAnswer1 || '').trim() },
  ].filter((entry) => entry.question && entry.answer);

  try {
    if (verificationQuestions.length < 1) {
      req.flash('error', 'Please provide a verification question with an answer.');
      return res.redirect('/items/report');
    }

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
      returnInfo: (returnInfo || '').trim(),
      returnBy: (returnBy || '').trim(),
      verificationQuestions,
      status: 'reported',
    });

    req.flash('success', 'Item reported successfully.');
    const redirectUrl = type === 'found' ? '/items/found' : '/items/lost';
    res.redirect(redirectUrl);
  } catch (error) {
    req.flash('error', 'Failed to report item. Please try again.');
    res.redirect('/items/report');
  }
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

router.get('/lost', async (req, res) => {
  const { q, category, location, status, sort, date } = req.query;
  let items = await itemModel.searchItems({
    query: q,
    category,
    location,
    type: 'lost',
    status,
    date,
    sort: sort || 'newest',
  });
  if (!status) {
    items = items.filter((item) => item.status !== 'resolved');
  }
  res.render('lost', {
    title: 'Lost Items',
    items,
    filters: { q, category, location, type: 'lost', status, sort: sort || 'newest', date },
  });
});

router.get('/found', async (req, res) => {
  const { q, category, location, status, sort, date } = req.query;
  let items = await itemModel.searchItems({
    query: q,
    category,
    location,
    type: 'found',
    status,
    date,
    sort: sort || 'newest',
  });
  if (!status) {
    items = items.filter((item) => item.status !== 'resolved');
  }
  res.render('found', {
    title: 'Found Items',
    items,
    filters: { q, category, location, type: 'found', status, sort: sort || 'newest', date },
  });
});

router.get('/returned', async (req, res) => {
  const { q, category, location, type, sort, date } = req.query;
  const items = await itemModel.searchItems({
    query: q,
    category,
    location,
    type,
    status: 'resolved',
    date,
    sort: sort || 'newest',
  });
  res.render('returned', {
    title: 'Returned Items',
    items,
    filters: { q, category, location, type, status: 'resolved', sort: sort || 'newest', date },
  });
});

router.get('/featured/:slug', (req, res) => {
  const featured = getFeaturedItem(req.params.slug);
  if (!featured) return res.status(404).render('404', { title: 'Not Found' });

  const item = {
    id: `featured-${featured.slug}`,
    name: featured.name,
    type: featured.type,
    status: featured.status,
    category: featured.category,
    location: featured.location,
    dateLost: featured.dateLost,
    contactMethod: featured.contactMethod,
    anonymous: featured.anonymous,
    reportedByName: featured.reportedByName,
    description: featured.description,
    photoPath: featured.photoPath,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    userId: 0,
  };

  res.render('item', { title: featured.name, item, isOwner: false, matches: [] });
});

router.get('/:id/chat', requireLogin, async (req, res) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) return res.status(404).render('404', { title: 'Not Found' });

  if (!item.userId) {
    req.flash('error', 'Cannot chat with the reporter of this item.');
    return res.redirect(`/items/${item.id}`);
  }

  // Prevent user from chatting with themselves
  if (req.session.user && String(item.userId) === String(req.session.user.id)) {
    req.flash('info', 'You cannot chat with yourself.');
    return res.redirect(`/items/${item.id}`);
  }

  res.redirect(`/chat/${item.userId}`);
});

router.post('/:id/chat', requireLogin, async (req, res) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) return res.status(404).render('404', { title: 'Not Found' });

  if (!item.userId) {
    req.flash('error', 'Cannot chat with the reporter of this item.');
    return res.redirect(`/items/${item.id}`);
  }

  if (req.session.user && String(item.userId) === String(req.session.user.id)) {
    req.flash('info', 'You cannot chat with yourself.');
    return res.redirect(`/items/${item.id}`);
  }

  if (req.body.message) {
    await messageModel.createMessage({
      senderId: req.session.user.id,
      senderName: req.session.user.name,
      recipientId: item.userId,
      recipientName: item.reportedByName || 'User',
      content: req.body.message
    });
  }

  res.redirect(`/chat/${item.userId}`);
});

router.post('/:id/claim', requireLogin, upload.single('proof'), async (req, res) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) return res.status(404).render('404', { title: 'Not Found' });

  if (req.session.user && String(item.userId) === String(req.session.user.id)) {
    req.flash('info', 'You cannot claim your own item.');
    return res.redirect(`/items/${item.id}`);
  }

  const description = (req.body.description || '').trim();
  const claimedDate = (req.body.claimedDate || '').trim();
  const answersRaw = req.body.answers || [];
  const claimantAnswers = Array.isArray(answersRaw) ? answersRaw.map((ans) => (ans || '').trim()) : [(answersRaw || '').trim()];
  const verificationQuestions = item.verificationQuestions || [];
  if (verificationQuestions.length) {
    const providedCount = claimantAnswers.filter((ans) => ans).length;
    if (providedCount < verificationQuestions.length) {
      req.flash('error', 'Please answer all verification questions.');
      return res.redirect(`/items/${item.id}`);
    }
  }
  const proofPath = req.file ? req.file.path : null;
  if (!description && !proofPath) {
    req.flash('error', 'Please provide a description or upload a proof photo.');
    return res.redirect(`/items/${item.id}`);
  }

  const expectedAnswers = verificationQuestions.map((entry) => entry.answer || '');
  const score = computeConfidenceScore({
    proofProvided: Boolean(proofPath),
    itemDate: item.dateLost,
    claimedDate,
    expectedAnswers,
    claimantAnswers,
  });

  await itemModel.addClaim(item.id, {
    id: Date.now().toString(),
    claimantId: req.session.user.id,
    claimantName: req.session.user.name,
    description,
    claimedDate: claimedDate || null,
    proofPath,
    status: 'pending',
    answers: claimantAnswers,
    score,
    createdAt: new Date().toISOString(),
  });

  req.flash('success', 'Claim request sent. The reporter will review it.');
  res.redirect(`/items/${item.id}`);
});

router.post('/:id/claim/:claimId/accept', requireLogin, async (req, res) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) return res.status(404).render('404', { title: 'Not Found' });

  const isOwner = String(item.userId) === String(req.session.user.id);
  const isAdmin = req.session.user && req.session.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    req.flash('error', 'You do not have permission to update this claim.');
    return res.redirect('/dashboard');
  }

  await itemModel.updateClaimStatus(item.id, req.params.claimId, 'accepted');
  const claim = (item.claims || []).find((c) => String(c.id) === String(req.params.claimId));
  if (claim) {
    const returnInfo = item.returnInfo ? `Return location: ${item.returnInfo}` : 'Return location: (not specified)';
    const returnBy = item.returnBy ? `Handled by: ${item.returnBy}` : `Handled by: ${item.reportedByName || 'Reporter'}`;
    const messageText = `Your claim for "${item.name}" was accepted. ${returnInfo}. ${returnBy}. If this is not yours, request a return within 72 hours and return the item within 5 days.`;
    await messageModel.createMessage({
      senderId: req.session.user.id,
      senderName: req.session.user.name,
      recipientId: claim.claimantId,
      recipientName: claim.claimantName,
      content: messageText,
    });
  }
  req.flash('success', 'Claim accepted. The item has been marked as returned.');
  res.redirect('/dashboard');
});

router.post('/:id/claim/:claimId/deny', requireLogin, async (req, res) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) return res.status(404).render('404', { title: 'Not Found' });

  const isOwner = String(item.userId) === String(req.session.user.id);
  const isAdmin = req.session.user && req.session.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    req.flash('error', 'You do not have permission to update this claim.');
    return res.redirect('/dashboard');
  }

  await itemModel.updateClaimStatus(item.id, req.params.claimId, 'denied');
  req.flash('info', 'Claim denied.');
  res.redirect('/dashboard');
});

router.post('/:id/claim/:claimId/return-request', requireLogin, async (req, res) => {
  const result = await itemModel.requestClaimReturn(req.params.id, req.params.claimId, req.session.user.id);
  if (!result.ok) {
    const message =
      result.reason === 'window_closed'
        ? 'Return window has closed (72 hours).'
        : 'Unable to request return.';
    req.flash('error', message);
    return res.redirect('/dashboard');
  }

  const { item, claim } = result;
  const dueDate = claim.returnDueAt ? new Date(claim.returnDueAt).toLocaleDateString() : 'within 5 days';
  const reporterId = item.userId;
  const reporterName = item.reportedByName || 'Reporter';
  const messageText = `Return requested for "${item.name}". Please collect the item back by ${dueDate}.`;
  await messageModel.createMessage({
    senderId: req.session.user.id,
    senderName: req.session.user.name,
    recipientId: reporterId,
    recipientName: reporterName,
    content: messageText,
  });

  req.flash('info', 'Return request sent. Please return the item within 5 days.');
  res.redirect('/dashboard');
});

router.post('/:id/claim/:claimId/return-confirm', requireLogin, async (req, res) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) return res.status(404).render('404', { title: 'Not Found' });

  const isOwner = String(item.userId) === String(req.session.user.id);
  const isAdmin = req.session.user && req.session.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    req.flash('error', 'You do not have permission to confirm returns.');
    return res.redirect('/dashboard');
  }

  const result = await itemModel.confirmClaimReturn(req.params.id, req.params.claimId, req.session.user.id);
  if (!result.ok) {
    req.flash('error', 'Unable to confirm return.');
    return res.redirect('/dashboard');
  }

  const { claim } = result;
  const messageText = `Return confirmed for "${item.name}". Thanks for helping keep the community safe.`;
  await messageModel.createMessage({
    senderId: req.session.user.id,
    senderName: req.session.user.name,
    recipientId: claim.claimantId,
    recipientName: claim.claimantName,
    content: messageText,
  });

  req.flash('success', 'Return confirmed. Item reopened for new claims.');
  res.redirect('/dashboard');
});

router.get('/:id', async (req, res) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) return res.status(404).render('404', { title: 'Not Found' });
  const isOwner = req.session.user && String(req.session.user.id) === String(item.userId);
  const matches = await itemModel.findSimilarItems(item, 3);
  res.render('item', { 
    title: item.name, 
    item, 
    isOwner, 
    matches, 
    currentUser: req.session.user || null,
    editMode: req.query.edit === 'true'
  });
});

router.post('/:id/status', requireLogin, async (req, res) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) return res.status(404).render('404', { title: 'Not Found' });

  const isOwner = String(item.userId) === String(req.session.user.id);
  const isAdmin = req.session.user && req.session.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    req.flash('error', 'You do not have permission to update this report.');
    return res.redirect(`/items/${item.id}`);
  }

  const { status } = req.body;
  const allowed = ['reported', 'resolved'];
  if (!allowed.includes(status)) {
    req.flash('error', 'Invalid status update.');
    return res.redirect(`/items/${item.id}`);
  }

  if (status === 'resolved' && !isAdmin && !item.returnAdminConfirmedAt) {
    req.flash('error', 'Awaiting admin confirmation before marking this as returned.');
    return res.redirect(`/items/${item.id}`);
  }

  await itemModel.updateStatus(item.id, status);
  req.flash('success', 'Status updated successfully.');
  res.redirect(`/items/${item.id}`);
});

router.post('/:id/return-admin', requireLogin, async (req, res) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) return res.status(404).render('404', { title: 'Not Found' });

  const isAdmin = req.session.user && req.session.user.role === 'admin';
  if (!isAdmin) {
    req.flash('error', 'Only admins can confirm returns.');
    return res.redirect(`/items/${item.id}`);
  }

  await itemModel.markReturnAdminConfirmed(item.id, req.session.user.id);
  req.flash('success', 'Admin return recorded. The owner can now mark it as returned.');
  res.redirect(`/items/${item.id}`);
});

router.post('/:id/return-success', requireLogin, async (req, res) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) return res.status(404).render('404', { title: 'Not Found' });

  const isOwner = String(item.userId) === String(req.session.user.id);
  if (!isOwner) {
    req.flash('error', 'Only the original owner can confirm a successful return.');
    return res.redirect(`/items/${item.id}`);
  }

  if (!item.returnAdminConfirmedAt) {
    req.flash('error', 'Awaiting admin confirmation before marking this as returned.');
    return res.redirect(`/items/${item.id}`);
  }

  await itemModel.markReturnUserConfirmed(item.id, req.session.user.id);
  req.flash('success', 'Return confirmed. Thank you for updating the status.');
  res.redirect(`/items/${item.id}`);
});

router.post('/:id/delete', requireLogin, async (req, res) => {
  const isAdmin = req.session.user && req.session.user.role === 'admin';
  if (!isAdmin) {
    req.flash('error', 'Only admins can delete reports.');
    return res.redirect('/dashboard');
  }

  const success = await itemModel.deleteItem(req.params.id);
  if (!success) {
    req.flash('error', 'Report not found.');
    return res.redirect('/dashboard');
  }

  req.flash('success', 'Report deleted successfully.');
  res.redirect('/dashboard');
});

router.post('/:id/update', requireLogin, upload.single('photo'), async (req, res) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) return res.status(404).render('404', { title: 'Not Found' });

  const isOwner = String(item.userId) === String(req.session.user.id);
  const isAdmin = req.session.user && req.session.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    req.flash('error', 'You do not have permission to update this report.');
    return res.redirect(`/items/${item.id}`);
  }

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

  const photoPath = req.file ? req.file.path : item.photoPath;

  await itemModel.updateItem(req.params.id, {
    type,
    name,
    description,
    location,
    dateLost,
    category,
    contactMethod,
    anonymous: anonymous === 'true',
    photoPath,
  });

  req.flash('success', 'Item updated successfully.');
  res.redirect(`/items/${item.id}`);
});

module.exports = router;
