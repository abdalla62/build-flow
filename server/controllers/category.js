const Category = require('../models/Category');
const logActivity = require('../utils/audit');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Private
exports.getCategories = async (req, res, next) => {
  try {
    const { page = 1, limit = 100, search } = req.query; // Larger limit for category selects
    const query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const count = await Category.countDocuments(query);
    const categories = await Category.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      categories,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalCategories: count
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Private
exports.getCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    res.status(200).json({ success: true, category });
  } catch (error) {
    next(error);
  }
};

// @desc    Create category
// @route   POST /api/categories
// @access  Private/Admin
exports.createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    const exists = await Category.findOne({ name });
    if (exists) {
      return res.status(400).json({ success: false, error: 'Category already exists' });
    }

    const category = await Category.create({ name, description });

    await logActivity(req, req.user, 'Create Category', `Category ${name} created`);

    res.status(201).json({ success: true, category });
  } catch (error) {
    next(error);
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private/Admin
exports.updateCategory = async (req, res, next) => {
  try {
    let category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    await logActivity(req, req.user, 'Update Category', `Category ${category.name} updated`);

    res.status(200).json({ success: true, category });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    await Category.findByIdAndDelete(req.params.id);

    await logActivity(req, req.user, 'Delete Category', `Category ${category.name} deleted`);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
