/**
 * Remove Somalia catalog categories + materials previously seeded.
 * Usage: node scripts/removeSomaliaCatalog.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Category = require('../models/Category');
const Material = require('../models/Material');
const Supplier = require('../models/Supplier');

const CATEGORY_NAMES = [
  'Cement & Binders',
  'Aggregates & Earthworks',
  'Steel & Reinforcement',
  'Blocks & Masonry',
  'Roofing & Cladding',
  'Timber & Formwork',
  'Plumbing & Water',
  'Electrical & Solar',
  'Finishes & Paint',
  'Doors, Windows & Hardware'
];

const MATERIAL_NAMES = [
  'Portland Cement 42.5R (50kg bag)',
  'White Cement (40kg bag)',
  'Hydrated Lime (25kg)',
  'River Sand (fine)',
  'Crushed Aggregate 20mm',
  'Hardcore / Ballast Fill',
  'Deformed Rebar 8mm',
  'Deformed Rebar 12mm',
  'Deformed Rebar 16mm',
  'Binding Wire 16 Gauge',
  'Hollow Concrete Block 6 inch',
  'Hollow Concrete Block 8 inch',
  'Solid Concrete Block',
  'CGI Roofing Sheet Gauge 28 (2m)',
  'CGI Roofing Sheet Gauge 26 (3m)',
  'Ridge Cap / Valley Gutter',
  'Marine Plywood 18mm (4x8 ft)',
  'Timber Plank 2x4 (3m)',
  'Bamboo / Eucalyptus Pole',
  'PVC Pipe 4 inch (Class B) 6m',
  'PPR Pipe 25mm (Hot/Cold) 4m',
  'Plastic Water Tank 2000L',
  'Ceramic WC Suite (local grade)',
  'Copper Cable 2.5mm² (100m roll)',
  'Copper Cable 6mm² (100m roll)',
  'MCB Breaker 32A Single Pole',
  'LED Ceiling Light 18W',
  'Solar Panel 300W Mono',
  'Emulsion Paint Interior (20L)',
  'Weather Shield Exterior Paint (20L)',
  'Ceramic Floor Tile 60x60cm',
  'Tile Adhesive Cement-based (25kg)',
  'Steel Security Door (single leaf)',
  'Aluminium Sliding Window 1.5x1.2m',
  'Padlock Heavy Duty 60mm',
  'Assorted Nails & Screws Pack 5kg'
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const cats = await Category.find({ name: { $in: CATEGORY_NAMES } });
    const catIds = cats.map((c) => c._id);

    const byName = await Material.deleteMany({ name: { $in: MATERIAL_NAMES } });
    const byCat = await Material.deleteMany({ category: { $in: catIds } });
    const catDel = await Category.deleteMany({ _id: { $in: catIds } });

    await Supplier.updateMany({}, { $pull: { suppliedCategories: { $in: catIds } } });

    console.log('Materials deleted:', byName.deletedCount + byCat.deletedCount);
    console.log('Categories deleted:', catDel.deletedCount);
    console.log('Remaining categories:', await Category.countDocuments());
    console.log('Remaining materials:', await Material.countDocuments());

    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
