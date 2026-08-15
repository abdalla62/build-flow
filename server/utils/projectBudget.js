const Project = require('../models/Project');
const MaterialRequest = require('../models/MaterialRequest');

/** Statuses that reserve / consume project budget */
const BUDGET_STATUSES = ['Pending', 'Approved', 'Ordered', 'Delivered'];

/**
 * Sum estimated cost of material requests that count against a project budget.
 * @param {string|import('mongoose').Types.ObjectId} projectId
 * @param {{ excludeRequestIds?: Array<string|import('mongoose').Types.ObjectId> }} [opts]
 */
async function getProjectBudgetSummary(projectId, opts = {}) {
  const { excludeRequestIds = [] } = opts;

  const project = await Project.findById(projectId).select('name budget');
  if (!project) return null;

  const query = {
    project: projectId,
    status: { $in: BUDGET_STATUSES }
  };

  if (excludeRequestIds.length > 0) {
    query._id = { $nin: excludeRequestIds };
  }

  const requests = await MaterialRequest.find(query)
    .populate('material', 'estimatedPrice')
    .select('quantity material status');

  const used = requests.reduce((sum, r) => {
    const price = Number(r.material?.estimatedPrice) || 0;
    const qty = Number(r.quantity) || 0;
    return sum + qty * price;
  }, 0);

  const budget = Number(project.budget) || 0;
  const remaining = budget - used;

  return {
    projectId: project._id,
    projectName: project.name,
    budget: Number(budget.toFixed(2)),
    used: Number(used.toFixed(2)),
    remaining: Number(remaining.toFixed(2))
  };
}

/**
 * @param {string} projectId
 * @param {number} additionalCost
 * @param {{ excludeRequestIds?: string[] }} [opts]
 */
async function assertWithinBudget(projectId, additionalCost, opts = {}) {
  const summary = await getProjectBudgetSummary(projectId, opts);
  if (!summary) {
    return { ok: false, status: 404, error: 'Project not found', summary: null };
  }

  const cost = Number(additionalCost) || 0;
  if (cost > summary.remaining + 0.009) {
    return {
      ok: false,
      status: 400,
      error: `Budget limit exceeded. Remaining: $${summary.remaining.toFixed(2)}, this request: $${cost.toFixed(2)}.`,
      summary
    };
  }

  return { ok: true, summary };
}

module.exports = {
  BUDGET_STATUSES,
  getProjectBudgetSummary,
  assertWithinBudget
};
