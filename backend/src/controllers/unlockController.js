const { pool } = require('../config/database');

async function unlockTemplate(req, res, next) {
    try {
        const { template_id } = req.body;
        const userId = req.user.id;

        const [templates] = await pool.execute('SELECT id, title, unlock_url, unlock_password, price FROM templates WHERE id = ?', [template_id]);
        if (templates.length === 0) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        const template = templates[0];

        // Check if already unlocked
        const [existingUnlocks] = await pool.execute('SELECT id FROM unlocks WHERE user_id = ? AND template_id = ? AND payment_status = ?', [userId, template_id, 'completed']);
        if (existingUnlocks.length > 0) {
            return res.json({ success: true, message: 'Template already unlocked', data: { unlock_url: template.unlock_url, unlock_password: template.unlock_password } });
        }

        // Check payment
        const [payments] = await pool.execute('SELECT id FROM payments WHERE user_id = ? AND template_id = ? AND status = ?', [userId, template_id, 'success']);
        if (payments.length === 0) {
            return res.status(402).json({ success: false, message: 'Payment required. Please complete payment before unlocking.' });
        }

        // Create unlock record
        await pool.execute('INSERT INTO unlocks (user_id, template_id, payment_status) VALUES (?, ?, ?)', [userId, template_id, 'completed']);

        res.json({ success: true, message: 'Template unlocked successfully', data: { unlock_url: template.unlock_url, unlock_password: template.unlock_password } });
    } catch (error) { next(error); }
}

async function getUserUnlocks(req, res, next) {
    try {
        const [unlocks] = await pool.execute(
            `SELECT u.id, u.template_id, u.payment_status, u.created_at, t.title, t.description, t.image, t.unlock_url, t.unlock_password
       FROM unlocks u JOIN templates t ON u.template_id = t.id WHERE u.user_id = ? AND u.payment_status = ? ORDER BY u.created_at DESC`,
            [req.user.id, 'completed']
        );
        res.json({ success: true, data: { unlocks, total: unlocks.length } });
    } catch (error) { next(error); }
}

module.exports = { unlockTemplate, getUserUnlocks };
