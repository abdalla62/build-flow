const mongoose = require('mongoose');

const ApprovalSchema = new mongoose.Schema({
  request: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaterialRequest',
    required: true
  },
  approver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['Approve', 'Reject', 'Return'],
    required: true
  },
  comments: {
    type: String,
    required: [true, 'Comments/remarks are required'],
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Approval', ApprovalSchema);
