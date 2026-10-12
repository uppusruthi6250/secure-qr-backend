const Organization = require('../models/Organization');
const VerificationRecord = require('../models/VerificationRecord');

// @desc    Upload supporting document or QR image
// @route   POST /api/organizations/upload
// @access  Private
const uploadDocumentFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded.',
      });
    }

    const fileReference = `/uploads/${req.file.filename}`;
    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      fileReference,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register complete organization details (Step-by-step submission)
// @route   POST /api/organizations
// @access  Private (ORGANIZATION, ADMIN)
const registerOrganization = async (req, res, next) => {
  try {
    const {
      organizationName,
      category,
      customCategory,
      description,
      email,
      phone,
      website,
      address,
      applicableRegistrations,
      registrationNumbers,
      documents,
    } = req.body;

    if (!organizationName || !category || !email || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: 'Please provide organizationName, category, email, phone, and address.',
      });
    }

    // Check if organization profile already exists for this user
    let organization = await Organization.findOne({ userId: req.user.userId });

    if (organization) {
      // Allow update / resubmit if rejected or pending
      organization.organizationName = organizationName;
      organization.category = category;
      organization.customCategory = customCategory || '';
      organization.description = description || '';
      organization.email = email.toLowerCase();
      organization.phone = phone;
      organization.website = website || '';
      organization.address = address;
      organization.applicableRegistrations = applicableRegistrations || [];
      organization.registrationNumbers = registrationNumbers || {};
      if (documents && documents.length > 0) {
        organization.documents = documents;
      }
      organization.verification.status = 'PENDING_VERIFICATION';
      organization.verification.rejectionReason = '';
      organization.verificationStatus = 'PENDING_VERIFICATION';

      await organization.save();

      // Update or create verification record
      await VerificationRecord.findOneAndUpdate(
        { organizationId: organization.organizationId },
        {
          verificationType: (applicableRegistrations && applicableRegistrations[0]) || 'MANUAL',
          registrationNumber: (registrationNumbers && (registrationNumbers.gstin || registrationNumbers.fssai || registrationNumbers.mcaCin || registrationNumbers.msmeUdyam || registrationNumbers.pan)) || 'PENDING',
          status: 'UNDER_REVIEW',
          adminNotes: 'Resubmitted by organization for verification review.',
        },
        { upsert: true, new: true }
      );

      return res.status(200).json({
        success: true,
        message: 'Organization registration updated and resubmitted successfully for Admin review.',
        organization,
      });
    }

    // Generate Organization ID
    const organizationId = `org_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    organization = await Organization.create({
      organizationId,
      userId: req.user.userId,
      organizationName,
      category,
      customCategory: customCategory || '',
      description: description || '',
      email: email.toLowerCase(),
      phone,
      website: website || '',
      address,
      applicableRegistrations: applicableRegistrations || [],
      registrationNumbers: registrationNumbers || {},
      documents: documents || [],
      verification: {
        status: 'PENDING_VERIFICATION',
        gstinVerificationStatus: 'PENDING',
      },
      verificationStatus: 'PENDING_VERIFICATION',
    });

    // Create Verification Record
    const verificationId = `ver_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const primaryRegNum = (registrationNumbers && (registrationNumbers.gstin || registrationNumbers.fssai || registrationNumbers.mcaCin || registrationNumbers.msmeUdyam || registrationNumbers.pan)) || 'PENDING';
    const primaryRegType = (applicableRegistrations && applicableRegistrations[0]) || 'MANUAL';

    await VerificationRecord.create({
      verificationId,
      organizationId,
      verificationType: primaryRegType,
      registrationNumber: primaryRegNum,
      status: 'UNDER_REVIEW',
    });

    return res.status(201).json({
      success: true,
      message: 'Organization registration submitted successfully. Status is PENDING_VERIFICATION.',
      organization,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current organization profile
// @route   GET /api/organizations/profile
// @access  Private
const getProfile = async (req, res, next) => {
  try {
    const organization = await Organization.findOne({ userId: req.user.userId });
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization profile not found for this user account.',
      });
    }

    return res.status(200).json({
      success: true,
      organization,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update organization profile
// @route   PUT /api/organizations/profile
// @access  Private (ORGANIZATION, ADMIN)
const updateProfile = async (req, res, next) => {
  try {
    const organization = await Organization.findOne({ userId: req.user.userId });
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization profile not found.',
      });
    }

    const { organizationName, address, phone, email, website, description } = req.body;

    if (organizationName) organization.organizationName = organizationName;
    if (address) organization.address = address;
    if (phone) organization.phone = phone;
    if (email) organization.email = email.toLowerCase();
    if (website !== undefined) organization.website = website;
    if (description !== undefined) organization.description = description;

    await organization.save();

    return res.status(200).json({
      success: true,
      message: 'Organization profile updated successfully.',
      organization,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadDocumentFile,
  registerOrganization,
  getProfile,
  updateProfile,
};
