/**
 * Upsert Somali construction categories + materials.
 * Does NOT delete projects, POs, payments, or users.
 *
 * Usage: node scripts/seedSomaliaCatalog.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Category = require('../models/Category');
const Material = require('../models/Material');
const Supplier = require('../models/Supplier');

/** Approximate Mogadishu / Banadir market reference prices (USD). */
const CATEGORIES = [
  {
    name: 'Cement & Binders',
    description:
      'Sibidh iyo xirmooyinka — Portland cement bags, lime, and bonding agents used on Somali building sites.'
  },
  {
    name: 'Aggregates & Earthworks',
    description:
      'Ciid, roobad iyo dhagax — river sand, crushed stone, and fill materials from local quarries and riverbeds.'
  },
  {
    name: 'Steel & Reinforcement',
    description:
      'Birta dhismo — deformed rebar, mesh, and structural steel commonly imported via Mogadishu and Bosaso ports.'
  },
  {
    name: 'Blocks & Masonry',
    description:
      'Block-yo iyo dhismo derbi — hollow concrete blocks, solid blocks, and brickwork materials.'
  },
  {
    name: 'Roofing & Cladding',
    description:
      'Saqafka — corrugated CGI sheets, ridge caps, gutters, and waterproofing common across Somalia.'
  },
  {
    name: 'Timber & Formwork',
    description:
      'Qoryo iyo formwork — plywood, timber planks, and props for slabs and columns.'
  },
  {
    name: 'Plumbing & Water',
    description:
      'Biyo iyo tuubooyin — PVC/PPR pipes, fittings, tanks, and sanitary fittings for site water systems.'
  },
  {
    name: 'Electrical & Solar',
    description:
      'Koronto iyo solar — cables, breakers, switches, LED lighting, and solar accessories used in Mogadishu builds.'
  },
  {
    name: 'Finishes & Paint',
    description:
      'Dib-u-qurxin — emulsion/oil paints, plaster, putty, tiles, and adhesives for finishing works.'
  },
  {
    name: 'Doors, Windows & Hardware',
    description:
      'Albaabo, daaqado iyo qalab — metal/wood doors, aluminium windows, locks, hinges, and fasteners.'
  }
];

/**
 * Materials keyed by category name.
 * unit + estimatedPrice reflect typical site procurement units in Somalia.
 */
