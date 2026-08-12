const express = require('express');
const { body } = require('express-validator');
const { recordPayment, getPayments, getPaymentSummary } = require('../controllers/payment');
const { protect, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const { uploadPaymentReceiptFile } = require('../middlewares/upload');

const router = express.Router();

router.use(protect);

const paymentValidation = [
  body('purchaseOrder', 'Purchase order ID must be a valid Mongo ID').isMongoId(),
  body('paidAmount', 'Paid amount must be positive').isFloat({ min: 0.01 }),
  body('paymentMethod', 'Invalid payment method').isIn(['Mobile Wallet']),
  body('referenceNumber').optional({ nullable: true, checkFalsy: true }).trim(),
  body('accountNo').optional({ nullable: true, checkFalsy: true }).trim(),
  validate
];

router.get('/summary', getPaymentSummary);

router.route('/')
  .get(getPayments)
  .post(
    authorize('Administrator', 'Accountant'),
    uploadPaymentReceiptFile,
    paymentValidation,
    recordPayment
  );

module.exports = router;
