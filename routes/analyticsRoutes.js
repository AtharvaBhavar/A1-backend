const express = require('express');
const Component = require('../models/Component');
const Log = require('../models/Log');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Dashboard statistics
router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Basic counts
    const totalComponents = await Component.countDocuments();
    const totalUsers = await User.countDocuments({ isActive: true });
    
    // Low stock components
    const lowStockComponents = await Component.find({
      $expr: { $lte: ['$quantity', '$critical_low_threshold'] }
    }).select('component_name part_number quantity critical_low_threshold location_bin');
    
    // Stale components (no outward in 90+ days)
    const staleComponents = await Component.find({
      last_outward: { $lt: ninetyDaysAgo },
      quantity: { $gt: 0 }
    }).select('component_name part_number quantity last_outward location_bin');
    
    // Recent activity (last 30 days)
    const recentInward = await Log.countDocuments({
      action: 'inward',
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    const recentOutward = await Log.countDocuments({
      action: 'outward',
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    // Total inventory value
    const inventoryValue = await Component.aggregate([
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$quantity', '$unit_price'] } }
        }
      }
    ]);
    
    // Category distribution
    const categoryStats = await Component.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: { $sum: { $multiply: ['$quantity', '$unit_price'] } }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      summary: {
        totalComponents,
        totalUsers,
        lowStockCount: lowStockComponents.length,
        staleComponentsCount: staleComponents.length,
        recentInward,
        recentOutward,
        totalInventoryValue: inventoryValue[0]?.totalValue || 0
      },
      lowStockComponents: lowStockComponents.slice(0, 10), // Top 10
      staleComponents: staleComponents.slice(0, 10), // Top 10
      categoryStats
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ message: 'Error fetching dashboard analytics', error: error.message });
  }
});

// Monthly inventory trends
router.get('/trends', verifyToken, async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    // Monthly inward/outward trends
    const monthlyTrends = await Log.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          action: { $in: ['inward', 'outward'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            action: '$action'
          },
          totalQuantity: { $sum: { $abs: '$quantity_changed' } },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: {
            year: '$_id.year',
            month: '$_id.month'
          },
          inward: {
            $sum: {
              $cond: [{ $eq: ['$_id.action', 'inward'] }, '$totalQuantity', 0]
            }
          },
          outward: {
            $sum: {
              $cond: [{ $eq: ['$_id.action', 'outward'] }, '$totalQuantity', 0]
            }
          },
          inwardTransactions: {
            $sum: {
              $cond: [{ $eq: ['$_id.action', 'inward'] }, '$transactionCount', 0]
            }
          },
          outwardTransactions: {
            $sum: {
              $cond: [{ $eq: ['$_id.action', 'outward'] }, '$transactionCount', 0]
            }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);
    
    res.json({ monthlyTrends });
  } catch (error) {
    console.error('Trends analytics error:', error);
    res.status(500).json({ message: 'Error fetching trends analytics', error: error.message });
  }
});

// Top components by activity
router.get('/top-components', verifyToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Most active components (by transaction count)
    const mostActive = await Log.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          action: { $in: ['inward', 'outward'] }
        }
      },
      {
        $group: {
          _id: '$component',
          transactionCount: { $sum: 1 },
          totalQuantityMoved: { $sum: { $abs: '$quantity_changed' } },
          lastActivity: { $max: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'components',
          localField: '_id',
          foreignField: '_id',
          as: 'component'
        }
      },
      {
        $unwind: '$component'
      },
      {
        $project: {
          component_name: '$component.component_name',
          part_number: '$component.part_number',
          category: '$component.category',
          current_quantity: '$component.quantity',
          transactionCount: 1,
          totalQuantityMoved: 1,
          lastActivity: 1
        }
      },
      {
        $sort: { transactionCount: -1 }
      },
      {
        $limit: 10
      }
    ]);
    
    // Most valuable components
    const mostValuable = await Component.find()
      .select('component_name part_number quantity unit_price category location_bin')
      .sort({ $expr: { $multiply: ['$quantity', '$unit_price'] } })
      .limit(10);
    
    res.json({
      mostActive,
      mostValuable: mostValuable.map(comp => ({
        ...comp.toObject(),
        totalValue: comp.quantity * comp.unit_price
      }))
    });
  } catch (error) {
    console.error('Top components analytics error:', error);
    res.status(500).json({ message: 'Error fetching top components analytics', error: error.message });
  }
});

