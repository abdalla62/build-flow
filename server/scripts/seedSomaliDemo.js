/**
 * Seed clear Somali demo data for supervisor presentation.
 * Creates: Projects, Categories, Materials, Suppliers
 * Does NOT touch Users / Roles / Payments / Requests / POs
 *
 * Prices are approximate Mogadishu / Banadir market (USD).
 *
 * Usage:
 *   npm run seed:somali-demo
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Project = require('../models/Project');
const Category = require('../models/Category');
const Material = require('../models/Material');
const Supplier = require('../models/Supplier');

const CATEGORIES = [
  {
    name: 'Sibidh iyo Xirmooyin',
    description: 'Sibidh Portland, lime iyo xirmooyinka la isticmaalo dhismooyinka Soomaaliyeed.'
  },
  {
    name: 'Ciid, Roobad iyo Dhagax',
    description: 'Ciid wabi, roobad la jajabiyey iyo dhagax buuxin ah oo laga helo Suuqa Muqdisho.'
  },
  {
    name: 'Birta Dhismo',
    description: 'Birta xoojinta (rebar), mesh iyo birta qaab-dhismeedka ee la soo dejiyo dekedaha.'
  },
  {
    name: 'Block-yo iyo Derbi',
    description: 'Block-yo hollow/solid iyo qalabka dhismo derbi ee goobaha dhismo.'
  },
  {
    name: 'Saqaf iyo Dabool',
    description: 'Saqafka birta (CGI), ridge, gutters iyo qalabka ka-hortagga biyo-gelitaanka.'
  },
  {
    name: 'Qoryo iyo Formwork',
    description: 'Plywood, alwaax iyo props-ka loo isticmaalo shubka saqafka iyo tiirarka.'
  },
  {
    name: 'Biyo iyo Tuubooyin',
    description: 'Tuubooyinka PVC/PPR, fittings, haamaha biyaha iyo qalabka sanitarka.'
  },
  {
    name: 'Koronto iyo Solar',
    description: 'Fiilooyin, breakers, nalalka LED iyo qalabka solar ee dhismooyinka Muqdisho.'
  },
  {
    name: 'Rinji iyo Dhammaystir',
    description: 'Rinji, plaster, putty, tiles iyo xabagta dhammaystirka gudaha/dibadda.'
  },
  {
    name: 'Albaabo, Daaqado iyo Qalab',
    description: 'Albaabo bir/alwaax, daaqado aluminium, qufullo, hinges iyo qalabka xidhitaanka.'
  }
];

const MATERIALS_BY_CATEGORY = {
  'Sibidh iyo Xirmooyin': [
    {
      name: 'Sibidh Portland 42.5R (50kg)',
      unit: 'Kiish',
      estimatedPrice: 8.5,
      currentStock: 500,
      minimumStock: 150,
      description: 'Sibidh caadi ah oo laga helo Suuqa Bakaaraha / Industrial Road.'
    },
    {
      name: 'Sibidh Cad (40kg)',
      unit: 'Kiish',
      estimatedPrice: 14,
      currentStock: 80,
      minimumStock: 25,
      description: 'Loo isticmaalo plaster qurxin iyo shaqada dhammaystirka.'
    },
    {
      name: 'Lime la qoyay (25kg)',
      unit: 'Kiish',
      estimatedPrice: 6,
      currentStock: 100,
      minimumStock: 30,
      description: 'Loogu daro mortar iyo plaster dhaqameed.'
    }
  ],
  'Ciid, Roobad iyo Dhagax': [
    {
      name: 'Ciid Wabi (fine)',
      unit: 'm³',
      estimatedPrice: 32,
      currentStock: 60,
      minimumStock: 20,
      description: 'Ciid wabi oo loogu talagalay plaster iyo shubka.'
    },
    {
      name: 'Roobad 20mm',
      unit: 'm³',
      estimatedPrice: 38,
      currentStock: 40,
      minimumStock: 15,
      description: 'Roobad la jajabiyey oo loogu talagalay concrete structural.'
    },
    {
      name: 'Dhagax Buuxin (Hardcore)',
      unit: 'm³',
      estimatedPrice: 28,
      currentStock: 35,
      minimumStock: 12,
      description: 'Dhagax buuxin ah oo loogu talagalay aasaaska iyo jidadka goobta.'
    }
  ],
  'Birta Dhismo': [
    {
      name: 'Birta Xoojinta Ø12mm (12m)',
      unit: 'Xabbo',
      estimatedPrice: 9.5,
      currentStock: 800,
      minimumStock: 200,
      description: 'Birta deformed ee tiirarka iyo saqafka.'
    },
    {
      name: 'Birta Xoojinta Ø16mm (12m)',
      unit: 'Xabbo',
      estimatedPrice: 16.5,
      currentStock: 450,
      minimumStock: 120,
      description: 'Birta weyn ee aasaaska iyo tiirarka culus.'
    },
    {
      name: 'Mesh Bir (6x6 mm)',
      unit: 'Saxan',
      estimatedPrice: 22,
      currentStock: 90,
      minimumStock: 25,
      description: 'Mesh loogu talagalay saqafka iyo floor slab.'
    }
  ],
  'Block-yo iyo Derbi': [
    {
      name: 'Block Hollow 20x20x40',
      unit: 'Xabbo',
      estimatedPrice: 0.85,
      currentStock: 5000,
      minimumStock: 1500,
      description: 'Block-yo hollow oo caadi ah derbiyada gudaha/dibadda.'
    },
    {
      name: 'Block Solid 20x20x40',
      unit: 'Xabbo',
      estimatedPrice: 1.1,
      currentStock: 2000,
      minimumStock: 600,
      description: 'Block-yo adag oo loogu talagalay derbiyo culus / foundation walls.'
    },
    {
      name: 'Mortar Premix (40kg)',
      unit: 'Kiish',
      estimatedPrice: 7.5,
      currentStock: 150,
      minimumStock: 40,
      description: 'Isku-darka mortar ee shaqada block-ka.'
    }
  ],
  'Saqaf iyo Dabool': [
    {
      name: 'Saqaf Bir CGI 0.40mm',
      unit: 'Saxan',
      estimatedPrice: 18,
      currentStock: 300,
      minimumStock: 80,
      description: 'Saqafka birta ee ugu badan ee guryaha iyo xarumaha.'
    },
    {
      name: 'Ridge Cap (saqaf)',
      unit: 'Xabbo',
      estimatedPrice: 6.5,
      currentStock: 120,
      minimumStock: 40,
      description: 'Daboolka jiirka saqafka.'
    },
    {
      name: 'Gutter PVC 4 inch',
      unit: 'Mitir',
      estimatedPrice: 4.2,
      currentStock: 200,
      minimumStock: 50,
      description: 'Mariiinka biyaha saqafka.'
    }
  ],
  'Qoryo iyo Formwork': [
    {
      name: 'Plywood 18mm (1220x2440)',
      unit: 'Saxan',
      estimatedPrice: 28,
      currentStock: 160,
      minimumStock: 40,
      description: 'Plywood formwork ee shubka saqafka.'
    },
    {
      name: 'Alwaax 2x4 (4m)',
      unit: 'Xabbo',
      estimatedPrice: 5.5,
      currentStock: 400,
      minimumStock: 100,
      description: 'Alwaax props iyo scaffolding fudud.'
    },
    {
      name: 'Props Bir (adjustable)',
      unit: 'Xabbo',
      estimatedPrice: 35,
      currentStock: 80,
      minimumStock: 25,
      description: 'Tiirarka birta ee taageerada formwork.'
    }
  ],
  'Biyo iyo Tuubooyin': [
    {
      name: 'Tuubo PVC 1 inch (6m)',
      unit: 'Xabbo',
      estimatedPrice: 4.8,
      currentStock: 250,
      minimumStock: 70,
      description: 'Tuubooyinka biyaha gudaha dhismooyinka.'
    },
    {
      name: 'Tuubo PPR 25mm (4m)',
      unit: 'Xabbo',
      estimatedPrice: 6.2,
      currentStock: 180,
      minimumStock: 50,
      description: 'Tuubooyinka kulaylka / qabowga ee nidaamka biyaha.'
    },
    {
      name: 'Haanta Biyaha 2000L',
      unit: 'Xabbo',
      estimatedPrice: 180,
      currentStock: 12,
      minimumStock: 4,
      description: 'Haanta kaydinta biyaha ee saqafka ama dhulka.'
    }
  ],
  'Koronto iyo Solar': [
    {
      name: 'Fiilo 2.5mm² (100m roll)',
      unit: 'Roll',
      estimatedPrice: 45,
      currentStock: 60,
      minimumStock: 15,
      description: 'Fiilooyinka nalalka iyo sockets-ka.'
    },
    {
      name: 'Breaker 32A (single)',
      unit: 'Xabbo',
      estimatedPrice: 8,
      currentStock: 100,
      minimumStock: 30,
      description: 'Breaker ilaalinta wareegga korontada.'
    },
    {
      name: 'Solar Panel 300W',
      unit: 'Xabbo',
      estimatedPrice: 95,
      currentStock: 40,
      minimumStock: 10,
      description: 'Panel solar oo caadi ah oo loogu talagalay xarumaha.'
    }
  ],
  'Rinji iyo Dhammaystir': [
    {
      name: 'Rinji Emulsion 20L (cad)',
      unit: 'Baaldi',
      estimatedPrice: 38,
      currentStock: 70,
      minimumStock: 20,
      description: 'Rinji gudaha ee derbiyada.'
    },
    {
      name: 'Tiles Ceramic 40x40 (sanduuq)',
      unit: 'Sanduuq',
      estimatedPrice: 16,
      currentStock: 200,
      minimumStock: 50,
      description: 'Tiles dabaqa iyo musqulaha.'
    },
    {
      name: 'Putty Wall (25kg)',
      unit: 'Kiish',
      estimatedPrice: 12,
      currentStock: 90,
      minimumStock: 25,
      description: 'Putty diyaarinta derbiga kahor rinji.'
    }
  ],
  'Albaabo, Daaqado iyo Qalab': [
    {
      name: 'Albaab Bir Security (90x210)',
      unit: 'Xabbo',
      estimatedPrice: 160,
      currentStock: 25,
      minimumStock: 8,
      description: 'Albaab ammaan oo bir ah oo albaabada ugu muhiimsan.'
    },
    {
      name: 'Daaqad Aluminium 120x120',
      unit: 'Xabbo',
      estimatedPrice: 85,
      currentStock: 40,
      minimumStock: 12,
      description: 'Daaqad aluminium oo glass leh.'
    },
    {
      name: 'Quful Cylinder + Fure',
      unit: 'Xabbo',
      estimatedPrice: 12,
      currentStock: 80,
      minimumStock: 25,
      description: 'Quful caadi ah oo albaabada gudaha/dibadda.'
    }
  ]
};

const SUPPLIERS = [
  {
    name: 'Axmed Cabdi Xasan',
    company: 'Hormuud Dhismo Supplies',
    phone: '+252 61 700 1100',
    email: 'hormuud.supplies@example.com',
    address: 'Industrial Road, Muqdisho, Banadir',
    paymentTerms: 'Net 15 maalmood (USD)',
    performanceRating: 5
  },
  {
    name: 'Faadumo Cali Warsame',
    company: 'Bakaarah Building Materials',
    phone: '+252 61 555 2200',
    email: 'bakaarah.materials@example.com',
    address: 'Suuqa Bakaaraha, Muqdisho',
    paymentTerms: 'Lacag caddaan / Net 7',
    performanceRating: 4
  },
  {
    name: 'Maxamed Yuusuf Guuleed',
    company: 'Banadir Steel & Cement',
    phone: '+252 61 333 4400',
    email: 'banadir.steel@example.com',
    address: 'KM4 / Maka Al-Mukarama, Muqdisho',
    paymentTerms: 'Net 30 maalmood (USD)',
    performanceRating: 5
  }
];

/** Budgets in USD — typical mid-size Mogadishu builds. */
const PROJECTS = [
  {
    name: 'Dhismaha Xarunta Caafimaadka Wadajir',
    location: 'Wadajir, Muqdisho, Banadir',
    budget: 185000,
    status: 'Active'
  },
  {
    name: 'Dayactirka Dugsiyada Hargeisa Phase-1',
    location: 'Hargeisa, Maroodi Jeex',
    budget: 92000,
    status: 'Active'
  },
  {
    name: 'Guryaha Shaqaalaha Garowe (12 Unug)',
    location: 'Garowe, Nugaal',
    budget: 240000,
    status: 'Pending'
  },
  {
    name: 'Ballaarinta Suuqa Xamar Weyne',
    location: 'Xamar Weyne, Muqdisho',
    budget: 150000,
    status: 'Active'
  },
  {
    name: 'Mashruuca Biyaha Beledweyne',
    location: 'Beledweyne, Hiiraan',
    budget: 78000,
    status: 'On Hold'
  }
];

