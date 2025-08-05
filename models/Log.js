const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  component: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Component',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['inward', 'outward', 'adjustment', 'created', 'updated', 'deleted']
  },
  quantity_changed: {
    type: Number,
    required: true
  },
  previous_quantity: {
    type: Number,
    required: true
  },
  new_quantity: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  project_name: {
    type: String,
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String,
    trim: true
  },
  batch_id: {
    type: String,
    trim: true
  },
  supplier_info: {
    name: String,
    invoice_number: String,
    purchase_date: Date,
    unit_cost: Number
  }
}, {
  timestamps: true
});

// Indexes for better query performance
logSchema.index({ component: 1, createdAt: -1 });
logSchema.index({ user: 1, createdAt: -1 });
logSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('Log', logSchema);