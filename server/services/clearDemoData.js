/**
 * Shared clear logic for CLI script + Admin API.
 * KEEPS: Users + Roles
 * DELETES: all business / practice demo collections
 */
const Project = require('../models/Project');
const Category = require('../models/Category');
const Supplier = require('../models/Supplier');
const Material = require('../models/Material');
const MaterialRequest = require('../models/MaterialRequest');
const Quotation = require('../models/Quotation');
const PurchaseOrder = require('../models/PurchaseOrder');
const Delivery = require('../models/Delivery');
const Payment = require('../models/Payment');
const Inventory = require('../models/Inventory');
const Approval = require('../models/Approval');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const ProjectStock = require('../models/ProjectStock');
const User = require('../models/User');
const Role = require('../models/Role');

async function clearCollection(model) {
  const result = await model.deleteMany({});
  return result.deletedCount || 0;
}

async function clearDemoData() {
  const usersKept = await User.countDocuments();
  const rolesKept = await Role.countDocuments();

  const deleted = {
    payments: await clearCollection(Payment),
    deliveries: await clearCollection(Delivery),
    inventoryLogs: await clearCollection(Inventory),
    projectStock: await clearCollection(ProjectStock),
    quotations: await clearCollection(Quotation),
    purchaseOrders: await clearCollection(PurchaseOrder),
    approvals: await clearCollection(Approval),
    materialRequests: await clearCollection(MaterialRequest),
    materials: await clearCollection(Material),
    suppliers: await clearCollection(Supplier),
    categories: await clearCollection(Category),
    projects: await clearCollection(Project),
    notifications: await clearCollection(Notification),
    auditLogs: await clearCollection(AuditLog)
  };

  return {
    usersKept,
    rolesKept,
    deleted,
    totalDeleted: Object.values(deleted).reduce((a, b) => a + b, 0)
  };
}

module.exports = { clearDemoData };
