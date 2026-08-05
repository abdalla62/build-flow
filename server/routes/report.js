const express = require('express');
const { getReportStats } = require('../controllers/report');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(protect); // All routes require authentication
router.use(authorize('Administrator', 'Procurement Officer')); // Restrict to admin / procurement officer

router.get('/', getReportStats);

module.exports = router;
