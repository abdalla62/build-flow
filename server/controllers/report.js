const Payment = require('../models/Payment');
const Delivery = require('../models/Delivery');
const PurchaseOrder = require('../models/PurchaseOrder');
const Inventory = require('../models/Inventory');

function monthRange(monthStr) {
  // monthStr = YYYY-MM ; default = current UTC month
  const now = new Date();
  const raw =
    typeof monthStr === 'string' && /^\d{4}-\d{2}$/.test(monthStr)
      ? monthStr
      : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const [y, m] = raw.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return { month: raw, start, end };
}

function money(n) {
  return Number(Number(n || 0).toFixed(2));
}

function daysBetween(a, b) {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / (1000 * 60 * 60 * 24);
}

/**
 * Feature 10.13 — non-AI supplier performance metrics (all-time).
 * Optional filterSupplierId limits to one supplier (self-service).
 */
async function buildSupplierPerformanceReport(filterSupplierId = null) {
  const Supplier = require('../models/Supplier');
  const supplierQuery = filterSupplierId ? { _id: filterSupplierId } : {};
  const suppliers = await Supplier.find(supplierQuery)
    .select('company name email')
    .sort({ company: 1 })
    .lean();

  if (suppliers.length === 0) {
    return {
      title: 'Supplier Performance Record',
      description:
        'Non-AI supplier evaluation: completed orders, delays, delivery time, cancellations, transaction value, and payment history',
      headers: [
        'Supplier',
        'Completed Orders',
        'Delayed Deliveries',
        'Avg Delivery Days',
        'Cancelled Orders',
        'Total Transaction Value',
        'Payments Paid',
        'Payments Unpaid',
        'Payments Overdue',
        'Total Paid Amount'
      ],
      rows: [],
      summary: { supplierCount: 0 },
      count: 0
    };
  }

  const supplierIds = suppliers.map((s) => s._id);
  const [orders, deliveries, payments] = await Promise.all([
    PurchaseOrder.find({ supplier: { $in: supplierIds } })
      .select('supplier status paymentStatus grandTotal createdAt')
      .lean(),
    Delivery.find()
      .populate({
        path: 'purchaseOrder',
        select: 'supplier createdAt',
        match: { supplier: { $in: supplierIds } }
      })
      .select(
        'status deliveryDate actualDeliveredAt originalDeliveryDate purchaseOrder rescheduleHistory'
      )
      .lean(),
    Payment.find()
      .populate({
        path: 'purchaseOrder',
        select: 'supplier',
        match: { supplier: { $in: supplierIds } }
      })
      .select('paidAmount purchaseOrder')
      .lean()
  ]);

  const byId = new Map(
    suppliers.map((s) => [
      String(s._id),
      {
        company: s.company || s.name || '—',
        completedOrders: 0,
        cancelledOrders: 0,
        delayedDeliveries: 0,
        deliveryDurations: [],
        totalTransactionValue: 0,
        paidPayments: 0,
        unpaidPos: 0,
        overduePos: 0,
        totalPaidAmount: 0
      }
    ])
  );

  for (const o of orders) {
    const key = String(o.supplier);
    const row = byId.get(key);
    if (!row) continue;
    if (o.status === 'Delivered') row.completedOrders += 1;
    if (o.status === 'Cancelled' || o.status === 'Rejected') row.cancelledOrders += 1;
    if (!['Cancelled', 'Rejected'].includes(o.status)) {
      row.totalTransactionValue += Number(o.grandTotal || 0);
    }
    if (o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Partially Paid') {
      row.unpaidPos += 1;
    }
    if (o.paymentStatus === 'Overdue') row.overduePos += 1;
    if (o.paymentStatus === 'Paid') row.paidPayments += 1;
  }

  for (const d of deliveries) {
    const po = d.purchaseOrder;
    if (!po?.supplier) continue;
    const key = String(po.supplier);
    const row = byId.get(key);
    if (!row) continue;

    const scheduled = d.originalDeliveryDate || d.deliveryDate;
    const delayed =
      d.status === 'Delayed' ||
      (Array.isArray(d.rescheduleHistory) && d.rescheduleHistory.length > 0) ||
      (d.status === 'Delivered' &&
        d.actualDeliveredAt &&
        scheduled &&
        new Date(d.actualDeliveredAt) > new Date(scheduled));

    if (delayed) row.delayedDeliveries += 1;

    if (d.actualDeliveredAt && po.createdAt) {
      const days = daysBetween(po.createdAt, d.actualDeliveredAt);
      if (days != null) row.deliveryDurations.push(days);
    }
  }

  for (const p of payments) {
    const po = p.purchaseOrder;
    if (!po?.supplier) continue;
    const row = byId.get(String(po.supplier));
    if (!row) continue;
    row.totalPaidAmount += Number(p.paidAmount || 0);
  }

  const rows = [...byId.values()].map((r) => {
    const avg =
      r.deliveryDurations.length > 0
        ? money(
            r.deliveryDurations.reduce((s, d) => s + d, 0) / r.deliveryDurations.length
          )
        : null;
    return [
      r.company,
      r.completedOrders,
      r.delayedDeliveries,
      avg == null ? '—' : avg,
      r.cancelledOrders,
      money(r.totalTransactionValue),
      r.paidPayments,
      r.unpaidPos,
      r.overduePos,
      money(r.totalPaidAmount)
    ];
  });

  return {
    title: 'Supplier Performance Record',
    description:
      'Non-AI supplier evaluation (all-time): completed orders, delayed deliveries, average delivery time, cancelled orders, transaction value, and payment history',
    headers: [
      'Supplier',
      'Completed Orders',
      'Delayed Deliveries',
      'Avg Delivery Days',
      'Cancelled Orders',
      'Total Transaction Value',
      'Payments Paid (PO count)',
      'Unpaid / Partial POs',
      'Overdue POs',
      'Total Paid Amount'
    ],
    rows,
    summary: {
      supplierCount: rows.length,
      completedOrders: rows.reduce((s, r) => s + Number(r[1] || 0), 0),
      delayedDeliveries: rows.reduce((s, r) => s + Number(r[2] || 0), 0),
      cancelledOrders: rows.reduce((s, r) => s + Number(r[4] || 0), 0),
      totalTransactionValue: money(rows.reduce((s, r) => s + Number(r[5] || 0), 0)),
      totalPaidAmount: money(rows.reduce((s, r) => s + Number(r[9] || 0), 0))
    },
    count: rows.length
  };
}

