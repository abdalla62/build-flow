const express = require('express');
const { body } = require('express-validator');
const {
  getInventoryLedger,
  getMaterialStockAlerts,
  postManualStockAdjustment,
  getProjectStock,
  rebuildProjectStock,
  recordSiteUsage
} = require('../controllers/inventory');
const { protect, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');

const router = express.Router();

router.use(protect);

const adjustmentValidation = [
  body('material', 'Material ID is required').isMongoId(),
  body('project', 'Project ID is optional but must be valid').optional().isMongoId(),
  body('quantity', 'Quantity must be at least 1').isInt({ min: 1 }),
  body('type', 'Adjustment type must be Stock In or Stock Out').isIn(['Stock In', 'Stock Out']),
  body('comments', 'Remarks are required').optional().notEmpty().trim(),
  validate
];

const siteUsageValidation = [
  body('project', 'Project ID is required').isMongoId(),
  body('material', 'Material ID is required').isMongoId(),
  body('quantity', 'Quantity must be at least 1').isInt({ min: 1 }),
  body('notes').optional().isString().trim().isLength({ max: 500 }),
  validate
];

router.get('/', getInventoryLedger);
router.get('/alerts', getMaterialStockAlerts);
router.get('/project-stock', getProjectStock);
router.post('/site-usage', siteUsageValidation, recordSiteUsage);
router.post('/rebuild-project-stock', authorize('Administrator'), rebuildProjectStock);
router.post('/adjust', authorize('Administrator'), adjustmentValidation, postManualStockAdjustment);

module.exports = router;
