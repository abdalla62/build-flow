const mongoose = require('mongoose');

const ReportScheduleSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'default',
      unique: true
    },
    enabled: {
      type: Boolean,
      default: false
    },
    dayOfMonth: {
      type: Number,
      default: 1,
      min: 1,
      max: 28
    },
    recipientEmails: {
      type: [String],
      default: []
    },
    lastSentAt: Date,
    lastSentPeriod: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('ReportSchedule', ReportScheduleSchema);
