const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // If null, it can target a specific role or everyone
  },
  targetRole: {
    type: String,
    enum: [
      'All',
      'Administrator',
      'Procurement Officer',
      'Project Manager',
      'Site Engineer',
      'Supplier',
      'Accountant',
      'Delivery Staff'
    ],
    default: 'All'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Request', 'Approval', 'Payment', 'Delivery', 'System', 'General'],
    default: 'General'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', NotificationSchema);
