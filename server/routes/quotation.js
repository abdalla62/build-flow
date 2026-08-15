const express = require('express');
const { body } = require('express-validator');
const { submitQuotation, submitQuotationBatch, updateQuotationBatch, getQuotations, selectQuotation } = require('../controllers/quotation');
const { protect, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');

const router = express.Router();

router.use(protect); // All routes require authentication

const batchBidValidation = [
  body('materialRequest', 'Material request ID is required').optional().isMongoId(),
  body('items', 'Add a unit price for each material').isArray({ min: 1 }),
  body('items.*.materialRequest', 'Material request ID is required').isMongoId(),
  body('items.*.unitPrice', 'Offer unit price must be positive').isFloat({ min: 0 }),
  body('deliveryCost', 'Delivery cost must be positive').isFloat({ min: 0 }),
  body('deliveryTimeDays', 'Delivery time in days must be at least 1').isInt({ min: 1 }),
  body('warrantyMonths', 'Warranty must be positive').optional().isInt({ min: 0 }),
  body('paymentTerms', 'Payment terms specification is required').notEmpty().trim(),
  validate
];

const bidValidation = [
  body('materialRequest', 'Material request ID is required').isMongoId(),
  body('unitPrice', 'Offer unit price must be positive').isFloat({ min: 0 }),
  body('deliveryCost', 'Delivery cost must be positive').isFloat({ min: 0 }),
  body('deliveryTimeDays', 'Delivery time in days must be at least 1').isInt({ min: 1 }),
  body('warrantyMonths', 'Warranty must be positive').optional().isInt({ min: 0 }),
  body('paymentTerms', 'Payment terms specification is required').notEmpty().trim(),
  validate
];

router.route('/')
  .get(getQuotations)
  .post(authorize('Administrator', 'Supplier'), bidValidation, submitQuotation);

router.post(
  '/batch',
  authorize('Administrator', 'Supplier'),
  batchBidValidation,
  submitQuotationBatch
);

router.put(
  '/batch',
  authorize('Administrator', 'Supplier'),
  batchBidValidation,
  updateQuotationBatch
);

router.put('/:id/select', authorize('Administrator', 'Procurement Officer'), selectQuotation);

module.exports = router;
