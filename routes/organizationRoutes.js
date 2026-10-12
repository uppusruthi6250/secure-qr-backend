const express = require('express');
const router = express.Router();
const {
  uploadDocumentFile,
  registerOrganization,
  getProfile,
  updateProfile,
} = require('../controllers/organizationController');
const { authenticateToken, requireOrganization } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// File Upload Route
router.post('/upload', authenticateToken, upload.single('file'), uploadDocumentFile);

// Organization Routes
router.post('/', authenticateToken, registerOrganization);
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', requireOrganization, updateProfile);

module.exports = router;
