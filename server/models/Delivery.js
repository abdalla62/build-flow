const mongoose = require('mongoose');

const RescheduleHistorySchema = new mongoose.Schema(
  {
    originalDate: { type: Date, required: true },
    newDate: { type: Date, required: true },
    previousTimeSlot: { type: String, default: '' },
    newTimeSlot: { type: String, default: '' },
    reason: { type: String, required: true, trim: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const DeliverySchema = new mongoose.Schema({
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scheduledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  vehicle: {
    type: String,
    required: [true, 'Vehicle plate number is required'],
    trim: true
  },
  vehicleType: {
    type: String,
    trim: true,
    default: ''
  },
  vehicleModel: {
    type: String,
    trim: true,
    default: ''
  },
  deliveryAddress: {
    type: String,
    required: [true, 'Delivery address is required'],
    trim: true
  },
  deliveryDate: {
    type: Date,
    required: [true, 'Delivery date is required']
  },
  /** First scheduled date (set once; preserved across reschedules). */
  originalDeliveryDate: {
    type: Date
  },
  timeSlot: {
    type: String,
    required: [true, 'Time slot is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Preparing', 'Dispatched', 'In Transit', 'Delivered', 'Delayed', 'Rescheduled', 'Cancelled'],
    default: 'Scheduled'
  },
  actualDeliveredAt: {
    type: Date
  },
  deliveryNoteFile: {
    type: String,
    default: ''
  },
  rescheduleHistory: {
    type: [RescheduleHistorySchema],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Delivery', DeliverySchema);
