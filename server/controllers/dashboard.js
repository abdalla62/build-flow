const User = require('../models/User');
const Project = require('../models/Project');
const Material = require('../models/Material');
const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const Delivery = require('../models/Delivery');
const Payment = require('../models/Payment');
const MaterialRequest = require('../models/MaterialRequest');
const Quotation = require('../models/Quotation');
const AuditLog = require('../models/AuditLog');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PIE_COLORS = ['#0F766E', '#14B8A6', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444', '#64748B'];

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// @desc    Administrator dashboard totals + real charts/events
// @route   GET /api/dashboard/admin
// @access  Private/Administrator
exports.getAdminDashboard = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalProjects,
      totalMaterials,
      totalSuppliers,
      totalPurchaseOrders,
      totalDeliveries,
      totalPayments,
      spendTrendsRaw,
      categorySpendRaw,
      recentLogs
    ] = await Promise.all([
      User.countDocuments(),
      Project.countDocuments(),
      Material.countDocuments(),
      Supplier.countDocuments(),
      PurchaseOrder.countDocuments(),
      Delivery.countDocuments(),
      Payment.countDocuments(),
      PurchaseOrder.aggregate([
        { $match: { status: { $nin: ['Rejected', 'Cancelled'] } } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            expenditure: { $sum: '$grandTotal' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 }
      ]),
      PurchaseOrder.aggregate([
        { $match: { status: { $nin: ['Rejected', 'Cancelled'] } } },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'materials',
            localField: 'items.material',
            foreignField: '_id',
            as: 'mat'
          }
        },
        { $unwind: { path: '$mat', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'categories',
            localField: 'mat.category',
            foreignField: '_id',
            as: 'cat'
          }
        },
        { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$cat.name', 'Uncategorized'] },
            value: {
              $sum: {
                $multiply: [
                  { $ifNull: ['$items.quantity', 0] },
                  { $ifNull: ['$items.unitPrice', 0] }
                ]
              }
            }
          }
        },
        { $sort: { value: -1 } },
        { $limit: 6 }
      ]),
      AuditLog.find().sort({ createdAt: -1 }).limit(10).select('action details role userName createdAt')
    ]);

    const spendTrends = spendTrendsRaw.map((item) => ({
      month: `${MONTHS[item._id.month - 1] || '?'} ${item._id.year}`,
      expenditure: Number(item.expenditure.toFixed(2)),
      deliveries: item.count
    }));

    const categoryData = categorySpendRaw.map((item, idx) => ({
      name: item._id,
      value: Number(Number(item.value).toFixed(2)),
      color: PIE_COLORS[idx % PIE_COLORS.length]
    }));

    const totalCategorySpend = categoryData.reduce((s, c) => s + c.value, 0);

    const recentEvents = recentLogs.map((log) => ({
      title: log.action,
      detail: log.details || `${log.userName} (${log.role})`,
      role: log.role,
      initials: (log.role || 'SY')
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      when: timeAgo(log.createdAt)
    }));

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalProjects,
        totalMaterials,
        totalSuppliers,
        totalPurchaseOrders,
        totalDeliveries,
        totalPayments
      },
      spendTrends,
      categoryData,
      totalCategorySpend: Number(totalCategorySpend.toFixed(2)),
      recentEvents
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Site Engineer dashboard (own requests)
// @route   GET /api/dashboard/site-engineer
// @access  Private/Site Engineer
exports.getSiteEngineerDashboard = async (req, res, next) => {
  try {
    const mine = { requestedBy: req.user.id };

    const [myRequests, pendingRequests, approvedRequests, deliveredMaterials] = await Promise.all([
      MaterialRequest.countDocuments(mine),
      MaterialRequest.countDocuments({ ...mine, status: 'Pending' }),
      MaterialRequest.countDocuments({ ...mine, status: 'Approved' }),
      MaterialRequest.countDocuments({ ...mine, status: 'Delivered' })
    ]);

    res.status(200).json({
      success: true,
      stats: {
        myRequests,
        pendingRequests,
        approvedRequests,
        deliveredMaterials
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Project Manager dashboard (managed projects' requests)
// @route   GET /api/dashboard/project-manager
// @access  Private/Project Manager
exports.getProjectManagerDashboard = async (req, res, next) => {
  try {
    const projects = await Project.find({ manager: req.user.id }).select('_id');
    const projectIds = projects.map((p) => p._id);
    const inProjects = { project: { $in: projectIds } };

    const [pendingRequests, approvedRequests, rejectedRequests, pendingForBudget] = await Promise.all([
      MaterialRequest.countDocuments({ ...inProjects, status: 'Pending' }),
      MaterialRequest.countDocuments({ ...inProjects, status: 'Approved' }),
      MaterialRequest.countDocuments({ ...inProjects, status: 'Rejected' }),
      MaterialRequest.find({ ...inProjects, status: 'Pending' }).populate('material', 'estimatedPrice')
    ]);

    const budgetRequests = pendingForBudget.reduce((sum, r) => {
      const price = r.material?.estimatedPrice || 0;
      return sum + Number(r.quantity || 0) * Number(price);
    }, 0);

    res.status(200).json({
      success: true,
      stats: {
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        budgetRequests: Number(budgetRequests.toFixed(2))
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Procurement Officer dashboard
// @route   GET /api/dashboard/procurement
// @access  Private/Procurement Officer
exports.getProcurementDashboard = async (req, res, next) => {
  try {
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const [approvedRequests, activeQuotations, draftPOs, deliveriesScheduled] = await Promise.all([
      MaterialRequest.countDocuments({ status: 'Approved' }),
      Quotation.countDocuments({ status: 'Pending' }),
      PurchaseOrder.countDocuments({ status: 'Pending' }),
      Delivery.countDocuments({
        status: 'Scheduled',
        deliveryDate: { $gte: startOfWeek, $lt: endOfWeek }
      })
    ]);

    res.status(200).json({
      success: true,
      stats: {
        approvedRequests,
        activeQuotations,
        draftPOs,
        deliveriesScheduled
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delivery Staff dashboard (own assigned routes)
// @route   GET /api/dashboard/delivery-staff
// @access  Private/Delivery Staff
exports.getDeliveryStaffDashboard = async (req, res, next) => {
  try {
    const mine = { driver: req.user.id };
    const activeStatuses = ['Scheduled', 'Preparing', 'Dispatched', 'In Transit'];

    const [assignedShipments, completedDeliveries, delayedShipments, nextActive] =
      await Promise.all([
        Delivery.countDocuments({ ...mine, status: { $in: activeStatuses } }),
        Delivery.countDocuments({ ...mine, status: 'Delivered' }),
        Delivery.countDocuments({ ...mine, status: 'Delayed' }),
        Delivery.findOne({
          ...mine,
          status: { $in: activeStatuses }
        })
          .sort({ deliveryDate: 1 })
          .populate({
            path: 'purchaseOrder',
            populate: {
              path: 'materialRequest',
              populate: { path: 'project', select: 'name location' }
            }
          })
      ]);

    let activeRoute = 'No active route';
    if (nextActive) {
      const project =
        nextActive.purchaseOrder?.materialRequest?.project?.name ||
        nextActive.deliveryAddress ||
        null;
      activeRoute = project || 'Assigned route';
    }

    res.status(200).json({
      success: true,
      stats: {
        assignedShipments,
        completedDeliveries,
        delayedShipments,
        activeRoute
      }
    });
  } catch (error) {
    next(error);
  }
};
