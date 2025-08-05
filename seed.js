// seed.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();
MONGODB_URI='mongodb://localhost:27017/lims_inventory'


const seedUsers = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log(' Connected to MongoDB');

    // Clear existing users
    await User.deleteMany({});
    console.log(' Cleared old users');

    // Add demo users
    const users = [
      {
        name: 'Admin User',
        email: 'admin@lims.com',
        password: 'admin123',
        role: 'Admin',
        isActive: true
      },
      {
        name: 'Tech User',
        email: 'tech@lims.com',
        password: 'tech123',
        role: 'Lab Technician',
        isActive: true
      },
      {
        name: 'Engineer User',
        email: 'engineer@lims.com',
        password: 'eng123',
        role: 'Engineer',
        isActive: true
      },
      {
        name: 'Researcher User',
        email: 'researcher@lims.com',
        password: 'res123',
        role: 'Researcher',
        isActive: true
      }
    ];

    for (const userData of users) {
      const user = new User(userData);
      await user.save();
      console.log(` Created: ${user.email}`);
    }

    console.log(' Demo users seeded successfully');
    process.exit();
  } catch (error) {
    console.error(' Seeding error:', error);
    process.exit(1);
  }
};

seedUsers();
