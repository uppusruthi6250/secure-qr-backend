const express = require('express');
const router = express.Router();
const {
  createFraudReport,
  getAllFraudReports,
  updateFraudReportStatus,
} = require('../controllers/fraudReportController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

router.post('/', authenticateToken, createFraudReport);
router.get('/', requireAdmin, getAllFraudReports);
router.put('/:id/status', requireAdmin, updateFraudReportStatus);

module.exports = router;
