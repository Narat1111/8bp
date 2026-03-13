const { pool } = require('../config/database');
const config = require('../config/app');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const axios = require('axios');

let BakongKHQR, IndividualInfo, khqrData;
try {
    const khqrModule = require('bakong-khqr');
    BakongKHQR = khqrModule.BakongKHQR;
    IndividualInfo = khqrModule.IndividualInfo;
    khqrData = khqrModule.khqrData;
} catch (err) {
    console.warn('⚠️  bakong-khqr module not available. Using fallback mode.');
}

async function createPayment(req, res, next) {
    try {
        const { template_id } = req.body;
        const userId = req.user.id;

        const [templates] = await pool.execute('SELECT id, title, price FROM templates WHERE id = ?', [template_id]);
        if (templates.length === 0) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        const template = templates[0];

        // Check if already paid
        const [existingPayment] = await pool.execute('SELECT id FROM payments WHERE user_id = ? AND template_id = ? AND status = ?', [userId, template_id, 'success']);
        if (existingPayment.length > 0) {
            return res.status(400).json({ success: false, message: 'Payment already completed for this template. You can unlock it now.' });
        }

        // Check for pending payment
        const [pendingPayment] = await pool.execute(
            'SELECT id, transaction_id, qr_data, md5_hash FROM payments WHERE user_id = ? AND template_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
            [userId, template_id, 'pending']
        );
        if (pendingPayment.length > 0 && pendingPayment[0].qr_data) {
            return res.json({
                success: true, message: 'Existing pending payment found',
                data: { transaction_id: pendingPayment[0].transaction_id, qr_data: pendingPayment[0].qr_data, amount: parseFloat(template.price), currency: 'USD', template: { id: template.id, title: template.title } },
            });
        }

        const transactionId = `TXN-${uuidv4().split('-')[0].toUpperCase()}-${Date.now()}`;
        let qrData = null;
        let md5Hash = null;

        try {
            if (BakongKHQR && IndividualInfo && khqrData) {
                const optionalData = {
                    currency: khqrData.currency.usd,
                    amount: parseFloat(template.price),
                    billNumber: transactionId,
                    storeLabel: 'LinkVault',
                    terminalLabel: 'Web',
                    expirationTimestamp: Date.now() + (5 * 60 * 1000)
                };
                const individualInfo = new IndividualInfo(config.bakong.account, config.bakong.merchantName, 'Phnom Penh', optionalData);
                const khqr = new BakongKHQR();
                const result = khqr.generateIndividual(individualInfo);
                if (result && result.data) {
                    qrData = result.data.qr;
                    md5Hash = result.data.md5 || crypto.createHash('md5').update(result.data.qr || transactionId).digest('hex');
                }
            }
        } catch (qrError) {
            console.warn('⚠️  KHQR generation failed, using fallback:', qrError.message);
        }

        if (!qrData) {
            qrData = `00020101021229370014${config.bakong.account}520400005303840540${parseFloat(template.price).toFixed(2)}5802KH5913${transactionId.substring(0, 13)}6010PhnomPenh`;
            md5Hash = crypto.createHash('md5').update(qrData).digest('hex');
        }

        const [result] = await pool.execute(
            'INSERT INTO payments (user_id, template_id, amount, method, status, transaction_id, qr_data, md5_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, template_id, template.price, 'bakong_khqr', 'pending', transactionId, qrData, md5Hash]
        );

        res.status(201).json({
            success: true, message: 'Payment created successfully',
            data: { payment_id: result.insertId, transaction_id: transactionId, qr_data: qrData, md5_hash: md5Hash, amount: parseFloat(template.price), currency: 'USD', merchant: config.bakong.merchantName, template: { id: template.id, title: template.title } },
        });
    } catch (error) { next(error); }
}

async function verifyPayment(req, res, next) {
    try {
        const { transaction_id } = req.body;
        const userId = req.user.id;

        const [payments] = await pool.execute('SELECT id, user_id, template_id, amount, status, md5_hash, transaction_id FROM payments WHERE transaction_id = ? AND user_id = ?', [transaction_id, userId]);
        if (payments.length === 0) {
            return res.status(404).json({ success: false, message: 'Payment record not found' });
        }
        const payment = payments[0];

        if (payment.status === 'success') {
            return res.json({ success: true, status: 'success', message: 'Payment already verified and confirmed' });
        }
        if (payment.status === 'failed' || payment.status === 'expired') {
            return res.status(400).json({ success: false, status: payment.status, message: `Payment has been marked as ${payment.status}` });
        }

        let paymentVerified = false;
        try {
            if (config.bakong.apiToken && config.bakong.apiToken !== 'ENV_VARIABLE') {
                const bakongResponse = await axios.post('https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5', { md5: payment.md5_hash }, {
                    headers: { Authorization: `Bearer ${config.bakong.apiToken}`, 'Content-Type': 'application/json' },
                    timeout: 10000,
                });
                if (bakongResponse.data && bakongResponse.data.responseCode === 0) {
                    const txnData = bakongResponse.data.data;
                    if (txnData && parseFloat(txnData.amount) >= parseFloat(payment.amount)) {
                        paymentVerified = true;
                    }
                }
            } else {
                console.log('⚠️  Development mode: Simulating payment verification');
                paymentVerified = true;
            }
        } catch (apiError) {
            console.error('Bakong API verification error:', apiError.message);
            if (process.env.NODE_ENV === 'development') paymentVerified = true;
        }

        if (paymentVerified) {
            await pool.execute('UPDATE payments SET status = ?, updated_at = NOW() WHERE id = ?', ['success', payment.id]);
            await pool.execute('INSERT INTO unlocks (user_id, template_id, payment_status) VALUES (?, ?, ?)', [userId, payment.template_id, 'completed']);

            return res.json({
                success: true, status: 'success', message: 'Payment verified and confirmed successfully',
                data: { payment_id: payment.id, transaction_id: payment.transaction_id, amount: parseFloat(payment.amount) },
            });
        }

        res.json({ success: true, status: 'pending', message: 'Payment is still being processed. Please try again.' });
    } catch (error) { next(error); }
}

module.exports = { createPayment, verifyPayment };
