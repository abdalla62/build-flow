const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  material: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: false // Optional: null can mean central warehouse
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  type: {
    type: String,
    enum: ['Stock In', 'Stock Out'],
    required: true
  },
  referenceType: {
    type: String,
    enum: ['Delivery', 'Adjustment', 'Request'],
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Inventory', InventorySchema);
