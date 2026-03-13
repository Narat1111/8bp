require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const config = require('./config/app');
const { testConnection } = require('./config/database');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const templateRoutes = require('./routes/templateRoutes');
const unlockRoutes = require('./routes/unlockRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

// ── Global Middleware ──────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors(config.cors));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api', apiLimiter);

// ── Serve Static Frontend ─────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// Dev-mode request logging
if (config.nodeEnv === 'development') {
    app.use((req, res, next) => {
        if (req.originalUrl.startsWith('/api')) {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
        }
        next();
    });
}

// ── Health Check ──────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Digital Link Unlock API is running', version: '1.0.0', timestamp: new Date().toISOString(), environment: config.nodeEnv });
});

// ── API Routes ────────────────────────────────────────
app.use('/api', authRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/unlock', unlockRoutes);
app.use('/api/unlocks', unlockRoutes);
app.use('/api', paymentRoutes);

// ── SPA Fallback ──────────────────────────────────────
app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Error Handling ────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────
async function startServer() {
    const dbConnected = await testConnection();
    if (!dbConnected) {
        console.error('\n⚠️  Server starting without database connection.');
        console.error('   Make sure XAMPP MySQL is running and run: npm run db:init\n');
    }

    app.listen(config.port, () => {
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║     🔓 Digital Link Unlock API Server            ║');
        console.log('╠══════════════════════════════════════════════════╣');
        console.log(`║  🌐 URL:         http://localhost:${config.port}          ║`);
        console.log(`║  🔧 Environment: ${config.nodeEnv.padEnd(28)}║`);
        console.log(`║  💾 Database:    ${dbConnected ? 'Connected ✅'.padEnd(28) : 'Disconnected ❌'.padEnd(28)}║`);
        console.log('╠══════════════════════════════════════════════════╣');
        console.log('║  API Endpoints:                                  ║');
        console.log('║  ├─ POST /api/signup                             ║');
        console.log('║  ├─ POST /api/login                              ║');
        console.log('║  ├─ GET  /api/user                               ║');
        console.log('║  ├─ GET  /api/templates                          ║');
        console.log('║  ├─ POST /api/unlock                             ║');
        console.log('║  ├─ POST /api/create-payment                     ║');
        console.log('║  └─ POST /api/verify-payment                     ║');
        console.log('╚══════════════════════════════════════════════════╝\n');
    });
}

startServer();
module.exports = app;
