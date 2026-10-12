const express = require('express');
const router = express.Router();
const { getVerificationLogs } = require('../controllers/logController');
const { requireAdmin } = require('../middleware/authMiddleware');

router.get('/', requireAdmin, getVerificationLogs);

module.exports = router;
