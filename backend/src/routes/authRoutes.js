const express = require('express');
const router = express.Router();
const { signup, login, getUser } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { signupValidation, loginValidation } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/signup', authLimiter, signupValidation, signup);
router.post('/login', authLimiter, loginValidation, login);
router.get('/user', authenticate, getUser);

module.exports = router;
