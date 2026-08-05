const MaterialRequest = require('../models/MaterialRequest');
const Approval = require('../models/Approval');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const logActivity = require('../utils/audit');

// @desc    Get all material requests (role-filtered + paginated)
// @route   GET /api/requests
// @access  Private
exports.getRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, priority, projectId } = req.query;
    const query = {};

    // Role-based visibility
    if (req.user.role === 'Site Engineer') {
      query.requestedBy = req.user.id;
    } else if (req.user.role === 'Project Manager') {
      // Find projects managed by this user
      const projects = await Project.find({ manager: req.user.id });
      const projectIds = projects.map(p => p._id);
      query.project = { $in: projectIds };
    } else if (req.user.role === 'Supplier') {
      // Only show requests this supplier was invited to (PM multi-select)
      const Supplier = require('../models/Supplier');
      const { resolveSupplierProfile, escapeRegex } = require('../utils/supplierLink');
      const supplierProfile = await resolveSupplierProfile(req.user);
      if (!supplierProfile) {
        return res.status(200).json({
          success: true,
          requests: [],
          totalPages: 0,
          currentPage: Number(page),
          totalRequests: 0
        });
      }

      const email = String(req.user.email || '').trim().toLowerCase();
      const linkedIds = await Supplier.find({
        email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') }
      }).distinct('_id');

      const idSet = new Set([
        supplierProfile._id.toString(),
        ...linkedIds.map((id) => id.toString())
      ]);

      query.$or = [
        { suppliers: { $in: [...idSet] } },
        { suppliers: { $exists: false } },
        { suppliers: { $size: 0 } }
      ];
    }
    // Admin / Procurement / Accountant / Delivery Staff can read all

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (projectId) query.project = projectId;

    const count = await MaterialRequest.countDocuments(query);
    const requests = await MaterialRequest.find(query)
      .populate('project', 'name location budget manager')
      .populate('requestedBy', 'name email')
      .populate('material', 'name unit estimatedPrice category supplier')
      .populate('supplier', 'name company')
      .populate('suppliers', 'name company')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    // For Project Managers, load the Approval history for reviewed items
    res.status(200).json({
      success: true,
      requests,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalRequests: count
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single material request detail + approval history
// @route   GET /api/requests/:id
// @access  Private
exports.getRequest = async (req, res, next) => {
  try {
    const request = await MaterialRequest.findById(req.params.id)
      .populate('project', 'name location budget manager')
      .populate('requestedBy', 'name email')
      .populate('material', 'name unit estimatedPrice category supplier')
      .populate('supplier', 'name company')
      .populate('suppliers', 'name company');

    if (!request) {
      return res.status(404).json({ success: false, error: 'Material request not found' });
    }

    const approvals = await Approval.find({ request: request._id })
      .populate('approver', 'name role');

    res.status(200).json({ success: true, request, approvals });
  } catch (error) {
    next(error);
  }
};

// @desc    Create material request
// @route   POST /api/requests
// @access  Private/Site Engineer
exports.createRequest = async (req, res, next) => {
  try {
    const { project, material, quantity, priority, reason, requiredDate } = req.body;

    const newRequest = await MaterialRequest.create({
      project,
      requestedBy: req.user.id,
      material,
      quantity,
      priority,
      reason,
      requiredDate
    });

    // Load populated data to draft notification details
    const populated = await newRequest.populate('project material requestedBy');

    // Notify Project Manager
    if (populated.project?.manager) {
      await Notification.create({
        user: populated.project.manager,
        title: 'New Material Request',
        message: `${req.user.name} submitted a request for ${quantity} ${populated.material.unit} of ${populated.material.name} for project "${populated.project.name}".`,
        type: 'Request'
      });
    }

    await logActivity(req, req.user, 'Create Material Request', `Requested ${quantity} of material ID: ${material}`);

    res.status(201).json({ success: true, request: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Update material request
// @route   PUT /api/requests/:id
// @access  Private/Site Engineer
exports.updateRequest = async (req, res, next) => {
  try {
    let request = await MaterialRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    // Security check: Only requester can edit, and only if Pending/Returned
    if (request.requestedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized to edit this request' });
    }

    if (!['Pending', 'Returned'].includes(request.status)) {
      return res.status(400).json({ success: false, error: 'Cannot modify a request once reviewed or ordered' });
    }

    // Update details and set back to Pending if it was Returned
    req.body.status = 'Pending';
    request = await MaterialRequest.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('project material');

    // Re-notify Project Manager
    if (request.project?.manager) {
      await Notification.create({
        user: request.project.manager,
        title: 'Resubmitted Material Request',
        message: `${req.user.name} revised and resubmitted a returned request for ${request.quantity} ${request.material.unit} of ${request.material.name}.`,
        type: 'Request'
      });
    }

    await logActivity(req, req.user, 'Resubmit Material Request', `Revised request ID: ${request._id}`);

    res.status(200).json({ success: true, request });
  } catch (error) {
    next(error);
  }
};

// @desc    Review / Approve / Reject / Return material request
// @route   PUT /api/requests/:id/review
// @access  Private/Project Manager
exports.reviewRequest = async (req, res, next) => {
  try {
    const { action, comments, suppliers } = req.body;

    if (!['Approve', 'Reject', 'Return'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid review action' });
    }

    if (!comments) {
      return res.status(400).json({ success: false, error: 'Review comments/remarks are required' });
    }

    if (action === 'Approve' && (!Array.isArray(suppliers) || suppliers.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Select at least one supplier for quotations before approving'
      });
    }

    const request = await MaterialRequest.findById(req.params.id).populate('project material');
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    // Verify Project Manager matches the project manager
    if (request.project.manager.toString() !== req.user.id && req.user.role !== 'Administrator') {
      return res.status(403).json({ success: false, error: 'You are not authorized to review requests for this project' });
    }

    if (!['Pending', 'Returned', 'Rejected'].includes(request.status)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot change review once the request is approved or ordered'
      });
    }

    let status = 'Pending';
    if (action === 'Approve') status = 'Approved';
    if (action === 'Reject') status = 'Rejected';
    if (action === 'Return') status = 'Returned';

    request.status = status;
    if (Array.isArray(suppliers) && suppliers.length > 0) {
      request.suppliers = suppliers;
    }
    await request.save();

    // Log the approval comment
    await Approval.create({
      request: request._id,
      approver: req.user.id,
      action,
      comments
    });

    // Notify Requester
    await Notification.create({
      user: request.requestedBy,
      title: `Request ${action}d`,
      message: `Your material request for ${request.quantity} ${request.material.unit} of ${request.material.name} was ${action.toLowerCase()}d by ${req.user.name}. Remarks: "${comments}"`,
      type: 'Approval'
    });

    // Notify invited supplier user accounts so Quotes & Bids is actionable
    if (action === 'Approve' && Array.isArray(suppliers) && suppliers.length > 0) {
      const Supplier = require('../models/Supplier');
      const User = require('../models/User');
      const invitedProfiles = await Supplier.find({ _id: { $in: suppliers } });
      for (const profile of invitedProfiles) {
        const supplierUser = await User.findOne({
          email: { $regex: new RegExp(`^${String(profile.email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          role: 'Supplier'
        });
        if (supplierUser) {
          await Notification.create({
            user: supplierUser._id,
            title: 'New Quotation Opportunity',
            message: `A material request for ${request.quantity} ${request.material.unit} of ${request.material.name} is approved and open for bidding.`,
            type: 'Request'
          });
        }
      }
    }

    await logActivity(req, req.user, `Review Request - ${action}`, `Reviewed request ID: ${request._id}. Status: ${status}`);

    res.status(200).json({ success: true, request });
  } catch (error) {
    next(error);
  }
};

// @desc    Site Engineer confirm receipt of materials / report damage
// @route   PUT /api/requests/:id/receive
// @access  Private/Site Engineer
exports.receiveMaterials = async (req, res, next) => {
  try {
    const { damagedQuantity, comments } = req.body;

    const request = await MaterialRequest.findById(req.params.id).populate('project material');
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    if (request.requestedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized to confirm receipt for this request' });
    }

    request.status = 'Delivered';

    if (damagedQuantity && damagedQuantity > 0) {
      request.damagedReported = {
        quantity: damagedQuantity,
        comments: comments || 'No comments provided',
        reportedAt: Date.now()
      };
      
      const Inventory = require('../models/Inventory');
      const Material = require('../models/Material');

      // Create a Stock Out adjustment log for the damaged quantity
      await Inventory.create({
        material: request.material._id,
        project: request.project._id,
        quantity: damagedQuantity,
        type: 'Stock Out',
        referenceType: 'Adjustment',
        referenceId: request._id
      });

      // Deduct damaged quantity from material balance
      await Material.findByIdAndUpdate(request.material._id, {
        $inc: { currentStock: -damagedQuantity }
      });

      // Notify Procurement / Admin of damaged delivery
      await Notification.create({
        targetRole: 'Procurement Officer',
        title: 'Damaged Materials Reported',
        message: `Site Engineer reported ${damagedQuantity} damaged ${request.material.unit} of ${request.material.name} on delivery receipt for "${request.project.name}".`,
        type: 'General'
      });
    }

    await request.save();

    await logActivity(
      req,
      req.user,
      'Receive Materials',
      `Received materials. Damaged: ${damagedQuantity || 0} ${request.material.unit}`
    );

    res.status(200).json({ success: true, request });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel request (before PM review)
// @route   DELETE /api/requests/:id
// @access  Private/Site Engineer
exports.cancelRequest = async (req, res, next) => {
  try {
    const request = await MaterialRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    if (request.requestedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    if (request.status !== 'Pending') {
      return res.status(400).json({ success: false, error: 'Cannot cancel requests already under review or processed' });
    }

    request.status = 'Cancelled';
    await request.save();

    await logActivity(req, req.user, 'Cancel Material Request', `Cancelled request ID: ${request._id}`);

    res.status(200).json({ success: true, request });
  } catch (error) {
    next(error);
  }
};
