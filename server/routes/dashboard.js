const express = require('express');
const {
  getAdminDashboard,
  getSiteEngineerDashboard,
  getProjectManagerDashboard,
  getProcurementDashboard,
  getDeliveryStaffDashboard
} = require('../controllers/dashboard');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.get('/admin', authorize('Administrator'), getAdminDashboard);
router.get('/site-engineer', authorize('Site Engineer'), getSiteEngineerDashboard);
router.get('/project-manager', authorize('Project Manager'), getProjectManagerDashboard);
router.get('/procurement', authorize('Procurement Officer'), getProcurementDashboard);
router.get('/delivery-staff', authorize('Delivery Staff'), getDeliveryStaffDashboard);

module.exports = router;
