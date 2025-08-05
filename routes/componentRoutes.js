const express = require('express');
const { body, validationResult } = require('express-validator');
const Component = require('../models/Component');
const Log = require('../models/Log');
const { verifyToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// Get all components
router.get('/', verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const category = req.query.category;
    const location = req.query.location;
    const lowStock = req.query.lowStock === 'true';
    const stale = req.query.stale === 'true';
    const sortBy = req.query.sortBy || 'updatedAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const query = {};
    
    // Search functionality
    if (search) {
      query.$or = [
        { component_name: { $regex: search, $options: 'i' } },
        { part_number: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { manufacturer_supplier: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by category
    if (category && category !== 'all') {
      query.category = category;
    }
    
    // Filter by location
    if (location) {
      query.location_bin = { $regex: location, $options: 'i' };
    }
    
    // Filter low stock
    if (lowStock) {
      query.$expr = { $lte: ['$quantity', '$critical_low_threshold'] };
    }
    
    // Filter stale stock (90+ days)
    if (stale) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      query.last_outward = { $lt: ninetyDaysAgo };
    }

    const total = await Component.countDocuments(query);
    
    const components = await Component.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      components,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalComponents: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Components fetch error:', error);
    res.status(500).json({ message: 'Error fetching components', error: error.message });
  }
});

// Get component by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const component = await Component.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    
    if (!component) {
      return res.status(404).json({ message: 'Component not found' });
    }

    // Get recent logs for this component
    const logs = await Log.find({ component: component._id })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ component, logs });
  } catch (error) {
    console.error('Component fetch error:', error);
    res.status(500).json({ message: 'Error fetching component', error: error.message });
  }
});

// Create new component
router.post('/', [
  verifyToken,
  checkRole(['Admin', 'Lab Technician']),
  body('component_name').trim().notEmpty().withMessage('Component name is required'),
  body('manufacturer_supplier').trim().notEmpty().withMessage('Manufacturer/Supplier is required'),
  body('part_number').trim().notEmpty().withMessage('Part number is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('location_bin').trim().notEmpty().withMessage('Location/Bin is required'),
  body('unit_price').isFloat({ min: 0 }).withMessage('Unit price must be a non-negative number'),
  body('category').isIn(['ICs', 'Resistors', 'Capacitors', 'Inductors', 'Diodes', 'Transistors', 'Connectors', 'Sensors', 'Modules', 'PCBs', 'Tools', 'Others']).withMessage('Invalid category'),
  body('critical_low_threshold').isInt({ min: 0 }).withMessage('Critical low threshold must be a non-negative integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const componentData = {
      ...req.body,
      part_number: req.body.part_number.toUpperCase(),
      createdBy: req.user._id
    };

    // Check if part number already exists
    const existingComponent = await Component.findOne({ 
      part_number: componentData.part_number 
    });
    
    if (existingComponent) {
      return res.status(400).json({ 
        message: 'Component with this part number already exists' 
      });
    }

    const component = new Component(componentData);
    await component.save();

    // Create log entry
    const log = new Log({
      component: component._id,
      action: 'created',
      quantity_changed: component.quantity,
      previous_quantity: 0,
      new_quantity: component.quantity,
      reason: 'Component created',
      user: req.user._id
    });
    await log.save();

    await component.populate('createdBy', 'name email');

    res.status(201).json({ 
      message: 'Component created successfully', 
      component 
    });
  } catch (error) {
    console.error('Component creation error:', error);
    res.status(500).json({ message: 'Error creating component', error: error.message });
  }
});

