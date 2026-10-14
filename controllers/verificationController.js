const VerificationRecord = require('../models/VerificationRecord');
const Organization = require('../models/Organization');

// @desc    Submit or update organization verification details
// @route   POST /api/verifications
// @access  Private (ORGANIZATION, ADMIN)
const submitVerification = async (req, res, next) => {
  try {
    const { verificationType, registrationNumber, documentReference } = req.body;

    if (!verificationType || !registrationNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide verificationType and registrationNumber.',
      });
    }

    const organization = await Organization.findOne({ userId: req.user.userId });
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'No organization profile found for this user account. Please register organization profile first.',
      });
    }

    let record = await VerificationRecord.findOne({ organizationId: organization.organizationId });

    if (record) {
      record.verificationType = verificationType.toUpperCase();
      record.registrationNumber = registrationNumber;
      if (documentReference !== undefined) record.documentReference = documentReference;
      record.status = 'UNDER_REVIEW';
      record.adminNotes = '';
      record.verifiedBy = null;
      record.verifiedAt = null;
      await record.save();
    } else {
      const verificationId = `ver_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      record = await VerificationRecord.create({
        verificationId,
        organizationId: organization.organizationId,
        verificationType: verificationType.toUpperCase(),
        registrationNumber,
        documentReference: documentReference || '',
        status: 'UNDER_REVIEW',
      });
    }

    organization.verification.status = 'PENDING_VERIFICATION';
    organization.verificationStatus = 'PENDING_VERIFICATION';
    await organization.save();

    return res.status(200).json({
      success: true,
      message: 'Verification request submitted successfully and queued for Admin review.',
      verificationRecord: record,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get verification status for current organization
// @route   GET /api/verifications/status
// @access  Private (ORGANIZATION, ADMIN)
const getVerificationStatus = async (req, res, next) => {
  try {
    const organization = await Organization.findOne({ userId: req.user.userId });
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization profile not found.',
      });
    }

    const record = await VerificationRecord.findOne({ organizationId: organization.organizationId });

    return res.status(200).json({
      success: true,
      organizationStatus: organization.verification?.status || organization.verificationStatus,
      rejectionReason: organization.verification?.rejectionReason || '',
      verificationRecord: record || null,
      organization,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get all organization verification requests & pending organizations
// @route   GET /api/admin/verifications
// @access  Private (ADMIN)
const getAllVerifications = async (req, res, next) => {
  try {
    const records = await VerificationRecord.find().sort({ createdAt: -1 });

    const populatedRecords = await Promise.all(
      records.map(async (rec) => {
        const org = await Organization.findOne({ organizationId: rec.organizationId });
        return {
          verificationId: rec.verificationId,
          organizationId: rec.organizationId,
          verificationType: rec.verificationType || org?.applicableRegistrations?.[0] || 'MANUAL',
          registrationNumber: rec.registrationNumber || org?.registrationNumbers?.gstin || 'PENDING',
          status: org?.verification?.status || org?.verificationStatus || rec.status || 'PENDING_VERIFICATION',
          adminNotes: org?.verification?.adminNotes || rec.adminNotes || '',
          rejectionReason: org?.verification?.rejectionReason || '',
          verifiedAt: org?.verification?.verifiedAt || rec.verifiedAt || null,
          createdAt: rec.createdAt,
          documentReference: rec.documentReference || '',
        };
      })
    );

    return res.status(200).json(populatedRecords);
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Approve or Reject Organization Verification
// @route   PUT /api/admin/verifications/:id
// @access  Private (ADMIN)
const reviewVerification = async (req, res, next) => {
  try {
    const { id } = req.params; // verificationId or organizationId
    const { status, adminNotes, rejectionReason, gstinVerificationStatus } = req.body;

    const normalizedStatus = (status || '').toUpperCase();
    if (!['APPROVED', 'REJECTED', 'VERIFIED', 'UNDER_REVIEW', 'PENDING_VERIFICATION'].includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid status: APPROVED, REJECTED, VERIFIED, or UNDER_REVIEW.',
      });
    }

    // Robust lookup: find verification record first, then organization
    let record = await VerificationRecord.findOne({
      $or: [
        { verificationId: id },
        { organizationId: id },
      ],
    });

    let organization = null;
    if (record) {
      organization = await Organization.findOne({ organizationId: record.organizationId });
    }

    if (!organization) {
      organization = await Organization.findOne({
        $or: [
          { organizationId: id },
          { userId: id },
        ],
      });
    }

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found for verification review.',
      });
    }

    const finalStatus = (normalizedStatus === 'VERIFIED' || normalizedStatus === 'APPROVED') ? 'APPROVED' : normalizedStatus;

    organization.verification.status = finalStatus;
    organization.verificationStatus = finalStatus;
    if (adminNotes !== undefined) organization.verification.adminNotes = adminNotes;
    if (gstinVerificationStatus) organization.verification.gstinVerificationStatus = gstinVerificationStatus.toUpperCase();

    if (finalStatus === 'APPROVED') {
      organization.verification.verifiedBy = req.user.userId;
      organization.verification.verifiedAt = new Date();
      organization.verification.rejectionReason = '';
    } else if (finalStatus === 'REJECTED') {
      organization.verification.rejectedBy = req.user.userId;
      organization.verification.rejectedAt = new Date();
      organization.verification.rejectionReason = rejectionReason || adminNotes || 'Registration documents could not be verified.';
    }

    await organization.save();

    await VerificationRecord.findOneAndUpdate(
      { organizationId: organization.organizationId },
      {
        status: finalStatus === 'APPROVED' ? 'VERIFIED' : (finalStatus === 'REJECTED' ? 'REJECTED' : 'UNDER_REVIEW'),
        adminNotes: adminNotes || '',
        verifiedBy: req.user.userId,
        verifiedAt: new Date(),
      },
      { upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: `Organization successfully marked as ${finalStatus}`,
      organization,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitVerification,
  getVerificationStatus,
  getAllVerifications,
  reviewVerification,
};
