const Inventory = require('../models/Inventory');
const Material = require('../models/Material');
const ProjectStock = require('../models/ProjectStock');
const MaterialRequest = require('../models/MaterialRequest');
const logActivity = require('../utils/audit');
const { applyProjectStockChange, rebuildProjectStockFromLedger } = require('../utils/projectStock');

// @desc    Get inventory stock history logs
// @route   GET /api/inventory
// @access  Private
exports.getInventoryLedger = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, materialId, projectId, type } = req.query;
    const query = {};

    if (materialId) query.material = materialId;
    if (type) query.type = type;

    if (req.user.role === 'Site Engineer') {
      const myProjects = await MaterialRequest.distinct('project', {
        requestedBy: req.user._id
      });
      if (projectId) {
        if (!myProjects.some((p) => String(p) === String(projectId))) {
          return res.status(200).json({
            success: true,
            logs: [],
            totalPages: 0,
            currentPage: Number(page),
            totalLogs: 0
          });
        }
        query.project = projectId;
      } else {
        query.project = { $in: myProjects };
      }
    } else if (projectId) {
      query.project = projectId;
    }

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

// @desc    Project/site stock balances (per material)
// @route   GET /api/inventory/project-stock
// @access  Private
exports.getProjectStock = async (req, res, next) => {
  try {
    const { projectId } = req.query;
    const query = {};

    if (req.user.role === 'Site Engineer') {
      const myProjects = await MaterialRequest.distinct('project', {
        requestedBy: req.user._id
      });
      if (projectId) {
        if (!myProjects.some((p) => String(p) === String(projectId))) {
          return res.status(403).json({
            success: false,
            error: 'Not authorized for this project stock'
          });
        }
        query.project = projectId;
      } else {
        query.project = { $in: myProjects };
      }
    } else if (projectId) {
      query.project = projectId;
    }

    // Bootstrap balances from existing ledger if empty
    if ((await ProjectStock.countDocuments()) === 0) {
      await rebuildProjectStockFromLedger();
    }

    const stocks = await ProjectStock.find(query)
      .populate('material', 'name unit category currentStock minimumStock')
      .populate('project', 'name location')
      .sort({ updatedAt: -1 });

    const projects = [
      ...new Map(
        stocks
          .filter((s) => s.project)
          .map((s) => [String(s.project._id), s.project])
      ).values()
    ];

    res.status(200).json({ success: true, stocks, projects });
  } catch (error) {
    next(error);
  }
};

// @desc    Record material usage on a project site (Stock Out)
// @route   POST /api/inventory/site-usage
// @access  Private (Site Engineer on own projects; Admin / Procurement)
exports.recordSiteUsage = async (req, res, next) => {
  try {
    const { project, material, quantity, notes } = req.body;
    const qty = Number(quantity);

    if (!project || !material) {
      return res.status(400).json({
        success: false,
        error: 'Project and material are required'
      });
    }
    if (!Number.isFinite(qty) || qty < 1 || !Number.isInteger(qty)) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be a whole number of at least 1'
      });
    }

    const role = req.user.role;
    const allowedRoles = ['Site Engineer', 'Administrator', 'Procurement Officer'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, error: 'Not authorized to record site usage' });
    }

    if (role === 'Site Engineer') {
      const myProjects = await MaterialRequest.distinct('project', {
        requestedBy: req.user._id
      });
      if (!myProjects.some((p) => String(p) === String(project))) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized for this project stock'
        });
      }
    }

    const materialDoc = await Material.findById(material);
    if (!materialDoc) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }

    const siteRow = await ProjectStock.findOne({ project, material });
    const onSite = siteRow?.quantity || 0;
    if (onSite < qty) {
      return res.status(400).json({
        success: false,
        error: `Only ${onSite} ${materialDoc.unit || ''} on site — cannot use ${qty}`
      });
    }

    try {
      await applyProjectStockChange({
        projectId: project,
        materialId: material,
        quantity: qty,
        type: 'Stock Out',
        referenceType: 'Site Usage',
        referenceId: req.user._id
      });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    // Keep catalog stock in sync (delivery already incremented it)
    materialDoc.currentStock = Math.max(0, (materialDoc.currentStock || 0) - qty);
    await materialDoc.save();

    const updated = await ProjectStock.findOne({ project, material })
      .populate('material', 'name unit category currentStock minimumStock')
      .populate('project', 'name location');

    await logActivity(
      req,
      req.user,
      'Site Material Usage',
      `Used ${qty} ${materialDoc.unit || ''} of ${materialDoc.name} on site` +
        (notes ? `. Note: "${notes}"` : '')
    );

    res.status(201).json({
      success: true,
      stock: updated,
      message: `Recorded usage of ${qty} ${materialDoc.unit || ''}`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Rebuild project stock from inventory ledger
// @route   POST /api/inventory/rebuild-project-stock
// @access  Private/Admin
exports.rebuildProjectStock = async (req, res, next) => {
  try {
    const count = await rebuildProjectStockFromLedger();
    await logActivity(
      req,
      req.user,
      'Rebuild Project Stock',
      `Rebuilt project stock balances from ledger (${count} groups)`
    );
    res.status(200).json({ success: true, groups: count });
  } catch (error) {
    next(error);
  }
};

// @desc    Get low stock material alerts
// @route   GET /api/inventory/alerts
// @access  Private
exports.getMaterialStockAlerts = async (req, res, next) => {
  try {
    const alerts = await Material.find({
      $expr: { $lte: ['$currentStock', '$minimumStock'] },
      status: 'Active'
    })
      .populate('category', 'name')
      .populate('supplier', 'company')
      .populate('suppliers', 'company');

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

    if (type === 'Stock Out' && materialDoc.currentStock < quantity) {
      return res.status(400).json({
        success: false,
        error: `Deduction quantity exceeds current stock balance of ${materialDoc.currentStock}`
      });
    }

    let log;
    if (project) {
      try {
        await applyProjectStockChange({
          projectId: project,
          materialId: material,
          quantity,
          type,
          referenceType: 'Adjustment',
          referenceId: req.user._id
        });
        log = await Inventory.findOne({
          material,
          project,
          type,
          referenceType: 'Adjustment',
          referenceId: req.user._id
        }).sort({ createdAt: -1 });
      } catch (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
    } else {
      log = await Inventory.create({
        material,
        project: null,
        quantity,
        type,
        referenceType: 'Adjustment',
        referenceId: req.user._id
      });
    }

    const incrementFactor = type === 'Stock In' ? quantity : -quantity;
    materialDoc.currentStock += incrementFactor;
    await materialDoc.save();

    await logActivity(
      req,
      req.user,
      'Manual Stock Adjustment',
      `Adjusted material ${materialDoc.name} by ${incrementFactor} ${materialDoc.unit}${
        project ? ' (project stock)' : ''
      }. Remarks: "${comments || ''}"`
    );

    res.status(201).json({ success: true, log });
  } catch (error) {
    next(error);
  }
};
