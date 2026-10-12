const User = require('../models/User');
const Organization = require('../models/Organization');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      role: user.role,
      id: user._id,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, phone, password, passwordHash, role } = req.body;
    const rawPassword = password || passwordHash;

    if (!name || !email || !phone || !rawPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, phone, and password.',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    const userRole = (role && ['ADMIN', 'ORGANIZATION', 'CUSTOMER'].includes(role.toUpperCase()))
      ? role.toUpperCase()
      : 'CUSTOMER';

    const hashedPassword = await User.hashPassword(rawPassword);
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const user = await User.create({
      userId,
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash: hashedPassword,
      role: userRole,
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      token,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password, passwordHash } = req.body;
    const rawPassword = password || passwordHash;

    if (!email || !rawPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(rawPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // If user is an ORGANIZATION, check verification status
    let orgStatus = null;
    let rejectionReason = null;
    if (user.role === 'ORGANIZATION') {
      const org = await Organization.findOne({ userId: user.userId });
      if (org) {
        orgStatus = org.verification.status || org.verificationStatus;
        rejectionReason = org.verification.rejectionReason || '';

        if (orgStatus === 'PENDING_VERIFICATION' || orgStatus === 'UNDER_REVIEW') {
          return res.status(403).json({
            success: false,
            status: 'PENDING_VERIFICATION',
            message: 'Your organization registration is still under admin verification.',
          });
        }

        if (orgStatus === 'REJECTED') {
          return res.status(403).json({
            success: false,
            status: 'REJECTED',
            message: 'Your organization registration was rejected.',
            rejectionReason: rejectionReason || 'Documents could not be verified.',
          });
        }
      }
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      organizationStatus: orgStatus,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public
const logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

// @desc    Get current authenticated user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findOne({ userId: req.user.userId }).select('-passwordHash');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    let organization = null;
    if (user.role === 'ORGANIZATION') {
      organization = await Organization.findOne({ userId: user.userId });
    }

    return res.status(200).json({
      success: true,
      user,
      organization,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
};
