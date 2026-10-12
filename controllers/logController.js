const VerificationLog = require('../models/VerificationLog');

// @desc    Get all verification logs (Admin)
// @route   GET /api/logs
// @access  Private (ADMIN)
const getVerificationLogs = async (req, res, next) => {
  try {
    const logs = await VerificationLog.find().sort({ createdAt: -1 }).limit(100);
    return res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVerificationLogs,
};
