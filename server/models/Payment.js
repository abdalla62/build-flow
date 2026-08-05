const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: true
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    required: true,
    min: 0
  },
  remainingBalance: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Bank Transfer', 'Cheque', 'Credit Card', 'Mobile Wallet'],
    default: 'Bank Transfer'
  },
  referenceNumber: {
    type: String,
    required: [true, 'Payment transaction reference is required'],
    unique: true,
    trim: true
  },
  payerAccountNo: {
    type: String,
    default: '',
    trim: true
  },
  waafiTransactionId: {
    type: String,
    default: '',
    trim: true
  },
  waafiResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  /** Feature 10.10 — uploaded payment receipt (PDF/JPG/PNG/DOCX) */
  receiptFile: {
    type: String,
    default: ''
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', PaymentSchema);
