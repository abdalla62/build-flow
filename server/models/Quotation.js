const mongoose = require('mongoose');

const QuotationSchema = new mongoose.Schema({
  materialRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaterialRequest',
    required: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price offer is required'],
    min: [0, 'Price must be positive']
  },
  deliveryCost: {
    type: Number,
    required: [true, 'Delivery cost is required'],
    min: [0, 'Delivery cost must be positive']
  },
  deliveryTimeDays: {
    type: Number,
    required: [true, 'Estimated delivery time in days is required'],
    min: [1, 'Delivery time must be at least 1 day']
  },
  warrantyMonths: {
    type: Number,
    default: 0,
    min: [0, 'Warranty months must be positive']
  },
  paymentTerms: {
    type: String,
    required: [true, 'Payment terms specification is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Selected', 'Rejected'],
    default: 'Pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Quotation', QuotationSchema);
