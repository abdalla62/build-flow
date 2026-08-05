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
        materialUsage: reports.materialUsage.count
      }
    });
  } catch (error) {
    next(error);
  }
};
