const express = require('express');
const router = express.Router();
const { unlockTemplate, getUserUnlocks } = require('../controllers/unlockController');
const { authenticate } = require('../middleware/auth');
const { unlockValidation } = require('../middleware/validate');

router.post('/', authenticate, unlockValidation, unlockTemplate);
router.get('/', authenticate, getUserUnlocks);

module.exports = router;
