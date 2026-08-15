const Quotation = require('../models/Quotation');
const MaterialRequest = require('../models/MaterialRequest');
const PurchaseOrder = require('../models/PurchaseOrder');
const Notification = require('../models/Notification');
const logActivity = require('../utils/audit');

async function siblingRequests(request) {
  if (!request?.batchId) return request ? [request] : [];
  return MaterialRequest.find({ batchId: request.batchId }).sort({ createdAt: 1 });
}

// @desc    Submit a quotation bid
// @route   POST /api/quotations
// @access  Private/Supplier
exports.submitQuotation = async (req, res, next) => {
  try {
    const { materialRequest, unitPrice, deliveryCost, deliveryTimeDays, warrantyMonths, paymentTerms } = req.body;

    // Verify request is approved and not already ordered
    const request = await MaterialRequest.findById(materialRequest);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Material request not found' });
    }

    if (request.status !== 'Approved') {
      return res.status(400).json({ success: false, error: 'Cannot bid on requests that are not approved' });
    }

    // Resolve Supplier profile linked to this login
    const { resolveSupplierProfile, isSupplierInvited } = require('../utils/supplierLink');
    const supplierProfile = await resolveSupplierProfile(req.user);
    if (!supplierProfile) {
      return res.status(400).json({
        success: false,
        error: 'Logged-in user is not linked to a registered Supplier profile'
      });
    }

    if (!(await isSupplierInvited(request, supplierProfile, req.user))) {
      return res.status(403).json({
        success: false,
        error: 'You were not invited to quote on this material request'
      });
    }

    // Check if supplier already bid on this request
    const existing = await Quotation.findOne({ materialRequest, supplier: supplierProfile._id });
    if (existing) {
      return res.status(400).json({ success: false, error: 'You have already submitted a bid for this material request' });
    }

    const quotation = await Quotation.create({
      materialRequest,
      supplier: supplierProfile._id,
      unitPrice,
      deliveryCost,
      deliveryTimeDays,
      warrantyMonths,
      paymentTerms
    });

    await logActivity(req, req.user, 'Submit Quotation', `Quotation submitted for request: ${materialRequest}. Offer price: $${unitPrice}`);

    // Notify Procurement Officer
    await Notification.create({
      targetRole: 'Procurement Officer',
      title: 'New Bid Received',
      message: `Supplier ${supplierProfile.company} submitted a quotation bid of $${unitPrice} per unit for request ID: ${materialRequest}.`,
      type: 'Request'
    });

    res.status(201).json({ success: true, quotation });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit one bid covering every line in a material request
// @route   POST /api/quotations/batch
// @access  Private/Supplier
exports.submitQuotationBatch = async (req, res, next) => {
  try {
    const {
      materialRequest,
      items,
      deliveryCost,
      deliveryTimeDays,
      warrantyMonths,
      paymentTerms
    } = req.body;

    const primaryId = materialRequest || items?.[0]?.materialRequest;
    const request = await MaterialRequest.findById(primaryId);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Material request not found' });
    }

    const siblings = await siblingRequests(request);
    const approved = siblings.filter((r) => r.status === 'Approved');
    if (approved.length === 0) {
      return res.status(400).json({ success: false, error: 'Cannot bid on requests that are not approved' });
    }

    const { resolveSupplierProfile, isSupplierInvited } = require('../utils/supplierLink');
    const supplierProfile = await resolveSupplierProfile(req.user);
    if (!supplierProfile) {
      return res.status(400).json({
        success: false,
        error: 'Logged-in user is not linked to a registered Supplier profile'
      });
    }

    if (!(await isSupplierInvited(approved[0], supplierProfile, req.user))) {
      return res.status(403).json({
        success: false,
        error: 'You were not invited to quote on this material request'
      });
    }

    const priceById = new Map(
      (Array.isArray(items) ? items : []).map((it) => [
        String(it.materialRequest),
        Number(it.unitPrice)
      ])
    );

    for (const line of approved) {
      if (!priceById.has(line._id.toString()) || Number.isNaN(priceById.get(line._id.toString()))) {
        return res.status(400).json({
          success: false,
          error: 'Enter a unit price for every material in this request'
        });
      }
    }

    const existing = await Quotation.findOne({
      materialRequest: { $in: approved.map((r) => r._id) },
      supplier: supplierProfile._id
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'You have already submitted a bid for this material request'
      });
    }

    const created = await Quotation.insertMany(
      approved.map((line, idx) => ({
        materialRequest: line._id,
        supplier: supplierProfile._id,
        unitPrice: priceById.get(line._id.toString()),
        deliveryCost: idx === 0 ? Number(deliveryCost) || 0 : 0,
        deliveryTimeDays,
        warrantyMonths,
        paymentTerms
      }))
    );

    await logActivity(
      req,
      req.user,
      'Submit Quotation',
      `Quotation submitted for ${created.length} item(s) on request ${primaryId}`
    );

    await Notification.create({
      targetRole: 'Procurement Officer',
      title: 'New Bid Received',
      message: `Supplier ${supplierProfile.company} submitted a quotation bid for ${created.length} item${
        created.length > 1 ? 's' : ''
      }.`,
      type: 'Request'
    });

    res.status(201).json({ success: true, quotations: created, count: created.length });
  } catch (error) {
    next(error);
  }
};

