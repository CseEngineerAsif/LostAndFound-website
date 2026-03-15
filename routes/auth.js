const express = require('express');
const router = express.Router();
const userModel = require('../models/user');

router.get('/register', (req, res) => {
  res.render('register', { title: 'Register' });
});

router.post('/register', async (req, res) => {
  const { name, email, studentId, password, confirmPassword } = req.body;
  if (!name || !email || !password || password !== confirmPassword) {
    req.flash('error', 'Please provide all required fields and ensure passwords match.');
    return res.redirect('/auth/register');
  }

  const existing = await userModel.findByEmail(email);
  if (existing) {
    req.flash('error', 'Email is already registered.');
    return res.redirect('/auth/register');
  }

  try {
    const user = await userModel.createUser({ name, email, studentId, password });
    req.session.user = { id: user.id, email: user.email, name: user.name, role: user.role || 'user' };
    req.flash('success', 'Welcome! Your account has been created.');
    res.redirect('/');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to create account. Please try again.');
    res.redirect('/auth/register');
  }
});

router.get('/login', (req, res) => {
  res.render('login', { title: 'Login' });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await userModel.findByEmail(email);
  if (!user) {
    req.flash('error', 'Invalid email or password');
    return res.redirect('/auth/login');
  }

  const ok = await userModel.verifyPassword(user, password);
  if (!ok) {
    req.flash('error', 'Invalid email or password');
    return res.redirect('/auth/login');
  }

  req.session.user = { id: user.id, email: user.email, name: user.name, role: user.role || 'user' };
  req.flash('success', 'Logged in successfully');
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
