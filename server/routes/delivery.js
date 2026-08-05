const express = require('express');
const { body } = require('express-validator');
const {
  scheduleDelivery,
  getDeliveries,
  updateDeliveryStatus,
  uploadDeliveryNote,
  deleteDelivery,
  rescheduleDelivery
} = require('../controllers/delivery');
const { protect, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const { uploadDeliveryNoteFile } = require('../middlewares/upload');

const router = express.Router();

router.use(protect); // All routes require authentication

const scheduleValidation = [
  body('purchaseOrder', 'Purchase order ID is required').isMongoId(),
  body('driver', 'Driver ID is required').isMongoId(),
  body('vehicle', 'Vehicle description is required').notEmpty().trim(),
  body('vehicleType').optional({ nullable: true }).trim(),
  body('vehicleModel').optional({ nullable: true }).trim(),
  body('deliveryAddress', 'Delivery address is required').notEmpty().trim(),
  body('deliveryDate', 'Delivery date is required').isISO8601(),
  body('timeSlot', 'Time slot is required').notEmpty().trim(),
  validate
];

const statusValidation = [
  body('status', 'Invalid delivery status value').isIn([
    'Preparing',
    'Dispatched',
    'In Transit',
    'Delivered',
    'Delayed',
    'Rescheduled',
    'Cancelled'
  ]),
  validate
];

const rescheduleValidation = [
  body('newDeliveryDate', 'New delivery date is required').isISO8601(),
  body('reason', 'Reason for rescheduling is required').notEmpty().trim(),
  body('timeSlot').optional({ nullable: true }).trim(),
  validate
];

router.route('/')
  .get(getDeliveries)
  .post(authorize('Administrator', 'Procurement Officer'), scheduleValidation, scheduleDelivery);

router.route('/:id')
  .delete(authorize('Administrator', 'Procurement Officer'), deleteDelivery);

router.put('/:id/status', authorize('Administrator', 'Delivery Staff'), statusValidation, updateDeliveryStatus);
router.put(
  '/:id/reschedule',
  authorize('Administrator', 'Procurement Officer'),
  rescheduleValidation,
  rescheduleDelivery
);
router.put(
  '/:id/note',
  authorize('Administrator', 'Delivery Staff'),
  uploadDeliveryNoteFile,
  uploadDeliveryNote
);

module.exports = router;
