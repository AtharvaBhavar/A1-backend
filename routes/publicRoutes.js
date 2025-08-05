const express = require('express');
const { body, validationResult } = require('express-validator');
const Component = require('../models/Component');
const User = require('../models/User');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Public signup endpoint for testing purposes
router.post('/signup', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['Admin', 'Lab Technician', 'Researcher', 'Engineer']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { name, email, password, role = 'Researcher' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create new user (without admin requirement for testing)
    const user = new User({
      name,
      email,
      password,
      role: role || 'Researcher', // Default to Researcher if no role specified
      isActive: true
    });

    await user.save();

    res.status(201).json({ 
      message: 'Account created successfully! You can now login.', 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Public signup error:', error);
    res.status(500).json({ message: 'Error creating account', error: error.message });
  }
});

// Public API to get component by part number
router.get('/components', optionalAuth, async (req, res) => {
  try {
    const { part, search, category, limit = 20 } = req.query;
    
    let query = {};
    
    if (part) {
      query.part_number = { $regex: part, $options: 'i' };
    }
    
    if (search) {
      query.$or = [
        { component_name: { $regex: search, $options: 'i' } },
        { part_number: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = category;
    }
    
    const components = await Component.find(query)
      .select('component_name part_number description quantity location_bin unit_price category manufacturer_supplier datasheet_link')
      .limit(parseInt(limit))
      .sort({ component_name: 1 });
    
    res.json({
      components,
      count: components.length,
      api_version: '1.0',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Public API error:', error);
    res.status(500).json({ 
      message: 'Error fetching components', 
      error: error.message 
    });
  }
});

// Public API to get categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Component.distinct('category');
    const categoryCounts = await Component.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const categoriesWithCounts = categories.map(category => {
      const categoryData = categoryCounts.find(item => item._id === category);
      return {
        name: category,
        count: categoryData ? categoryData.count : 0
      };
    });

    res.json({
      categories: categoriesWithCounts,
      api_version: '1.0',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Public categories API error:', error);
    res.status(500).json({ 
      message: 'Error fetching categories', 
      error: error.message 
    });
  }
});

// Public API stats
router.get('/stats', async (req, res) => {
  try {
    const totalComponents = await Component.countDocuments();
    const totalCategories = await Component.distinct('category').then(cats => cats.length);
    const lowStockCount = await Component.countDocuments({
      $expr: { $lte: ['$quantity', '$critical_low_threshold'] }
    });
    
    res.json({
      totalComponents,
      totalCategories,
      lowStockCount,
      api_version: '1.0',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Public stats API error:', error);
    res.status(500).json({ 
      message: 'Error fetching stats', 
      error: error.message 
    });
  }
});

module.exports = router;