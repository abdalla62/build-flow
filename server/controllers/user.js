const User = require('../models/User');
const Role = require('../models/Role');
const logActivity = require('../utils/audit');

function normalizePlate(plate) {
  return String(plate || '').trim().toUpperCase();
}

async function findPlateOwner(plate, excludeUserId) {
  const normalized = normalizePlate(plate);
  if (!normalized) return null;

  const query = {
    vehiclePlateCode: { $exists: true, $nin: ['', null] }
  };
  if (excludeUserId) query._id = { $ne: excludeUserId };

  const owners = await User.find(query).select('name email vehiclePlateCode').lean();
  return owners.find((u) => normalizePlate(u.vehiclePlateCode) === normalized) || null;
}

function plateTakenError(owner, plate) {
  return `Vehicle Plate Code ${normalizePlate(plate)} waxaa hore u isticmaalaya ${owner.name}. Qof walba waa inuu lahaadaa plate gaar ah.`;
}

// @desc    Get all users (paginated + filters)
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, role } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) {
      query.role = role;
    }

    const [count, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select('-password -resetPasswordToken -resetPasswordExpire')
        .lean()
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 })
    ]);

    res.status(200).json({
      success: true,
      users,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalUsers: count
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle user status
// @route   PUT /api/users/:id/status
// @access  Private/Admin
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Prevent deactivating own account
    if (user._id.toString() === req.user._id.toString() && status === 'Inactive') {
      return res.status(400).json({ success: false, error: 'You cannot deactivate your own account' });
    }

    user.status = status;
    await user.save();

    await logActivity(req, req.user, 'Update User Status', `Changed user ${user.email} status to ${status}`);

    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user role
// @route   PUT /api/users/:id/role
// @access  Private/Admin
exports.updateUserRole = async (req, res, next) => {
  try {
    const { role, vehiclePlateCode } = req.body;

    const roleExists = await Role.findOne({ name: role });
    if (!roleExists) {
      return res.status(400).json({ success: false, error: 'Role does not exist in system' });
    }

    if (role === 'Delivery Staff') {
      if (!String(vehiclePlateCode || '').trim()) {
        return res.status(400).json({
          success: false,
          error: 'Vehicle Plate Code is required for Delivery Staff'
        });
      }
      const plateOwner = await findPlateOwner(vehiclePlateCode, req.params.id);
      if (plateOwner) {
        return res.status(400).json({
          success: false,
          error: plateTakenError(plateOwner, vehiclePlateCode)
        });
      }
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Prevent changing own role
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'You cannot change your own role' });
    }

    const oldRole = user.role;
    user.role = role;
    if (role === 'Delivery Staff') {
      user.vehiclePlateCode = normalizePlate(vehiclePlateCode);
      user.vehicleType = '';
      user.vehicleModel = '';
    } else {
      user.vehiclePlateCode = '';
      user.vehicleType = '';
      user.vehicleModel = '';
    }
    await user.save();

    await logActivity(req, req.user, 'Update User Role', `Changed user ${user.email} role from ${oldRole} to ${role}`);

    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all system roles
// @route   GET /api/users/roles
// @access  Private
exports.getRoles = async (req, res, next) => {
  try {
    const roles = await Role.find({});
    res.status(200).json({ success: true, roles });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a user
// @route   POST /api/users
// @access  Private/Admin
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, status, vehiclePlateCode } = req.body;

    if (role === 'Delivery Staff') {
      if (!String(vehiclePlateCode || '').trim()) {
        return res.status(400).json({
          success: false,
          error: 'Vehicle Plate Code is required for Delivery Staff'
        });
      }
      const plateOwner = await findPlateOwner(vehiclePlateCode);
      if (plateOwner) {
        return res.status(400).json({
          success: false,
          error: plateTakenError(plateOwner, vehiclePlateCode)
        });
      }
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ success: false, error: 'Email address already registered' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      status: status || 'Active',
      vehiclePlateCode: role === 'Delivery Staff' ? normalizePlate(vehiclePlateCode) : '',
      vehicleType: '',
      vehicleModel: ''
    });

    // If role is Supplier, ensure a Supplier directory profile exists for Quotes & Bids
    if (role === 'Supplier') {
      const { resolveSupplierProfile } = require('../utils/supplierLink');
      await resolveSupplierProfile(user);
    }

    await logActivity(req, req.user, 'Create User', `Created user account for ${email} with role ${role}`);

    user.password = undefined;
    res.status(201).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'You cannot delete your own account' });
    }

    await User.findByIdAndDelete(req.params.id);
    await logActivity(req, req.user, 'Delete User', `Deleted user account for ${user.email}`);

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};
