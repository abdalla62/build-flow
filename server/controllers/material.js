const Material = require('../models/Material');
const logActivity = require('../utils/audit');

// @desc    Get all materials (paginated + search + filters)
// @route   GET /api/materials
// @access  Private
exports.getMaterials = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, category, supplier, status, lowStock } = req.query;
    const query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (category) {
      query.category = category;
    }

    if (supplier) {
      query.$or = [{ supplier }, { suppliers: supplier }];
    }

    if (status) {
      query.status = status;
    }

    if (lowStock === 'true') {
      // Current stock is less than or equal to minimum stock limit
      query.$expr = { $lte: ['$currentStock', '$minimumStock'] };
    }

    const count = await Material.countDocuments(query);
    const materials = await Material.find(query)
      .populate('category', 'name')
      .populate('supplier', 'name company')
      .populate('suppliers', 'name company')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      materials,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalMaterials: count
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single material
// @route   GET /api/materials/:id
// @access  Private
exports.getMaterial = async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id)
      .populate('category', 'name')
      .populate('supplier', 'name company')
      .populate('suppliers', 'name company');
    if (!material) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }
    res.status(200).json({ success: true, material });
  } catch (error) {
    next(error);
  }
};

// @desc    Create material
// @route   POST /api/materials
// @access  Private/Admin
exports.createMaterial = async (req, res, next) => {
  try {
    const {
      name,
      category,
      unit,
      estimatedPrice,
      currentStock,
      minimumStock,
      supplier,
      suppliers,
      description,
      image,
      status
    } = req.body;

    const supplierIds = Array.isArray(suppliers) && suppliers.length > 0
      ? suppliers
      : supplier
        ? [supplier]
        : [];

    if (supplierIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Select at least one primary supplier'
      });
    }

    const imagePath = req.file
      ? `/uploads/materials/${req.file.filename}`
      : (typeof image === 'string' && image.startsWith('/uploads/') ? image : '');

    const material = await Material.create({
      name,
      category,
      unit,
      estimatedPrice,
      currentStock,
      minimumStock,
      suppliers: supplierIds,
      supplier: supplierIds[0],
      description,
      image: imagePath,
      status
    });

    await logActivity(req, req.user, 'Create Material', `Material ${name} created. Est Price: $${estimatedPrice}`);

    res.status(201).json({ success: true, material });
  } catch (error) {
    next(error);
  }
};

// @desc    Update material
// @route   PUT /api/materials/:id
// @access  Private/Admin
exports.updateMaterial = async (req, res, next) => {
  try {
    let material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }

    const {
      name,
      category,
      unit,
      estimatedPrice,
      currentStock,
      minimumStock,
      supplier,
      suppliers,
      description,
      image,
      status
    } = req.body;

    const supplierIds = Array.isArray(suppliers) && suppliers.length > 0
      ? suppliers
      : supplier
        ? [supplier]
        : [];

    if (supplierIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Select at least one primary supplier'
      });
    }

    const updatePayload = {
      name,
      category,
      unit,
      estimatedPrice,
      currentStock,
      minimumStock,
      suppliers: supplierIds,
      supplier: supplierIds[0],
      description,
      status
    };

    if (req.file) {
      updatePayload.image = `/uploads/materials/${req.file.filename}`;
    } else if (image === '' || image === 'null') {
      updatePayload.image = '';
    } else if (typeof image === 'string' && image.startsWith('/uploads/')) {
      updatePayload.image = image;
    }

    material = await Material.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true
    });

    await logActivity(req, req.user, 'Update Material', `Material ${material.name} updated`);

    res.status(200).json({ success: true, material });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete material
// @route   DELETE /api/materials/:id
// @access  Private/Admin
exports.deleteMaterial = async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }

    await Material.findByIdAndDelete(req.params.id);

    await logActivity(req, req.user, 'Delete Material', `Material ${material.name} deleted`);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
