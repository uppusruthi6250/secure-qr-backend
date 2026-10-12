const mongoose = require('mongoose');

const fraudReportSchema = new mongoose.Schema(
  {
    reportId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    qrId: {
      type: String,
      default: null,
      index: true,
    },
    organizationId: {
      type: String,
      default: null,
      index: true,
    },
    reportedBy: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      enum: [
        'Suspicious QR',
        'Wrong UPI ID',
        'QR replaced',
        'Payment information mismatch',
        'Organization information mismatch',
        'Other',
      ],
      required: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'],
      default: 'OPEN',
    },
  },
  {
    timestamps: true,
  }
);

const FraudReport = mongoose.model('FraudReport', fraudReportSchema);
module.exports = FraudReport;
