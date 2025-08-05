const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['low_stock', 'stale_stock', 'system', 'inventory_update']
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  data: {
    componentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Component'
    },
    quantity: Number,
    threshold: Number,
    additionalInfo: mongoose.Schema.Types.Mixed
  },
  read: {
    type: Boolean,
    default: false
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  targetRoles: [{
    type: String,
    enum: ['Admin', 'Lab Technician', 'Researcher', 'Engineer']
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: Date,
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    }
  }
}, {
  timestamps: true
});

// Index for efficient querying
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ read: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ targetRoles: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);