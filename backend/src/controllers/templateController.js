const { pool } = require('../config/database');

async function getTemplates(req, res, next) {
    try {
        const [templates] = await pool.execute('SELECT id, title, description, image, price, created_at FROM templates ORDER BY created_at DESC');
        res.json({ success: true, data: { templates, total: templates.length } });
    } catch (error) { next(error); }
}

async function getTemplateById(req, res, next) {
    try {
        const [templates] = await pool.execute('SELECT id, title, description, image, price, created_at FROM templates WHERE id = ?', [req.params.id]);
        if (templates.length === 0) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        res.json({ success: true, data: { template: templates[0] } });
    } catch (error) { next(error); }
}

module.exports = { getTemplates, getTemplateById };
