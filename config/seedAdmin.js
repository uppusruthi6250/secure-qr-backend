const User = require('../models/User');
const FraudReport = require('../models/FraudReport');

const seedAdminUser = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@secureqr.com';
    const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase() });

    if (!existingAdmin) {
      const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123';
      const hashedPassword = await User.hashPassword(adminPassword);

      const adminUser = await User.create({
        userId: 'usr_admin_default_01',
        name: 'System Administrator',
        email: adminEmail.toLowerCase(),
        phone: '0000000000',
        passwordHash: hashedPassword,
        role: 'ADMIN',
      });

      console.log(`👤 Default Admin account seeded: ${adminUser.email}`);
    } else {
      console.log(`ℹ️ Admin account already exists: ${existingAdmin.email}`);
    }

    // Seed sample fraud report if none exist so admin dashboard displays data immediately
    const reportCount = await FraudReport.countDocuments();
    if (reportCount === 0) {
      await FraudReport.create({
        reportId: 'rep_sample_01',
        reportedBy: 'usr_demo_customer',
        reason: 'Suspicious QR',
        description: 'Fake payment sticker pasted over counter QR code at local store.',
        status: 'OPEN',
      });
      console.log('🚨 Sample fraud report seeded.');
    }
  } catch (error) {
    console.error(`❌ Error seeding Admin user or reports: ${error.message}`);
  }
};

module.exports = seedAdminUser;
