const express = require('express');
const router = express.Router();
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
  const conversations = await messageModel.getConversations(userId);
  
  res.render('chat', {
    title: 'My Chats',
    user: req.session.user,
    conversations,
    activeChat: null,
    currentUser: req.session.user
  });
});

router.get('/:otherId', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const otherId = req.params.otherId;
  const conversations = await messageModel.getConversations(userId);
  const messages = await messageModel.getMessages(userId, otherId);
  
  const activeChatUser = conversations.find(c => String(c.userId) === String(otherId)) || { userId: otherId, name: 'User' };

  res.render('chat', {
    title: `Chat with ${activeChatUser.name}`,
    user: req.session.user,
    conversations,
    activeChat: {
        user: activeChatUser,
        messages
    },
    currentUser: req.session.user
  });
});

router.post('/send', requireLogin, async (req, res) => {
  const { recipientId, recipientName, content } = req.body;
  await messageModel.createMessage({
    senderId: req.session.user.id,
    senderName: req.session.user.name,
    recipientId,
    recipientName,
    content
  });
  res.json({ success: true });
});

module.exports = router;
