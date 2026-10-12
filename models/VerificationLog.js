const mongoose = require('mongoose');

const verificationLogSchema = new mongoose.Schema(
  {
    logId: {
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
    scannedBy: {
      type: String,
      default: 'ANONYMOUS',
    },
    action: {
      type: String,
      enum: [
        'QR_REGISTERED',
        'QR_SCANNED',
        'HASH_MATCH',
        'HASH_MISMATCH',
        'SIGNATURE_VALID',
        'SIGNATURE_INVALID',
        'ORG_VERIFIED',
        'ORG_REJECTED',
        'FRAUD_REPORTED',
      ],
      required: true,
    },
    result: {
      type: String,
      required: true,
    },
    additionalDetails: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const VerificationLog = mongoose.model('VerificationLog', verificationLogSchema);
module.exports = VerificationLog;
