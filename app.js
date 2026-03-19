require('dotenv').config();

const util = require('util');
// Prevent deprecated util.isArray warnings from older dependencies.
if (typeof util.isArray === 'function') {
  util.isArray = Array.isArray;
}

const path = require('path');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const http = require('http');
const { Server } = require('socket.io');

const { init } = require('./db');
const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const indexRoutes = require('./routes/index');
const chatRoutes = require('./routes/chat');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const messageModel = require('./models/message');
const itemModel = require('./models/item');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

init().catch((err) => {
  console.error('Failed to initialize database', err);
  process.exit(1);
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');
app.use(expressLayouts);

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'campus-lost-found-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

app.use(flash());

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.messages = req.flash();
  res.locals.currentPath = req.path;
  res.locals.unreadChatCount = 0;
  res.locals.claimDecisionCount = 0;
  res.locals.currentSection = (() => {
    if (req.path === '/') return 'home';
    if (req.path.startsWith('/items/search')) return 'feed';
    if (req.path.startsWith('/items/report')) return 'report';
    if (req.path.startsWith('/items/lost')) return 'lost';
    if (req.path.startsWith('/items/found')) return 'found';
    if (req.path.startsWith('/chat')) return 'chat';
    if (req.path.startsWith('/dashboard')) return 'dashboard';
    if (req.path.startsWith('/admin')) return 'admin';
    return '';
  })();

  if (req.session.user) {
    Promise.all([
      messageModel.getUnreadCount(req.session.user.id),
      itemModel.getClaimDecisionCountForClaimant(req.session.user.id),
    ])
      .then(([chatCount, claimCount]) => {
        res.locals.unreadChatCount = chatCount;
        res.locals.claimDecisionCount = claimCount;
        next();
      })
      .catch((err) => {
        console.error('Unread count error:', err);
        next();
      });
  } else {
    next();
  }
});

const shouldLogChat = process.env.NODE_ENV !== 'production';
const logChat = (...args) => {
  if (shouldLogChat) console.log(...args);
};

io.on('connection', (socket) => {
  logChat('A user connected:', socket.id);

  // The client sends 'user online' with their ID. We can use this to join a private room.
  socket.on('user online', (userId) => {
    if (userId) {
      socket.join(String(userId));
      logChat(`User ${userId} joined their private room.`);
    }
  });


  socket.on('typing', (data) => {
    if (data && data.recipientId) {
      socket.to(String(data.recipientId)).emit('typing', {
        senderId: data.senderId,
        senderName: data.senderName
      });
    }
  });

  socket.on('stop typing', (data) => {
    if (data && data.recipientId) {
      socket.to(String(data.recipientId)).emit('stop typing', {
        senderId: data.senderId
      });
    }
  });

  // Listen for a chat message
  socket.on('chat message', (data) => {
    // data contains { sender, senderName, recipient, message }
    if (data.recipient) {
      // Emit the message only to the recipient's room
      socket.to(String(data.recipient)).emit('chat message', {
        sender: data.sender,
        message: data.message,
        senderName: data.senderName,
      });
    }
  });

  socket.on('disconnect', () => {
    logChat('User disconnected:', socket.id);
  });
});

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/items', itemRoutes);
app.use('/chat', chatRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

function startServer(startPort, maxAttempts = 10) {
  let port = startPort;
  const maxPort = startPort + maxAttempts;

  const tryListen = () => {
    server.listen(port, () => {
      console.log(`Lost2Found running at http://localhost:${port}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && port < maxPort) {
        console.warn(`Port ${port} is in use. Trying ${port + 1}...`);
        port += 1;
        setTimeout(tryListen, 200);
      } else {
        console.error('Failed to start server:', err);
        process.exit(1);
      }
    });
  };

  tryListen();
}

startServer(PORT);
