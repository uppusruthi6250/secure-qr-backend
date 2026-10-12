const express = require('express');
const router = express.Router();
const { register, login, logout, getMe } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Public Auth Routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Protected Auth Routes
router.get('/me', authenticateToken, getMe);

module.exports = router;
