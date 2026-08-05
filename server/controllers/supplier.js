const Supplier = require('../models/Supplier');
const User = require('../models/User');
const logActivity = require('../utils/audit');

// @desc    Get all suppliers
// @route   GET /api/suppliers
// @access  Private
exports.getSuppliers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, category } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.suppliedCategories = category;
    }

    const count = await Supplier.countDocuments(query);
    const suppliers = await Supplier.find(query)
      .populate('suppliedCategories', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      suppliers,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalSuppliers: count
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single supplier
// @route   GET /api/suppliers/:id
// @access  Private
exports.getSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id).populate('suppliedCategories', 'name');
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }
    res.status(200).json({ success: true, supplier });
  } catch (error) {
    next(error);
  }
};

// @desc    Create supplier (+ login User account)
// @route   POST /api/suppliers
// @access  Private/Admin
exports.createSupplier = async (req, res, next) => {
  try {
    const {
      name,
      company,
      phone,
      email,
      address,
      paymentTerms,
      suppliedCategories,
      performanceRating,
      password
    } = req.body;

    if (!password || String(password).length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password is required and must be at least 6 characters'
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'A user with this email already exists'
      });
    }

    const existingSupplier = await Supplier.findOne({ email: normalizedEmail });
    if (existingSupplier) {
      return res.status(400).json({
        success: false,
        error: 'A supplier with this email already exists'
      });
    }

    const supplier = await Supplier.create({
      name,
      company,
      phone,
      email: normalizedEmail,
      address,
      paymentTerms,
      suppliedCategories,
      performanceRating
    });

    // Create login account so supplier appears under Users and can sign in
    await User.create({
      name,
      email: normalizedEmail,
      password,
      role: 'Supplier',
      status: 'Active'
    });

    await logActivity(
      req,
      req.user,
      'Create Supplier',
      `Supplier ${name} of ${company} created with login account`
    );

    res.status(201).json({ success: true, supplier });
  } catch (error) {
    next(error);
  }
};

// @desc    Update supplier
// @route   PUT /api/suppliers/:id
// @access  Private/Admin
exports.updateSupplier = async (req, res, next) => {
  try {
    let supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    const previousEmail = supplier.email;

    const {
      name,
      company,
      phone,
      email,
      address,
      paymentTerms,
      suppliedCategories,
      performanceRating
    } = req.body;

    supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      {
        name,
        company,
        phone,
        email,
        address,
        paymentTerms,
        suppliedCategories,
        performanceRating
      },
      {
        new: true,
        runValidators: true
      }
    );

    // Keep linked Supplier user account name/email in sync when possible
    const linkedUser = await User.findOne({
      email: previousEmail,
      role: 'Supplier'
    });
    if (linkedUser) {
      await User.findByIdAndUpdate(linkedUser._id, {
        name: name || linkedUser.name,
        ...(email ? { email: String(email).toLowerCase().trim() } : {})
      });
    }

    await logActivity(req, req.user, 'Update Supplier', `Supplier ${supplier.name} updated`);

    res.status(200).json({ success: true, supplier });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete supplier
// @route   DELETE /api/suppliers/:id
// @access  Private/Admin
exports.deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    await Supplier.findByIdAndDelete(req.params.id);

    await logActivity(req, req.user, 'Delete Supplier', `Supplier ${supplier.name} deleted`);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
