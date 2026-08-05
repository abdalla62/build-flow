const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    unique: true,
    trim: true
  },
  location: {
    type: String,
    required: [true, 'Project location is required'],
    trim: true
  },
  budget: {
    type: Number,
    required: [true, 'Project budget is required'],
    min: [0, 'Budget must be positive']
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Project manager is required']
  },
  status: {
    type: String,
    enum: ['Pending', 'Active', 'Completed', 'On Hold'],
    default: 'Pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Project', ProjectSchema);
