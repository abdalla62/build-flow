/**
 * Keep only Kowsar + Ahmed supplier companies; delete the rest.
 * Reassigns materials to those two suppliers.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Supplier = require('../models/Supplier');
const Material = require('../models/Material');

const KEEP_EMAILS = ['kowsar@gmail.com', 'ahmed@gmail.com'];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const keep = await Supplier.find({ email: { $in: KEEP_EMAILS } });
  const keepIds = keep.map((s) => s._id);
  console.log(
    'Keeping:',
    keep.map((s) => `${s.company} <${s.email}>`)
  );

  if (keepIds.length < 2) {
    throw new Error('Expected both kowsar@gmail.com and ahmed@gmail.com supplier records');
  }

  const toDelete = await Supplier.find({ email: { $nin: KEEP_EMAILS } });
  console.log(
    'Deleting:',
    toDelete.map((s) => `${s.company} <${s.email}>`)
  );

  const mats = await Material.find({});
  let i = 0;
  for (const m of mats) {
    const sid = keepIds[i % keepIds.length];
    i += 1;
    m.supplier = sid;
    m.suppliers = [sid];
    await m.save();
  }
  console.log('Materials reassigned:', mats.length);

  const del = await Supplier.deleteMany({ email: { $nin: KEEP_EMAILS } });
  console.log('Deleted count:', del.deletedCount);

  const left = await Supplier.find().select('company email');
  console.log(
    'Remaining:',
    left.map((s) => s.company)
  );

  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
