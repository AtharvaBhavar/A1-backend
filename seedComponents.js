const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Component = require('./models/Component');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lims_inventory';

// Replace this with a valid user ObjectId from your `User` collection
const DUMMY_USER_ID = '64eeaa4eeb0c2cf32ac4d123';

const seedComponents = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(' Connected to MongoDB');

    await Component.deleteMany({});
    console.log(' Cleared existing components');

    const components = [
      {
        component_name: 'Resistor (100 Ohm, 1/4W)',
        manufacturer_supplier: 'Generic',
        part_number: 'R100_1/4W',
        description: 'Carbon Film, 5% Tolerance',
        quantity: 500,
        location_bin: 'R-Shelf-A1',
        unit_price: 0.5,
        category: 'Resistors',
        critical_low_threshold: 100,
        createdBy: DUMMY_USER_ID
      },
      {
        component_name: 'Ceramic Cap (0.1uF, 50V)',
        manufacturer_supplier: 'Generic',
        part_number: 'C0.1UF_50V_CER',
        description: 'Ceramic Disc Capacitor',
        quantity: 800,
        location_bin: 'C-BinB1',
        unit_price: 0.8,
        category: 'Capacitors',
        critical_low_threshold: 200,
        createdBy: DUMMY_USER_ID
      },
      {
        component_name: 'NE555 Timer IC',
        manufacturer_supplier: 'Texas Instruments',
        part_number: 'NE555P',
        description: 'Precision Timer IC',
        quantity: 80,
        location_bin: 'IC-Box-F1',
        unit_price: 8.0,
        category: 'ICs',
        critical_low_threshold: 20,
        createdBy: DUMMY_USER_ID
      },
      {
        component_name: 'DHT11 Temp/Humidity Sensor',
        manufacturer_supplier: 'Aosong',
        part_number: 'DHT11',
        description: 'Digital Temperature & Humidity Sensor',
        quantity: 15,
        location_bin: 'Sensor-BinH1',
        unit_price: 50,
        category: 'Sensors',
        critical_low_threshold: 3,
        createdBy: DUMMY_USER_ID
      },
      {
        component_name: 'Breadboard (Full Size)',
        manufacturer_supplier: 'Generic',
        part_number: 'BRDBRD-FULL',
        description: '830 Tie Points',
        quantity: 10,
        location_bin: 'MiscShelfN2',
        unit_price: 70,
        category: 'Others',
        critical_low_threshold: 2,
        createdBy: DUMMY_USER_ID
      },
    ];

    await Component.insertMany(components);
    console.log(` Seeded ${components.length} components`);

    process.exit(0);
  } catch (err) {
    console.error(' Seeding failed:', err.message);
    process.exit(1);
  }
};

seedComponents();
