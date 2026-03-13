function errorHandler(err, req, res, next) {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
    const isDev = process.env.NODE_ENV === 'development';

    if (err.name === 'SyntaxError' && err.status === 400) {
        return res.status(400).json({ success: false, message: 'Invalid JSON in request body' });
    }
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'A record with this information already exists' });
    }
    if (err.code === 'ECONNREFUSED') {
        return res.status(503).json({ success: false, message: 'Database connection failed. Please try again later.' });
    }

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(isDev && { stack: err.stack }),
    });
}

function notFoundHandler(req, res) {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
}

module.exports = { errorHandler, notFoundHandler };
