const express = require('express');
const { getReportStats, getSupplierReportStats } = require('../controllers/report');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.get(
  '/supplier',
  authorize('Administrator', 'Supplier'),
  getSupplierReportStats
);

router.get(
  '/',
  authorize('Administrator', 'Procurement Officer'),
  getReportStats
);

module.exports = router;
