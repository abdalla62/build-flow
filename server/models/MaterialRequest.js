const mongoose = require('mongoose');

const MaterialRequestSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project is required']
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Requester is required']
  },
  // Same id on every line submitted together so PM can review once
  batchId: {
    type: String,
    index: true,
    default: null
  },
  material: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: [true, 'Requested material is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  reason: {
    type: String,
    required: [true, 'Reason for request is required'],
    trim: true
  },
  requiredDate: {
    type: Date,
    required: [true, 'Required date is required']
  },
  attachments: {
    type: [String],
    default: []
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  suppliers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  }],
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Returned', 'Ordered', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  damagedReported: {
    quantity: { type: Number, default: 0 },
    comments: { type: String, default: '' },
    reportedAt: { type: Date }
  },
  missingReported: {
    quantity: { type: Number, default: 0 },
    comments: { type: String, default: '' },
    reportedAt: { type: Date }
  },
  // Suppliers who declined to bid (e.g. no stock)
  declinedBySuppliers: [{
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true
    },
    reason: {
      type: String,
      enum: ['No stock', 'Cannot supply', 'Other'],
      default: 'No stock'
    },
    notes: {
      type: String,
      default: '',
      trim: true
    },
    declinedAt: {
      type: Date,
      default: Date.now
    },
    declinedByUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('MaterialRequest', MaterialRequestSchema);
