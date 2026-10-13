const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  documentType: { type: String, default: '' },
  fileReference: { type: String, default: '' },
  originalName: { type: String, default: '' },
  uploadDate: { type: Date, default: Date.now },
});

const organizationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    organizationName: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: 'Other',
    },
    customCategory: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    website: {
      type: String,
      trim: true,
      default: '',
    },
    // Flexible address (can be String or Object)
    address: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Organization address is required'],
    },
    applicableRegistrations: {
      type: [String],
      default: [],
    },
    registrationNumbers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    documents: {
      type: [documentSchema],
      default: [],
    },
    verification: {
      status: {
        type: String,
        enum: ['PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'SUSPENDED', 'UNDER_REVIEW', 'VERIFIED'],
        default: 'PENDING_VERIFICATION',
        index: true,
      },
      gstinVerificationStatus: {
        type: String,
        default: 'PENDING',
      },
      adminNotes: { type: String, default: '' },
      rejectionReason: { type: String, default: '' },
      verifiedBy: { type: String, default: null },
      verifiedAt: { type: Date, default: null },
      rejectedBy: { type: String, default: null },
      rejectedAt: { type: Date, default: null },
    },
    verificationStatus: {
      type: String,
      default: 'PENDING_VERIFICATION',
    },
    organizationType: {
      type: String,
      default: 'SMALL_BUSINESS',
    },
    registrationType: {
      type: String,
      default: 'MANUAL',
    },
    registrationNumber: {
      type: String,
      default: 'PENDING',
    },
  },
  {
    timestamps: true,
  }
);

const Organization = mongoose.model('Organization', organizationSchema);
module.exports = Organization;
