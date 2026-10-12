const express = require('express');
const router = express.Router();
const {
  submitVerification,
  getVerificationStatus,
} = require('../controllers/verificationController');
const { requireOrganization, authenticateToken } = require('../middleware/authMiddleware');

router.post('/', requireOrganization, submitVerification);
router.get('/status', authenticateToken, getVerificationStatus);

module.exports = router;
