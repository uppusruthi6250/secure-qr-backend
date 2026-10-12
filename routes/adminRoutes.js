const express = require('express');
const router = express.Router();
const {
  getAllVerifications,
  reviewVerification,
} = require('../controllers/verificationController');
const { requireAdmin } = require('../middleware/authMiddleware');

// Admin Verification Management APIs
router.get('/verifications', requireAdmin, getAllVerifications);
router.put('/verifications/:id', requireAdmin, reviewVerification);

module.exports = router;
