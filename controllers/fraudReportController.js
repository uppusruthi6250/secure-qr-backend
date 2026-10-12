const FraudReport = require('../models/FraudReport');
const VerificationLog = require('../models/VerificationLog');

// @desc    Create a new fraud report
// @route   POST /api/fraud-reports
// @access  Private (CUSTOMER, ORGANIZATION, ADMIN)
const createFraudReport = async (req, res, next) => {
  try {
    const { qrId, organizationId, reason, description } = req.body;

    if (!reason || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide reason and description for the fraud report.',
      });
    }

    const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const fraudReport = await FraudReport.create({
      reportId,
      qrId: qrId || null,
      organizationId: organizationId || null,
      reportedBy: req.user.userId,
      reason,
      description,
      status: 'OPEN',
    });

    // Record Audit Log
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await VerificationLog.create({
      logId,
      qrId: qrId || null,
      organizationId: organizationId || null,
      scannedBy: req.user.userId,
      action: 'FRAUD_REPORTED',
      result: 'OPEN',
      additionalDetails: `Fraud reported: ${reason} - ${description}`,
    });

    return res.status(201).json({
      success: true,
      message: 'Fraud report submitted successfully. Thank you for helping keep the system secure.',
      fraudReport,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all fraud reports (Admin)
// @route   GET /api/fraud-reports
// @access  Private (ADMIN)
const getAllFraudReports = async (req, res, next) => {
  try {
    const reports = await FraudReport.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: reports.length,
      fraudReports: reports,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update fraud report status (Admin)
// @route   PUT /api/fraud-reports/:id/status
// @access  Private (ADMIN)
const updateFraudReportStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'].includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid status: OPEN, UNDER_REVIEW, RESOLVED, or DISMISSED.',
      });
    }

    const report = await FraudReport.findOne({
      $or: [{ reportId: id }, { _id: id }],
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Fraud report not found.',
      });
    }

    report.status = status.toUpperCase();
    await report.save();

    return res.status(200).json({
      success: true,
      message: `Fraud report status updated to ${status.toUpperCase()}`,
      fraudReport: report,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFraudReport,
  getAllFraudReports,
  updateFraudReportStatus,
};
