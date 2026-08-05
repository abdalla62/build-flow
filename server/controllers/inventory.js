const Inventory = require('../models/Inventory');
const Material = require('../models/Material');
const logActivity = require('../utils/audit');

// @desc    Get inventory stock history logs
// @route   GET /api/inventory
// @access  Private
exports.getInventoryLedger = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, materialId, projectId, type } = req.query;
    const query = {};

    if (materialId) query.material = materialId;
    if (projectId) query.project = projectId;
    if (type) query.type = type;

    const count = await Inventory.countDocuments(query);
    const logs = await Inventory.find(query)
      .populate('material', 'name unit estimatedPrice')
      .populate('project', 'name location')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      logs,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalLogs: count
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get low stock material alerts
// @route   GET /api/inventory/alerts
// @access  Private
exports.getMaterialStockAlerts = async (req, res, next) => {
  try {
    // Current stock is less than or equal to minimum stock limit
    const alerts = await Material.find({
      $expr: { $lte: ['$currentStock', '$minimumStock'] },
      status: 'Active'
    }).populate('category', 'name').populate('supplier', 'company').populate('suppliers', 'company');

    res.status(200).json({ success: true, alerts });
  } catch (error) {
    next(error);
  }
};

// @desc    Post manual stock adjustment
// @route   POST /api/inventory/adjust
// @access  Private/Admin
exports.postManualStockAdjustment = async (req, res, next) => {
  try {
    const { material, project, quantity, type, comments } = req.body;

    if (!['Stock In', 'Stock Out'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid stock adjustment type' });
    }

    if (quantity <= 0) {
      return res.status(400).json({ success: false, error: 'Quantity must be positive' });
    }

    const materialDoc = await Material.findById(material);
    if (!materialDoc) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }

    // Check stock limit for deductions
    if (type === 'Stock Out' && materialDoc.currentStock < quantity) {
      return res.status(400).json({ success: false, error: `Deduction quantity exceeds current stock balance of ${materialDoc.currentStock}` });
    }

    // Log ledger entry
    const log = await Inventory.create({
      material,
      project: project || null,
      quantity,
      type,
      referenceType: 'Adjustment',
      referenceId: req.user._id // Stores the admin user ID who logged it
    });

    // Update Material currentStock balance
    const incrementFactor = type === 'Stock In' ? quantity : -quantity;
    materialDoc.currentStock += incrementFactor;
    await materialDoc.save();

    await logActivity(
      req,
      req.user,
      'Manual Stock Adjustment',
      `Adjusted material ${materialDoc.name} by ${incrementFactor} ${materialDoc.unit}. Remarks: "${comments || ''}"`
    );

    res.status(201).json({ success: true, log });
  } catch (error) {
    next(error);
  }
};
