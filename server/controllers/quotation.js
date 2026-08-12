const Quotation = require('../models/Quotation');
const MaterialRequest = require('../models/MaterialRequest');
const PurchaseOrder = require('../models/PurchaseOrder');
const Notification = require('../models/Notification');
const logActivity = require('../utils/audit');

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

// @desc    Get quotations for comparison
// @route   GET /api/quotations
// @access  Private
exports.getQuotations = async (req, res, next) => {
  try {
    const { requestId } = req.query;
    const query = {};

    if (requestId) {
      query.materialRequest = requestId;
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

    // Award contract
    quotation.status = 'Selected';
    await quotation.save();

    // Reject other bids for this request
    await Quotation.updateMany(
      { materialRequest: materialRequest._id, _id: { $ne: quotation._id } },
      { status: 'Rejected' }
    );

    // Update MaterialRequest status
    materialRequest.status = 'Ordered';
    await materialRequest.save();

    // Auto-calculate Grand Total (Quantity * Unit Price) + Tax + Delivery/Shipping
    const subtotal = materialRequest.quantity * quotation.unitPrice;
    const tax = subtotal * 0.05; // 5% flat tax estimation
    const deliveryCost = Number(quotation.deliveryCost || 0);
    const grandTotal = subtotal + tax + deliveryCost;

    // Generate Purchase Order
    const po = await PurchaseOrder.create({
      supplier: quotation.supplier._id,
      materialRequest: materialRequest._id,
      items: [{
        material: materialRequest.material,
        quantity: materialRequest.quantity,
        unitPrice: quotation.unitPrice
      }],
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
