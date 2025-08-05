const express = require('express');
const { Parser } = require('json2csv');
const Component = require('../models/Component');
const Log = require('../models/Log');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Export components to CSV
router.get('/components', verifyToken, async (req, res) => {
  try {
    const format = req.query.format || 'csv';
    const includeEmpty = req.query.includeEmpty === 'true';
    
    let query = {};
    if (!includeEmpty) {
      query.quantity = { $gt: 0 };
    }
    
    const components = await Component.find(query)
      .populate('createdBy updatedBy', 'name email')
      .sort({ component_name: 1 });
    
    if (format === 'csv') {
      const fields = [
        'component_name',
        'part_number', 
        'manufacturer_supplier',
        'description',
        'quantity',
        'location_bin',
        'unit_price',
        'category',
        'critical_low_threshold',
        'datasheet_link',
        'createdAt',
        'updatedAt'
      ];
      
      const opts = { fields };
      const parser = new Parser(opts);
      const csv = parser.parse(components.map(comp => ({
        component_name: comp.component_name,
        part_number: comp.part_number,
        manufacturer_supplier: comp.manufacturer_supplier,
        description: comp.description,
        quantity: comp.quantity,
        location_bin: comp.location_bin,
        unit_price: comp.unit_price,
        category: comp.category,
        critical_low_threshold: comp.critical_low_threshold,
        datasheet_link: comp.datasheet_link || '',
        createdAt: comp.createdAt.toISOString(),
        updatedAt: comp.updatedAt.toISOString()
      })));
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=components-${Date.now()}.csv`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=components-${Date.now()}.json`);
      res.json(components);
    }
  } catch (error) {
    console.error('Components export error:', error);
    res.status(500).json({ message: 'Error exporting components', error: error.message });
  }
});

// Export inventory logs to CSV
router.get('/logs', verifyToken, async (req, res) => {
  try {
    const format = req.query.format || 'csv';
    const days = parseInt(req.query.days) || 30;
    const action = req.query.action;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    let query = { createdAt: { $gte: startDate } };
    if (action && action !== 'all') {
      query.action = action;
    }
    
    const logs = await Log.find(query)
      .populate('component', 'component_name part_number category location_bin')
      .populate('user', 'name email role')
      .sort({ createdAt: -1 });
    
    if (format === 'csv') {
      const fields = [
        'date',
        'action',
        'component_name',
        'part_number',
        'quantity_changed',
        'previous_quantity',
        'new_quantity',
        'reason',
        'project_name',
        'user_name',
        'user_role',
        'notes'
      ];
      
      const opts = { fields };
      const parser = new Parser(opts);
      const csv = parser.parse(logs.map(log => ({
        date: log.createdAt.toISOString(),
        action: log.action,
        component_name: log.component?.component_name || 'N/A',
        part_number: log.component?.part_number || 'N/A',
        quantity_changed: log.quantity_changed,
        previous_quantity: log.previous_quantity,
        new_quantity: log.new_quantity,
        reason: log.reason,
        project_name: log.project_name || '',
        user_name: log.user?.name || 'N/A',
        user_role: log.user?.role || 'N/A',
        notes: log.notes || ''
      })));
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=inventory-logs-${Date.now()}.csv`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=inventory-logs-${Date.now()}.json`);
      res.json(logs);
    }
  } catch (error) {
    console.error('Logs export error:', error);
    res.status(500).json({ message: 'Error exporting logs', error: error.message });
  }
});

// Export low stock report
router.get('/low-stock', verifyToken, async (req, res) => {
  try {
    const format = req.query.format || 'csv';
    
    const lowStockComponents = await Component.find({
      $expr: { $lte: ['$quantity', '$critical_low_threshold'] }
    }).sort({ quantity: 1 });
    
    if (format === 'csv') {
      const fields = [
        'component_name',
        'part_number',
        'quantity',
        'critical_low_threshold',
        'shortage',
        'location_bin',
        'manufacturer_supplier',
        'unit_price',
        'estimated_reorder_cost',
        'category'
      ];
      
      const opts = { fields };
      const parser = new Parser(opts);
      const csv = parser.parse(lowStockComponents.map(comp => {
        const shortage = Math.max(0, comp.critical_low_threshold - comp.quantity);
        const reorderQuantity = comp.critical_low_threshold * 2; // Reorder to 2x threshold
        const estimatedCost = reorderQuantity * comp.unit_price;
        
        return {
          component_name: comp.component_name,
          part_number: comp.part_number,
          quantity: comp.quantity,
          critical_low_threshold: comp.critical_low_threshold,
          shortage: shortage,
          location_bin: comp.location_bin,
          manufacturer_supplier: comp.manufacturer_supplier,
          unit_price: comp.unit_price,
          estimated_reorder_cost: estimatedCost.toFixed(2),
          category: comp.category
        };
      }));
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=low-stock-report-${Date.now()}.csv`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=low-stock-report-${Date.now()}.json`);
      res.json(lowStockComponents);
    }
  } catch (error) {
    console.error('Low stock export error:', error);
    res.status(500).json({ message: 'Error exporting low stock report', error: error.message });
  }
});

