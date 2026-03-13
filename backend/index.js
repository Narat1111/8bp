const express = require('express');
const cors = require('cors');
const db = require('./db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const { BakongKHQR, IndividualInfo } = require('bakong-khqr');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

// Ensure contacts table exists
db.query(`
    CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`).catch(err => console.error("Auto table creation error", err));

// Admin login route
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const result = await db.query('SELECT * FROM admins WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            // Fallback for demo if db setup failed but we still want to show working login
            if (username === 'admin' && password === 'admin') {
                const token = jwt.sign({ id: 999, username: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
                return res.json({ token, message: 'Logged in successfully (Demo fallback)' });
            }
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const admin = result.rows[0];
        const match = await bcrypt.compare(password, admin.password_hash);

        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, message: 'Logged in successfully' });
    } catch (err) {
        console.error(err);
        // Fallback for demo if DB is completely offline
        if (username === 'admin' && password === 'admin') {
            const token = jwt.sign({ id: 999, username: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
            return res.json({ token, message: 'Logged in successfully (DB Offline Mode)' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Middleware to protect admin routes
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Invalid token format' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Failed to authenticate token' });
    }
};

// Admin Endpoints for Products
app.post('/api/admin/products', authenticateAdmin, async (req, res) => {
    const { name, description, price, image_url } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO products (name, description, price, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, description, price, image_url]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, description, price, image_url } = req.body;
    try {
        const result = await db.query(
            'UPDATE products SET name = $1, description = $2, price = $3, image_url = $4 WHERE id = $5 RETURNING *',
            [name, description, price, image_url, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM products WHERE id = $1', [id]);
        res.json({ message: 'Product deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error (ensure no licenses depend on this)' });
    }
});

// Admin Endpoints for Orders
app.get('/api/admin/orders', authenticateAdmin, async (req, res) => {
    try {
        const query = `
            SELECT o.id, o.customer_email as customer, p.name as product, o.total_price as price, o.created_at, l.is_sold
            FROM orders o
            JOIN products p ON o.product_id = p.id
            JOIN licenses l ON o.license_id = l.id
            ORDER BY o.created_at DESC
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const activeProducts = await db.query('SELECT COUNT(*) FROM products');
        const totalOrders = await db.query('SELECT COUNT(*) FROM orders');
        const revenue = await db.query('SELECT SUM(total_price) FROM orders');
        
        res.json({
            activeProducts: parseInt(activeProducts.rows[0].count),
            totalOrders: parseInt(totalOrders.rows[0].count),
            totalRevenue: revenue.rows[0].sum || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Public Endpoint for Contact form
app.post('/api/contact', async (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'All fields required' });
    try {
        await db.query('INSERT INTO contacts (name, email, message) VALUES ($1, $2, $3)', [name, email, message]);
        res.json({ success: true, message: 'Message sent successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to send message.' });
    }
});

// Admin Endpoint for Contacts
app.get('/api/admin/contacts', authenticateAdmin, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM contacts ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/admin/contacts/:id', authenticateAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM contacts WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin Endpoint for Unique Customers
app.get('/api/admin/customers', authenticateAdmin, async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT customer_email as email, COUNT(id) as total_orders, SUM(total_price) as total_spent, MAX(created_at) as last_order 
            FROM orders 
            GROUP BY customer_email 
            ORDER BY last_order DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all product types (e.g., Facebook, TikTok, YouTube)
app.get('/api/products', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM products ORDER BY id ASC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Temporary memory storage for pending payments
const pendingPayments = {};

// Generate KHQR Code for a product
app.post('/api/payment/generate', async (req, res) => {
    const { productId, email } = req.body;
    if (!productId || !email) {
        return res.status(400).json({ error: 'Product ID and email are required.' });
    }

    try {
        // Get the actual product price
        const productRes = await db.query('SELECT name, price FROM products WHERE id = $1', [productId]);
        if (productRes.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found in database.' });
        }
        const product = productRes.rows[0];

        // Generate KHQR
        const khqr = new BakongKHQR();
        const info = new IndividualInfo(
            'chheak_narat@bkrt',
            'CHHEAK NARAT',
            'Phnom Penh',
            {
                currency: '840', // USD
                amount: parseFloat(product.price),
                expirationTimestamp: (Date.now() + 2 * 60 * 1000).toString()
            }
        );
        
        const result = khqr.generateIndividual(info);
        if (result.status.code !== 0) {
            return res.status(500).json({ 
                error: 'Failed to generate QR code via Bakong API', 
                bakongError: result.status.message 
            });
        }

        const qrData = result.data.qr;
        const md5 = result.data.md5;

        // Store pending logic linked to MD5
        pendingPayments[md5] = { productId, email, created: Date.now() };

        res.json({
            success: true,
            qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrData)}`,
            md5: md5,
            qrData: qrData
        });
    } catch (err) {
        console.error("QR Generation Error:", err);
        // Catch DB connection errors specifically or generic errors
        const errorMessage = err.code === 'ECONNREFUSED' 
            ? 'Database connection refused. Please ensure PostgreSQL is running.' 
            : (err.message || 'Internal server error while generating QR.');
            
        res.status(500).json({ error: errorMessage, details: err.stack });
    }
});

// Check Payment Status (Polling)
app.get('/api/payment/check', async (req, res) => {
    const { md5 } = req.query;
    if (!md5) return res.status(400).json({ error: 'MD5 is required' });

    try {
        // Query the live external Bakong payment verification
        const mmotoolRes = await axios.get(`https://mmotool.dev/check_payment.php?md5=${encodeURIComponent(md5)}`);
        const status = mmotoolRes.data.status || 'UNPAID';

        // If newly PAID, finalize the order and deliver the key
        if (status === 'PAID' && pendingPayments[md5]) {
            const { productId, email } = pendingPayments[md5];

            await db.query('BEGIN');
            const licRes = await db.query(
                'SELECT id, key_value FROM licenses WHERE product_id = $1 AND is_sold = false LIMIT 1 FOR UPDATE SKIP LOCKED',
                [productId]
            );

            if (licRes.rows.length > 0) {
                const licenseId = licRes.rows[0].id;
                const keyValue = licRes.rows[0].key_value;

                await db.query(
                    'UPDATE licenses SET is_sold = true, sold_to_email = $1, sold_at = NOW() WHERE id = $2',
                    [email, licenseId]
                );

                await db.query(
                    'INSERT INTO orders (product_id, license_id, customer_email, total_price) VALUES ($1, $2, $3, (SELECT price FROM products WHERE id = $1))',
                    [productId, licenseId, email]
                );
                
                // Store license key back into memory so frontend can retrieve it on success
                pendingPayments[md5].licenseKey = keyValue;
                pendingPayments[md5].delivered = true;
            } else {
                // Sold out scenarios could be handled with refunds in production
                pendingPayments[md5].error = 'Sold out after payment';
            }

            await db.query('COMMIT');
            
            // Send email to the user with the product details and license key
            if (pendingPayments[md5].delivered) {
                try {
                    const productInfoRes = await db.query('SELECT name, image_url FROM products WHERE id = $1', [productId]);
                    const productName = productInfoRes.rows[0]?.name || 'Your Digital Product';
                    const fileUrl = productInfoRes.rows[0]?.image_url || 'N/A';
                    
                    const myHeaders = new Headers();
                    myHeaders.append("Authorization", "App baad232be6e622fa146a681cc521416d-382e0e64-68b9-4328-8ff8-a245368f5542");
                    myHeaders.append("Content-Type", "application/json");
                    myHeaders.append("Accept", "application/json");

                    const raw = JSON.stringify({
                        "messages": [
                            {
                                "destinations": [
                                    {
                                        "to": [
                                            {
                                                "destination": email
                                            }
                                        ]
                                    }
                                ],
                                "sender": "SocialKeys",
                                "content": {
                                    "subject": `Your Purchase: ${productName}`,
                                    "text": `Payment Successful!\n\nProduct: ${productName}\nFile/Image URL: ${fileUrl}\nLicense Key / Password: ${pendingPayments[md5].licenseKey}\n\nThank you for choosing us!`
                                }
                            }
                        ]
                    });

                    const requestOptions = {
                        method: "POST",
                        headers: myHeaders,
                        body: raw,
                        redirect: "follow"
                    };

                    fetch("https://vy3lve.api.infobip.com/email/4/messages", requestOptions)
                        .then((response) => response.text())
                        .then((result) => console.log("Infobip Email Result:", result))
                        .catch((error) => console.error("Infobip Email Error:", error));
                } catch (emailErr) {
                    console.error('Failed to send email:', emailErr);
                }
            }
        }

        res.json({ 
            status, 
            licenseKey: pendingPayments[md5] ? pendingPayments[md5].licenseKey : null,
            error: pendingPayments[md5] ? pendingPayments[md5].error : null
        });
    } catch (err) {
        console.error('Payment polling error:', err.message);
        res.json({ status: 'UNPAID' });
    }
});

// Deprecated direct purchase route (kept for fallback demo if needed)
app.post('/api/purchase', async (req, res) => {
    const { productId, email } = req.body;
    if (!productId || !email) {
        return res.status(400).json({ error: 'Product ID and email are required.' });
    }

    try {
        await db.query('BEGIN');

        // Find an available license key
        const result = await db.query(
            'SELECT id, key_value FROM licenses WHERE product_id = $1 AND is_sold = false LIMIT 1 FOR UPDATE SKIP LOCKED',
            [productId]
        );

        if (result.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'No available licenses for this product right now.' });
        }

        const licenseId = result.rows[0].id;
        const keyValue = result.rows[0].key_value;

        // Mark as sold and associate with email
        await db.query(
            'UPDATE licenses SET is_sold = true, sold_to_email = $1, sold_at = NOW() WHERE id = $2',
            [email, licenseId]
        );

        // Record the order
        await db.query(
            'INSERT INTO orders (product_id, license_id, customer_email, total_price) VALUES ($1, $2, $3, (SELECT price FROM products WHERE id = $1))',
            [productId, licenseId, email]
        );

        await db.query('COMMIT');

        res.json({ message: 'Purchase successful!', licenseKey: keyValue });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend API running on port ${PORT}`));
