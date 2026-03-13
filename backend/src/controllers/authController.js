const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const config = require('../config/app');

async function signup(req, res, next) {
    try {
        const { email, password } = req.body;
        const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'An account with this email already exists' });
        }
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);
        const [result] = await pool.execute('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, passwordHash]);
        const token = jwt.sign({ id: result.insertId, email }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
        res.status(201).json({
            success: true, message: 'Account created successfully',
            data: { user: { id: result.insertId, email }, token },
        });
    } catch (error) { next(error); }
}

async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        const [users] = await pool.execute('SELECT id, email, password_hash FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        const user = users[0];
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        const token = jwt.sign({ id: user.id, email: user.email }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
        res.json({
            success: true, message: 'Login successful',
            data: { user: { id: user.id, email: user.email }, token },
        });
    } catch (error) { next(error); }
}

async function getUser(req, res, next) {
    try {
        const [users] = await pool.execute('SELECT id, email, created_at FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const [unlockCount] = await pool.execute('SELECT COUNT(*) as total FROM unlocks WHERE user_id = ? AND payment_status = ?', [req.user.id, 'completed']);
        const [paymentCount] = await pool.execute('SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as total_spent FROM payments WHERE user_id = ? AND status = ?', [req.user.id, 'success']);
        res.json({
            success: true,
            data: {
                user: { id: users[0].id, email: users[0].email, created_at: users[0].created_at },
                stats: { total_unlocks: unlockCount[0].total, total_payments: paymentCount[0].total, total_spent: parseFloat(paymentCount[0].total_spent) },
            },
        });
    } catch (error) { next(error); }
}

module.exports = { signup, login, getUser };
