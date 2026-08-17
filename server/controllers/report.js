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

/** Month (YYYY-MM) or custom from/to (YYYY-MM-DD). */
function reportPeriod(query = {}) {
  const { month, from, to } = query;
  if (
    typeof from === 'string' &&
    typeof to === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(from) &&
    /^\d{4}-\d{2}-\d{2}$/.test(to)
  ) {
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    const start = new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0, 0));
    const end = new Date(Date.UTC(ty, tm - 1, td + 1, 0, 0, 0, 0));
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
      return { error: 'Invalid date range — start must be before end' };
    }
    return {
      mode: 'range',
      from,
      to,
      label: `${from} → ${to}`,
      start,
      end
    };
  }

  const { month: m, start, end } = monthRange(month);
  return {
    mode: 'month',
    month: m,
    label: m,
    start,
    end
  };
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

async function buildMaterialRequestsReport(start, end, label) {
  const MaterialRequest = require('../models/MaterialRequest');
  const inPeriod = { $gte: start, $lt: end };

  const requests = await MaterialRequest.find({ createdAt: inPeriod })
    .populate('project', 'name location')
    .populate('material', 'name unit estimatedPrice')
    .populate('requestedBy', 'name role')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const rows = requests.map((r) => {
    const est = money(Number(r.quantity || 0) * Number(r.material?.estimatedPrice || 0));
    return [
      r.createdAt,
      r.project?.name || '—',
      r.material?.name || '—',
      r.quantity ?? 0,
      r.material?.unit || '',
      r.priority || '—',
      r.status,
      r.requestedBy?.name || '—',
      r.requiredDate,
      est,
      (r.reason || '').slice(0, 80)
    ];
  });

  const byStatus = requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return {
    title: 'Material Requests Report',
    description: `Material requests submitted in ${label}`,
    headers: [
      'Date',
      'Project',
      'Material',
      'Qty',
      'Unit',
      'Priority',
      'Status',
      'Requested By',
      'Required By',
      'Est. Cost',
      'Reason'
    ],
    rows,
    summary: {
      requestCount: rows.length,
      totalEstCost: money(
        requests.reduce(
          (s, r) =>
            s + Number(r.quantity || 0) * Number(r.material?.estimatedPrice || 0),
          0
        )
      ),
      byStatus
    },
    count: rows.length
  };
}

async function buildSiteStockReport() {
  const ProjectStock = require('../models/ProjectStock');
  const stocks = await ProjectStock.find({ quantity: { $gt: 0 } })
    .populate('project', 'name location status')
    .populate('material', 'name unit')
    .sort({ updatedAt: -1 })
    .limit(500)
    .lean();

  const rows = stocks.map((s) => [
    s.project?.name || '—',
    s.project?.location || '—',
    s.material?.name || '—',
    s.material?.unit || '',
    s.quantity,
    s.updatedAt
  ]);

  const totalQty = stocks.reduce((sum, s) => sum + Number(s.quantity || 0), 0);

  return {
    title: 'Site Stock Report',
    description: 'Current material balances on project sites (snapshot)',
    headers: ['Project', 'Location', 'Material', 'Unit', 'Qty On Site', 'Last Updated'],
    rows,
    summary: {
      lineCount: rows.length,
      totalQtyOnSite: totalQty,
      projectCount: new Set(stocks.map((s) => String(s.project?._id || ''))).size
    },
    count: rows.length
  };
}

async function buildProjectBudgetReport(start, end, label) {
  const Project = require('../models/Project');
  const MaterialRequest = require('../models/MaterialRequest');
  const { getProjectBudgetSummary } = require('../utils/projectBudget');
  const inPeriod = { $gte: start, $lt: end };

  const projects = await Project.find()
    .populate('manager', 'name')
    .sort({ name: 1 })
    .lean();

  const [reqCounts, posInPeriod] = await Promise.all([
    MaterialRequest.aggregate([
      { $match: { createdAt: inPeriod } },
      { $group: { _id: '$project', count: { $sum: 1 } } }
    ]),
    PurchaseOrder.find({ createdAt: inPeriod })
      .populate({ path: 'materialRequest', select: 'project' })
      .select('grandTotal materialRequest')
      .lean()
  ]);

  const reqCountMap = Object.fromEntries(
    reqCounts.map((r) => [String(r._id), r.count])
  );
  const poSpendMap = {};
  for (const po of posInPeriod) {
    const pid = po.materialRequest?.project;
    if (!pid) continue;
    const key = String(pid);
    poSpendMap[key] = (poSpendMap[key] || 0) + Number(po.grandTotal || 0);
  }

  const rows = [];
  for (const p of projects) {
    const summary = await getProjectBudgetSummary(p._id);
    if (!summary) continue;
    const pct =
      summary.budget > 0 ? money((summary.used / summary.budget) * 100) : 0;
    rows.push([
      summary.projectName,
      p.location || '—',
      p.manager?.name || '—',
      p.status || '—',
      summary.budget,
      summary.used,
      summary.remaining,
      `${pct}%`,
      reqCountMap[String(p._id)] || 0,
      money(poSpendMap[String(p._id)] || 0)
    ]);
  }

  return {
    title: 'Project Budget Report',
    description: `Budget vs committed spend; PO value in ${label}`,
    headers: [
      'Project',
      'Location',
      'Manager',
      'Status',
      'Budget',
      'Used (Est.)',
      'Remaining',
      '% Used',
      'Requests in Period',
      'PO Spend in Period'
    ],
    rows,
    summary: {
      projectCount: rows.length,
      totalBudget: money(rows.reduce((s, r) => s + Number(r[4] || 0), 0)),
      totalUsed: money(rows.reduce((s, r) => s + Number(r[5] || 0), 0)),
      totalRemaining: money(rows.reduce((s, r) => s + Number(r[6] || 0), 0)),
      poSpendInPeriod: money(rows.reduce((s, r) => s + Number(r[9] || 0), 0))
    },
    count: rows.length
  };
}

