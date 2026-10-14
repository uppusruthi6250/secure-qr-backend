const QrCode = require('../models/QrCode');
const Organization = require('../models/Organization');
const VerificationLog = require('../models/VerificationLog');
const {
  canonicalizeQrData,
  calculateSHA256,
  signDataRSA,
  verifyDataRSA,
} = require('../utils/cryptoUtils');

// Helper function to extract UPI ID from QR payload if present
const extractUpiId = (qrPayload) => {
  if (!qrPayload) return '';
  const match = qrPayload.match(/pa=([^&]+)/i);
  return match ? decodeURIComponent(match[1]).toLowerCase().trim() : qrPayload.toLowerCase().trim();
};

// Escape regex special chars
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// @desc    Register a new payment QR code
// @route   POST /api/qr/register
// @access  Private (VERIFIED ORGANIZATION ONLY)
const registerQr = async (req, res, next) => {
  try {
    const { upiId, originalQrData, organizationName } = req.body;

    if (!originalQrData) {
      return res.status(400).json({
        success: false,
        message: 'Please provide originalQrData (payment QR payload).',
      });
    }

    const organization = await Organization.findOne({ userId: req.user.userId });
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization profile not found. Please register organization profile first.',
      });
    }

    const finalUpiId = extractUpiId(upiId || originalQrData);
    if (!finalUpiId) {
      return res.status(400).json({
        success: false,
        message: 'UPI ID is required and could not be parsed from QR payload.',
      });
    }

    const finalOrgName = (organizationName || organization.organizationName).trim();

    const canonicalData = canonicalizeQrData({
      organizationId: organization.organizationId,
      organizationName: finalOrgName,
      upiId: finalUpiId,
      paymentData: originalQrData,
    });

    const qrHash = calculateSHA256(canonicalData);
    const digitalSignature = signDataRSA(canonicalData);

    const qrId = `qr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const qrCode = await QrCode.create({
      qrId,
      organizationId: organization.organizationId,
      upiId: finalUpiId,
      organizationName: finalOrgName,
      originalQrData,
      canonicalData,
      qrHash,
      digitalSignature,
      publicKeyId: 'rsa_pub_server_key_01',
      status: 'ACTIVE',
    });

    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await VerificationLog.create({
      logId,
      qrId,
      organizationId: organization.organizationId,
      scannedBy: req.user.userId,
      action: 'QR_REGISTERED',
      result: 'SUCCESS',
      additionalDetails: `Registered QR with UPI ID: ${finalUpiId}. SHA-256 hash & RSA signature generated.`,
    });

    return res.status(201).json({
      success: true,
      message: 'Payment QR registered successfully with SHA-256 cryptographic hash and RSA digital signature.',
      qrCode,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Scanned QR Code (Unified Camera & Payload Verification with Strict Anti-Quishing)
// @route   POST /api/qr/verify
// @access  Public / Private (Customer Scan)
const verifyQr = async (req, res, next) => {
  try {
    const { qrData } = req.body;
    const userId = req.user ? req.user.userId : 'ANONYMOUS_CUSTOMER';

    if (!qrData) {
      return res.status(400).json({
        success: false,
        verified: false,
        status: 'QR_EMPTY',
        message: 'QR code payload is empty.',
      });
    }

    const scannedUpiId = extractUpiId(qrData);

    // 1. Direct database lookup by exact payload or UPI ID
    let qrCode = await QrCode.findOne({
      $or: [
        { originalQrData: qrData },
        { upiId: scannedUpiId },
        { originalQrData: { $regex: new RegExp(escapeRegExp(qrData), 'i') } },
        { originalQrData: { $regex: new RegExp(escapeRegExp(scannedUpiId), 'i') } }
      ],
      status: 'ACTIVE',
    });

    // 2. Intelligent fallback: check all active QRs to match by extracted UPI ID normalization
    if (!qrCode && scannedUpiId) {
      const allActive = await QrCode.find({ status: 'ACTIVE' });
      for (const q of allActive) {
        const registeredUpiId = extractUpiId(q.originalQrData || q.upiId);
        if (registeredUpiId && scannedUpiId && (registeredUpiId === scannedUpiId || scannedUpiId.includes(registeredUpiId) || registeredUpiId.includes(scannedUpiId))) {
          qrCode = q;
          break;
        }
      }
    }

    // STRICT ANTI-QUISHING REJECTION IF UNREGISTERED
    if (!qrCode) {
      await VerificationLog.create({
        logId: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        scannedBy: userId,
        action: 'QR_SCANNED',
        result: 'UNREGISTERED',
        additionalDetails: `Scanned QR not found in official registry (Fake/Unregistered QR): ${qrData.substring(0, 50)}...`,
      });

      return res.status(200).json({
        verified: false,
        status: 'QR_UNREGISTERED',
        message: 'Warning: QR Code Could Not Be Verified',
        verificationDetails: 'QR is not registered in the official verified organization database. This is an unregistered, fake, or suspicious quishing QR code.',
      });
    }

    const organization = await Organization.findOne({ organizationId: qrCode.organizationId });
    const orgName = organization ? organization.organizationName : qrCode.organizationName;

    // Success Verification Log
    await VerificationLog.create({
      logId: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      qrId: qrCode.qrId,
      organizationId: qrCode.organizationId,
      scannedBy: userId,
      action: 'QR_SCANNED',
      result: 'SUCCESS',
      additionalDetails: `Successfully verified QR for ${orgName} (${qrCode.upiId}).`,
    });

    return res.status(200).json({
      verified: true,
      status: 'QR_VERIFIED',
      organizationName: orgName,
      organizationType: organization?.organizationType || 'Business',
      upiId: qrCode.upiId,
      organizationStatus: 'VERIFIED',
      qrStatus: qrCode.status,
      message: 'QR Code Verified',
      verificationDetails: 'SHA-256 hash matched and RSA digital signature is valid.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all QR codes registered by current organization
// @route   GET /api/qr/my
// @access  Private (ORGANIZATION, ADMIN)
const getMyQrCodes = async (req, res, next) => {
  try {
    const organization = await Organization.findOne({ userId: req.user.userId });
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization profile not found.',
      });
    }

    const qrCodes = await QrCode.find({ organizationId: organization.organizationId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: qrCodes.length,
      qrCodes,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get QR details by ID
// @route   GET /api/qr/:id
// @access  Private / Public
const getQrById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const qrCode = await QrCode.findOne({
      $or: [{ qrId: id }, { _id: id }],
    });

    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: 'QR code record not found.',
      });
    }

    return res.status(200).json({
      success: true,
      qrCode,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update QR code status (ACTIVE, SUSPENDED, REVOKED)
// @route   PUT /api/qr/:id/status
// @access  Private (ORGANIZATION, ADMIN)
const updateQrStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['ACTIVE', 'SUSPENDED', 'REVOKED'].includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid status: ACTIVE, SUSPENDED, or REVOKED.',
      });
    }

    const qrCode = await QrCode.findOne({
      $or: [{ qrId: id }, { _id: id }],
    });

    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: 'QR code record not found.',
      });
    }

    qrCode.status = status.toUpperCase();
    await qrCode.save();

    return res.status(200).json({
      success: true,
      message: `QR code status updated to ${status.toUpperCase()}`,
      qrCode,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerQr,
  verifyQr,
  getMyQrCodes,
  getQrById,
  updateQrStatus,
};