// @desc    Update pending bid (before award)
// @route   PUT /api/quotations/batch
// @access  Private/Supplier
exports.updateQuotationBatch = async (req, res, next) => {
  try {
    const {
      materialRequest,
      items,
      deliveryCost,
      deliveryTimeDays,
      warrantyMonths,
      paymentTerms
    } = req.body;

    const primaryId = materialRequest || items?.[0]?.materialRequest;
    const request = await MaterialRequest.findById(primaryId);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Material request not found' });
    }

    const siblings = await siblingRequests(request);
    const approved = siblings.filter((r) => r.status === 'Approved');
    if (approved.length === 0) {
      return res.status(400).json({ success: false, error: 'Cannot edit bid — request is not approved' });
    }

    const { resolveSupplierProfile, isSupplierInvited } = require('../utils/supplierLink');
    const supplierProfile = await resolveSupplierProfile(req.user);
    if (!supplierProfile) {
      return res.status(400).json({
        success: false,
        error: 'Logged-in user is not linked to a registered Supplier profile'
      });
    }

    if (!(await isSupplierInvited(approved[0], supplierProfile, req.user))) {
      return res.status(403).json({
        success: false,
        error: 'You were not invited to quote on this material request'
      });
    }

    const existingQuotes = await Quotation.find({
      materialRequest: { $in: approved.map((r) => r._id) },
      supplier: supplierProfile._id
    });
    if (existingQuotes.length === 0) {
      return res.status(404).json({ success: false, error: 'No bid found to edit' });
    }
    if (existingQuotes.some((q) => q.status !== 'Pending')) {
      return res.status(400).json({
        success: false,
        error: 'Only pending bids can be edited (already awarded or rejected)'
      });
    }

    const priceById = new Map(
      (Array.isArray(items) ? items : []).map((it) => [
        String(it.materialRequest),
        Number(it.unitPrice)
      ])
    );

    for (const line of approved) {
      if (!priceById.has(line._id.toString()) || Number.isNaN(priceById.get(line._id.toString()))) {
        return res.status(400).json({
          success: false,
          error: 'Enter a unit price for every material in this request'
        });
      }
    }

    const updated = [];
    for (let i = 0; i < approved.length; i += 1) {
      const line = approved[i];
      const quote = existingQuotes.find(
        (q) => String(q.materialRequest) === String(line._id)
      );
      if (!quote) continue;
      quote.unitPrice = priceById.get(line._id.toString());
      quote.deliveryCost = i === 0 ? Number(deliveryCost) || 0 : 0;
      quote.deliveryTimeDays = deliveryTimeDays;
      quote.warrantyMonths = warrantyMonths;
      quote.paymentTerms = paymentTerms;
      await quote.save();
      updated.push(quote);
    }

    await logActivity(
      req,
      req.user,
      'Update Quotation',
      `Quotation bid updated for ${updated.length} item(s) on request ${primaryId}`
    );

    res.status(200).json({ success: true, quotations: updated, count: updated.length });
  } catch (error) {
    next(error);
  }
};

