const ProjectStock = require('../models/ProjectStock');
const Inventory = require('../models/Inventory');

/**
 * Apply a stock change to a project (site) balance and write a ledger row.
 * @param {object} opts
 * @param {string|object} opts.projectId
 * @param {string|object} opts.materialId
 * @param {number} opts.quantity - positive amount
 * @param {'Stock In'|'Stock Out'} opts.type
 * @param {string} opts.referenceType
 * @param {string|object} [opts.referenceId]
 * @param {boolean} [opts.skipLedger=false]
 */
async function applyProjectStockChange({
  projectId,
  materialId,
  quantity,
  type,
  referenceType,
  referenceId,
  skipLedger = false
}) {
  if (!projectId || !materialId) return null;
  const qty = Number(quantity);
  if (!qty || qty <= 0) return null;
  if (!['Stock In', 'Stock Out'].includes(type)) {
    throw new Error('Invalid stock type');
  }

  const delta = type === 'Stock In' ? qty : -qty;

  let row = await ProjectStock.findOne({ project: projectId, material: materialId });
  if (!row) {
    row = new ProjectStock({ project: projectId, material: materialId, quantity: 0 });
  }

  const next = row.quantity + delta;
  if (next < 0) {
    throw new Error(
      `Project stock would go negative (have ${row.quantity}, change ${delta})`
    );
  }
  row.quantity = next;
  await row.save();

  if (!skipLedger) {
    await Inventory.create({
      material: materialId,
      project: projectId,
      quantity: qty,
      type,
      referenceType,
      referenceId: referenceId || undefined
    });
  }

  return row;
}

/** Rebuild project balances from inventory ledger (safe to re-run). */
async function rebuildProjectStockFromLedger() {
  await ProjectStock.deleteMany({});
  const rows = await Inventory.aggregate([
    { $match: { project: { $ne: null } } },
    {
      $group: {
        _id: { project: '$project', material: '$material' },
        quantity: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'Stock In'] },
              '$quantity',
              { $multiply: ['$quantity', -1] }
            ]
          }
        }
      }
    }
  ]);

  for (const r of rows) {
    const q = Math.max(0, Number(r.quantity) || 0);
    if (q <= 0) continue;
    await ProjectStock.create({
      project: r._id.project,
      material: r._id.material,
      quantity: q
    });
  }

  return rows.length;
}

module.exports = {
  applyProjectStockChange,
  rebuildProjectStockFromLedger
};
