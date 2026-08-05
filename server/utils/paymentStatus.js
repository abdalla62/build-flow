const PurchaseOrder = require('../models/PurchaseOrder');

/**
 * Mark unpaid / partially paid POs as Overdue past PAYMENT_DUE_DAYS (default 30).
 */
async function markOverduePurchaseOrders() {
  const dueDays = Number(process.env.PAYMENT_DUE_DAYS || 30);
  if (!Number.isFinite(dueDays) || dueDays <= 0) return 0;

  const cutoff = new Date(Date.now() - dueDays * 24 * 60 * 60 * 1000);
  const result = await PurchaseOrder.updateMany(
    {
      paymentStatus: { $in: ['Unpaid', 'Partially Paid'] },
      status: { $nin: ['Rejected', 'Cancelled'] },
      createdAt: { $lt: cutoff }
    },
    { $set: { paymentStatus: 'Overdue' } }
  );

  return result.modifiedCount || 0;
}

module.exports = { markOverduePurchaseOrders };