// User activity analytics
router.get('/user-activity', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const userActivity = await Log.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$user',
          totalTransactions: { $sum: 1 },
          inwardTransactions: {
            $sum: {
              $cond: [{ $eq: ['$action', 'inward'] }, 1, 0]
            }
          },
          outwardTransactions: {
            $sum: {
              $cond: [{ $eq: ['$action', 'outward'] }, 1, 0]
            }
          },
          totalQuantityMoved: { $sum: { $abs: '$quantity_changed' } },
          lastActivity: { $max: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          name: '$user.name',
          email: '$user.email',
          role: '$user.role',
          totalTransactions: 1,
          inwardTransactions: 1,
          outwardTransactions: 1,
          totalQuantityMoved: 1,
          lastActivity: 1
        }
      },
      {
        $sort: { totalTransactions: -1 }
      }
    ]);
    
    res.json({ userActivity });
  } catch (error) {
    console.error('User activity analytics error:', error);
    res.status(500).json({ message: 'Error fetching user activity analytics', error: error.message });
  }
});

// Inventory health score
router.get('/health-score', verifyToken, async (req, res) => {
  try {
    const totalComponents = await Component.countDocuments();
    
    if (totalComponents === 0) {
      return res.json({
        healthScore: 100,
        details: {
          lowStockScore: 100,
          staleStockScore: 100,
          activityScore: 100
        },
        recommendations: ['Add components to start monitoring inventory health']
      });
    }
    
    // Low stock score (100 - percentage of low stock items)
    const lowStockCount = await Component.countDocuments({
      $expr: { $lte: ['$quantity', '$critical_low_threshold'] }
    });
    const lowStockScore = Math.max(0, 100 - (lowStockCount / totalComponents) * 100);
    
    // Stale stock score (100 - percentage of stale items)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const staleCount = await Component.countDocuments({
      last_outward: { $lt: ninetyDaysAgo },
      quantity: { $gt: 0 }
    });
    const staleStockScore = Math.max(0, 100 - (staleCount / totalComponents) * 100);
    
    // Activity score (based on recent activity)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentActivity = await Log.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      action: { $in: ['inward', 'outward'] }
    });
    
    // Activity score: normalize based on component count
    const activityScore = Math.min(100, (recentActivity / totalComponents) * 50);
    
    // Overall health score (weighted average)
    const healthScore = Math.round(
      (lowStockScore * 0.4) + (staleStockScore * 0.3) + (activityScore * 0.3)
    );
    
    const recommendations = [];
    if (lowStockScore < 80) recommendations.push('Reorder low stock components');
    if (staleStockScore < 70) recommendations.push('Review and relocate stale inventory');
    if (activityScore < 50) recommendations.push('Increase inventory activity or review thresholds');
    if (recommendations.length === 0) recommendations.push('Inventory health is good! Keep monitoring.');
    
    res.json({
      healthScore,
      details: {
        lowStockScore: Math.round(lowStockScore),
        staleStockScore: Math.round(staleStockScore),
        activityScore: Math.round(activityScore)
      },
      counts: {
        totalComponents,
        lowStockCount,
        staleCount,
        recentActivity
      },
      recommendations
    });
  } catch (error) {
    console.error('Health score analytics error:', error);
    res.status(500).json({ message: 'Error calculating health score', error: error.message });
  }
});

// Export analytics data
router.get('/export', verifyToken, async (req, res) => {
  try {
    const type = req.query.type || 'summary';
    const format = req.query.format || 'json';
    
    let data = {};
    
    switch (type) {
      case 'summary':
        const dashboardData = await router.handle({ method: 'GET', url: '/dashboard', user: req.user }, res);
        data = dashboardData;
        break;
        
      case 'trends':
        const trendsData = await router.handle({ method: 'GET', url: '/trends', user: req.user }, res);
        data = trendsData;
        break;
        
      default:
        return res.status(400).json({ message: 'Invalid export type' });
    }
    
    if (format === 'csv') {
      // Convert to CSV format
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-${type}-${Date.now()}.csv`);
      // TODO: Implement CSV conversion
      res.send('CSV export not implemented yet');
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-${type}-${Date.now()}.json`);
      res.json(data);
    }
  } catch (error) {
    console.error('Analytics export error:', error);
    res.status(500).json({ message: 'Error exporting analytics data', error: error.message });
  }
});

module.exports = router;