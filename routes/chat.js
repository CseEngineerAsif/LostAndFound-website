const express = require('express');
const router = express.Router();
const messageModel = require('../models/message');
const userModel = require('../models/user');


const chatClients = new Map();

function addClient(userId, res) {
  const id = String(userId);
  if (!chatClients.has(id)) {
    chatClients.set(id, new Set());
  }
  chatClients.get(id).add(res);
}

function removeClient(userId, res) {
  const id = String(userId);
  const set = chatClients.get(id);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    chatClients.delete(id);
  }
}

function sendEvent(userId, event, payload) {
  const id = String(userId);
  const set = chatClients.get(id);
  if (!set || set.size === 0) return;
  const data = `event: ${event}\n` + `data: ${JSON.stringify(payload)}\n\n`;
  set.forEach((res) => {
    res.write(data);
  });
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.flash('info', 'Please log in to continue.');
    return res.redirect('/auth/login');
  }
  next();
}


router.get('/stream', requireLogin, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const userId = req.session.user.id;
  addClient(userId, res);

  res.write('event: ready\n');
  res.write('data: {}\n\n');

  req.on('close', () => {
    removeClient(userId, res);
  });
});

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


router.get('/history/:otherId', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const otherId = req.params.otherId;
  const messages = await messageModel.getMessages(userId, otherId);
  res.json(
    messages.map((msg) => ({
      sender: msg.senderId,
      message: msg.content,
      createdAt: msg.createdAt
    }))
  );
});

router.get('/:otherId', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const otherId = req.params.otherId;
  await messageModel.markConversationRead(userId, otherId);

  const conversations = await messageModel.getConversations(userId);
  const messages = await messageModel.getMessages(userId, otherId);
  
  let activeChatUser = conversations.find(c => String(c.userId) === String(otherId));
  
  if (!activeChatUser) {
    const user = await userModel.findById(Number(otherId));
    activeChatUser = { 
      userId: otherId, 
      name: user ? user.name : 'User' 
    };
  }

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



router.post('/typing', requireLogin, async (req, res) => {
  const { recipientId } = req.body;
  if (recipientId) {
    sendEvent(recipientId, 'typing', {
      senderId: req.session.user.id,
      senderName: req.session.user.name
    });
  }
  res.json({ success: true });
});

router.post('/stop-typing', requireLogin, async (req, res) => {
  const { recipientId } = req.body;
  if (recipientId) {
    sendEvent(recipientId, 'stop-typing', {
      senderId: req.session.user.id
    });
  }
  res.json({ success: true });
});

router.post('/read', requireLogin, async (req, res) => {
  const { otherId } = req.body;
  if (otherId) {
    await messageModel.markConversationRead(req.session.user.id, otherId);
  }
  res.json({ success: true });
});

router.post('/send', requireLogin, async (req, res) => {
  const { recipientId, recipientName, content } = req.body;
  const message = await messageModel.createMessage({
    senderId: req.session.user.id,
    senderName: req.session.user.name,
    recipientId,
    recipientName,
    content
  });

  if (recipientId) {
    sendEvent(recipientId, 'chat-message', {
      sender: req.session.user.id,
      senderName: req.session.user.name,
      recipient: recipientId,
      message: content,
      createdAt: message.createdAt
    });
  }

  res.json({ success: true });
});

module.exports = router;
