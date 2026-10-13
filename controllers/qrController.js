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
  return match ? decodeURIComponent(match[1]) : '';
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

    // Retrieve Organization Profile
    const organization = await Organization.findOne({ userId: req.user.userId });
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization profile not found. Please register organization profile first.',
      });
    }

    // STRICT SECURITY RULE: Only VERIFIED/APPROVED organizations can register active payment QR codes!
    const orgStatus = organization.verification?.status || organization.verificationStatus;
    if (orgStatus !== 'VERIFIED' && orgStatus !== 'APPROVED') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Only APPROVED organizations are permitted to register payment QR codes. Your current status is: ' + (orgStatus || 'PENDING_VERIFICATION'),
      });
    }

    // Resolve UPI ID (from body or extracted from payload)
    const finalUpiId = (upiId || extractUpiId(originalQrData) || '').toLowerCase().trim();
    if (!finalUpiId) {
      return res.status(400).json({
        success: false,
        message: 'UPI ID is required and could not be parsed from QR payload.',
      });
    }

    const finalOrgName = (organizationName || organization.organizationName).trim();

    // 1. Generate Canonical Data String
    const canonicalData = canonicalizeQrData({
      organizationId: organization.organizationId,
      organizationName: finalOrgName,
      upiId: finalUpiId,
      paymentData: originalQrData,
    });

    // 2. Calculate SHA-256 Hash
    const qrHash = calculateSHA256(canonicalData);

    // 3. Create RSA Digital Signature using Server-Side Private Key
    const digitalSignature = signDataRSA(canonicalData);

    // 4. Save QR Record
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

    // Create Audit Log
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

// @desc    Verify Scanned QR Code (Anti-Quishing Logic)
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

    // 1. Find registered QR in database
    const qrCode = await QrCode.findOne({ originalQrData: qrData });
    if (!qrCode) {
      // Record failed scan log
      const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await VerificationLog.create({
        logId,
        scannedBy: userId,
        action: 'QR_SCANNED',
        result: 'UNREGISTERED',
        additionalDetails: `Scanned QR not found in registry (Potential Quishing/Fake QR): ${qrData.substring(0, 50)}...`,
      });

      return res.status(200).json({
        verified: false,
        status: 'QR_UNREGISTERED',
        message: 'Warning: QR Code Could Not Be Verified',
        verificationDetails: 'QR is not registered in the official verified organization database.',
      });
    }

    // 2. Find associated Organization
    const organization = await Organization.findOne({ organizationId: qrCode.organizationId });
    if (!organization) {
      return res.status(200).json({
        verified: false,
        status: 'ORGANIZATION_UNVERIFIED',
        message: 'Warning: QR Code Could Not Be Verified',
        verificationDetails: 'Associated organization record could not be found.',
      });
    }

    // 3. Check Organization verification status
    const orgStatus = organization.verification?.status || organization.verificationStatus;
    if (orgStatus !== 'VERIFIED' && orgStatus !== 'APPROVED') {
      return res.status(200).json({
        verified: false,
        status: 'ORGANIZATION_UNVERIFIED',
        message: 'Warning: QR Code Could Not Be Verified',
        organizationName: organization.organizationName,
        verificationDetails: `Organization verification status is ${orgStatus}.`,
      });
    }

    // 4. Check QR status
    if (qrCode.status !== 'ACTIVE') {
      return res.status(200).json({
        verified: false,
        status: qrCode.status === 'REVOKED' ? 'QR_REVOKED' : 'ORGANIZATION_SUSPENDED',
        message: 'Warning: QR Code Could Not Be Verified',
        organizationName: organization.organizationName,
        verificationDetails: `QR code status is ${qrCode.status}.`,
      });
    }

    // 5. Generate canonical QR data and calculate SHA-256 hash
    const canonicalData = canonicalizeQrData({
      organizationId: organization.organizationId,
      organizationName: qrCode.organizationName,
      upiId: qrCode.upiId,
      paymentData: qrCode.originalQrData,
    });

    const calculatedHash = calculateSHA256(canonicalData);
    if (calculatedHash !== qrCode.qrHash) {
      await VerificationLog.create({
        logId: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        qrId: qrCode.qrId,
        organizationId: organization.organizationId,
        scannedBy: userId,
        action: 'HASH_MISMATCH',
        result: 'FAILURE',
        additionalDetails: 'SHA-256 hash calculation does not match stored hash.',
      });

      return res.status(200).json({
        verified: false,
        status: 'HASH_MISMATCH',
        message: 'Warning: QR Code Could Not Be Verified',
        verificationDetails: 'QR cryptographic hash mismatch detected.',
      });
    }

    // 6. Verify RSA Digital Signature
    const isSignatureValid = verifyDataRSA(canonicalData, qrCode.digitalSignature);
    if (!isSignatureValid) {
      await VerificationLog.create({
        logId: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        qrId: qrCode.qrId,
        organizationId: organization.organizationId,
        scannedBy: userId,
        action: 'SIGNATURE_INVALID',
        result: 'FAILURE',
        additionalDetails: 'RSA digital signature verification failed.',
      });

      return res.status(200).json({
        verified: false,
        status: 'SIGNATURE_INVALID',
        message: 'Warning: QR Code Could Not Be Verified',
        verificationDetails: 'RSA digital signature is invalid.',
      });
    }

    // 7. Success Verification Log
    await VerificationLog.create({
      logId: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      qrId: qrCode.qrId,
      organizationId: organization.organizationId,
      scannedBy: userId,
      action: 'QR_SCANNED',
      result: 'SUCCESS',
      additionalDetails: `Successfully verified QR for ${organization.organizationName} (${qrCode.upiId}).`,
    });

    return res.status(200).json({
      verified: true,
      status: 'QR_VERIFIED',
      organizationName: organization.organizationName,
      organizationType: organization.organizationType,
      upiId: qrCode.upiId,
      organizationStatus: orgStatus,
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
        message: 'Organization profile not found.',
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
