const mongoose = require('mongoose');

const MaterialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Material name is required'],
    trim: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category reference is required']
  },
  unit: {
    type: String,
    required: [true, 'Unit of measurement is required'],
    trim: true
  },
  estimatedPrice: {
    type: Number,
    required: [true, 'Estimated price index is required'],
    min: [0, 'Estimated price must be positive']
  },
  currentStock: {
    type: Number,
    required: true,
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  minimumStock: {
    type: Number,
    required: true,
    min: [0, 'Minimum stock cannot be negative'],
    default: 0
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  suppliers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  }],
  description: {
    type: String,
    trim: true
  },
  image: {
    type: String, // data URL or path
    default: ''
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Material', MaterialSchema);
