const mongoose = require('mongoose');

const componentSchema = new mongoose.Schema({
  component_name: {
    type: String,
    required: true,
    trim: true
  },
  manufacturer_supplier: {
    type: String,
    required: true,
    trim: true
  },
  part_number: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  location_bin: {
    type: String,
    required: true,
    trim: true
  },
  unit_price: {
    type: Number,
    required: true,
    min: 0
  },
  datasheet_link: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Datasheet link must be a valid URL'
    }
  },
  category: {
    type: String,
    required: true,
    enum: [
      'ICs', 'Resistors', 'Capacitors', 'Inductors', 'Diodes', 
      'Transistors', 'Connectors', 'Sensors', 'Modules', 
      'PCBs', 'Tools', 'Others'
    ]
  },
  critical_low_threshold: {
    type: Number,
    required: true,
    min: 0,
    default: 10
  },
  last_outward: {
    type: Date,
    default: Date.now
  },
  image_url: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better search performance
componentSchema.index({ component_name: 'text', part_number: 'text', description: 'text' });
componentSchema.index({ category: 1 });
componentSchema.index({ quantity: 1 });
componentSchema.index({ last_outward: 1 });

// Virtual for checking if stock is low
componentSchema.virtual('isLowStock').get(function() {
  return this.quantity <= this.critical_low_threshold;
});

// Virtual for checking if stock is stale (no outward in 90+ days)
componentSchema.virtual('isStale').get(function() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  return this.last_outward < ninetyDaysAgo;
});

componentSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Component', componentSchema);