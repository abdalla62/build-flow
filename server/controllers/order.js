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
      // paymentStatus is ledger-driven â€” only auto-cancel with PO cancel/reject
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
      const doc = new PDFDocument({ margin: 0, size: 'A4' });
      const stream = fs.createWriteStream(fullPath);
      doc.pipe(stream);

      const pageW = doc.page.width;
      const pageH = doc.page.height;
      const left = 48;
      const right = pageW - 48;
      const contentW = right - left;
      const teal = '#0F766E';
      const tealDark = '#115E59';
      const slate = '#0F172A';
      const muted = '#64748B';
      const border = '#E2E8F0';
      const soft = '#F0FDFA';

      const project = order.materialRequest?.project?.name || '—';
      const projectLoc = order.materialRequest?.project?.location || '';
      const today = new Date().toLocaleDateString();
      const invoiceNo = `INV-${order.purchaseOrderNumber || safePo}`;
      const tax = Number(order.tax || 0);
      const discount = Number(order.discount || 0);
      const grand = Number(order.grandTotal || 0);
      const items = order.items || [];
      const subtotal = items.reduce((sum, item) => {
        return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
      }, 0);
      const money = (n) => `$${Number(n || 0).toFixed(2)}`;

      // Brand header
      doc.rect(0, 0, pageW, 96).fill(teal);
      doc.rect(0, 96, pageW, 6).fill(tealDark);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(26);
      doc.text('INVOICE', left, 28, { width: contentW * 0.55 });
      doc.font('Helvetica').fontSize(10).fillColor('#CCFBF1');
      doc.text('BUILD FLOW', left, 58);
      doc.text('Construction Material Procurement', left, 72);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
      doc.text(invoiceNo, left + contentW * 0.55, 34, { width: contentW * 0.45, align: 'right' });
      doc.font('Helvetica').fontSize(9).fillColor('#CCFBF1');
      doc.text(`Date: ${today}`, left + contentW * 0.55, 52, { width: contentW * 0.45, align: 'right' });
      doc.text(`PO: ${order.purchaseOrderNumber || '—'}`, left + contentW * 0.55, 66, {
        width: contentW * 0.45,
        align: 'right'
      });

      // Project meta card
      let y = 124;
      doc.roundedRect(left, y, contentW, 54, 8).fill(soft);
      doc.roundedRect(left, y, contentW, 54, 8).lineWidth(1).strokeColor('#99F6E4').stroke();
      doc.fillColor(muted).font('Helvetica').fontSize(8);
      doc.text('PROJECT', left + 16, y + 12);
      doc.text('PO STATUS', left + contentW * 0.55, y + 12);
      doc.fillColor(slate).font('Helvetica-Bold').fontSize(11);
      doc.text(project, left + 16, y + 26, { width: contentW * 0.5 });
      if (projectLoc) {
        doc.font('Helvetica').fontSize(8).fillColor(muted).text(projectLoc, left + 16, y + 40, {
          width: contentW * 0.5
        });
      }
      doc.font('Helvetica-Bold').fontSize(11).fillColor(teal);
      doc.text(order.status || 'Issued', left + contentW * 0.55, y + 26);

      // Supplier / Bill-to cards
      y = 196;
      const cardW = (contentW - 16) / 2;
      const drawInfoCard = (x, title, lines) => {
        doc.roundedRect(x, y, cardW, 108, 8).fill('#FFFFFF');
        doc.roundedRect(x, y, cardW, 108, 8).lineWidth(1).strokeColor(border).stroke();
        doc.rect(x, y, 4, 108).fill(teal);
        doc.fillColor(muted).font('Helvetica-Bold').fontSize(8);
        doc.text(title, x + 16, y + 14);
        doc.fillColor(slate).font('Helvetica-Bold').fontSize(11);
        doc.text(lines[0] || '—', x + 16, y + 32, { width: cardW - 28 });
        doc.font('Helvetica').fontSize(9).fillColor('#334155');
        let ly = y + 50;
        lines.slice(1).forEach((t) => {
          if (!t) return;
          doc.text(String(t), x + 16, ly, { width: cardW - 28 });
          ly += 14;
        });
      };

      drawInfoCard(left, 'FROM (SUPPLIER)', [
        company,
        order.supplier?.email,
        order.supplier?.phone ? String(order.supplier.phone) : '',
        order.supplier?.address ? String(order.supplier.address) : ''
      ]);
      drawInfoCard(left + cardW + 16, 'BILL TO', [
        'BUILD FLOW — Project Client',
        project,
        projectLoc || 'Project site',
        `Linked PO ${order.purchaseOrderNumber || '—'}`
      ]);

      // Line items
      y = 328;
      doc.fillColor(slate).font('Helvetica-Bold').fontSize(12);
      doc.text('Line Items', left, y);
      y += 22;

      const cols = [
        { key: 'n', label: '#', x: left, w: 28 },
        { key: 'm', label: 'Material', x: left + 28, w: 210 },
        { key: 'q', label: 'Qty', x: left + 238, w: 50 },
        { key: 'u', label: 'Unit', x: left + 288, w: 58 },
        { key: 'p', label: 'Unit Price', x: left + 346, w: 80 },
        { key: 't', label: 'Amount', x: left + 426, w: contentW - 426 }
      ];

      const headerH = 26;
      doc.roundedRect(left, y, contentW, headerH, 6).fill(teal);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
      cols.forEach((c) => {
        const align = c.key === 'p' || c.key === 't' || c.key === 'q' ? 'right' : 'left';
        doc.text(c.label, c.x + 6, y + 9, { width: c.w - 10, align });
      });
      y += headerH;

      const rowH = 24;
      items.forEach((item, idx) => {
        const name = item.material?.name || 'Material';
        const unit = item.material?.unit || '—';
        const qty = Number(item.quantity || 0);
        const price = Number(item.unitPrice || 0);
        const amount = Number((qty * price).toFixed(2));

        if (y + rowH > pageH - 180) {
          doc.addPage();
          y = 48;
        }

        if (idx % 2 === 1) {
          doc.rect(left, y, contentW, rowH).fill('#F8FAFC');
        }
        doc.moveTo(left, y + rowH).lineTo(right, y + rowH).strokeColor(border).lineWidth(0.5).stroke();

        const vals = [String(idx + 1), name, String(qty), unit, money(price), money(amount)];
        cols.forEach((c, i) => {
          const align = c.key === 'p' || c.key === 't' || c.key === 'q' ? 'right' : 'left';
          const font = c.key === 'm' || c.key === 't' ? 'Helvetica-Bold' : 'Helvetica';
          doc.fillColor(slate).font(font).fontSize(9);
          doc.text(vals[i], c.x + 6, y + 7, { width: c.w - 10, align });
        });
        y += rowH;
      });

      if (items.length === 0) {
        doc.rect(left, y, contentW, rowH).fill('#F8FAFC');
        doc.fillColor(muted).font('Helvetica').fontSize(9);
        doc.text('No line items on this purchase order.', left + 12, y + 7);
        y += rowH;
      }

      // Totals
      y += 18;
      const boxW = 220;
      const boxX = right - boxW;
      doc.roundedRect(boxX, y, boxW, 108, 8).fill('#FFFFFF');
      doc.roundedRect(boxX, y, boxW, 108, 8).lineWidth(1).strokeColor(border).stroke();

      const totalRow = (label, value, yy) => {
        doc.font('Helvetica').fontSize(9).fillColor(muted);
        doc.text(label, boxX + 14, yy, { width: 90 });
        doc.fillColor(slate).text(value, boxX + 100, yy, { width: boxW - 114, align: 'right' });
      };
      totalRow('Subtotal', money(subtotal), y + 14);
      totalRow('Tax', money(tax), y + 34);
      totalRow('Discount', money(discount), y + 54);
      doc.moveTo(boxX + 12, y + 72).lineTo(boxX + boxW - 12, y + 72).strokeColor(border).stroke();
      doc.rect(boxX, y + 78, boxW, 30).fill(teal);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
      doc.text('GRAND TOTAL', boxX + 14, y + 88);
      doc.fontSize(12).text(money(grand), boxX + 100, y + 86, { width: boxW - 114, align: 'right' });

      // Footer
      const footY = pageH - 56;
      doc.moveTo(left, footY).lineTo(right, footY).strokeColor(border).lineWidth(1).stroke();
      doc.fillColor(muted).font('Helvetica').fontSize(8);
      doc.text(
        'Auto-generated from Purchase Order data in BUILD FLOW. Supplier may replace with a custom uploaded invoice if needed.',
        left,
        footY + 12,
        { width: contentW * 0.72 }
      );
      doc.fillColor(teal).font('Helvetica-Bold').fontSize(8);
      doc.text('BUILD FLOW', right - 90, footY + 12, { width: 90, align: 'right' });

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