async function buildQuotationBiddingReport(start, end, label) {
  const Quotation = require('../models/Quotation');
  const MaterialRequest = require('../models/MaterialRequest');
  const inPeriod = { $gte: start, $lt: end };

  const quotes = await Quotation.find({ createdAt: inPeriod })
    .populate('supplier', 'company name')
    .populate({
      path: 'materialRequest',
      populate: [
        { path: 'project', select: 'name' },
        { path: 'material', select: 'name unit' }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const bidRows = quotes.map((q) => {
    const mr = q.materialRequest;
    return {
      sortDate: q.createdAt,
      row: [
        q.createdAt,
        'Bid',
        mr?.project?.name || '—',
        mr?.material?.name || '—',
        q.supplier?.company || q.supplier?.name || '—',
        money(q.unitPrice),
        money(q.deliveryCost),
        q.deliveryTimeDays,
        q.status,
        mr?.status || '—'
      ]
    };
  });

  const requestsWithDeclines = await MaterialRequest.find({
    declinedBySuppliers: { $exists: true, $not: { $size: 0 } }
  })
    .populate('project', 'name')
    .populate('material', 'name unit')
    .populate('declinedBySuppliers.supplier', 'company name')
    .lean();

  const declineRows = [];
  for (const r of requestsWithDeclines) {
    for (const d of r.declinedBySuppliers || []) {
      const declinedAt = d.declinedAt ? new Date(d.declinedAt) : null;
      if (!declinedAt || declinedAt < start || declinedAt >= end) continue;
      declineRows.push({
        sortDate: declinedAt,
        row: [
          d.declinedAt,
          'Declined',
          r.project?.name || '—',
          r.material?.name || '—',
          d.supplier?.company || d.supplier?.name || '—',
          '—',
          '—',
          '—',
          d.reason || 'No stock',
          r.status || '—'
        ]
      });
    }
  }

  const rows = [...bidRows, ...declineRows]
    .sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate))
    .map((x) => x.row);

  return {
    title: 'Quotation & Bidding Report',
    description: `Supplier bids and declines in ${label}`,
    headers: [
      'Date',
      'Type',
      'Project',
      'Material',
      'Supplier',
      'Unit Price',
      'Delivery',
      'Days',
      'Bid Status / Reason',
      'Request Status'
    ],
    rows,
    summary: {
      bidCount: bidRows.length,
      declineCount: declineRows.length,
      selectedBids: quotes.filter((q) => q.status === 'Selected').length,
      pendingBids: quotes.filter((q) => q.status === 'Pending').length
    },
    count: rows.length
  };
}

async function buildDamagedMissingReport(start, end, label, projectIds = null) {
  const MaterialRequest = require('../models/MaterialRequest');
  const query = {
    $or: [
      { 'damagedReported.quantity': { $gt: 0 } },
      { 'missingReported.quantity': { $gt: 0 } }
    ]
  };
  if (projectIds?.length) {
    query.project = { $in: projectIds };
  }

  const requests = await MaterialRequest.find(query)
    .populate('project', 'name location')
    .populate('material', 'name unit')
    .populate('requestedBy', 'name')
    .sort({ updatedAt: -1 })
    .limit(500)
    .lean();

  const rows = [];
  for (const r of requests) {
    if (Number(r.damagedReported?.quantity) > 0) {
      const at = r.damagedReported.reportedAt
        ? new Date(r.damagedReported.reportedAt)
        : null;
      if (at && at >= start && at < end) {
        rows.push([
          r.damagedReported.reportedAt,
          'Damaged',
          r.project?.name || '—',
          r.material?.name || '—',
          r.quantity ?? 0,
          r.material?.unit || '',
          r.damagedReported.quantity,
          r.requestedBy?.name || '—',
          (r.damagedReported.comments || '').slice(0, 80)
        ]);
      }
    }
    if (Number(r.missingReported?.quantity) > 0) {
      const at = r.missingReported.reportedAt
        ? new Date(r.missingReported.reportedAt)
        : null;
      if (at && at >= start && at < end) {
        rows.push([
          r.missingReported.reportedAt,
          'Missing',
          r.project?.name || '—',
          r.material?.name || '—',
          r.quantity ?? 0,
          r.material?.unit || '',
          r.missingReported.quantity,
          r.requestedBy?.name || '—',
          (r.missingReported.comments || '').slice(0, 80)
        ]);
      }
    }
  }

  rows.sort((a, b) => new Date(b[0]) - new Date(a[0]));

  return {
    title: 'Damaged & Missing Materials Report',
    description: `Receipt issues reported in ${label}`,
    headers: [
      'Reported Date',
      'Issue Type',
      'Project',
      'Material',
      'Ordered Qty',
      'Unit',
      'Issue Qty',
      'Reported By',
      'Comments'
    ],
    rows,
    summary: {
      issueCount: rows.length,
      damagedCount: rows.filter((r) => r[1] === 'Damaged').length,
      missingCount: rows.filter((r) => r[1] === 'Missing').length
    },
    count: rows.length
  };
}

/** Phase 3 — all Stock In / Stock Out (central warehouse + project sites). */
async function buildInventoryLedgerReport(start, end, label, projectIds = null) {
  const inPeriod = { $gte: start, $lt: end };
  const query = { createdAt: inPeriod };
  if (projectIds?.length) {
    query.project = { $in: projectIds };
  }

  const entries = await Inventory.find(query)
    .populate('material', 'name unit')
    .populate('project', 'name')
    .sort({ createdAt: -1 })
    .limit(1000)
    .lean();

  const rows = entries.map((e) => [
    e.createdAt,
    e.type,
    e.material?.name || '—',
    e.material?.unit || '',
    e.project?.name || 'Central Warehouse',
    e.quantity,
    e.referenceType || '—'
  ]);

  const stockIn = entries.filter((e) => e.type === 'Stock In');
  const stockOut = entries.filter((e) => e.type === 'Stock Out');

  return {
    title: 'Inventory Ledger Report',
    description: `Stock In and Stock Out movements in ${label}`,
    headers: [
      'Date',
      'Movement',
      'Material',
      'Unit',
      'Location',
      'Quantity',
      'Reference'
    ],
    rows,
    summary: {
      movementCount: rows.length,
      stockInCount: stockIn.length,
      stockOutCount: stockOut.length,
      totalQtyIn: stockIn.reduce((s, e) => s + Number(e.quantity || 0), 0),
      totalQtyOut: stockOut.reduce((s, e) => s + Number(e.quantity || 0), 0)
    },
    count: rows.length
  };
}

/** Phase 3 — dedicated supplier decline (no stock) report. */
async function buildSupplierDeclineReport(start, end, label) {
  const MaterialRequest = require('../models/MaterialRequest');
  const requestsWithDeclines = await MaterialRequest.find({
    declinedBySuppliers: { $exists: true, $not: { $size: 0 } }
  })
    .populate('project', 'name')
    .populate('material', 'name unit')
    .populate('declinedBySuppliers.supplier', 'company name')
    .lean();

  const rows = [];
  for (const r of requestsWithDeclines) {
    for (const d of r.declinedBySuppliers || []) {
      const declinedAt = d.declinedAt ? new Date(d.declinedAt) : null;
      if (!declinedAt || declinedAt < start || declinedAt >= end) continue;
      rows.push([
        d.declinedAt,
        r.project?.name || '—',
        r.material?.name || '—',
        r.quantity ?? 0,
        r.material?.unit || '',
        d.supplier?.company || d.supplier?.name || '—',
        d.reason || 'No stock',
        r.status || '—'
      ]);
    }
  }
  rows.sort((a, b) => new Date(b[0]) - new Date(a[0]));

  const bySupplier = {};
  for (const row of rows) {
    const name = row[5];
    bySupplier[name] = (bySupplier[name] || 0) + 1;
  }

  return {
    title: 'Supplier Decline Report',
    description: `Suppliers who declined to bid in ${label}`,
    headers: [
      'Date',
      'Project',
      'Material',
      'Request Qty',
      'Unit',
      'Supplier',
      'Reason',
      'Request Status'
    ],
    rows,
    summary: {
      declineCount: rows.length,
      supplierCount: Object.keys(bySupplier).length,
      bySupplier: Object.entries(bySupplier)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 12)
    },
    count: rows.length
  };
}

