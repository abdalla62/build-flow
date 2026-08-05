const Payment = require('../models/Payment');
const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');
const Delivery = require('../models/Delivery');
const Notification = require('../models/Notification');
const logActivity = require('../utils/audit');
const { markOverduePurchaseOrders } = require('../utils/paymentStatus');
const waafiPay = require('../services/waafiPay');

async function assertPaymentEligible(po) {
  if (!po) {
    return { ok: false, status: 404, error: 'Purchase order not found' };
  }

  if (po.status === 'Rejected' || po.status === 'Cancelled' || po.paymentStatus === 'Cancelled') {
    return { ok: false, status: 400, error: 'Cannot pay for rejected or cancelled purchase orders' };
  }

  if (!po.invoiceFile || !String(po.invoiceFile).trim()) {
    return { ok: false, status: 400, error: 'Invoice is required before recording payment. Ask the supplier to upload an invoice on the PO.' };
  }

  // Delivered required: PO status Delivered OR a delivery marked Delivered
  const deliveredDelivery = await Delivery.findOne({
    purchaseOrder: po._id,
    status: 'Delivered'
  });

  if (po.status !== 'Delivered' && !deliveredDelivery) {
    return {
      ok: false,
      status: 400,
      error: 'Payment is only allowed after delivery is marked Delivered.'
    };
  }

  return { ok: true };
}

