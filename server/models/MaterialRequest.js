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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MaterialRequest', MaterialRequestSchema);
