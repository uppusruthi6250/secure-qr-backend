const mongoose = require('mongoose');

const verificationRecordSchema = new mongoose.Schema(
  {
    verificationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
    verificationType: {
      type: String,
      enum: ['MCA', 'GST', 'UDYAM', 'FSSAI', 'MANUAL'],
      required: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      trim: true,
    },
    documentReference: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['UNDER_REVIEW', 'VERIFIED', 'REJECTED'],
      default: 'UNDER_REVIEW',
    },
    verifiedBy: {
      type: String,
      default: null,
    },
    adminNotes: {
      type: String,
      default: '',
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const VerificationRecord = mongoose.model('VerificationRecord', verificationRecordSchema);
module.exports = VerificationRecord;
