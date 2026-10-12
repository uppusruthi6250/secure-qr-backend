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
      organizationStatus: organization.verification.status || organization.verificationStatus,
      rejectionReason: organization.verification.rejectionReason || '',
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
    const organizations = await Organization.find().sort({ createdAt: -1 });

    const verifications = await Promise.all(
      organizations.map(async (org) => {
        const record = await VerificationRecord.findOne({ organizationId: org.organizationId });
        return {
          verificationId: record ? record.verificationId : org.organizationId,
          organizationId: org.organizationId,
          verificationType: record ? record.verificationType : (org.applicableRegistrations[0] || 'MANUAL'),
          registrationNumber: record ? record.registrationNumber : (org.registrationNumbers?.gstin || org.registrationNumbers?.fssai || 'N/A'),
          status: org.verification.status || org.verificationStatus,
          adminNotes: org.verification.adminNotes || '',
          rejectionReason: org.verification.rejectionReason || '',
          verifiedAt: org.verification.verifiedAt || null,
          createdAt: org.createdAt,
          organization: org,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: verifications.length,
      verifications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Approve or Reject Organization Verification
// @route   PUT /api/admin/verifications/:id
// @access  Private (ADMIN)
const reviewVerification = async (req, res, next) => {
  try {
    const { id } = req.params; // organizationId or verificationId
    const { status, adminNotes, rejectionReason, gstinVerificationStatus } = req.body;

    const normalizedStatus = (status || '').toUpperCase();
    if (!['APPROVED', 'REJECTED', 'VERIFIED', 'UNDER_REVIEW', 'PENDING_VERIFICATION'].includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid status: APPROVED, REJECTED, VERIFIED, or UNDER_REVIEW.',
      });
    }

    // Find organization by organizationId or userId or verificationId
    let organization = await Organization.findOne({
      $or: [{ organizationId: id }, { userId: id }],
    });

    if (!organization) {
      const record = await VerificationRecord.findOne({
        $or: [{ verificationId: id }, { organizationId: id }],
      });
      if (record) {
        organization = await Organization.findOne({ organizationId: record.organizationId });
      }
    }

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found.',
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

    // Update VerificationRecord
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
