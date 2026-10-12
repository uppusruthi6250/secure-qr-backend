const express = require('express');
const router = express.Router();
const {
  registerQr,
  verifyQr,
  getMyQrCodes,
  getQrById,
  updateQrStatus,
} = require('../controllers/qrController');
const { requireOrganization, authenticateToken } = require('../middleware/authMiddleware');

router.post('/register', requireOrganization, registerQr);
router.post('/verify', verifyQr); // Public or authenticated customer scan verification
router.get('/my', requireOrganization, getMyQrCodes);
router.get('/:id', authenticateToken, getQrById);
router.put('/:id/status', requireOrganization, updateQrStatus);

module.exports = router;
