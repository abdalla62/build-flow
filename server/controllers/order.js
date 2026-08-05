const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');
const Notification = require('../models/Notification');
const logActivity = require('../utils/audit');
const { markOverduePurchaseOrders } = require('../utils/paymentStatus');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

// @desc    Get all purchase orders
// @route   GET /api/orders
// @access  Private
exports.getOrders = async (req, res, next) => {
  try {
    await markOverduePurchaseOrders();

    const { page = 1, limit = 10, search, status, paymentStatus } = req.query;
    const query = {};

    // Role-based visibility
    if (req.user.role === 'Supplier') {
      const { resolveSupplierProfile } = require('../utils/supplierLink');
      const supplierProfile = await resolveSupplierProfile(req.user);
      if (supplierProfile) {
        query.supplier = supplierProfile._id;
      }
    }

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    if (search) {
      query.purchaseOrderNumber = { $regex: search, $options: 'i' };
    }

    const count = await PurchaseOrder.countDocuments(query);
    const orders = await PurchaseOrder.find(query)
      .populate('supplier', 'name company email phone')
      .populate('materialRequest')
      .populate('items.material', 'name unit')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalOrders: count
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single purchase order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id)
      .populate('supplier', 'name company email phone address paymentTerms')
      .populate({
        path: 'materialRequest',
        populate: { path: 'project', select: 'name location manager' }
      })
      .populate('items.material', 'name unit estimatedPrice');

    if (!order) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }
    res.status(200).json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

// @desc    Update purchase order (Procurement / Admin)
// @route   PUT /api/orders/:id
// @access  Private/Procurement Officer, Administrator
exports.updateOrder = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    const { quantity, unitPrice, tax, discount, status } = req.body;

    if (order.items?.length > 0) {
      if (quantity !== undefined) order.items[0].quantity = Number(quantity);
      if (unitPrice !== undefined) order.items[0].unitPrice = Number(unitPrice);
    }

    if (tax !== undefined) order.tax = Number(tax);
    if (discount !== undefined) order.discount = Number(discount);

    if (status) {
      const allowed = ['Pending', 'Accepted', 'Rejected', 'Preparing', 'Dispatched', 'Delivered', 'Cancelled'];
      if (!allowed.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid PO status' });
      }
      order.status = status;
      // paymentStatus is ledger-driven — only auto-cancel with PO cancel/reject
      if (status === 'Rejected' || status === 'Cancelled') {
        order.paymentStatus = 'Cancelled';
      }
    }

    const qty = order.items?.[0]?.quantity || 0;
    const price = order.items?.[0]?.unitPrice || 0;
    const taxAmt = Number(order.tax) || 0;
    const discAmt = Number(order.discount) || 0;
    order.grandTotal = Math.max(0, qty * price + taxAmt - discAmt);

    await order.save();

    const populated = await PurchaseOrder.findById(order._id)
      .populate('supplier', 'name company email phone')
      .populate('items.material', 'name unit');

    await logActivity(
      req,
      req.user,
      'Update Purchase Order',
      `Updated PO ${order.purchaseOrderNumber}`
    );

    res.status(200).json({ success: true, order: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete purchase order
// @route   DELETE /api/orders/:id
// @access  Private/Procurement Officer, Administrator
exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    const poNumber = order.purchaseOrderNumber;
    await PurchaseOrder.findByIdAndDelete(req.params.id);

    await logActivity(req, req.user, 'Delete Purchase Order', `Deleted PO ${poNumber}`);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept / Reject Purchase Order
// @route   PUT /api/orders/:id/status
// @access  Private/Supplier
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Accepted', 'Rejected', 'Preparing', 'Dispatched'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid order status transition' });
    }

    const order = await PurchaseOrder.findById(req.params.id).populate('supplier');
    if (!order) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    // Verify ownership or role
    if (req.user.role !== 'Supplier' && req.user.role !== 'Administrator' && order.supplier?.email !== req.user.email) {
      return res.status(403).json({ success: false, error: 'You are not authorized to update status of this purchase order' });
    }

    order.status = status;
    if (status === 'Rejected' || status === 'Cancelled') {
      order.paymentStatus = 'Cancelled';
    }
    await order.save();

    await logActivity(req, req.user, `PO Status Updated - ${status}`, `PO ${order.purchaseOrderNumber} status set to ${status}`);

    // Notify Procurement Officers
    await Notification.create({
      targetRole: 'Procurement Officer',
      title: `PO ${order.purchaseOrderNumber} ${status}`,
      message: `Supplier ${order.supplier?.company || 'Vendor'} marked PO ${order.purchaseOrderNumber} as "${status}".`,
      type: 'Request'
    });

    res.status(200).json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload invoice document (file or path string)