// Update component
router.put('/:id', [
  verifyToken,
  checkRole(['Admin', 'Lab Technician']),
  body('component_name').optional().trim().notEmpty().withMessage('Component name cannot be empty'),
  body('manufacturer_supplier').optional().trim().notEmpty().withMessage('Manufacturer/Supplier cannot be empty'),
  body('part_number').optional().trim().notEmpty().withMessage('Part number cannot be empty'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('location_bin').optional().trim().notEmpty().withMessage('Location/Bin cannot be empty'),
  body('unit_price').optional().isFloat({ min: 0 }).withMessage('Unit price must be a non-negative number'),
  body('category').optional().isIn(['ICs', 'Resistors', 'Capacitors', 'Inductors', 'Diodes', 'Transistors', 'Connectors', 'Sensors', 'Modules', 'PCBs', 'Tools', 'Others']).withMessage('Invalid category'),
  body('critical_low_threshold').optional().isInt({ min: 0 }).withMessage('Critical low threshold must be a non-negative integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { id } = req.params;
    const updateData = { ...req.body, updatedBy: req.user._id };

    if (updateData.part_number) {
      updateData.part_number = updateData.part_number.toUpperCase();
      
      // Check if part number already exists (excluding current component)
      const existingComponent = await Component.findOne({ 
        part_number: updateData.part_number,
        _id: { $ne: id }
      });
      
      if (existingComponent) {
        return res.status(400).json({ 
          message: 'Component with this part number already exists' 
        });
      }
    }

    const oldComponent = await Component.findById(id);
    if (!oldComponent) {
      return res.status(404).json({ message: 'Component not found' });
    }

    const component = await Component.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy updatedBy', 'name email');

    // Create log entry for updates
    const log = new Log({
      component: component._id,
      action: 'updated',
      quantity_changed: 0,
      previous_quantity: component.quantity,
      new_quantity: component.quantity,
      reason: 'Component updated',
      user: req.user._id,
      notes: `Updated fields: ${Object.keys(updateData).filter(key => key !== 'updatedBy').join(', ')}`
    });
    await log.save();

    res.json({ 
      message: 'Component updated successfully', 
      component 
    });
  } catch (error) {
    console.error('Component update error:', error);
    res.status(500).json({ message: 'Error updating component', error: error.message });
  }
});

// Delete component
router.delete('/:id', [
  verifyToken,
  checkRole(['Admin'])
], async (req, res) => {
  try {
    const { id } = req.params;
    
    const component = await Component.findById(id);
    if (!component) {
      return res.status(404).json({ message: 'Component not found' });
    }

    // Create log entry before deletion
    const log = new Log({
      component: component._id,
      action: 'deleted',
      quantity_changed: -component.quantity,
      previous_quantity: component.quantity,
      new_quantity: 0,
      reason: 'Component deleted',
      user: req.user._id
    });
    await log.save();

    await Component.findByIdAndDelete(id);

    res.json({ message: 'Component deleted successfully' });
  } catch (error) {
    console.error('Component deletion error:', error);
    res.status(500).json({ message: 'Error deleting component', error: error.message });
  }
});

// Inward inventory
router.post('/:id/inward', [
  verifyToken,
  checkRole(['Admin', 'Lab Technician']),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('reason').trim().notEmpty().withMessage('Reason is required'),
  body('project_name').optional().trim(),
  body('batch_id').optional().trim(),
  body('supplier_info').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { id } = req.params;
    const { quantity, reason, project_name, batch_id, supplier_info, notes } = req.body;

    const component = await Component.findById(id);
    if (!component) {
      return res.status(404).json({ message: 'Component not found' });
    }

    const previousQuantity = component.quantity;
    const newQuantity = previousQuantity + quantity;

    // Update component quantity
    await Component.findByIdAndUpdate(id, { 
      quantity: newQuantity,
      updatedBy: req.user._id
    });

    // Create log entry
    const log = new Log({
      component: id,
      action: 'inward',
      quantity_changed: quantity,
      previous_quantity: previousQuantity,
      new_quantity: newQuantity,
      reason,
      project_name,
      user: req.user._id,
      notes,
      batch_id,
      supplier_info
    });
    await log.save();

    // Get updated component
    const updatedComponent = await Component.findById(id)
      .populate('createdBy updatedBy', 'name email');

    res.json({ 
      message: 'Inward inventory recorded successfully', 
      component: updatedComponent,
      log: await log.populate('user', 'name email')
    });
  } catch (error) {
    console.error('Inward inventory error:', error);
    res.status(500).json({ message: 'Error recording inward inventory', error: error.message });
  }
});