function buildAdminCharts(reports) {
  const byStatus = reports.materialRequests?.summary?.byStatus || {};
  const procurementByProject = {};
  for (const row of reports.monthlyProcurement?.rows || []) {
    const project = row[3] || 'Other';
    procurementByProject[project] =
      (procurementByProject[project] || 0) + Number(row[9] || 0);
  }

  const paymentsByMethod = {};
  for (const row of reports.supplierPayments?.rows || []) {
    const method = row[5] || 'Other';
    paymentsByMethod[method] =
      (paymentsByMethod[method] || 0) + Number(row[3] || 0);
  }

  return {
    stockMovement: [
      {
        label: 'Stock In',
        value: Number(reports.inventoryLedger?.summary?.totalQtyIn || 0)
      },
      {
        label: 'Stock Out',
        value: Number(reports.inventoryLedger?.summary?.totalQtyOut || 0)
      }
    ],
    requestsByStatus: Object.entries(byStatus).map(([label, value]) => ({
      label,
      value: Number(value || 0)
    })),
    procurementByProject: Object.entries(procurementByProject)
      .map(([label, value]) => ({ label, value: money(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    paymentsByMethod: Object.entries(paymentsByMethod)
      .map(([label, value]) => ({ label, value: money(value) }))
      .sort((a, b) => b.value - a.value),
    declinesBySupplier: reports.supplierDecline?.summary?.bySupplier || []
  };
}

async function buildOutstandingBySupplierReport() {
  const outstandingOrders = await PurchaseOrder.find({
    paymentStatus: { $in: ['Unpaid', 'Partially Paid', 'Overdue'] }
  })
    .populate('supplier', 'company name')
    .lean();

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

  const bySupplier = new Map();
  for (const o of outstandingOrders) {
    const key = String(o.supplier?._id || o.supplier || 'unknown');
    const name = o.supplier?.company || o.supplier?.name || '—';
    if (!bySupplier.has(key)) {
      bySupplier.set(key, {
        name,
        poCount: 0,
        totalDue: 0,
        outstanding: 0
      });
    }
    const row = bySupplier.get(key);
    const total = money(o.grandTotal);
    const paid = paidMap[String(o._id)] || 0;
    const out = money(Math.max(0, total - paid));
    row.poCount += 1;
    row.totalDue += total;
    row.outstanding += out;
  }

  const rows = [...bySupplier.values()]
    .sort((a, b) => b.outstanding - a.outstanding)
    .map((r) => [r.name, r.poCount, money(r.totalDue), money(r.outstanding)]);

  return {
    title: 'Outstanding by Supplier',
    description: 'Open balances grouped by supplier',
    headers: ['Supplier', 'Open POs', 'Total PO Value', 'Outstanding'],
    rows,
    summary: {
      supplierCount: rows.length,
      totalOutstanding: money(rows.reduce((s, r) => s + Number(r[3] || 0), 0))
    },
    count: rows.length
  };
}

async function buildTaxSummaryReport(start, end, label) {
  const inPeriod = { $gte: start, $lt: end };
  const orders = await PurchaseOrder.find({ createdAt: inPeriod })
    .populate('supplier', 'company name')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const rows = orders.map((o) => {
    const subtotal = (o.items || []).reduce(
      (s, it) => s + Number(it.quantity || 0) * Number(it.unitPrice || 0),
      0
    );
    return [
      o.createdAt,
      o.purchaseOrderNumber || '—',
      o.supplier?.company || o.supplier?.name || '—',
      money(subtotal),
      money(o.tax),
      money(o.deliveryCost),
      money(o.discount),
      money(o.grandTotal),
      o.paymentStatus || '—'
    ];
  });

  return {
    title: 'Tax Summary Report',
    description: `PO tax and totals in ${label}`,
    headers: [
      'Date',
      'PO Number',
      'Supplier',
      'Subtotal',
      'Tax',
      'Delivery',
      'Discount',
      'Grand Total',
      'Payment Status'
    ],
    rows,
    summary: {
      poCount: rows.length,
      totalTax: money(orders.reduce((s, o) => s + Number(o.tax || 0), 0)),
      grandTotal: money(orders.reduce((s, o) => s + Number(o.grandTotal || 0), 0))
    },
    count: rows.length
  };
}

async function buildPOFinancialsReport(start, end, label) {
  const inPeriod = { $gte: start, $lt: end };
  const orders = await PurchaseOrder.find({ createdAt: inPeriod })
    .populate('supplier', 'company name')
    .populate({
      path: 'materialRequest',
      select: 'project',
      populate: { path: 'project', select: 'name' }
    })
    .populate('items.material', 'name unit')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const rows = orders.map((o) => {
    const item = o.items?.[0];
    return [
      o.createdAt,
      o.purchaseOrderNumber || '—',
      o.supplier?.company || o.supplier?.name || '—',
      o.materialRequest?.project?.name || '—',
      item?.material?.name || '—',
      item?.quantity ?? 0,
      money(item?.unitPrice),
      money(o.tax),
      money(o.grandTotal),
      o.status,
      o.paymentStatus
    ];
  });

  return {
    title: 'PO Financial Report',
    description: `Purchase order financials in ${label}`,
    headers: [
      'Date',
      'PO Number',
      'Supplier',
      'Project',
      'Material',
      'Qty',
      'Unit Price',
      'Tax',
      'Grand Total',
      'PO Status',
      'Payment Status'
    ],
    rows,
    summary: {
      poCount: rows.length,
      totalValue: money(orders.reduce((s, o) => s + Number(o.grandTotal || 0), 0))
    },
    count: rows.length
  };
}

async function getManagedProjectIds(userId) {
  const Project = require('../models/Project');
  return Project.find({ manager: userId }).distinct('_id');
}

async function buildMaterialRequestsReportForProjects(start, end, label, projectIds) {
  const MaterialRequest = require('../models/MaterialRequest');
  if (!projectIds?.length) {
    return {
      title: 'Material Requests Report',
      description: `No managed projects — ${label}`,
      headers: [
        'Date',
        'Project',
        'Material',
        'Qty',
        'Unit',
        'Priority',
        'Status',
        'Requested By',
        'Required By',
        'Est. Cost',
        'Reason'
      ],
      rows: [],
      summary: { requestCount: 0, totalEstCost: 0 },
      count: 0
    };
  }
  const inPeriod = { $gte: start, $lt: end };
  const requests = await MaterialRequest.find({
    project: { $in: projectIds },
    createdAt: inPeriod
  })
    .populate('project', 'name location')
    .populate('material', 'name unit estimatedPrice')
    .populate('requestedBy', 'name role')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const rows = requests.map((r) => [
    r.createdAt,
    r.project?.name || '—',
    r.material?.name || '—',
    r.quantity ?? 0,
    r.material?.unit || '',
    r.priority || '—',
    r.status,
    r.requestedBy?.name || '—',
    r.requiredDate,
    money(Number(r.quantity || 0) * Number(r.material?.estimatedPrice || 0)),
    (r.reason || '').slice(0, 80)
  ]);

  const byStatus = requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return {
    title: 'My Material Requests',
    description: `Requests on your projects in ${label}`,
    headers: [
      'Date',
      'Project',
      'Material',
      'Qty',
      'Unit',
      'Priority',
      'Status',
      'Requested By',
      'Required By',
      'Est. Cost',
      'Reason'
    ],
    rows,
    summary: {
      requestCount: rows.length,
      totalEstCost: money(
        requests.reduce(
          (s, r) =>
            s + Number(r.quantity || 0) * Number(r.material?.estimatedPrice || 0),
          0
        )
      ),
      byStatus
    },
    count: rows.length
  };
}

async function buildProjectBudgetReportForProjects(start, end, label, projectIds) {
  const Project = require('../models/Project');
  const MaterialRequest = require('../models/MaterialRequest');
  const { getProjectBudgetSummary } = require('../utils/projectBudget');
  const inPeriod = { $gte: start, $lt: end };

  if (!projectIds?.length) {
    return {
      title: 'My Project Budget',
      description: `No managed projects — ${label}`,
      headers: [
        'Project',
        'Location',
        'Manager',
        'Status',
        'Budget',
        'Used (Est.)',
        'Remaining',
        '% Used',
        'Requests in Period',
        'PO Spend in Period'
      ],
      rows: [],
      summary: { projectCount: 0, totalRemaining: 0 },
      count: 0
    };
  }

  const projects = await Project.find({ _id: { $in: projectIds } })
    .populate('manager', 'name')
    .sort({ name: 1 })
    .lean();

  const [reqCounts, posInPeriod] = await Promise.all([
    MaterialRequest.aggregate([
      { $match: { project: { $in: projectIds }, createdAt: inPeriod } },
      { $group: { _id: '$project', count: { $sum: 1 } } }
    ]),
    PurchaseOrder.find({ createdAt: inPeriod })
      .populate({ path: 'materialRequest', select: 'project' })
      .select('grandTotal materialRequest')
      .lean()
  ]);

  const reqCountMap = Object.fromEntries(
    reqCounts.map((r) => [String(r._id), r.count])
  );
  const poSpendMap = {};
  for (const po of posInPeriod) {
    const pid = po.materialRequest?.project;
    if (!pid || !projectIds.some((id) => String(id) === String(pid))) continue;
    const key = String(pid);
    poSpendMap[key] = (poSpendMap[key] || 0) + Number(po.grandTotal || 0);
  }

  const rows = [];
  for (const p of projects) {
    const summary = await getProjectBudgetSummary(p._id);
    if (!summary) continue;
    const pct =
      summary.budget > 0 ? money((summary.used / summary.budget) * 100) : 0;
    rows.push([
      summary.projectName,
      p.location || '—',
      p.manager?.name || '—',
      p.status || '—',
      summary.budget,
      summary.used,
      summary.remaining,
      `${pct}%`,
      reqCountMap[String(p._id)] || 0,
      money(poSpendMap[String(p._id)] || 0)
    ]);
  }

  return {
    title: 'My Project Budget',
    description: `Budget on your managed projects; PO value in ${label}`,
    headers: [
      'Project',
      'Location',
      'Manager',
      'Status',
      'Budget',
      'Used (Est.)',
      'Remaining',
      '% Used',
      'Requests in Period',
      'PO Spend in Period'
    ],
    rows,
    summary: {
      projectCount: rows.length,
      totalRemaining: money(rows.reduce((s, r) => s + Number(r[6] || 0), 0))
    },
    count: rows.length
  };
}

async function buildDeliveriesForProjects(start, end, label, projectIds) {
  const inPeriod = { $gte: start, $lt: end };
  if (!projectIds?.length) {
    return {
      title: 'My Deliveries',
      description: `No managed projects — ${label}`,
      headers: [
        'Delivery Date',
        'Time Slot',
        'PO Number',
        'Supplier',
        'Project',
        'Driver',
        'Status'
      ],
      rows: [],
      summary: { deliveryCount: 0 },
      count: 0
    };
  }

  const pos = await PurchaseOrder.find({})
    .populate({
      path: 'materialRequest',
      select: 'project',
      match: { project: { $in: projectIds } },
      populate: { path: 'project', select: 'name' }
    })
    .select('_id purchaseOrderNumber materialRequest supplier')
    .populate('supplier', 'company name')
    .lean();

  const poIds = pos.filter((p) => p.materialRequest).map((p) => p._id);
  const poProjectMap = Object.fromEntries(
    pos
      .filter((p) => p.materialRequest)
      .map((p) => [String(p._id), p.materialRequest?.project?.name || '—'])
  );
  const poSupplierMap = Object.fromEntries(
    pos
      .filter((p) => p.materialRequest)
      .map((p) => [
        String(p._id),
        p.supplier?.company || p.supplier?.name || '—'
      ])
  );
  const poNumberMap = Object.fromEntries(
    pos.filter((p) => p.materialRequest).map((p) => [String(p._id), p.purchaseOrderNumber || '—'])
  );

  const deliveries = poIds.length
    ? await Delivery.find({
        purchaseOrder: { $in: poIds },
        $or: [{ deliveryDate: inPeriod }, { createdAt: inPeriod }]
      })
        .populate('driver', 'name')
        .sort({ deliveryDate: 1 })
        .limit(500)
        .lean()
    : [];

  const rows = deliveries.map((d) => [
    d.deliveryDate,
    d.timeSlot || '—',
    poNumberMap[String(d.purchaseOrder)] || '—',
    poSupplierMap[String(d.purchaseOrder)] || '—',
    poProjectMap[String(d.purchaseOrder)] || '—',
    d.driver?.name || '—',
    d.status
  ]);

  return {
    title: 'My Deliveries',
    description: `Deliveries for your projects in ${label}`,
    headers: [
      'Delivery Date',
      'Time Slot',
      'PO Number',
      'Supplier',
      'Project',
      'Driver',
      'Status'
    ],
    rows,
    summary: { deliveryCount: rows.length },
    count: rows.length
  };
}

async function buildMaterialUsageForProjects(start, end, label, projectIds) {
  const inPeriod = { $gte: start, $lt: end };
  if (!projectIds?.length) {
    return {
      title: 'Site Material Usage',
      description: `No managed projects — ${label}`,
      headers: ['Date', 'Material', 'Unit', 'Project', 'Quantity', 'Reference'],
      rows: [],
      summary: { totalQtyOut: 0 },
      count: 0
    };
  }

  const stockOut = await Inventory.find({
    type: 'Stock Out',
    project: { $in: projectIds },
    createdAt: inPeriod
  })
    .populate('material', 'name unit')
    .populate('project', 'name')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const rows = stockOut.map((e) => [
    e.createdAt,
    e.material?.name || '—',
    e.material?.unit || '',
    e.project?.name || '—',
    e.quantity,
    e.referenceType || '—'
  ]);

  return {
    title: 'Site Material Usage',
    description: `Stock used on your project sites in ${label}`,
    headers: ['Date', 'Material', 'Unit', 'Project', 'Quantity', 'Reference'],
    rows,
    summary: {
      totalQtyOut: rows.reduce((s, r) => s + Number(r[4] || 0), 0)
    },
    count: rows.length
  };
}

/**
 * @desc    Feature 10.14 — downloadable operational reports
 * @route   GET /api/reports?month=YYYY-MM OR ?from=YYYY-MM-DD&to=YYYY-MM-DD
 * @access  Private/Admin or Procurement Officer
 *
 * Reports:
 *  - monthlyProcurement
 *  - supplierPayments
 *  - deliverySchedule
 *  - outstandingBalance
 *  - materialUsage
 *  - supplierPerformance (10.13)
 *  - materialRequests (Phase 1)
 *  - siteStock (Phase 1)
 *  - projectBudget (Phase 1)
 */
exports.getReportStats = async (req, res, next) => {
  try {
    const period = reportPeriod(req.query);
    if (period.error) {
      return res.status(400).json({ success: false, error: period.error });
    }
    const { start, end, label } = period;
    const inPeriod = { $gte: start, $lt: end };

    const [ordersMonth, payments, deliveries, outstandingOrders, stockOut, stockIn] =
      await Promise.all([
        PurchaseOrder.find({ createdAt: inPeriod })
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
          $or: [{ paymentDate: inPeriod }, { createdAt: inPeriod }]
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
          $or: [{ deliveryDate: inPeriod }, { createdAt: inPeriod }]
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
        Inventory.find({ type: 'Stock Out', createdAt: inPeriod })
          .populate('material', 'name unit')
          .populate('project', 'name')
          .sort({ createdAt: -1 })
          .limit(500),
        Inventory.find({ type: 'Stock In', createdAt: inPeriod })
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
        `Purchase orders created in ${label}`,
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
        `Payments recorded in ${label}`,
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
        `Deliveries scheduled or created in ${label}`,
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
        `Stock Out (usage) movements in ${label}`,
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

    reports.materialRequests = await buildMaterialRequestsReport(start, end, label);
    reports.siteStock = await buildSiteStockReport();
    reports.projectBudget = await buildProjectBudgetReport(start, end, label);
    reports.quotationBidding = await buildQuotationBiddingReport(start, end, label);
    reports.damagedMissing = await buildDamagedMissingReport(start, end, label);
    reports.supplierPerformance = await buildSupplierPerformanceReport();
    reports.inventoryLedger = await buildInventoryLedgerReport(start, end, label);
    reports.supplierDecline = await buildSupplierDeclineReport(start, end, label);
    reports.taxSummary = await buildTaxSummaryReport(start, end, label);

    const charts = buildAdminCharts(reports);

    // Keep legacy keys lightly for any older clients (summary counts only).
    res.status(200).json({
      success: true,
      period,
      month: period.mode === 'month' ? period.month : undefined,
      reports,
      charts,
      summary: {
        monthlyProcurement: reports.monthlyProcurement.count,
        supplierPayments: reports.supplierPayments.count,
        deliverySchedule: reports.deliverySchedule.count,
        outstandingBalance: reports.outstandingBalance.count,
        materialUsage: reports.materialUsage.count,
        materialRequests: reports.materialRequests.count,
        siteStock: reports.siteStock.count,
        projectBudget: reports.projectBudget.count,
        quotationBidding: reports.quotationBidding.count,
        damagedMissing: reports.damagedMissing.count,
        supplierPerformance: reports.supplierPerformance.count,
        inventoryLedger: reports.inventoryLedger.count,
        supplierDecline: reports.supplierDecline.count,
        taxSummary: reports.taxSummary.count
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
    const period = reportPeriod(req.query);
    if (period.error) {
      return res.status(400).json({ success: false, error: period.error });
    }
    const { start, end, label } = period;
    const inPeriod = { $gte: start, $lt: end };

    const supplierProfile = await resolveSupplierProfile(req.user);
    if (!supplierProfile) {
      return res.status(400).json({
        success: false,
        error: 'No supplier company profile is linked to this login'
      });
    }

    const sid = supplierProfile._id;

    const [quotes, orders, payments, outstandingOrders] = await Promise.all([
      Quotation.find({ supplier: sid, createdAt: inPeriod })
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
      PurchaseOrder.find({ supplier: sid, createdAt: inPeriod })
        .populate('items.material', 'name unit')
        .sort({ createdAt: -1 })
        .limit(500),
      Payment.find({
        $or: [{ paymentDate: inPeriod }, { createdAt: inPeriod }]
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
        `Bids you submitted in ${label}`,
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
        `Purchase orders awarded to your company in ${label}`,
        ['Date', 'PO', 'Material', 'Qty', 'Total', 'Status', 'Payment', 'Invoice'],
        myOrdersRows,
        {
          orderCount: myOrdersRows.length,
          orderValue: money(myOrdersRows.reduce((s, r) => s + Number(r.grandTotal || 0), 0))
        }
      ),
      myPayments: pack(
        'Payments Received',
        `Payments recorded against your POs in ${label}`,
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
      period,
      month: period.mode === 'month' ? period.month : undefined,
      company: supplierProfile.company,
      reports
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Project Manager reports (managed projects only)
 * @route   GET /api/reports/pm
 */
exports.getPMReportStats = async (req, res, next) => {
  try {
    const period = reportPeriod(req.query);
    if (period.error) {
      return res.status(400).json({ success: false, error: period.error });
    }
    const { start, end, label } = period;
    const projectIds = await getManagedProjectIds(req.user._id);

    const reports = {
      myMaterialRequests: await buildMaterialRequestsReportForProjects(
        start,
        end,
        label,
        projectIds
      ),
      myProjectBudget: await buildProjectBudgetReportForProjects(
        start,
        end,
        label,
        projectIds
      ),
      myDeliveries: await buildDeliveriesForProjects(start, end, label, projectIds),
      myMaterialUsage: await buildMaterialUsageForProjects(
        start,
        end,
        label,
        projectIds
      ),
      damagedMissing: await buildDamagedMissingReport(start, end, label, projectIds)
    };

    const charts = {
      requestsByStatus: Object.entries(
        reports.myMaterialRequests?.summary?.byStatus || {}
      ).map(([label, value]) => ({ label, value: Number(value || 0) })),
      budgetUsage: [
        {
          label: 'Used',
          value: Number(reports.myProjectBudget?.summary?.totalUsed || 0)
        },
        {
          label: 'Remaining',
          value: Number(reports.myProjectBudget?.summary?.totalRemaining || 0)
        }
      ]
    };

    res.status(200).json({
      success: true,
      period,
      month: period.mode === 'month' ? period.month : undefined,
      reports,
      charts
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Accountant financial reports
 * @route   GET /api/reports/accountant
 */
exports.getAccountantReportStats = async (req, res, next) => {
  try {
    const period = reportPeriod(req.query);
    if (period.error) {
      return res.status(400).json({ success: false, error: period.error });
    }
    const { start, end, label } = period;
    const inPeriod = { $gte: start, $lt: end };

    const payments = await Payment.find({
      $or: [{ paymentDate: inPeriod }, { createdAt: inPeriod }]
    })
      .populate({
        path: 'purchaseOrder',
        select: 'purchaseOrderNumber grandTotal paymentStatus supplier',
        populate: { path: 'supplier', select: 'company name' }
      })
      .populate('recordedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(500);

    const paymentRows = payments.map((p) => [
      p.paymentDate || p.createdAt,
      p.purchaseOrder?.purchaseOrderNumber || '—',
      p.purchaseOrder?.supplier?.company ||
        p.purchaseOrder?.supplier?.name ||
        '—',
      money(p.paidAmount),
      money(p.remainingBalance),
      p.paymentMethod || '—',
      p.referenceNumber || '—',
      p.recordedBy?.name || '—',
      p.purchaseOrder?.paymentStatus || '—'
    ]);

    const pack = (title, description, headers, rows, summary = {}) => ({
      title,
      description,
      headers,
      rows,
      summary,
      count: rows.length
    });

    const reports = {
      paymentSummary: pack(
        'Payment Summary',
        `Payments recorded in ${label}`,
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
        paymentRows,
        {
          paymentCount: paymentRows.length,
          totalPaid: money(
            payments.reduce((s, p) => s + Number(p.paidAmount || 0), 0)
          )
        }
      ),
      outstandingBySupplier: await buildOutstandingBySupplierReport(),
      taxSummary: await buildTaxSummaryReport(start, end, label),
      poFinancials: await buildPOFinancialsReport(start, end, label)
    };

    const charts = {
      paymentsByMethod: (() => {
        const byMethod = {};
        for (const row of paymentRows) {
          const method = row[5] || 'Other';
          byMethod[method] = (byMethod[method] || 0) + Number(row[3] || 0);
        }
        return Object.entries(byMethod).map(([label, value]) => ({
          label,
          value: money(value)
        }));
      })(),
      taxVsTotal: [
        {
          label: 'Tax',
          value: Number(reports.taxSummary?.summary?.totalTax || 0)
        },
        {
          label: 'Grand Total',
          value: Number(reports.taxSummary?.summary?.grandTotal || 0)
        }
      ]
    };

    res.status(200).json({
      success: true,
      period,
      month: period.mode === 'month' ? period.month : undefined,
      reports,
      charts
    });
  } catch (error) {
    next(error);
  }
};

/** Build admin report bundle for email (Phase 3). */
async function buildAdminEmailSummaries(start, end, label) {
  return {
    materialRequests: await buildMaterialRequestsReport(start, end, label),
    projectBudget: await buildProjectBudgetReport(start, end, label),
    inventoryLedger: await buildInventoryLedgerReport(start, end, label),
    supplierDecline: await buildSupplierDeclineReport(start, end, label),
    taxSummary: await buildTaxSummaryReport(start, end, label),
    damagedMissing: await buildDamagedMissingReport(start, end, label)
  };
}

exports.buildAdminEmailSummaries = buildAdminEmailSummaries;
exports.reportPeriod = reportPeriod;

/**
 * @desc    Get monthly report email schedule (Admin)
 * @route   GET /api/reports/schedule
 */
exports.getReportSchedule = async (req, res, next) => {
  try {
    const ReportSchedule = require('../models/ReportSchedule');
    let doc = await ReportSchedule.findOne({ key: 'default' });
    if (!doc) {
      doc = await ReportSchedule.create({ key: 'default' });
    }
    res.status(200).json({ success: true, schedule: doc });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update report email schedule (Admin)
 * @route   PUT /api/reports/schedule
 */
exports.updateReportSchedule = async (req, res, next) => {
  try {
    const ReportSchedule = require('../models/ReportSchedule');
    const { enabled, dayOfMonth, recipientEmails } = req.body;

    const update = {};
    if (typeof enabled === 'boolean') update.enabled = enabled;
    if (dayOfMonth != null) {
      const day = Number(dayOfMonth);
      if (!Number.isInteger(day) || day < 1 || day > 28) {
        return res.status(400).json({
          success: false,
          error: 'dayOfMonth must be between 1 and 28'
        });
      }
      update.dayOfMonth = day;
    }
    if (Array.isArray(recipientEmails)) {
      update.recipientEmails = recipientEmails
        .map((e) => String(e).trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    }

    const doc = await ReportSchedule.findOneAndUpdate(
      { key: 'default' },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, schedule: doc });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send report summary email now (Admin)
 * @route   POST /api/reports/email-now
 */
exports.sendReportEmailNow = async (req, res, next) => {
  try {
    const { sendReportSummaryEmail } = require('../utils/reportEmail');
    const ReportSchedule = require('../models/ReportSchedule');

    const period = reportPeriod(req.query);
    if (period.error) {
      return res.status(400).json({ success: false, error: period.error });
    }

    let recipients = [];
    if (Array.isArray(req.body?.recipientEmails) && req.body.recipientEmails.length) {
      recipients = req.body.recipientEmails.map((e) => String(e).trim().toLowerCase());
    } else {
      const schedule = await ReportSchedule.findOne({ key: 'default' });
      recipients = schedule?.recipientEmails || [];
    }

    if (!recipients.length) {
      return res.status(400).json({
        success: false,
        error: 'No recipient emails configured'
      });
    }

    const summaries = await buildAdminEmailSummaries(
      period.start,
      period.end,
      period.label
    );
    await sendReportSummaryEmail({
      recipients,
      period,
      summaries
    });

    res.status(200).json({
      success: true,
      message: `Report email sent to ${recipients.length} recipient(s)`,
      period: period.label
    });
  } catch (error) {
    if (String(error.message || '').includes('SMTP is not configured')) {
      return res.status(503).json({ success: false, error: error.message });
    }
    next(error);
  }
};
