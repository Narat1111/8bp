require('dotenv').config();

module.exports = {
    port: parseInt(process.env.PORT, 10) || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    jwt: {
        secret: process.env.JWT_SECRET || 'fallback_secret_change_me',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    bakong: {
        apiToken: process.env.BAKONG_API_TOKEN,
        account: process.env.BAKONG_ACCOUNT || 'chheak_narat@bkrt',
        merchantName: process.env.MERCHANT_NAME || 'NARAT CHHEAK',
    },
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    },
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    },
};
