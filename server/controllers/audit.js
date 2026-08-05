const AuditLog = require('../models/AuditLog');

// @desc    Get all audit logs
// @route   GET /api/audit
// @access  Private/Admin
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, search, action, role } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } }
      ];
    }

    if (action) query.action = action;
    if (role) query.role = role;

    const count = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('user', 'name email role')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      logs,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalLogs: count
    });
  } catch (error) {
    next(error);
  }
};