const MATERIALS_BY_CATEGORY = {
  'Cement & Binders': [
    {
      name: 'Portland Cement 42.5R (50kg bag)',
      unit: 'Bags',
      estimatedPrice: 8.5,
      currentStock: 400,
      minimumStock: 120,
      description: 'Standard OPC bag widely sold in Bakara / Industrial Road Mogadishu.'
    },
    {
      name: 'White Cement (40kg bag)',
      unit: 'Bags',
      estimatedPrice: 14,
      currentStock: 60,
      minimumStock: 20,
      description: 'For decorative plaster, tiles adhesive base, and finishing works.'
    },
    {
      name: 'Hydrated Lime (25kg)',
      unit: 'Bags',
      estimatedPrice: 6,
      currentStock: 80,
      minimumStock: 25,
      description: 'Used in mortar mixes and traditional plastering.'
    }
  ],
  'Aggregates & Earthworks': [
    {
      name: 'River Sand (fine)',
      unit: 'm³',
      estimatedPrice: 32,
      currentStock: 45,
      minimumStock: 15,
      description: 'Ciid wabiga — fine sand for plaster and concrete mixes.'
    },
    {
      name: 'Crushed Aggregate 20mm',
      unit: 'm³',
      estimatedPrice: 38,
      currentStock: 30,
      minimumStock: 12,
      description: 'Roobad 20mm for structural concrete and foundations.'
    },
    {
      name: 'Hardcore / Ballast Fill',
      unit: 'm³',
      estimatedPrice: 22,
      currentStock: 50,
      minimumStock: 20,
      description: 'Base fill under slabs, roads, and compound floors.'
    }
  ],
  'Steel & Reinforcement': [
    {
      name: 'Deformed Rebar 8mm',
      unit: 'Tons',
      estimatedPrice: 780,
      currentStock: 4,
      minimumStock: 2,
      description: 'Light reinforcement for slabs, stirrups, and mesh ties.'
    },
    {
      name: 'Deformed Rebar 12mm',
      unit: 'Tons',
      estimatedPrice: 820,
      currentStock: 6,
      minimumStock: 3,
      description: 'Common column/beam bar size on Mogadishu mid-rise sites.'
    },
    {
      name: 'Deformed Rebar 16mm',
      unit: 'Tons',
      estimatedPrice: 850,
      currentStock: 3,
      minimumStock: 2,
      description: 'Heavy reinforcement for foundations and main columns.'
    },
    {
      name: 'Binding Wire 16 Gauge',
      unit: 'Rolls',
      estimatedPrice: 18,
      currentStock: 40,
      minimumStock: 15,
      description: 'Xadhig bir ah — for tying rebar cages on site.'
    }
  ],
  'Blocks & Masonry': [
    {
      name: 'Hollow Concrete Block 6 inch',
      unit: 'Pcs',
      estimatedPrice: 0.55,
      currentStock: 5000,
      minimumStock: 1500,
      description: 'Block 6" — most used walling unit in Banadir housing projects.'
    },
    {
      name: 'Hollow Concrete Block 8 inch',
      unit: 'Pcs',
      estimatedPrice: 0.75,
      currentStock: 2500,
      minimumStock: 800,
      description: 'Thicker block for external walls and boundary walls.'
    },
    {
      name: 'Solid Concrete Block',
      unit: 'Pcs',
      estimatedPrice: 0.9,
      currentStock: 1200,
      minimumStock: 400,
      description: 'For load-bearing sections and foundation dwarf walls.'
    }
  ],
  'Roofing & Cladding': [
    {
      name: 'CGI Roofing Sheet Gauge 28 (2m)',
      unit: 'Sheets',
      estimatedPrice: 14,
      currentStock: 350,
      minimumStock: 100,
      description: 'Saqaf bir ah — corrugated iron sheet, standard residential roofing.'
    },
    {
      name: 'CGI Roofing Sheet Gauge 26 (3m)',
      unit: 'Sheets',
      estimatedPrice: 22,
      currentStock: 180,
      minimumStock: 60,
      description: 'Heavier gauge for longer spans and commercial sheds.'
    },
    {
      name: 'Ridge Cap / Valley Gutter',
      unit: 'Pcs',
      estimatedPrice: 8,
      currentStock: 90,
      minimumStock: 30,
      description: 'Roof ridge and rainwater valley fittings.'
    }
  ],
  'Timber & Formwork': [
    {
      name: 'Marine Plywood 18mm (4x8 ft)',
      unit: 'Sheets',
      estimatedPrice: 48,
      currentStock: 70,
      minimumStock: 25,
      description: 'Formwork plywood for slabs and beams.'
    },
    {
      name: 'Timber Plank 2x4 (3m)',
      unit: 'Pcs',
      estimatedPrice: 6.5,
      currentStock: 400,
      minimumStock: 120,
      description: 'Qori — props, shutters, and temporary site framing.'
    },
    {
      name: 'Bamboo / Eucalyptus Pole',
      unit: 'Pcs',
      estimatedPrice: 2.5,
      currentStock: 600,
      minimumStock: 200,
      description: 'Scaffolding and light support poles common on local sites.'
    }
  ],
  'Plumbing & Water': [
    {
      name: 'PVC Pipe 4 inch (Class B) 6m',
      unit: 'Lengths',
      estimatedPrice: 16,
      currentStock: 120,
      minimumStock: 40,
      description: 'Drainage and sewer line pipe for compounds and buildings.'
    },
    {
      name: 'PPR Pipe 25mm (Hot/Cold) 4m',
      unit: 'Lengths',
      estimatedPrice: 5.5,
      currentStock: 200,
      minimumStock: 60,
      description: 'Internal water supply pipe used in new Mogadishu apartments.'
    },
    {
      name: 'Plastic Water Tank 2000L',
      unit: 'Pcs',
      estimatedPrice: 180,
      currentStock: 12,
      minimumStock: 4,
      description: 'Roof / ground water storage tank (biyo kayd).'
    },
    {
      name: 'Ceramic WC Suite (local grade)',
      unit: 'Sets',
      estimatedPrice: 95,
      currentStock: 18,
      minimumStock: 6,
      description: 'Toilet suite with cistern — mid-range Banadir market stock.'
    }
  ],
  'Electrical & Solar': [
    {
      name: 'Copper Cable 2.5mm² (100m roll)',
      unit: 'Rolls',
      estimatedPrice: 55,
      currentStock: 40,
      minimumStock: 15,
      description: 'Lighting and socket circuits for residential buildings.'
    },
    {
      name: 'Copper Cable 6mm² (100m roll)',
      unit: 'Rolls',
      estimatedPrice: 110,
      currentStock: 20,
      minimumStock: 8,
      description: 'Main distribution / AC feeder cable.'
    },
    {
      name: 'MCB Breaker 32A Single Pole',
      unit: 'Pcs',
      estimatedPrice: 4.5,
      currentStock: 150,
      minimumStock: 40,
      description: 'Distribution board protection device.'
    },
    {
      name: 'LED Ceiling Light 18W',
      unit: 'Pcs',
      estimatedPrice: 7,
      currentStock: 200,
      minimumStock: 50,
      description: 'Energy-efficient indoor lighting common in new builds.'
    },
    {
      name: 'Solar Panel 300W Mono',
      unit: 'Pcs',
      estimatedPrice: 95,
      currentStock: 25,
      minimumStock: 8,
      description: 'Off-grid / hybrid solar module widely used with generators.'
    }
  ],
  'Finishes & Paint': [
    {
      name: 'Emulsion Paint Interior (20L)',
      unit: 'Buckets',
      estimatedPrice: 42,
      currentStock: 55,
      minimumStock: 15,
      description: 'Rinji gudaha — wall emulsion for rooms and corridors.'
    },
    {
      name: 'Weather Shield Exterior Paint (20L)',
      unit: 'Buckets',
      estimatedPrice: 58,
      currentStock: 35,
      minimumStock: 10,
      description: 'Rinji dibadda — UV-resistant exterior coating for coastal climate.'
    },
    {
      name: 'Ceramic Floor Tile 60x60cm',
      unit: 'm²',
      estimatedPrice: 12,
      currentStock: 400,
      minimumStock: 100,
      description: 'Porcelain/ceramic tiles popular in Mogadishu apartments.'
    },
    {
      name: 'Tile Adhesive Cement-based (25kg)',
      unit: 'Bags',
      estimatedPrice: 9,
      currentStock: 90,
      minimumStock: 30,
      description: 'For fixing floor and wall tiles.'
    }
  ],
  'Doors, Windows & Hardware': [
    {
      name: 'Steel Security Door (single leaf)',
      unit: 'Pcs',
      estimatedPrice: 220,
      currentStock: 15,
      minimumStock: 5,
      description: 'Albaab bir ah — common main entrance door in Banadir homes.'
    },
    {
      name: 'Aluminium Sliding Window 1.5x1.2m',
      unit: 'Pcs',
      estimatedPrice: 140,
      currentStock: 20,
      minimumStock: 6,
      description: 'Daaqad aluminium — with glass, for rooms and offices.'
    },
    {
      name: 'Padlock Heavy Duty 60mm',
      unit: 'Pcs',
      estimatedPrice: 6,
      currentStock: 100,
      minimumStock: 30,
      description: 'Site gates, stores, and temporary security.'
    },
    {
      name: 'Assorted Nails & Screws Pack 5kg',
      unit: 'Packs',
      estimatedPrice: 12,
      currentStock: 80,
      minimumStock: 25,
      description: 'General fasteners for timber and finishing works.'
    }
  ]
};

