const mongoose = require('mongoose');

/** Running stock balance for a material at a specific project/site. */
const ProjectStockSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Project stock cannot be negative']
    }
  },
  { timestamps: true }
);

ProjectStockSchema.index({ project: 1, material: 1 }, { unique: true });

module.exports = mongoose.model('ProjectStock', ProjectStockSchema);
