const express = require('express');
const { body } = require('express-validator');
const { getSuppliers, getSupplier, getMySupplier, updateMySupplier, createSupplier, updateSupplier, deleteSupplier } = require('../controllers/supplier');
const { protect, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');

const router = express.Router();

router.use(protect); // All routes require authentication

const supplierValidation = [
  body('name', 'Supplier name is required').notEmpty().trim(),
  body('company', 'Company is required').notEmpty().trim(),
  body('phone', 'Phone is required').notEmpty().trim(),
  body('email', 'Please provide a valid email').isEmail().normalizeEmail(),
  body('address', 'Address is required').notEmpty().trim(),
  body('paymentTerms', 'Payment terms are required').notEmpty().trim(),
  body('suppliedCategories', 'Supplied categories array is required').isArray(),
  body('performanceRating', 'Performance rating must be between 1 and 5').optional().isInt({ min: 1, max: 5 }),
  validate
];

const mySupplierValidation = [
  body('name', 'Supplier name is required').notEmpty().trim(),
  body('company', 'Company is required').notEmpty().trim(),
  body('phone', 'Phone is required').notEmpty().trim(),
  body('email', 'Please provide a valid email').isEmail().normalizeEmail(),
  body('address', 'Address is required').notEmpty().trim(),
  body('paymentTerms', 'Payment terms are required').notEmpty().trim(),
  validate
];

const createSupplierValidation = [
  body('name', 'Supplier name is required').notEmpty().trim(),
  body('company', 'Company is required').notEmpty().trim(),
  body('phone', 'Phone is required').notEmpty().trim(),
  body('email', 'Please provide a valid email').isEmail().normalizeEmail(),
  body('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  body('address', 'Address is required').notEmpty().trim(),
  body('paymentTerms', 'Payment terms are required').notEmpty().trim(),
  body('suppliedCategories', 'Supplied categories array is required').isArray(),
  body('performanceRating', 'Performance rating must be between 1 and 5').optional().isInt({ min: 1, max: 5 }),
  validate
];

router.route('/')
  .get(getSuppliers)
  .post(authorize('Administrator', 'Procurement Officer'), createSupplierValidation, createSupplier);

router
  .route('/me')
  .get(authorize('Administrator', 'Supplier'), getMySupplier)
  .put(authorize('Administrator', 'Supplier'), mySupplierValidation, updateMySupplier);

router.route('/:id')
  .get(getSupplier)
  .put(authorize('Administrator', 'Procurement Officer'), supplierValidation, updateSupplier)
  .delete(authorize('Administrator', 'Procurement Officer'), deleteSupplier);

module.exports = router;
