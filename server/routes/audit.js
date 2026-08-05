const express = require('express');
const { getAuditLogs } = require('../controllers/audit');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(protect); // All routes require authentication
router.use(authorize('Administrator')); // Admin only route

router.get('/', getAuditLogs);

module.exports = router;
