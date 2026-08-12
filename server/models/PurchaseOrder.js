const mongoose = require('mongoose');

const PurchaseOrderSchema = new mongoose.Schema({
  purchaseOrderNumber: {
    type: String,
    unique: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  materialRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaterialRequest',
    required: true
  },
  items: [{
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  tax: {
    type: Number,
    default: 0
  },
  deliveryCost: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  grandTotal: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Rejected', 'Preparing', 'Dispatched', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  paymentStatus: {
    type: String,
    enum: ['Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'],
    default: 'Unpaid'
  },
  invoiceFile: {
    type: String, // String URL or file path of uploaded invoice
    default: ''
  }
}, {
  timestamps: true
});

// Auto-generate PO number pre-save hook
PurchaseOrderSchema.pre('save', async function (next) {
  if (!this.purchaseOrderNumber) {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;
    
    // Find latest PO of this year
    const lastPO = await this.constructor.findOne({
      purchaseOrderNumber: new RegExp(`^${prefix}`)
    }, {}, { sort: { purchaseOrderNumber: -1 } });

    let nextNum = 1;
    if (lastPO) {
      const parts = lastPO.purchaseOrderNumber.split('-');
      const sequence = parseInt(parts[2], 10);
      nextNum = sequence + 1;
    }
    
    const padded = String(nextNum).padStart(5, '0');
    this.purchaseOrderNumber = `${prefix}${padded}`;
  }
  next();
});

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);
