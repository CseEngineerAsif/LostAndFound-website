module.exports = {
    ensureAuthenticated: (req, res, next) => {
        if (req.session.user) {
            return next();
        }
        req.flash('error_msg', 'Please log in to view that resource');
        res.redirect('/auth/login');
    }
};
