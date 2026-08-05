/**
 * Clear business/demo data for supervisor practice demos.
 * KEEPS: Users + Roles
 * DELETES: projects, materials, categories, suppliers, requests,
 *          quotations, POs, deliveries, payments, inventory logs,
 *          approvals, notifications, audit logs
 *
 * Usage (from server folder):
 *   npm run clear-data -- --confirm
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Role = require('../models/Role');
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

const confirmed = process.argv.includes('--confirm');

async function clearCollection(label, model) {
  const result = await model.deleteMany({});
  console.log(`  ✓ ${label}: deleted ${result.deletedCount}`);
  return result.deletedCount;
}

async function run() {
  if (!confirmed) {
    console.log('');
    console.log('This will DELETE all business data but KEEP registered users and roles.');
    console.log('To proceed, run:');
    console.log('  npm run clear-data -- --confirm');
    console.log('');
    process.exit(0);
  }

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is missing in server/.env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.\n');

  const usersBefore = await User.countDocuments();
  const rolesBefore = await Role.countDocuments();
  console.log(`KEEPING users: ${usersBefore}`);
  console.log(`KEEPING roles: ${rolesBefore}\n`);
  console.log('Deleting business data...');

  // Order: dependents first (safer with any residual refs)
  await clearCollection('Payments', Payment);
  await clearCollection('Deliveries', Delivery);
  await clearCollection('Inventory logs', Inventory);
  await clearCollection('Quotations', Quotation);
  await clearCollection('Purchase Orders', PurchaseOrder);
  await clearCollection('Approvals', Approval);
  await clearCollection('Material Requests', MaterialRequest);
  await clearCollection('Materials', Material);
  await clearCollection('Suppliers (company records)', Supplier);
  await clearCollection('Categories', Category);
  await clearCollection('Projects', Project);
  await clearCollection('Notifications', Notification);
  await clearCollection('Audit Logs', AuditLog);

  const usersAfter = await User.countDocuments();
  const rolesAfter = await Role.countDocuments();

  console.log('\nDone.');
  console.log(`Users still in DB: ${usersAfter} (unchanged expected: ${usersBefore})`);
  console.log(`Roles still in DB: ${rolesAfter} (unchanged expected: ${rolesBefore})`);
  console.log('\nYou can now practice step-by-step: Projects → Categories → Materials → Requests → ...');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('Clear failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
