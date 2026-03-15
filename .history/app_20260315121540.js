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

const { init } = require('./db');
const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const indexRoutes = require('./routes/index');
const chatRoutes = require('./routes/chat');

const app = express();
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
  res.locals.currentSection = (() => {
    if (req.path === '/') return 'home';
    if (req.path.startsWith('/items/search')) return 'feed';
    if (req.path.startsWith('/items/report')) return 'report';
    if (req.path.startsWith('/items/lost')) return 'lost';
    if (req.path.startsWith('/items/found')) return 'found';
    if (req.path.startsWith('/chat')) return 'chat';
    if (req.path.startsWith('/dashboard')) return 'dashboard';
    return '';
  })();
  next();
});

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/items', itemRoutes);
app.use('/chat', chatRoutes);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

function startServer(startPort, maxAttempts = 10) {
  let port = startPort;
  const maxPort = startPort + maxAttempts;

  const tryListen = () => {
    const server = app.listen(port, () => {
      console.log(`Campus Lost & Found running at http://localhost:${port}`);
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
