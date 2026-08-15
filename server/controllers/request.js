const MaterialRequest = require('../models/MaterialRequest');
const Approval = require('../models/Approval');
const Project = require('../models/Project');
const PurchaseOrder = require('../models/PurchaseOrder');
const Delivery = require('../models/Delivery');
const Notification = require('../models/Notification');
const Material = require('../models/Material');
const logActivity = require('../utils/audit');
const { assertWithinBudget } = require('../utils/projectBudget');
const { randomUUID } = require('crypto');

const REQUEST_POPULATE = [
  ['project', 'name location budget manager'],
  ['requestedBy', 'name email'],
  ['material', 'name unit estimatedPrice category supplier'],
  ['supplier', 'name company'],
  ['suppliers', 'name company']
];

function populateRequest(query) {
  REQUEST_POPULATE.forEach(([path, select]) => query.populate(path, select));
  return query;
}

function groupStatus(lines) {
  const statuses = [...new Set(lines.map((l) => l.status))];
  if (statuses.length === 1) return statuses[0];
  const order = ['Pending', 'Returned', 'Rejected', 'Approved', 'Ordered', 'Delivered', 'Cancelled'];
  return order.find((s) => statuses.includes(s)) || lines[0].status;
}

function toGroupedRequest(lines, readyRequestIds) {
  const sorted = [...lines].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const lineObjs = sorted.map((r) => {
    const obj = r.toObject ? r.toObject() : { ...r };
    obj.canConfirmReceipt = r.status === 'Ordered' && readyRequestIds.has(r._id.toString());
    return obj;
  });
  const primary = { ...lineObjs[0] };
  primary.lines = lineObjs;
  primary.lineCount = lineObjs.length;
  primary.status = groupStatus(lineObjs);
  primary.canConfirmReceipt = lineObjs.some((l) => l.canConfirmReceipt);
  return primary;
}

async function attachBatchLines(requestDoc) {
  const obj = requestDoc.toObject();
  if (!obj.batchId) {
    obj.lineCount = 1;
    obj.lines = [{ ...obj }];
    return obj;
  }
  const siblings = await populateRequest(
    MaterialRequest.find({ batchId: obj.batchId })
  ).sort({ createdAt: 1 });
  obj.lines = siblings.map((s) => s.toObject());
  obj.lineCount = obj.lines.length;
  obj.status = groupStatus(obj.lines);
  return obj;
}

async function findReceiptReadyIds(requests) {
  const orderedIds = requests.filter((r) => r.status === 'Ordered').map((r) => r._id);
  const readyRequestIds = new Set();
  if (orderedIds.length === 0) return readyRequestIds;

  const pos = await PurchaseOrder.find({ materialRequest: { $in: orderedIds } })
    .select('_id materialRequest');
  const poIds = pos.map((p) => p._id);
  if (poIds.length === 0) return readyRequestIds;

  const delivered = await Delivery.find({
    purchaseOrder: { $in: poIds },
    status: 'Delivered'
  }).select('purchaseOrder');
  const deliveredPoIds = new Set(delivered.map((d) => d.purchaseOrder.toString()));
  pos.forEach((p) => {
    if (deliveredPoIds.has(p._id.toString()) && p.materialRequest) {
      readyRequestIds.add(p.materialRequest.toString());
    }
  });
  return readyRequestIds;
}

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

    const grouped = String(req.query.grouped || '') === 'true';
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const allMatching = await populateRequest(MaterialRequest.find(query)).sort({
      createdAt: -1
    });
    const readyRequestIds = await findReceiptReadyIds(allMatching);

    let enrichedRequests;
    let totalRequests;

    if (grouped) {
      const seen = new Set();
      const groups = [];
      for (const r of allMatching) {
        const key = r.batchId || r._id.toString();
        if (seen.has(key)) continue;
        seen.add(key);
        const lines = r.batchId
          ? allMatching.filter((x) => x.batchId === r.batchId)
          : [r];
        groups.push(toGroupedRequest(lines, readyRequestIds));
      }
      totalRequests = groups.length;
      const start = (pageNum - 1) * limitNum;
      enrichedRequests = groups.slice(start, start + limitNum);
    } else {
      totalRequests = allMatching.length;
      const start = (pageNum - 1) * limitNum;
      const pageRows = allMatching.slice(start, start + limitNum);
      enrichedRequests = pageRows.map((r) => {
        const obj = r.toObject();
        obj.canConfirmReceipt = r.status === 'Ordered' && readyRequestIds.has(r._id.toString());
        obj.lineCount = 1;
        obj.lines = [{ ...obj }];
        return obj;
      });
    }

    res.status(200).json({
      success: true,
      requests: enrichedRequests,
      totalPages: Math.ceil(totalRequests / limitNum) || 0,
      currentPage: pageNum,
      totalRequests
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

    const withLines = await attachBatchLines(request);
    res.status(200).json({ success: true, request: withLines, approvals });
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

    const materialDoc = await Material.findById(material).select('name unit estimatedPrice');
    if (!materialDoc) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }

    const qty = Number(quantity) || 0;
    const lineCost = qty * (Number(materialDoc.estimatedPrice) || 0);
    const budgetCheck = await assertWithinBudget(project, lineCost);
    if (!budgetCheck.ok) {
      return res.status(budgetCheck.status).json({
        success: false,
        error: budgetCheck.error,
        budget: budgetCheck.summary
      });
    }

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

    res.status(201).json({ success: true, request: populated, budget: budgetCheck.summary });
  } catch (error) {
    next(error);
  }
};