// @desc    Record a payment (manual ledger or Waafi Mobile Wallet)
// @route   POST /api/payments
// @access  Private/Accountant, Administrator
exports.recordPayment = async (req, res, next) => {
  try {
    const { purchaseOrder, paidAmount, paymentMethod, referenceNumber, accountNo } = req.body;
    const amount = Number(paidAmount);

    const po = await PurchaseOrder.findById(purchaseOrder).populate('supplier');
    const gate = await assertPaymentEligible(po);
    if (!gate.ok) {
      return res.status(gate.status).json({ success: false, error: gate.error });
    }

    const pastPayments = await Payment.find({ purchaseOrder });
    const totalPaidBefore = pastPayments.reduce((sum, p) => sum + p.paidAmount, 0);
    const remainingBefore = Number((po.grandTotal - totalPaidBefore).toFixed(2));

    if (!(amount > 0)) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
    }

    if (amount > remainingBefore) {
      return res.status(400).json({
        success: false,
        error: `Payment exceeds remaining balance of $${remainingBefore.toFixed(2)}`
      });
    }

    const remainingBalance = Number((remainingBefore - amount).toFixed(2));
    const isWallet = paymentMethod === 'Mobile Wallet';

    let finalReference = referenceNumber;
    let payerAccountNo = '';
    let waafiTransactionId = '';
    let waafiResponse = null;

    if (isWallet) {
      if (!accountNo) {
        return res.status(400).json({
          success: false,
          error: 'Mobile wallet account number is required (e.g. 2526XXXXXXXX)'
        });
      }

      const uniqueRef = `PO${po.purchaseOrderNumber.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;
      const waafiResult = await waafiPay.purchase({
        accountNo,
        amount,
        referenceId: uniqueRef,
        invoiceId: po.purchaseOrderNumber.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 50) || uniqueRef,
        description: `PO ${po.purchaseOrderNumber} payment to ${po.supplier?.company || 'supplier'}`
      });

      finalReference = `WAAFI-${waafiResult.transactionId}`;
      payerAccountNo = waafiResult.accountNo;
      waafiTransactionId = String(waafiResult.transactionId);
      waafiResponse = waafiResult.raw;
    } else {
      if (!finalReference || !String(finalReference).trim()) {
        return res.status(400).json({ success: false, error: 'Reference transaction number is required' });
      }
    }

    const refExists = await Payment.findOne({ referenceNumber: finalReference });
    if (refExists) {
      return res.status(400).json({ success: false, error: 'Reference transaction number already exists' });
    }

    const receiptFile = req.file
      ? `/uploads/receipts/${req.file.filename}`
      : (typeof req.body.receiptFile === 'string' ? req.body.receiptFile.trim() : '');

    const payment = await Payment.create({
      purchaseOrder,
      totalAmount: po.grandTotal,
      paidAmount: amount,
      remainingBalance,
      paymentMethod,
      referenceNumber: finalReference,
      payerAccountNo,
      waafiTransactionId,
      waafiResponse,
      receiptFile: receiptFile || '',
      recordedBy: req.user.id
    });

    if (remainingBalance === 0) {
      po.paymentStatus = 'Paid';
    } else {
      po.paymentStatus = 'Partially Paid';
    }
    await po.save();

    await logActivity(
      req,
      req.user,
      'Record Payment',
      `Recorded ${paymentMethod} payment of $${amount.toFixed(2)} for PO ${po.purchaseOrderNumber}. Balance: $${remainingBalance.toFixed(2)}${waafiTransactionId ? ` (Waafi TXN ${waafiTransactionId})` : ''}`
    );

    const User = require('../models/User');
    const supplierUser = await User.findOne({ email: po.supplier.email });
    if (supplierUser) {
      await Notification.create({
        user: supplierUser._id,
        title: 'Payment Received',
        message: `A payment of $${amount.toFixed(2)} (${paymentMethod}) was recorded against PO ${po.purchaseOrderNumber}. Outstanding: $${remainingBalance.toFixed(2)}.`,
        type: 'Payment'
      });
    }

    res.status(201).json({ success: true, payment });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        waafi: error.waafi || undefined
      });
    }
    next(error);
  }
};

// @desc    Payment dashboard summary
// @route   GET /api/payments/summary
// @access  Private
exports.getPaymentSummary = async (req, res, next) => {
  try {
    await markOverduePurchaseOrders();

    let poQuery = {
      status: { $nin: ['Rejected', 'Cancelled'] },
      paymentStatus: { $ne: 'Cancelled' }
    };

    if (req.user.role === 'Supplier') {
      const supplierProfile = await Supplier.findOne({ email: req.user.email });
      if (!supplierProfile) {
        return res.status(200).json({
          success: true,
          summary: { unpaidCount: 0, outstandingTotal: 0, paidThisMonth: 0, overdueCount: 0 }
        });
      }
      poQuery.supplier = supplierProfile._id;
    }

    const openStatuses = ['Unpaid', 'Partially Paid', 'Overdue'];
    const openPOs = await PurchaseOrder.find({
      ...poQuery,
      paymentStatus: { $in: openStatuses }
    }).select('_id grandTotal paymentStatus');

    const unpaidCount = openPOs.length;
    const overdueCount = openPOs.filter((o) => o.paymentStatus === 'Overdue').length;

    const openIds = openPOs.map((o) => o._id);
    const openPayments = openIds.length
      ? await Payment.find({ purchaseOrder: { $in: openIds } }).select('purchaseOrder paidAmount')
      : [];

    const paidByPo = {};
    for (const p of openPayments) {
      const id = String(p.purchaseOrder);
      paidByPo[id] = (paidByPo[id] || 0) + p.paidAmount;
    }

    let outstandingTotal = 0;
    for (const o of openPOs) {
      const paid = paidByPo[String(o._id)] || 0;
      outstandingTotal += Math.max(0, o.grandTotal - paid);
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthPayQuery = { paymentDate: { $gte: startOfMonth } };
    if (req.user.role === 'Supplier') {
      const supplierProfile = await Supplier.findOne({ email: req.user.email });
      if (supplierProfile) {
        const pos = await PurchaseOrder.find({ supplier: supplierProfile._id }).select('_id');
        monthPayQuery.purchaseOrder = { $in: pos.map((p) => p._id) };
      }
    }

    const monthPayments = await Payment.find(monthPayQuery).select('paidAmount');
    const paidThisMonth = monthPayments.reduce((s, p) => s + p.paidAmount, 0);

    res.status(200).json({
      success: true,
      summary: {
        unpaidCount,
        outstandingTotal: Number(outstandingTotal.toFixed(2)),
        paidThisMonth: Number(paidThisMonth.toFixed(2)),
        overdueCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private
exports.getPayments = async (req, res, next) => {
  try {
    await markOverduePurchaseOrders();

    const { page = 1, limit = 10, search } = req.query;
    const query = {};

    if (req.user.role === 'Supplier') {
      const supplierProfile = await Supplier.findOne({ email: req.user.email });
      if (supplierProfile) {
        const pos = await PurchaseOrder.find({ supplier: supplierProfile._id });
        const poIds = pos.map((po) => po._id);
        query.purchaseOrder = { $in: poIds };
      } else {
        return res.status(200).json({ success: true, payments: [] });
      }
    }

    if (search) {
      query.referenceNumber = { $regex: search, $options: 'i' };
    }

    const count = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .populate('purchaseOrder', 'purchaseOrderNumber grandTotal paymentStatus invoiceFile status')
      .populate('recordedBy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      payments,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalPayments: count
    });
  } catch (error) {
    next(error);
  }
};
