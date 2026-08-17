const express = require('express');
const {
  getReportStats,
  getSupplierReportStats,
  getPMReportStats,
  getAccountantReportStats,
  getReportSchedule,
  updateReportSchedule,
  sendReportEmailNow
} = require('../controllers/report');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.get(
  '/supplier',
  authorize('Administrator', 'Supplier'),
  getSupplierReportStats
);

router.get(
  '/pm',
  authorize('Administrator', 'Project Manager'),
  getPMReportStats
);

router.get(
  '/accountant',
  authorize('Administrator', 'Accountant'),
  getAccountantReportStats
);

router.get(
  '/',
  authorize('Administrator', 'Procurement Officer'),
  getReportStats
);

router.get('/schedule', authorize('Administrator'), getReportSchedule);
router.put('/schedule', authorize('Administrator'), updateReportSchedule);
router.post('/email-now', authorize('Administrator'), sendReportEmailNow);

module.exports = router;