async function upsertCategory(def) {
  const existing = await Category.findOne({ name: def.name });
  if (existing) {
    existing.description = def.description;
    await existing.save();
    return existing;
  }
  return Category.create(def);
}

async function upsertMaterial(def, categoryId, supplierId) {
  const existing = await Material.findOne({ name: def.name, category: categoryId });
  const payload = {
    ...def,
    category: categoryId,
    status: 'Active',
    ...(supplierId
      ? { supplier: supplierId, suppliers: [supplierId] }
      : {})
  };

  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    return { material: existing, created: false };
  }
  const material = await Material.create(payload);
  return { material, created: true };
}

const run = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.\n');

    const supplier = await Supplier.findOne().sort({ createdAt: 1 });
    if (supplier) {
      console.log(`Linking materials to supplier: ${supplier.company || supplier.name}`);
    } else {
      console.log('No supplier found — materials will be created without supplier link.');
    }

    const categoryMap = {};
    let catCreated = 0;
    let catUpdated = 0;

    console.log('\n--- Categories ---');
    for (const def of CATEGORIES) {
      const before = await Category.findOne({ name: def.name });
      const cat = await upsertCategory(def);
      categoryMap[def.name] = cat._id;
      if (before) {
        catUpdated += 1;
        console.log(`  updated: ${cat.name}`);
      } else {
        catCreated += 1;
        console.log(`  created: ${cat.name}`);
      }
    }

    if (supplier) {
      const allCatIds = Object.values(categoryMap);
      supplier.suppliedCategories = allCatIds;
      await supplier.save();
    }

    let matCreated = 0;
    let matUpdated = 0;

    console.log('\n--- Materials ---');
    for (const [catName, mats] of Object.entries(MATERIALS_BY_CATEGORY)) {
      const categoryId = categoryMap[catName];
      if (!categoryId) continue;
      for (const def of mats) {
        const { created } = await upsertMaterial(
          def,
          categoryId,
          supplier ? supplier._id : null
        );
        if (created) {
          matCreated += 1;
          console.log(`  + ${def.name}`);
        } else {
          matUpdated += 1;
          console.log(`  ~ ${def.name}`);
        }
      }
    }

    console.log('\nDone (Somalia catalog).');
    console.log(`Categories: ${catCreated} created, ${catUpdated} updated`);
    console.log(`Materials:  ${matCreated} created, ${matUpdated} updated`);
    console.log('Existing projects / POs / payments were NOT deleted.\n');

    await mongoose.connection.close();
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
};

run();
