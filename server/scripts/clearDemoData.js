/**
 * Clear business/demo data for supervisor practice demos.
 * KEEPS: Users + Roles
 *
 * Usage (from server folder):
 *   npm run clear-data -- --confirm
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { clearDemoData } = require('../services/clearDemoData');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const confirmed = process.argv.includes('--confirm');

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

  console.log('Deleting business data...');
  const result = await clearDemoData();

  Object.entries(result.deleted).forEach(([key, count]) => {
    console.log(`  ✓ ${key}: deleted ${count}`);
  });

  console.log('\nDone.');
  console.log(`Users still in DB: ${result.usersKept}`);
  console.log(`Roles still in DB: ${result.rolesKept}`);
  console.log('\nWeb + mobile share this database — both are now clean.');

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
