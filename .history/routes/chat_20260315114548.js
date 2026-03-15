const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth'); // Assuming you have an auth middleware

// @route   GET /chat
// @desc    Render chat page
// @access  Private
router.get('/', ensureAuthenticated, (req, res) => {
    res.render('chat', {
        title: 'Chat',
        user: req.session.user
    });
});

module.exports = router;
