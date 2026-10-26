const VerificationLog = require('../models/VerificationLog');

// @desc    Get all verification logs (Admin) - Returns direct JSON array for Android Gson compatibility
// @route   GET /api/logs
// @access  Private (ADMIN)
const getVerificationLogs = async (req, res, next) => {
  try {
    const logs = await VerificationLog.find().sort({ createdAt: -1 }).limit(100);
    return res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVerificationLogs,
};