// Outward inventory
router.post('/:id/outward', [
  verifyToken,
  checkRole(['Admin', 'Engineer', 'Lab Technician']),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('reason').trim().notEmpty().withMessage('Reason is required'),
  body('project_name').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { id } = req.params;
    const { quantity, reason, project_name, notes } = req.body;

    const component = await Component.findById(id);
    if (!component) {
      return res.status(404).json({ message: 'Component not found' });
    }

    // Check if sufficient quantity is available
    if (component.quantity < quantity) {
      return res.status(400).json({ 
        message: 'Insufficient quantity available',
        available: component.quantity,
        requested: quantity
      });
    }

    const previousQuantity = component.quantity;
    const newQuantity = previousQuantity - quantity;

    // Update component quantity and last_outward date
    await Component.findByIdAndUpdate(id, { 
      quantity: newQuantity,
      last_outward: new Date(),
      updatedBy: req.user._id
    });

    // Create log entry
    const log = new Log({
      component: id,
      action: 'outward',
      quantity_changed: -quantity,
      previous_quantity: previousQuantity,
      new_quantity: newQuantity,
      reason,
      project_name,
      user: req.user._id,
      notes
    });
    await log.save();

    // Get updated component
    const updatedComponent = await Component.findById(id)
      .populate('createdBy updatedBy', 'name email');

    res.json({ 
      message: 'Outward inventory recorded successfully', 
      component: updatedComponent,
      log: await log.populate('user', 'name email')
    });
  } catch (error) {
    console.error('Outward inventory error:', error);
    res.status(500).json({ message: 'Error recording outward inventory', error: error.message });
  }
});

// Adjust inventory
router.post('/:id/adjust', [
  verifyToken,
  checkRole(['Admin']),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('reason').trim().notEmpty().withMessage('Reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { id } = req.params;
    const { quantity, reason, notes } = req.body;

    const component = await Component.findById(id);
    if (!component) {
      return res.status(404).json({ message: 'Component not found' });
    }

    const previousQuantity = component.quantity;
    const quantityChanged = quantity - previousQuantity;

    // Update component quantity
    await Component.findByIdAndUpdate(id, { 
      quantity: quantity,
      updatedBy: req.user._id
    });

    // Create log entry
    const log = new Log({
      component: id,
      action: 'adjustment',
      quantity_changed: quantityChanged,
      previous_quantity: previousQuantity,
      new_quantity: quantity,
      reason,
      user: req.user._id,
      notes
    });
    await log.save();

    // Get updated component
    const updatedComponent = await Component.findById(id)
      .populate('createdBy updatedBy', 'name email');

    res.json({ 
      message: 'Inventory adjustment recorded successfully', 
      component: updatedComponent,
      log: await log.populate('user', 'name email')
    });
  } catch (error) {
    console.error('Inventory adjustment error:', error);
    res.status(500).json({ message: 'Error adjusting inventory', error: error.message });
  }
});

// Get component logs
router.get('/:id/logs', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const action = req.query.action;

    const query = { component: id };
    if (action && action !== 'all') {
      query.action = action;
    }

    const total = await Log.countDocuments(query);
    
    const logs = await Log.find(query)
      .populate('user', 'name email')
      .populate('component', 'component_name part_number')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      logs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalLogs: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Component logs fetch error:', error);
    res.status(500).json({ message: 'Error fetching component logs', error: error.message });
  }
});

// Get component categories
router.get('/categories/list', verifyToken, async (req, res) => {
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

    res.json({ categories: categoriesWithCounts });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
});

// Get component locations
router.get('/locations/list', verifyToken, async (req, res) => {
  try {
    const locations = await Component.distinct('location_bin');
    const locationCounts = await Component.aggregate([
      { $group: { _id: '$location_bin', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const locationsWithCounts = locations.map(location => {
      const locationData = locationCounts.find(item => item._id === location);
      return {
        name: location,
        count: locationData ? locationData.count : 0
      };
    });

    res.json({ locations: locationsWithCounts });
  } catch (error) {
    console.error('Locations fetch error:', error);
    res.status(500).json({ message: 'Error fetching locations', error: error.message });
  }
});

module.exports = router;