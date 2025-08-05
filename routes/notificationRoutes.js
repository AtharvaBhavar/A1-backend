const express = require('express');
const Notification = require('../models/Notification');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Get notifications for current user
router.get('/', verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';
    const type = req.query.type;

    const query = {
      $or: [
        { targetRoles: { $in: [req.user.role] } },
        { targetRoles: { $size: 0 } }
      ]
    };

    if (unreadOnly) {
      query['readBy.user'] = { $ne: req.user._id };
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    const total = await Notification.countDocuments(query);
    
    const notifications = await Notification.find(query)
      .populate('data.componentId', 'component_name part_number location_bin')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Mark which notifications are read by current user
    const notificationsWithReadStatus = notifications.map(notification => {
      const notificationObj = notification.toObject();
      notificationObj.isReadByUser = notification.readBy.some(
        readInfo => readInfo.user.toString() === req.user._id.toString()
      );
      return notificationObj;
    });

    res.json({
      notifications: notificationsWithReadStatus,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalNotifications: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Notifications fetch error:', error);
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
});

// Get unread notification count
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      $or: [
        { targetRoles: { $in: [req.user.role] } },
        { targetRoles: { $size: 0 } }
      ],
      'readBy.user': { $ne: req.user._id }
    });

    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Unread count fetch error:', error);
    res.status(500).json({ message: 'Error fetching unread count', error: error.message });
  }
});

// Mark notification as read
router.post('/:id/read', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Check if user already marked as read
    const alreadyRead = notification.readBy.some(
      readInfo => readInfo.user.toString() === req.user._id.toString()
    );

    if (!alreadyRead) {
      notification.readBy.push({
        user: req.user._id,
        readAt: new Date()
      });
      await notification.save();
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Error marking notification as read', error: error.message });
  }
});

// Mark all notifications as read
router.post('/mark-all-read', verifyToken, async (req, res) => {
  try {
    const notifications = await Notification.find({
      $or: [
        { targetRoles: { $in: [req.user.role] } },
        { targetRoles: { $size: 0 } }
      ],
      'readBy.user': { $ne: req.user._id }
    });

    const bulkOps = notifications.map(notification => ({
      updateOne: {
        filter: { _id: notification._id },
        update: {
          $push: {
            readBy: {
              user: req.user._id,
              readAt: new Date()
            }
          }
        }
      }
    }));

    if (bulkOps.length > 0) {
      await Notification.bulkWrite(bulkOps);
    }

    res.json({ 
      message: 'All notifications marked as read',
      updatedCount: bulkOps.length
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ message: 'Error marking all notifications as read', error: error.message });
  }
});

// Delete notification (Admin only or notification older than 30 days)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Check if user is admin or notification is old enough
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (req.user.role !== 'Admin' && notification.createdAt > thirtyDaysAgo) {
      return res.status(403).json({ 
        message: 'Only admins can delete recent notifications' 
      });
    }

    await Notification.findByIdAndDelete(id);

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Notification deletion error:', error);
    res.status(500).json({ message: 'Error deleting notification', error: error.message });
  }
});

// Get notification statistics (Admin only)
router.get('/stats', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const stats = await Notification.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          unreadCount: {
            $sum: {
              $cond: [{ $eq: [{ $size: '$readBy' }, 0] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const totalNotifications = await Notification.countDocuments();
    const totalUnread = await Notification.countDocuments({
      readBy: { $size: 0 }
    });

    res.json({
      totalNotifications,
      totalUnread,
      byType: stats
    });
  } catch (error) {
    console.error('Notification stats error:', error);
    res.status(500).json({ message: 'Error fetching notification statistics', error: error.message });
  }
});

module.exports = router;