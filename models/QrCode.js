const mongoose = require('mongoose');

const qrCodeSchema = new mongoose.Schema(
  {
    qrId: {
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
    upiId: {
      type: String,
      required: [true, 'UPI ID is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    organizationName: {
      type: String,
      required: true,
      trim: true,
    },
    originalQrData: {
      type: String,
      required: [true, 'Original QR data is required'],
    },
    canonicalData: {
      type: String,
      required: true,
    },
    qrHash: {
      type: String,
      required: true,
    },
    digitalSignature: {
      type: String,
      required: true,
    },
    publicKeyId: {
      type: String,
      default: 'rsa_pub_server_key_01',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'REVOKED'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

const QrCode = mongoose.model('QrCode', qrCodeSchema);
module.exports = QrCode;
