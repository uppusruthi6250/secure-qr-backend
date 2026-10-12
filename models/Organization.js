const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  buildingNumber: { type: String, required: true, trim: true },
  street: { type: String, required: true, trim: true },
  locality: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  country: { type: String, required: true, trim: true },
  pincode: { type: String, required: true, trim: true },
  isRegisteredOfficeSame: { type: Boolean, default: true },
  registeredOfficeAddress: { type: String, default: '' },
});

const documentSchema = new mongoose.Schema({
  documentType: { type: String, required: true },
  fileReference: { type: String, required: true },
  originalName: { type: String, required: true },
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
      required: [true, 'Organization category is required'],
      trim: true,
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
    address: {
      type: addressSchema,
      required: true,
    },
    applicableRegistrations: {
      type: [String],
      default: [],
    },
    registrationNumbers: {
      gstin: { type: String, trim: true, default: '' },
      fssai: { type: String, trim: true, default: '' },
      mcaCin: { type: String, trim: true, default: '' },
      msmeUdyam: { type: String, trim: true, default: '' },
      pan: { type: String, trim: true, default: '' },
      tan: { type: String, trim: true, default: '' },
      tradeLicense: { type: String, trim: true, default: '' },
      iec: { type: String, trim: true, default: '' },
      professionalTax: { type: String, trim: true, default: '' },
      otherRegistration: { type: String, trim: true, default: '' },
    },
    documents: {
      type: [documentSchema],
      default: [],
    },
    verification: {
      status: {
        type: String,
        enum: ['PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'SUSPENDED'],
        default: 'PENDING_VERIFICATION',
        index: true,
      },
      gstinVerificationStatus: {
        type: String,
        enum: ['PENDING', 'VERIFIED', 'INVALID', 'NEEDS_CORRECTION'],
        default: 'PENDING',
      },
      adminNotes: { type: String, default: '' },
      rejectionReason: { type: String, default: '' },
      verifiedBy: { type: String, default: null },
      verifiedAt: { type: Date, default: null },
      rejectedBy: { type: String, default: null },
      rejectedAt: { type: Date, default: null },
    },
    // Backward compatibility helper
    verificationStatus: {
      type: String,
      enum: ['PENDING_VERIFICATION', 'UNDER_REVIEW', 'APPROVED', 'VERIFIED', 'REJECTED', 'SUSPENDED'],
      default: 'PENDING_VERIFICATION',
    },
  },
  {
    timestamps: true,
  }
);

const Organization = mongoose.model('Organization', organizationSchema);
module.exports = Organization;