/**
 * @desc    Feature 10.14 — downloadable operational reports
 * @route   GET /api/reports?month=YYYY-MM
 * @access  Private/Admin or Procurement Officer
 *
 * Reports:
 *  - monthlyProcurement
 *  - supplierPayments
 *  - deliverySchedule
 *  - outstandingBalance
 *  - materialUsage
 *  - supplierPerformance (10.13)
 */
exports.getReportStats = async (req, res, next) => {
  try {
    const { month, start, end } = monthRange(req.query.month);
    const inMonth = { $gte: start, $lt: end };

    const [ordersMonth, payments, deliveries, outstandingOrders, stockOut, stockIn] =
      await Promise.all([
        PurchaseOrder.find({ createdAt: inMonth })
          .populate('supplier', 'company name')
          .populate({
            path: 'materialRequest',
            select: 'quantity project',
            populate: { path: 'project', select: 'name' }
          })
          .populate('items.material', 'name unit')
          .sort({ createdAt: -1 })
          .limit(500),
        Payment.find({
          $or: [{ paymentDate: inMonth }, { createdAt: inMonth }]
        })
          .populate({
            path: 'purchaseOrder',
            select: 'purchaseOrderNumber grandTotal paymentStatus supplier',
            populate: { path: 'supplier', select: 'company name' }
          })
          .populate('recordedBy', 'name')
          .sort({ createdAt: -1 })
          .limit(500),
        Delivery.find({
          $or: [{ deliveryDate: inMonth }, { createdAt: inMonth }]
        })
          .populate({
            path: 'purchaseOrder',
            select: 'purchaseOrderNumber supplier',
            populate: { path: 'supplier', select: 'company name' }
          })
          .populate('driver', 'name')
          .sort({ deliveryDate: 1, createdAt: -1 })
          .limit(500),
        PurchaseOrder.find({
          paymentStatus: { $in: ['Unpaid', 'Partially Paid', 'Overdue'] }
        })
          .populate('supplier', 'company name')
          .populate('items.material', 'name unit')
          .sort({ createdAt: -1 })
          .limit(500),
        Inventory.find({ type: 'Stock Out', createdAt: inMonth })
          .populate('material', 'name unit')
          .populate('project', 'name')
          .sort({ createdAt: -1 })
          .limit(500),
        Inventory.find({ type: 'Stock In', createdAt: inMonth })
          .populate('material', 'name unit')
          .populate('project', 'name')
          .sort({ createdAt: -1 })
          .limit(500)
      ]);

    // Paid amounts per PO (all time) for outstanding remaining calc
    const outstandingIds = outstandingOrders.map((o) => o._id);
    const paidAgg = outstandingIds.length
      ? await Payment.aggregate([
          { $match: { purchaseOrder: { $in: outstandingIds } } },
          { $group: { _id: '$purchaseOrder', totalPaid: { $sum: '$paidAmount' } } }
        ])
      : [];
    const paidMap = Object.fromEntries(
      paidAgg.map((a) => [String(a._id), money(a.totalPaid)])
    );

    // 1) Monthly procurement
    const monthlyProcurementRows = ordersMonth.map((o) => {
      const item = o.items?.[0];
      const lineTotal = money(
        Number(item?.quantity || 0) * Number(item?.unitPrice || 0)
      );
      return {
        id: String(o._id),
        date: o.createdAt,
        po: o.purchaseOrderNumber || '—',
        supplier: o.supplier?.company || o.supplier?.name || '—',
        project: o.materialRequest?.project?.name || '—',
        material: item?.material?.name || '—',
        quantity: item?.quantity ?? 0,
        unit: item?.material?.unit || '',
        unitPrice: money(item?.unitPrice),
        lineTotal,
        grandTotal: money(o.grandTotal),
        status: o.status,
        paymentStatus: o.paymentStatus
      };
    });

    // 2) Supplier payments
    const supplierPaymentRows = payments.map((p) => ({
      id: String(p._id),
      date: p.paymentDate || p.createdAt,
      po: p.purchaseOrder?.purchaseOrderNumber || '—',
      supplier:
        p.purchaseOrder?.supplier?.company ||
        p.purchaseOrder?.supplier?.name ||
        '—',
      paidAmount: money(p.paidAmount),
      remainingBalance: money(p.remainingBalance),
      method: p.paymentMethod || '—',
      reference: p.referenceNumber || '—',
      recordedBy: p.recordedBy?.name || '—',
      paymentStatus: p.purchaseOrder?.paymentStatus || '—'
    }));

    // 3) Delivery schedule
    const deliveryScheduleRows = deliveries.map((d) => ({
      id: String(d._id),
      createdAt: d.createdAt,
      deliveryDate: d.deliveryDate,
      timeSlot: d.timeSlot || '—',
      po: d.purchaseOrder?.purchaseOrderNumber || '—',
      supplier:
        d.purchaseOrder?.supplier?.company ||
        d.purchaseOrder?.supplier?.name ||
        '—',
      driver: d.driver?.name || '—',
      vehicle: d.vehicle || '—',
      address: d.deliveryAddress || '—',
      status: d.status
    }));

    // 4) Outstanding balance
    const outstandingBalanceRows = outstandingOrders.map((o) => {
      const item = o.items?.[0];
      const total = money(o.grandTotal);
      const paid = paidMap[String(o._id)] || 0;
      const outstanding = money(Math.max(0, total - paid));
      return {
        id: String(o._id),
        date: o.createdAt,
        po: o.purchaseOrderNumber || '—',
        supplier: o.supplier?.company || o.supplier?.name || '—',
        material: item?.material?.name || '—',
        grandTotal: total,
        paidAmount: paid,
        outstanding,
        paymentStatus: o.paymentStatus,
        poStatus: o.status
      };
    });

    // 5) Material usage — Stock Out detail + aggregated by material
    const materialUsageRows = stockOut.map((e) => ({
      id: String(e._id),
      date: e.createdAt,
      material: e.material?.name || '—',
      unit: e.material?.unit || '',
      project: e.project?.name || 'Central / Unassigned',
      quantity: e.quantity,
      type: e.type,
      referenceType: e.referenceType
    }));

    // Also expose Stock In summary rows for the same month (deliveries received)
    const materialReceivedRows = stockIn.map((e) => ({
      id: String(e._id),
      date: e.createdAt,
      material: e.material?.name || '—',
      unit: e.material?.unit || '',
      project: e.project?.name || 'Central / Unassigned',
      quantity: e.quantity,
      type: e.type,
      referenceType: e.referenceType
    }));

    const usageByMaterial = {};
    for (const r of materialUsageRows) {
      const key = r.material;
      if (!usageByMaterial[key]) {
        usageByMaterial[key] = { material: key, unit: r.unit, quantityOut: 0 };
      }
      usageByMaterial[key].quantityOut += Number(r.quantity || 0);
    }

    const pack = (title, description, headers, rows, summary = {}) => ({
      title,
      description,
      headers,
      rows,
      summary,
      count: rows.length
    });

    const reports = {
      monthlyProcurement: pack(
        'Monthly Procurement Report',
        `Purchase orders created in ${month}`,
        [
          'Date',
          'PO Number',
          'Supplier',
          'Project',
          'Material',
          'Qty',
          'Unit',
          'Unit Price',
          'Line Total',
          'Grand Total',
          'PO Status',
          'Payment Status'
        ],
        monthlyProcurementRows.map((r) => [
          r.date,
          r.po,
          r.supplier,
          r.project,
          r.material,
          r.quantity,
          r.unit,
          r.unitPrice,
          r.lineTotal,
          r.grandTotal,
          r.status,
          r.paymentStatus
        ]),
        {
          poCount: monthlyProcurementRows.length,
          procurementValue: money(
            monthlyProcurementRows.reduce((s, r) => s + Number(r.grandTotal || 0), 0)
          )
        }
      ),
      supplierPayments: pack(
        'Supplier Payment Report',
        `Payments recorded in ${month}`,
        [
          'Date',
          'PO Number',
          'Supplier',
          'Paid Amount',
          'Remaining',
          'Method',
          'Reference',
          'Recorded By',
          'Payment Status'
        ],
        supplierPaymentRows.map((r) => [
          r.date,
          r.po,
          r.supplier,
          r.paidAmount,
          r.remainingBalance,
          r.method,
          r.reference,
          r.recordedBy,
          r.paymentStatus
        ]),
        {
          paymentCount: supplierPaymentRows.length,
          totalPaid: money(
            supplierPaymentRows.reduce((s, r) => s + Number(r.paidAmount || 0), 0)
          )
        }
      ),
      deliverySchedule: pack(
        'Delivery Schedule Report',
        `Deliveries scheduled or created in ${month}`,
        [
          'Delivery Date',
          'Time Slot',
          'PO Number',
          'Supplier',
          'Driver',
          'Vehicle',
          'Address',
          'Status'
        ],
        deliveryScheduleRows.map((r) => [
          r.deliveryDate,
          r.timeSlot,
          r.po,
          r.supplier,
          r.driver,
          r.vehicle,
          r.address,
          r.status
        ]),
        {
          deliveryCount: deliveryScheduleRows.length,
          byStatus: deliveryScheduleRows.reduce((acc, r) => {
            acc[r.status] = (acc[r.status] || 0) + 1;
            return acc;
          }, {})
        }
      ),
      outstandingBalance: pack(
        'Outstanding Balance Report',
        'Purchase orders with unpaid / partial / overdue balances',
        [
          'PO Date',
          'PO Number',
          'Supplier',
          'Material',
          'Grand Total',
          'Paid',
          'Outstanding',
          'Payment Status',
          'PO Status'
        ],
        outstandingBalanceRows.map((r) => [
          r.date,
          r.po,
          r.supplier,
          r.material,
          r.grandTotal,
          r.paidAmount,
          r.outstanding,
          r.paymentStatus,
          r.poStatus
        ]),
        {
          openInvoices: outstandingBalanceRows.length,
          totalOutstanding: money(
            outstandingBalanceRows.reduce((s, r) => s + Number(r.outstanding || 0), 0)
          )
        }
      ),
      materialUsage: pack(
        'Material Usage Report',
        `Stock Out (usage) movements in ${month}`,
        [
          'Date',
          'Material',
          'Unit',
          'Project',
          'Quantity',
          'Type',
          'Reference'
        ],
        materialUsageRows.map((r) => [
          r.date,
          r.material,
          r.unit,
          r.project,
          r.quantity,
          r.type,
          r.referenceType
        ]),
        {
          movementCount: materialUsageRows.length,
          totalQtyOut: materialUsageRows.reduce(
            (s, r) => s + Number(r.quantity || 0),
            0
          ),
          receivedCount: materialReceivedRows.length,
          byMaterial: Object.values(usageByMaterial)
        }
      )
    };

    reports.supplierPerformance = await buildSupplierPerformanceReport();

    // Keep legacy keys lightly for any older clients (summary counts only).
    res.status(200).json({
      success: true,
      month,
      reports,
      summary: {
        monthlyProcurement: reports.monthlyProcurement.count,
        supplierPayments: reports.supplierPayments.count,
        deliverySchedule: reports.deliverySchedule.count,
        outstandingBalance: reports.outstandingBalance.count,
        materialUsage: reports.materialUsage.count,
        supplierPerformance: reports.supplierPerformance.count
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Supplier self-service activity report (own bids / POs / payments)
 * @route   GET /api/reports/supplier?month=YYYY-MM
 * @access  Private/Supplier (or Admin)
 */
exports.getSupplierReportStats = async (req, res, next) => {
  try {
    const Quotation = require('../models/Quotation');
    const { resolveSupplierProfile } = require('../utils/supplierLink');
    const { month, start, end } = monthRange(req.query.month);
    const inMonth = { $gte: start, $lt: end };

    const supplierProfile = await resolveSupplierProfile(req.user);
    if (!supplierProfile) {
      return res.status(400).json({
        success: false,
        error: 'No supplier company profile is linked to this login'
      });
    }

    const sid = supplierProfile._id;

    const [quotes, orders, payments, outstandingOrders] = await Promise.all([
      Quotation.find({ supplier: sid, createdAt: inMonth })
        .populate({
          path: 'materialRequest',
          select: 'quantity status project material',
          populate: [
            { path: 'project', select: 'name' },
            { path: 'material', select: 'name unit' }
          ]
        })
        .sort({ createdAt: -1 })
        .limit(500),
      PurchaseOrder.find({ supplier: sid, createdAt: inMonth })
        .populate('items.material', 'name unit')
        .sort({ createdAt: -1 })
        .limit(500),
      Payment.find({
        $or: [{ paymentDate: inMonth }, { createdAt: inMonth }]
      })
        .populate({
          path: 'purchaseOrder',
          select: 'purchaseOrderNumber grandTotal paymentStatus supplier',
          match: { supplier: sid }
        })
        .sort({ createdAt: -1 })
        .limit(500),
      PurchaseOrder.find({
        supplier: sid,
        paymentStatus: { $in: ['Unpaid', 'Partially Paid', 'Overdue'] }
      })
        .populate('items.material', 'name unit')
        .sort({ createdAt: -1 })
        .limit(500)
    ]);

    const myPayments = payments.filter((p) => p.purchaseOrder);

    const outstandingIds = outstandingOrders.map((o) => o._id);
    const paidAgg = outstandingIds.length
      ? await Payment.aggregate([
          { $match: { purchaseOrder: { $in: outstandingIds } } },
          { $group: { _id: '$purchaseOrder', totalPaid: { $sum: '$paidAmount' } } }
        ])
      : [];
    const paidMap = Object.fromEntries(
      paidAgg.map((a) => [String(a._id), money(a.totalPaid)])
    );

    const myBidsRows = quotes.map((q) => {
      const mr = q.materialRequest;
      return {
        id: String(q._id),
        date: q.createdAt,
        material: mr?.material?.name || '—',
        project: mr?.project?.name || '—',
        quantity: mr?.quantity ?? 0,
        unitPrice: money(q.unitPrice),
        deliveryCost: money(q.deliveryCost),
        deliveryDays: q.deliveryTimeDays,
        status: q.status,
        paymentTerms: q.paymentTerms || '—'
      };
    });

    const myOrdersRows = orders.map((o) => {
      const item = o.items?.[0];
      return {
        id: String(o._id),
        date: o.createdAt,
        po: o.purchaseOrderNumber || '—',
        material: item?.material?.name || '—',
        quantity: item?.quantity ?? 0,
        grandTotal: money(o.grandTotal),
        status: o.status,
        paymentStatus: o.paymentStatus,
        invoice: o.invoiceFile ? 'Uploaded' : 'Not uploaded'
      };
    });

    const myPaymentsRows = myPayments.map((p) => ({
      id: String(p._id),
      date: p.paymentDate || p.createdAt,
      po: p.purchaseOrder?.purchaseOrderNumber || '—',
      amount: money(p.paidAmount),
      method: p.paymentMethod || '—',
      reference: p.referenceNumber || p.accountNo || '—'
    }));

    const outstandingRows = outstandingOrders.map((o) => {
      const paid = paidMap[String(o._id)] || 0;
      const remaining = money(Math.max(0, Number(o.grandTotal || 0) - paid));
      const item = o.items?.[0];
      return {
        id: String(o._id),
        po: o.purchaseOrderNumber || '—',
        material: item?.material?.name || '—',
        grandTotal: money(o.grandTotal),
        paid,
        remaining,
        paymentStatus: o.paymentStatus
      };
    });

    const pack = (title, description, headers, rows, summary = {}) => ({
      title,
      description,
      headers,
      rows: rows.map((r) => headers.map((h) => {
        const key = {
          Date: 'date',
          Material: 'material',
          Project: 'project',
          Qty: 'quantity',
          'Unit Price': 'unitPrice',
          Delivery: 'deliveryCost',
          Days: 'deliveryDays',
          Status: 'status',
          Terms: 'paymentTerms',
          PO: 'po',
          Total: 'grandTotal',
          Payment: 'paymentStatus',
          Invoice: 'invoice',
          Amount: 'amount',
          Method: 'method',
          Reference: 'reference',
          Paid: 'paid',
          Remaining: 'remaining'
        }[h];
        return key ? r[key] : '—';
      })),
      count: rows.length,
      summary
    });

    const reports = {
      myBids: pack(
        'My Quotation Bids',
        `Bids you submitted in ${month}`,
        ['Date', 'Material', 'Project', 'Qty', 'Unit Price', 'Delivery', 'Days', 'Status', 'Terms'],
        myBidsRows,
        {
          bidCount: myBidsRows.length,
          pending: myBidsRows.filter((r) => r.status === 'Pending').length,
          selected: myBidsRows.filter((r) => r.status === 'Selected').length
        }
      ),
      myOrders: pack(
        'My Purchase Orders',
        `Purchase orders awarded to your company in ${month}`,
        ['Date', 'PO', 'Material', 'Qty', 'Total', 'Status', 'Payment', 'Invoice'],
        myOrdersRows,
        {
          orderCount: myOrdersRows.length,
          orderValue: money(myOrdersRows.reduce((s, r) => s + Number(r.grandTotal || 0), 0))
        }
      ),
      myPayments: pack(
        'Payments Received',
        `Payments recorded against your POs in ${month}`,
        ['Date', 'PO', 'Amount', 'Method', 'Reference'],
        myPaymentsRows,
        {
          paymentCount: myPaymentsRows.length,
          totalPaid: money(myPaymentsRows.reduce((s, r) => s + Number(r.amount || 0), 0))
        }
      ),
      outstandingBalance: pack(
        'Outstanding Balances',
        'Your unpaid / partially paid purchase orders',
        ['PO', 'Material', 'Total', 'Paid', 'Remaining', 'Payment'],
        outstandingRows,
        {
          outstandingCount: outstandingRows.length,
          totalOutstanding: money(
            outstandingRows.reduce((s, r) => s + Number(r.remaining || 0), 0)
          )
        }
      ),
      myPerformance: await buildSupplierPerformanceReport(sid)
    };

    res.status(200).json({
      success: true,
      month,
      company: supplierProfile.company,
      reports
    });
  } catch (error) {
    next(error);
  }
};
