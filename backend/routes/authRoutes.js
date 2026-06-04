const router = require('express').Router();
const { register, login, refresh, logout, forgotPassword, resetPassword } = require('../controllers/authController');
const { authenticateUser } = require('../middleware/auth');
const validator = require('../middleware/validator');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, validator.register, register);
router.post('/login', authLimiter, validator.login, login);
router.post('/refresh', refresh);
router.post('/logout', authenticateUser, logout);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

module.exports = router;