// @desc    Create several material lines as one request (same batchId)
// @route   POST /api/requests/batch
// @access  Private/Site Engineer
exports.createRequestBatch = async (req, res, next) => {
  try {
    const { project, lines, priority, reason, requiredDate } = req.body;
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, error: 'Add at least one material' });
    }

    const materialIds = lines.map((l) => l.material);
    const materialDocs = await Material.find({ _id: { $in: materialIds } }).select(
      'name unit estimatedPrice'
    );
    const byId = new Map(materialDocs.map((m) => [m._id.toString(), m]));

    let totalCost = 0;
    const normalized = [];
    for (const line of lines) {
      const mat = byId.get(String(line.material));
      if (!mat) {
        return res.status(404).json({ success: false, error: 'Material not found' });
      }
      const qty = Number(line.quantity) || 0;
      if (qty < 1) {
        return res.status(400).json({ success: false, error: 'Each quantity must be at least 1' });
      }
      totalCost += qty * (Number(mat.estimatedPrice) || 0);
      normalized.push({ material: line.material, quantity: qty, mat });
    }

    const budgetCheck = await assertWithinBudget(project, totalCost);
    if (!budgetCheck.ok) {
      return res.status(budgetCheck.status).json({
        success: false,
        error: budgetCheck.error,
        budget: budgetCheck.summary
      });
    }

    const batchId = randomUUID();
    const created = await MaterialRequest.insertMany(
      normalized.map((line) => ({
        project,
        requestedBy: req.user.id,
        material: line.material,
        quantity: line.quantity,
        priority,
        reason,
        requiredDate,
        batchId
      }))
    );

    const populated = await populateRequest(
      MaterialRequest.find({ _id: { $in: created.map((c) => c._id) } })
    ).sort({ createdAt: 1 });

    const first = populated[0];
    if (first?.project?.manager) {
      const itemSummary = populated
        .map((r) => `${r.quantity} ${r.material.unit} ${r.material.name}`)
        .join(', ');
      await Notification.create({
        user: first.project.manager,
        title: 'New Material Request',
        message: `${req.user.name} submitted a request (${populated.length} item${
          populated.length > 1 ? 's' : ''
        }: ${itemSummary}) for project "${first.project.name}".`,
        type: 'Request'
      });
    }

    await logActivity(
      req,
      req.user,
      'Create Material Request',
      `Requested ${populated.length} material line(s) as batch ${batchId}`
    );

    res.status(201).json({
      success: true,
      batchId,
      requests: populated,
      budget: budgetCheck.summary
    });
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

    const nextProject = req.body.project || request.project;
    const nextMaterial = req.body.material || request.material;
    const nextQty = Number(req.body.quantity != null ? req.body.quantity : request.quantity) || 0;

    const materialDoc = await Material.findById(nextMaterial).select('estimatedPrice');
    if (!materialDoc) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }

    const lineCost = nextQty * (Number(materialDoc.estimatedPrice) || 0);
    const budgetCheck = await assertWithinBudget(nextProject, lineCost, {
      excludeRequestIds: [request._id]
    });
    if (!budgetCheck.ok) {
      return res.status(budgetCheck.status).json({
        success: false,
        error: budgetCheck.error,
        budget: budgetCheck.summary
      });
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

    res.status(200).json({ success: true, request, budget: budgetCheck.summary });
  } catch (error) {
    next(error);
  }
};

