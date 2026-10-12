const User = require('../models/User');

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
  } catch (error) {
    console.error(`❌ Error seeding Admin user: ${error.message}`);
  }
};

module.exports = seedAdminUser;
