const mongoose = require('mongoose');
const seedAdminUser = require('./seedAdmin');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s if MongoDB service is unavailable
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);

    // Seed default Admin user if not exists
    await seedAdminUser();
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.warn(`⚠️ Note: Ensure local MongoDB service is running on mongodb://127.0.0.1:27017 or update MONGODB_URI in backend/.env for MongoDB Atlas.`);
  }
};

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB connection disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ MongoDB connection error event: ${err}`);
});

module.exports = connectDB;