// @route   PUT /api/orders/:id/invoice
// @access  Private/Supplier
exports.uploadPOInvoice = async (req, res, next) => {
  try {
    const invoiceFile = req.file
      ? `/uploads/invoices/${req.file.filename}`
      : (typeof req.body.invoiceFile === 'string' ? req.body.invoiceFile.trim() : '');

    if (!invoiceFile) {
      return res.status(400).json({
        success: false,
        error: 'Invoice file is required (upload a PDF/image or provide a path)'
      });
    }

    const order = await PurchaseOrder.findById(req.params.id).populate('supplier');
    if (!order) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    if (req.user.role !== 'Supplier' && req.user.role !== 'Administrator' && order.supplier?.email !== req.user.email) {
      return res.status(403).json({ success: false, error: 'Unauthorized to modify this PO invoice' });
    }

    order.invoiceFile = invoiceFile;
    await order.save();

    await logActivity(req, req.user, 'Upload PO Invoice', `Invoice uploaded for PO ${order.purchaseOrderNumber}`);

    // Notify Accountant
    await Notification.create({
      targetRole: 'Accountant',
      title: 'New Supplier Invoice Received',
      message: `Supplier ${order.supplier.company} uploaded invoice for Purchase Order ${order.purchaseOrderNumber}. Ready for recording payments.`,
      type: 'Payment'
    });

    res.status(200).json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    One-click invoice: auto-generate PDF from PO data (no Word needed)
 * @route   POST /api/orders/:id/generate-invoice
 * @access  Private/Supplier, Administrator
 */
exports.generatePOInvoice = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id)
      .populate('supplier', 'company name email phone address')
      .populate('items.material', 'name unit')
      .populate({
        path: 'materialRequest',
        select: 'project',
        populate: { path: 'project', select: 'name location' }
      });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    const isAdmin = req.user.role === 'Administrator';
    const isOwnerSupplier =
      req.user.role === 'Supplier' &&
      order.supplier &&
      String(order.supplier.email || '').toLowerCase() ===
        String(req.user.email || '').toLowerCase();

    if (!isAdmin && !isOwnerSupplier) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to generate invoice for this PO'
      });
    }

    const invoicesDir = path.join(__dirname, '..', 'uploads', 'invoices');
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    const safePo = String(order.purchaseOrderNumber || order._id).replace(/[^\w.-]+/g, '_');
    const filename = `auto-invoice-${safePo}-${Date.now()}.pdf`;
    const fullPath = path.join(invoicesDir, filename);
    const publicPath = `/uploads/invoices/${filename}`;
    const company = order.supplier?.company || order.supplier?.name || 'Supplier';

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(fullPath);
      doc.pipe(stream);

      const project = order.materialRequest?.project?.name || '—';
      const today = new Date().toLocaleDateString();

      doc.fillColor('#0F766E').fontSize(20).text('INVOICE', { align: 'left' });
      doc.moveDown(0.3);
      doc.fillColor('#0F172A').fontSize(10).text('BUILD FLOW — Construction Material Procurement');
      doc.moveDown(1);

      doc.fontSize(11).fillColor('#334155');
      doc.text(`Invoice No: INV-${safePo}`);
      doc.text(`Date: ${today}`);
      doc.text(`PO Number: ${order.purchaseOrderNumber}`);
      doc.text(`Project: ${project}`);
      doc.moveDown(0.8);

      doc.fillColor('#0F172A').fontSize(12).text('From (Supplier)', { underline: true });
      doc.fontSize(10).fillColor('#334155');
      doc.text(company);
      if (order.supplier?.email) doc.text(order.supplier.email);
      if (order.supplier?.phone) doc.text(String(order.supplier.phone));
      if (order.supplier?.address) doc.text(String(order.supplier.address));
      doc.moveDown(1);

      doc.fillColor('#0F172A').fontSize(12).text('Line Items', { underline: true });
      doc.moveDown(0.5);

      const startY = doc.y;
      doc.fontSize(9).fillColor('#FFFFFF').rect(50, startY, 495, 20).fill('#0F766E');
      doc.text('Material', 55, startY + 6);
      doc.text('Qty', 280, startY + 6);
      doc.text('Unit', 330, startY + 6);
      doc.text('Unit Price', 380, startY + 6);
      doc.text('Line Total', 470, startY + 6);
      doc.moveDown(1.2);

      let y = doc.y;
      (order.items || []).forEach((item, idx) => {
        const name = item.material?.name || 'Material';
        const unit = item.material?.unit || '';
        const qty = Number(item.quantity || 0);
        const price = Number(item.unitPrice || 0);
        const line = Number((qty * price).toFixed(2));
        if (idx % 2 === 1) {
          doc.fillColor('#F8FAFC').rect(50, y - 2, 495, 18).fill();
        }
        doc.fillColor('#0F172A').fontSize(9);
        doc.text(name, 55, y, { width: 210 });
        doc.text(String(qty), 280, y);
        doc.text(unit, 330, y);
        doc.text(`$${price.toFixed(2)}`, 380, y);
        doc.text(`$${line.toFixed(2)}`, 470, y);
        y += 18;
      });

      doc.y = y + 10;
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#334155');
      doc.text(`Tax: $${Number(order.tax || 0).toFixed(2)}`, { align: 'right' });
      doc.text(`Discount: $${Number(order.discount || 0).toFixed(2)}`, { align: 'right' });
      doc.moveDown(0.3);
      doc.fontSize(13).fillColor('#0F766E').text(
        `Grand Total: $${Number(order.grandTotal || 0).toFixed(2)}`,
        { align: 'right' }
      );

      doc.moveDown(2);
      doc.fontSize(9).fillColor('#64748B').text(
        'Auto-generated from Purchase Order data in BUILD FLOW. Supplier may replace with a custom uploaded invoice if needed.',
        { align: 'left', width: 495 }
      );

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    order.invoiceFile = publicPath;
    await order.save();

    await logActivity(
      req,
      req.user,
      'Generate PO Invoice',
      `Auto invoice generated for PO ${order.purchaseOrderNumber}`
    );

    await Notification.create({
      targetRole: 'Accountant',
      title: 'New Supplier Invoice Received',
      message: `Invoice auto-generated for Purchase Order ${order.purchaseOrderNumber} (${company}). Ready for recording payments.`,
      type: 'Payment'
    });

    const fresh = await PurchaseOrder.findById(order._id)
      .populate('supplier', 'company name email')
      .populate('items.material', 'name unit');

    res.status(200).json({ success: true, order: fresh, invoiceFile: publicPath });
  } catch (error) {
    next(error);
  }
};