// @desc    Get quotations for comparison
// @route   GET /api/quotations
// @access  Private
exports.getQuotations = async (req, res, next) => {
  try {
    const { requestId } = req.query;
    const query = {};

    if (requestId) {
      const seed = await MaterialRequest.findById(requestId).select('_id batchId');
      if (seed?.batchId) {
        const ids = await MaterialRequest.find({ batchId: seed.batchId }).distinct('_id');
        query.materialRequest = { $in: ids };
      } else {
        query.materialRequest = requestId;
      }
    }

    // Suppliers only see their own quotes
    if (req.user.role === 'Supplier') {
      const { resolveSupplierProfile } = require('../utils/supplierLink');
      const supplierProfile = await resolveSupplierProfile(req.user);
      if (supplierProfile) {
        query.supplier = supplierProfile._id;
      } else {
        return res.status(200).json({ success: true, quotations: [] });
      }
    }

    const quotations = await Quotation.find(query)
      .populate('materialRequest')
      .populate('supplier', 'name company performanceRating email phone')
      .sort({ unitPrice: 1 }); // Sorted by lowest price offer first

    res.status(200).json({ success: true, quotations });
  } catch (error) {
    next(error);
  }
};

// @desc    Select quotation and trigger PO generation
// @route   PUT /api/quotations/:id/select
// @access  Private/Procurement Officer
exports.selectQuotation = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('supplier')
      .populate('materialRequest');

    if (!quotation) {
      return res.status(404).json({ success: false, error: 'Quotation not found' });
    }

    if (quotation.status !== 'Pending') {
      return res.status(400).json({ success: false, error: 'Quotation is already evaluated' });
    }

    const materialRequest = quotation.materialRequest;
    const siblings = await siblingRequests(materialRequest);
    const siblingIdList = siblings.map((r) => r._id);

    const supplierQuotes = await Quotation.find({
      materialRequest: { $in: siblingIdList },
      supplier: quotation.supplier._id,
      status: 'Pending'
    }).populate('materialRequest');

    const toAward = supplierQuotes.length > 0 ? supplierQuotes : [quotation];
    const awardIds = toAward.map((q) => q._id);

    await Quotation.updateMany({ _id: { $in: awardIds } }, { $set: { status: 'Selected' } });
    await Quotation.updateMany(
      { materialRequest: { $in: siblingIdList }, _id: { $nin: awardIds } },
      { $set: { status: 'Rejected' } }
    );

    const awardedRequestIds = toAward
      .map((q) => q.materialRequest?._id || q.materialRequest)
      .filter(Boolean);
    await MaterialRequest.updateMany(
      { _id: { $in: awardedRequestIds } },
      { $set: { status: 'Ordered' } }
    );

    const items = toAward.map((q) => {
      const reqDoc = q.materialRequest;
      return {
        material: reqDoc.material,
        quantity: reqDoc.quantity,
        unitPrice: q.unitPrice
      };
    });

    const subtotal = items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unitPrice), 0);
    const tax = subtotal * 0.05;
    const deliveryCost = toAward.reduce((sum, q) => sum + Number(q.deliveryCost || 0), 0);
    const grandTotal = subtotal + tax + deliveryCost;

    const po = await PurchaseOrder.create({
      supplier: quotation.supplier._id,
      materialRequest: materialRequest._id,
      items,
      tax,
      deliveryCost,
      grandTotal,
      status: 'Pending',
      paymentStatus: 'Unpaid'
    });

    await logActivity(req, req.user, 'Select Quotation & Create PO', `Selected bid from ${quotation.supplier.company}. PO ${po.purchaseOrderNumber} created`);

    // Notify Selected Supplier
    // We need to notify user account linked to supplier
    const User = require('../models/User');
    const supplierUser = await User.findOne({ email: quotation.supplier.email });
    if (supplierUser) {
      await Notification.create({
        user: supplierUser._id,
        title: 'New Purchase Order Assigned',
        message: `Your quote was accepted. Purchase Order ${po.purchaseOrderNumber} ($${grandTotal.toFixed(2)}) has been issued.`,
        type: 'Request'
      });
    }

    res.status(200).json({ success: true, po });
  } catch (error) {
    next(error);
  }
};
