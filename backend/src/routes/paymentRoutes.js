const express = require('express');
const router = express.Router();
const { createPayment, verifyPayment } = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { createPaymentValidation, verifyPaymentValidation } = require('../middleware/validate');
const { paymentLimiter } = require('../middleware/rateLimiter');

router.post('/create-payment', authenticate, paymentLimiter, createPaymentValidation, createPayment);
router.post('/verify-payment', authenticate, paymentLimiter, verifyPaymentValidation, verifyPayment);

module.exports = router;