// Export stale stock report
router.get('/stale-stock', verifyToken, async (req, res) => {
  try {
    const format = req.query.format || 'csv';
    const days = parseInt(req.query.days) || 90;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const staleComponents = await Component.find({
      last_outward: { $lt: cutoffDate },
      quantity: { $gt: 0 }
    }).sort({ last_outward: 1 });
    
    if (format === 'csv') {
      const fields = [
        'component_name',
        'part_number',
        'quantity',
        'last_outward',
        'days_since_last_use',
        'location_bin',
        'unit_price',
        'tied_up_value',
        'category'
      ];
      
      const opts = { fields };
      const parser = new Parser(opts);
      const csv = parser.parse(staleComponents.map(comp => {
        const daysSinceLastUse = Math.floor((new Date() - comp.last_outward) / (1000 * 60 * 60 * 24));
        const tiedUpValue = comp.quantity * comp.unit_price;
        
        return {
          component_name: comp.component_name,
          part_number: comp.part_number,
          quantity: comp.quantity,
          last_outward: comp.last_outward.toISOString(),
          days_since_last_use: daysSinceLastUse,
          location_bin: comp.location_bin,
          unit_price: comp.unit_price,
          tied_up_value: tiedUpValue.toFixed(2),
          category: comp.category
        };
      }));
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=stale-stock-report-${Date.now()}.csv`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=stale-stock-report-${Date.now()}.json`);
      res.json(staleComponents);
    }
  } catch (error) {
    console.error('Stale stock export error:', error);
    res.status(500).json({ message: 'Error exporting stale stock report', error: error.message });
  }
});

// Export inventory valuation report
router.get('/valuation', verifyToken, async (req, res) => {
  try {
    const format = req.query.format || 'csv';
    
    const components = await Component.aggregate([
      {
        $match: { quantity: { $gt: 0 } }
      },
      {
        $addFields: {
          total_value: { $multiply: ['$quantity', '$unit_price'] }
        }
      },
      {
        $group: {
          _id: '$category',
          total_quantity: { $sum: '$quantity' },
          total_value: { $sum: '$total_value' },
          component_count: { $sum: 1 },
          avg_unit_price: { $avg: '$unit_price' },
          components: {
            $push: {
              component_name: '$component_name',
              part_number: '$part_number',
              quantity: '$quantity',
              unit_price: '$unit_price',
              total_value: '$total_value',
              location_bin: '$location_bin'
            }
          }
        }
      },
      {
        $sort: { total_value: -1 }
      }
    ]);
    
    if (format === 'csv') {
      // Flatten the data for CSV export
      const flatData = [];
      components.forEach(category => {
        category.components.forEach(comp => {
          flatData.push({
            category: category._id,
            component_name: comp.component_name,
            part_number: comp.part_number,
            quantity: comp.quantity,
            unit_price: comp.unit_price,
            total_value: comp.total_value.toFixed(2),
            location_bin: comp.location_bin
          });
        });
      });
      
      const fields = [
        'category',
        'component_name',
        'part_number',
        'quantity',
        'unit_price',
        'total_value',
        'location_bin'
      ];
      
      const opts = { fields };
      const parser = new Parser(opts);
      const csv = parser.parse(flatData);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=inventory-valuation-${Date.now()}.csv`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=inventory-valuation-${Date.now()}.json`);
      res.json(components);
    }
  } catch (error) {
    console.error('Valuation export error:', error);
    res.status(500).json({ message: 'Error exporting valuation report', error: error.message });
  }
});

// Export users list (Admin only)
router.get('/users', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const format = req.query.format || 'csv';
    
    const users = await User.find()
      .populate('createdBy', 'name email')
      .select('-password')
      .sort({ createdAt: -1 });
    
    if (format === 'csv') {
      const fields = [
        'name',
        'email',
        'role',
        'isActive',
        'lastLogin',
        'createdAt',
        'createdBy'
      ];
      
      const opts = { fields };
      const parser = new Parser(opts);
      const csv = parser.parse(users.map(user => ({
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin ? user.lastLogin.toISOString() : '',
        createdAt: user.createdAt.toISOString(),
        createdBy: user.createdBy ? user.createdBy.name : ''
      })));
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=users-${Date.now()}.csv`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=users-${Date.now()}.json`);
      res.json(users);
    }
  } catch (error) {
    console.error('Users export error:', error);
    res.status(500).json({ message: 'Error exporting users', error: error.message });
  }
});

module.exports = router;