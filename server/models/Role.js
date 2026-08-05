const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'Administrator',
      'Procurement Officer',
      'Project Manager',
      'Site Engineer',
      'Supplier',
      'Accountant',
      'Delivery Staff'
    ]
  },
  description: {
    type: String,
    required: true
  },
  permissions: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Role', RoleSchema);