async function applyReviewToRequest(request, { action, comments, suppliers, user, req, notify = true, itemCount = 1 }) {
  let status = 'Pending';
  if (action === 'Approve') status = 'Approved';
  if (action === 'Reject') status = 'Rejected';
  if (action === 'Return') status = 'Returned';

  request.status = status;
  if (Array.isArray(suppliers) && suppliers.length > 0) {
    request.suppliers = suppliers;
  }
  await request.save();

  await Approval.create({
    request: request._id,
    approver: user.id,
    action,
    comments
  });

  const requesterId = request.requestedBy?._id || request.requestedBy;
  const itemLabel =
    itemCount > 1
      ? `your material request (${itemCount} items)`
      : `your material request for ${request.quantity} ${request.material.unit} of ${request.material.name}`;

  if (notify && requesterId) {
    await Notification.create({
      user: requesterId,
      title: `Request ${action}d`,
      message: `${itemLabel} was ${action.toLowerCase()}d by ${user.name}. Remarks: "${comments}"`,
      type: 'Approval'
    });
  }

  if (notify && action === 'Approve' && Array.isArray(suppliers) && suppliers.length > 0) {
    const Supplier = require('../models/Supplier');
    const User = require('../models/User');
    const invitedProfiles = await Supplier.find({ _id: { $in: suppliers } });
    for (const profile of invitedProfiles) {
      const supplierUser = await User.findOne({
        email: {
          $regex: new RegExp(
            `^${String(profile.email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            'i'
          )
        },
        role: 'Supplier'
      });
      if (supplierUser) {
        await Notification.create({
          user: supplierUser._id,
          title: 'New Quotation Opportunity',
          message: itemCount > 1
            ? `A material request with ${itemCount} items is approved and open for bidding.`
            : `A material request for ${request.quantity} ${request.material.unit} of ${request.material.name} is approved and open for bidding.`,
          type: 'Request'
        });
      }
    }
  }

  await logActivity(
    req,
    user,
    `Review Request - ${action}`,
    `Reviewed request ID: ${request._id}. Status: ${status}`
  );

  return request;
}

function validateReviewPayload({ action, comments, suppliers }) {
  if (!['Approve', 'Reject', 'Return'].includes(action)) {
    return 'Invalid review action';
  }
  if (!comments) {
    return 'Review comments/remarks are required';
  }
  if (action === 'Approve' && (!Array.isArray(suppliers) || suppliers.length === 0)) {
    return 'Select at least one supplier for quotations before approving';
  }
  return null;
}

// @desc    Review / Approve / Reject / Return material request
// @route   PUT /api/requests/:id/review
// @access  Private/Project Manager
exports.reviewRequest = async (req, res, next) => {
  try {
    const { action, comments, suppliers } = req.body;
    const payloadError = validateReviewPayload({ action, comments, suppliers });
    if (payloadError) {
      return res.status(400).json({ success: false, error: payloadError });
    }

    const request = await MaterialRequest.findById(req.params.id).populate('project material');
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    if (request.project.manager.toString() !== req.user.id && req.user.role !== 'Administrator') {
      return res.status(403).json({ success: false, error: 'You are not authorized to review requests for this project' });
    }

    const siblings = request.batchId
      ? await populateRequest(MaterialRequest.find({ batchId: request.batchId }))
      : [request];

    const reviewable = siblings.filter((r) =>
      ['Pending', 'Returned', 'Rejected'].includes(r.status)
    );
    if (reviewable.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot change review once the request is approved or ordered'
      });
    }

    let last = request;
    for (let i = 0; i < reviewable.length; i++) {
      last = await applyReviewToRequest(reviewable[i], {
        action,
        comments,
        suppliers,
        user: req.user,
        req,
        notify: i === 0,
        itemCount: reviewable.length
      });
    }

    res.status(200).json({
      success: true,
      request: last,
      reviewedCount: reviewable.length
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk review multiple material requests (one decision)
// @route   PUT /api/requests/bulk-review
// @access  Private/Project Manager
exports.bulkReviewRequests = async (req, res, next) => {
  try {
    const { requestIds, action, comments, suppliers } = req.body;
    const payloadError = validateReviewPayload({ action, comments, suppliers });
    if (payloadError) {
      return res.status(400).json({ success: false, error: payloadError });
    }

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Select at least one request' });
    }

    const uniqueIds = [...new Set(requestIds.map(String))];
    const requests = await MaterialRequest.find({ _id: { $in: uniqueIds } }).populate(
      'project material'
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, error: 'No matching requests found' });
    }

    const reviewed = [];
    const skipped = [];

    for (const request of requests) {
      if (!request.project) {
        skipped.push({ id: request._id, reason: 'Project missing' });
        continue;
      }
      if (
        request.project.manager.toString() !== req.user.id &&
        req.user.role !== 'Administrator'
      ) {
        skipped.push({ id: request._id, reason: 'Not authorized' });
        continue;
      }
      if (!['Pending', 'Returned', 'Rejected'].includes(request.status)) {
        skipped.push({ id: request._id, reason: `Status is ${request.status}` });
        continue;
      }

      await applyReviewToRequest(request, {
        action,
        comments,
        suppliers,
        user: req.user,
        req
      });
      reviewed.push(request._id);
    }

    if (reviewed.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No requests could be reviewed',
        skipped
      });
    }

    await logActivity(
      req,
      req.user,
      `Bulk Review Requests - ${action}`,
      `Reviewed ${reviewed.length} request(s). Skipped: ${skipped.length}`
    );

    res.status(200).json({
      success: true,
      reviewedCount: reviewed.length,
      skippedCount: skipped.length,
      reviewed,
      skipped
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Site Engineer confirm receipt of materials / report damage or missing
// @route   PUT /api/requests/:id/receive
// @access  Private/Site Engineer
exports.receiveMaterials = async (req, res, next) => {
  try {
    const damagedQty = Number(req.body.damagedQuantity) || 0;
    const missingQty = Number(req.body.missingQuantity) || 0;
    const damagedComments = req.body.damagedComments || req.body.comments || '';
    const missingComments = req.body.missingComments || '';

    const request = await MaterialRequest.findById(req.params.id).populate('project material');
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    if (
      request.requestedBy.toString() !== req.user.id &&
      req.user.role !== 'Administrator'
    ) {
      return res.status(403).json({ success: false, error: 'Not authorized to confirm receipt for this request' });
    }

    if (request.status !== 'Ordered') {
      return res.status(400).json({
        success: false,
        error: `Cannot confirm receipt while request status is "${request.status}"`
      });
    }

    // Require Delivery Staff to mark shipment Delivered first
    const pos = await PurchaseOrder.find({ materialRequest: request._id }).select('_id');
    const poIds = pos.map((p) => p._id);
    const deliveredShipment = poIds.length
      ? await Delivery.findOne({ purchaseOrder: { $in: poIds }, status: 'Delivered' })
      : null;

    if (!deliveredShipment) {
      return res.status(400).json({
        success: false,
        error: 'Cannot confirm receipt until delivery is marked Delivered by Delivery Staff'
      });
    }

    if (damagedQty < 0 || missingQty < 0) {
      return res.status(400).json({ success: false, error: 'Quantities cannot be negative' });
    }

    if (damagedQty + missingQty > request.quantity) {
      return res.status(400).json({
        success: false,
        error: `Damaged + missing (${damagedQty + missingQty}) cannot exceed requested quantity (${request.quantity})`
      });
    }

    request.status = 'Delivered';

    const Inventory = require('../models/Inventory');
    const Material = require('../models/Material');

    if (damagedQty > 0) {
      request.damagedReported = {
        quantity: damagedQty,
        comments: damagedComments || 'No comments provided',
        reportedAt: Date.now()
      };

      await Inventory.create({
        material: request.material._id,
        project: request.project._id,
        quantity: damagedQty,
        type: 'Stock Out',
        referenceType: 'Adjustment',
        referenceId: request._id
      });

      await Material.findByIdAndUpdate(request.material._id, {
        $inc: { currentStock: -damagedQty }
      });

      await Notification.create({
        targetRole: 'Procurement Officer',
        title: 'Damaged Materials Reported',
        message: `Site Engineer reported ${damagedQty} damaged ${request.material.unit} of ${request.material.name} on delivery receipt for "${request.project.name}".`,
        type: 'General'
      });
    }

    if (missingQty > 0) {
      request.missingReported = {
        quantity: missingQty,
        comments: missingComments || 'No comments provided',
        reportedAt: Date.now()
      };

      await Inventory.create({
        material: request.material._id,
        project: request.project._id,
        quantity: missingQty,
        type: 'Stock Out',
        referenceType: 'Adjustment',
        referenceId: request._id
      });

      await Material.findByIdAndUpdate(request.material._id, {
        $inc: { currentStock: -missingQty }
      });

      await Notification.create({
        targetRole: 'Procurement Officer',
        title: 'Missing Materials Reported',
        message: `Site Engineer reported ${missingQty} missing ${request.material.unit} of ${request.material.name} on delivery receipt for "${request.project.name}".`,
        type: 'General'
      });
    }

    await request.save();

    await logActivity(
      req,
      req.user,
      'Receive Materials',
      `Received materials. Damaged: ${damagedQty} ${request.material.unit}, Missing: ${missingQty} ${request.material.unit}`
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

    const toCancel = request.batchId
      ? await MaterialRequest.find({
          batchId: request.batchId,
          requestedBy: req.user.id,
          status: 'Pending'
        })
      : request.status === 'Pending'
        ? [request]
        : [];

    if (toCancel.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel requests already under review or processed'
      });
    }

    await MaterialRequest.updateMany(
      { _id: { $in: toCancel.map((r) => r._id) } },
      { $set: { status: 'Cancelled' } }
    );

    await logActivity(
      req,
      req.user,
      'Cancel Material Request',
      `Cancelled ${toCancel.length} line(s) of request ${request._id}`
    );

    res.status(200).json({ success: true, request });
  } catch (error) {
    next(error);
  }
};
