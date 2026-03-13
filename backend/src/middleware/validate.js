const { body, validationResult } = require('express-validator');

function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map((err) => ({ field: err.path, message: err.msg })),
        });
    }
    next();
}

const signupValidation = [
    body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail().isLength({ max: 255 }).withMessage('Email must not exceed 255 characters'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    handleValidationErrors,
];

const loginValidation = [
    body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors,
];

const unlockValidation = [
    body('template_id').isInt({ min: 1 }).withMessage('Valid template_id is required'),
    handleValidationErrors,
];

const createPaymentValidation = [
    body('template_id').isInt({ min: 1 }).withMessage('Valid template_id is required'),
    handleValidationErrors,
];

const verifyPaymentValidation = [
    body('transaction_id').notEmpty().withMessage('transaction_id is required').isString().withMessage('transaction_id must be a string').trim(),
    handleValidationErrors,
];

module.exports = { signupValidation, loginValidation, unlockValidation, createPaymentValidation, verifyPaymentValidation, handleValidationErrors };
