const express = require('express');
const router = express.Router();
const { getTemplates, getTemplateById } = require('../controllers/templateController');

router.get('/', getTemplates);
router.get('/:id', getTemplateById);

module.exports = router;