async function upsertCategory(def) {
  let cat = await Category.findOne({ name: def.name });
  if (cat) {
    cat.description = def.description;
    await cat.save();
    return { cat, created: false };
  }
  cat = await Category.create(def);
  return { cat, created: true };
}

async function upsertSupplier(def, categoryIds) {
  let supplier = await Supplier.findOne({ email: def.email.toLowerCase() });
  const payload = { ...def, email: def.email.toLowerCase(), suppliedCategories: categoryIds };
  if (supplier) {
    Object.assign(supplier, payload);
    await supplier.save();
    return { supplier, created: false };
  }
  supplier = await Supplier.create(payload);
  return { supplier, created: true };
}

async function upsertMaterial(def, categoryId, supplierId) {
  let material = await Material.findOne({ name: def.name });
  const payload = {
    ...def,
    category: categoryId,
    status: 'Active',
    ...(supplierId ? { supplier: supplierId, suppliers: [supplierId] } : {})
  };
  if (material) {
    Object.assign(material, payload);
    await material.save();
    return { created: false };
  }
  await Material.create(payload);
  return { created: true };
}

async function upsertProject(def, managerId) {
  let project = await Project.findOne({ name: def.name });
  const payload = { ...def, manager: managerId };
  if (project) {
    Object.assign(project, payload);
    await project.save();
    return { created: false };
  }
  await Project.create(payload);
  return { created: true };
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing in server/.env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.\n');

  const manager =
    (await User.findOne({ role: 'Project Manager', status: 'Active' })) ||
    (await User.findOne({ role: 'Administrator', status: 'Active' }));

  if (!manager) {
    console.error('No Project Manager / Administrator user found. Create users first.');
    process.exit(1);
  }
  console.log(`Project manager link: ${manager.name} (${manager.role})\n`);

  const categoryMap = {};
  let catCreated = 0;
  let catUpdated = 0;

  console.log('--- Qaybaha (Categories) ---');
  for (const def of CATEGORIES) {
    const { cat, created } = await upsertCategory(def);
    categoryMap[def.name] = cat._id;
    if (created) {
      catCreated += 1;
      console.log(`  + ${cat.name}`);
    } else {
      catUpdated += 1;
      console.log(`  ~ ${cat.name}`);
    }
  }

  const allCatIds = Object.values(categoryMap);
  const supplierIds = [];
  let supCreated = 0;
  let supUpdated = 0;

  console.log('\n--- Suppliers ---');
  for (const def of SUPPLIERS) {
    const { supplier, created } = await upsertSupplier(def, allCatIds);
    supplierIds.push(supplier._id);
    if (created) {
      supCreated += 1;
      console.log(`  + ${supplier.company}`);
    } else {
      supUpdated += 1;
      console.log(`  ~ ${supplier.company}`);
    }
  }

  let matCreated = 0;
  let matUpdated = 0;
  let supplierIdx = 0;

  console.log('\n--- Alaabta (Materials) + qiimo USD ---');
  for (const [catName, mats] of Object.entries(MATERIALS_BY_CATEGORY)) {
    const categoryId = categoryMap[catName];
    if (!categoryId) continue;
    for (const def of mats) {
      const supplierId = supplierIds[supplierIdx % supplierIds.length];
      supplierIdx += 1;
      const { created } = await upsertMaterial(def, categoryId, supplierId);
      const line = `$${def.estimatedPrice} / ${def.unit}`;
      if (created) {
        matCreated += 1;
        console.log(`  + ${def.name} — ${line}`);
      } else {
        matUpdated += 1;
        console.log(`  ~ ${def.name} — ${line}`);
      }
    }
  }

  let projCreated = 0;
  let projUpdated = 0;

  console.log('\n--- Mashruucyada (Projects) ---');
  for (const def of PROJECTS) {
    const { created } = await upsertProject(def, manager._id);
    if (created) {
      projCreated += 1;
      console.log(`  + ${def.name} — miisaaniyad $${def.budget.toLocaleString()} — ${def.location}`);
    } else {
      projUpdated += 1;
      console.log(`  ~ ${def.name} — miisaaniyad $${def.budget.toLocaleString()}`);
    }
  }

  console.log('\n========== Dhammaatay ==========');
  console.log(`Categories: ${catCreated} cusub, ${catUpdated} la cusboonaysiiyay`);
  console.log(`Suppliers:  ${supCreated} cusub, ${supUpdated} la cusboonaysiiyay`);
  console.log(`Materials:  ${matCreated} cusub, ${matUpdated} la cusboonaysiiyay`);
  console.log(`Projects:   ${projCreated} cusub, ${projUpdated} la cusboonaysiiyay`);
  console.log('\nQiimaha waa USD (suuqa Muqdisho). Requests / PO / Payments adiga ayaa geli doonta.');
  console.log('Users lama taaban.\n');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('Seed failed:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
