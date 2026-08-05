const express = require('express');
const { body } = require('express-validator');
const {
  getOrders,
  getOrder,
  updateOrder,
  deleteOrder,
  updateOrderStatus,
  uploadPOInvoice,
  generatePOInvoice
} = require('../controllers/order');
const { protect, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const { uploadInvoiceFile } = require('../middlewares/upload');

const router = express.Router();

router.use(protect); // All routes require authentication

const statusValidation = [
  body('status', 'Invalid purchase order status').isIn(['Accepted', 'Rejected', 'Preparing', 'Dispatched']),
  validate
];

const updateOrderValidation = [
  body('quantity', 'Quantity must be at least 1').optional().isInt({ min: 1 }),
  body('unitPrice', 'Unit price must be positive').optional().isFloat({ min: 0 }),
  body('tax', 'Tax must be positive').optional().isFloat({ min: 0 }),
  body('discount', 'Discount must be positive').optional().isFloat({ min: 0 }),
  body('status', 'Invalid PO status')
    .optional()
    .isIn(['Pending', 'Accepted', 'Rejected', 'Preparing', 'Dispatched', 'Delivered', 'Cancelled']),
  body('paymentStatus', 'Invalid payment status')
    .optional()
    .isIn(['Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled']),
  validate
];

router.route('/')
  .get(getOrders);

router.route('/:id')
  .get(getOrder)
  .put(authorize('Administrator', 'Procurement Officer'), updateOrderValidation, updateOrder)
  .delete(authorize('Administrator', 'Procurement Officer'), deleteOrder);

router.put('/:id/status', authorize('Administrator', 'Supplier'), statusValidation, updateOrderStatus);
router.put(
  '/:id/invoice',
  authorize('Administrator', 'Supplier'),
  uploadInvoiceFile,
  uploadPOInvoice
);
router.post(
  '/:id/generate-invoice',
  authorize('Administrator', 'Supplier'),
  generatePOInvoice
);

module.exports = router;
