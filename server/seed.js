const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Role = require('./models/Role');
const Project = require('./models/Project');
const Category = require('./models/Category');
const Supplier = require('./models/Supplier');
const Material = require('./models/Material');
const MaterialRequest = require('./models/MaterialRequest');
const PurchaseOrder = require('./models/PurchaseOrder');
const Quotation = require('./models/Quotation');
const Payment = require('./models/Payment');

const seed = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected.');

    // 1. Ensure Roles are seeded
    const rolesCount = await Role.countDocuments();
    if (rolesCount === 0) {
      console.log('Seeding default roles...');
      const defaultRoles = [
        { name: 'Administrator', description: 'System Administrator' },
        { name: 'Procurement Officer', description: 'Procurement manager' },
        { name: 'Project Manager', description: 'Project manager' },
        { name: 'Site Engineer', description: 'Site engineer' },
        { name: 'Supplier', description: 'Material supplier' },
        { name: 'Accountant', description: 'Accountant' },
        { name: 'Delivery Staff', description: 'Delivery staff' }
      ];
      await Role.insertMany(defaultRoles);
    }

    // 2. Find or create users
    console.log('Ensuring demo users exist...');
    
    // Find any Supplier user in the DB (like the user Abdiqani logged in)
    let supplierUser = await User.findOne({ role: 'Supplier' });
    if (!supplierUser) {
      console.log('Creating demo Supplier user...');
      supplierUser = await User.create({
        name: 'Demo Supplier',
        email: 'supplier@test.com',
        password: 'password123',
        role: 'Supplier',
        status: 'Active'
      });
    } else {
      console.log(`Found existing Supplier user: ${supplierUser.email}`);
    }

    let pmUser = await User.findOne({ role: 'Project Manager' });
    if (!pmUser) {
      console.log('Creating demo Project Manager user...');
      pmUser = await User.create({
        name: 'Jane PM',
        email: 'pm@test.com',
        password: 'password123',
        role: 'Project Manager',
        status: 'Active'
      });
    }

    let engineerUser = await User.findOne({ role: 'Site Engineer' });
    if (!engineerUser) {
      console.log('Creating demo Site Engineer user...');
      engineerUser = await User.create({
        name: 'Bob Engineer',
        email: 'engineer@test.com',
        password: 'password123',
        role: 'Site Engineer',
        status: 'Active'
      });
    }

    let accountantUser = await User.findOne({ role: 'Accountant' });
    if (!accountantUser) {
      console.log('Creating demo Accountant user...');
      accountantUser = await User.create({
        name: 'Alice Accountant',
        email: 'accountant@test.com',
        password: 'password123',
        role: 'Accountant',
        status: 'Active'
      });
    }

    // 3. Seed Categories
    console.log('Clearing old categories, suppliers, projects, and materials to prevent duplicates...');
    await Category.deleteMany({});
    await Supplier.deleteMany({});
    await Project.deleteMany({});
    await Material.deleteMany({});
    await MaterialRequest.deleteMany({});
    await PurchaseOrder.deleteMany({});
    await Quotation.deleteMany({});
    await Payment.deleteMany({});

    console.log('Seeding Somalia Categories...');
    const catCement = await Category.create({
      name: 'Cement & Binders',
      description: 'Sibidh iyo xirmooyinka — Portland cement bags and bonding agents used on Somali sites.'
    });
    const catSteel = await Category.create({
      name: 'Steel & Reinforcement',
      description: 'Birta dhismo — rebar and structural steel imported via Mogadishu / Bosaso.'
    });
    const catBlocks = await Category.create({
      name: 'Blocks & Masonry',
      description: 'Hollow/solid concrete blocks for Banadir walling works.'
    });
    const catRoofing = await Category.create({
      name: 'Roofing & Cladding',
      description: 'CGI sheets and roof fittings common across Somalia.'
    });
    const catElectrical = await Category.create({
      name: 'Electrical & Solar',
      description: 'Cables, breakers, LED lights, and solar accessories.'
    });

    // 4. Seed Supplier profiles (Mogadishu)
    console.log('Seeding Supplier profile for Supplier user...');
    const supplierProfile = await Supplier.create({
      name: supplierUser.name,
      company: 'Hormuud Construction Supplies',
      phone: '+252 61 234 5678',
      email: supplierUser.email,
      address: 'Industrial Road, Hamar Weyne, Mogadishu',
      paymentTerms: 'Net 30',
      suppliedCategories: [catCement._id, catSteel._id, catBlocks._id, catRoofing._id, catElectrical._id],
      performanceRating: 5
    });

    // 5. Seed Projects (Somalia)
    console.log('Seeding Projects...');
    const projectA = await Project.create({
      name: 'Hodan Residential Complex',
      location: 'Hodan District, Mogadishu',
      budget: 850000,
      manager: pmUser._id,
      status: 'Active'
    });

    // 6. Seed Materials (Somalia market reference USD)
    console.log('Seeding Materials...');
    const matCement = await Material.create({
      name: 'Portland Cement 42.5R (50kg bag)',
      category: catCement._id,
      unit: 'Bags',
      estimatedPrice: 8.5,
      currentStock: 400,
      minimumStock: 120,
      supplier: supplierProfile._id,
      suppliers: [supplierProfile._id],
      description: 'Standard OPC bag widely sold in Bakara / Industrial Road Mogadishu.'
    });

    const matRebar = await Material.create({
      name: 'Deformed Rebar 12mm',
      category: catSteel._id,
      unit: 'Tons',
      estimatedPrice: 820,
      currentStock: 5,
      minimumStock: 10, // Under stock trigger!
      supplier: supplierProfile._id,
      suppliers: [supplierProfile._id],
      description: 'Common column/beam bar size on Mogadishu mid-rise sites.'
    });

    await Material.create({
      name: 'Hollow Concrete Block 6 inch',
      category: catBlocks._id,
      unit: 'Pcs',
      estimatedPrice: 0.55,
      currentStock: 5000,
      minimumStock: 1500,
      supplier: supplierProfile._id,
      suppliers: [supplierProfile._id],
      description: 'Most used walling unit in Banadir housing projects.'
    });

    await Material.create({
      name: 'CGI Roofing Sheet Gauge 28 (2m)',
      category: catRoofing._id,
      unit: 'Sheets',
      estimatedPrice: 14,
      currentStock: 350,
      minimumStock: 100,
      supplier: supplierProfile._id,
      suppliers: [supplierProfile._id],
      description: 'Corrugated iron sheet — standard residential roofing.'
    });

    // 7. Seed Approved Material Request (Site Engineer submitted & PM approved)
    console.log('Seeding Approved request for Supplier bidding...');
    const approvedRequest = await MaterialRequest.create({
      project: projectA._id,
      requestedBy: engineerUser._id,
      material: matCement._id,
      quantity: 500, // 500 Bags of cement
      priority: 'High',
      reason: 'Slab pouring on floor 3',
      requiredDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      status: 'Approved'
    });

    // 8. Seed Pending Purchase Order
    console.log('Seeding an active Purchase Order assigned to Supplier...');
    const orderedRequest = await MaterialRequest.create({
      project: projectA._id,
      requestedBy: engineerUser._id,
      material: matRebar._id,
      quantity: 15, // 15 Tons of steel
      priority: 'Urgent',
      reason: 'Reinforcement for main pillars',
      requiredDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: 'Ordered'
    });

    const po = await PurchaseOrder.create({
      supplier: supplierProfile._id,
      materialRequest: orderedRequest._id,
      items: [{
        material: matRebar._id,
        quantity: 15,
        unitPrice: 650.00
      }],
      tax: 487.50, // 5% tax
      grandTotal: 10237.50, // (15 * 650) + 487.50
      status: 'Pending',
      paymentStatus: 'Unpaid'
    });

    console.log('All mock data seeded successfully!');
    console.log('\n--- DEMO ACCOUNTS CREATED ---');
    console.log(`Supplier Account (Current User): ${supplierUser.email} / Password: password123`);
    console.log(`Site Engineer Account: ${engineerUser.email} / Password: password123`);
    console.log(`Project Manager Account: ${pmUser.email} / Password: password123`);
    console.log(`Accountant Account: ${accountantUser.email} / Password: password123`);
    console.log('-----------------------------\n');

    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seed();
