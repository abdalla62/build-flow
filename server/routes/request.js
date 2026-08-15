const express = require('express');
const { body } = require('express-validator');
const {
  getRequests,
  getRequest,
  createRequest,
  createRequestBatch,
  updateRequest,
  reviewRequest,
  bulkReviewRequests,
  receiveMaterials,
  cancelRequest
} = require('../controllers/request');
const { protect, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');

const router = express.Router();

router.use(protect); // Require auth for all paths

const batchValidation = [
  body('project', 'Project ID is required').isMongoId(),
  body('lines', 'Add at least one material').isArray({ min: 1 }),
  body('lines.*.material', 'Material ID is required').isMongoId(),
  body('lines.*.quantity', 'Quantity must be at least 1').isInt({ min: 1 }),
  body('priority', 'Invalid priority').isIn(['Low', 'Medium', 'High', 'Urgent']),
  body('reason', 'Reason is required').notEmpty().trim(),
  body('requiredDate', 'Required date is required').isISO8601(),
  validate
];

const requestValidation = [
  body('project', 'Project ID is required').isMongoId(),
  body('material', 'Material ID is required').isMongoId(),
  body('quantity', 'Quantity must be at least 1').isInt({ min: 1 }),
  body('priority', 'Invalid priority').isIn(['Low', 'Medium', 'High', 'Urgent']),
  body('reason', 'Reason is required').notEmpty().trim(),
  body('requiredDate', 'Required date is required').isISO8601(),
  validate
];

const reviewValidation = [
  body('action', 'Action must be Approve, Reject, or Return').isIn(['Approve', 'Reject', 'Return']),
  body('comments', 'Remarks are required').notEmpty().trim(),
  body('suppliers').optional({ nullable: true }).isArray(),
  body('suppliers.*').optional().isMongoId().withMessage('Invalid supplier ID'),
  validate
];

const bulkReviewValidation = [
  body('requestIds', 'requestIds must be a non-empty array').isArray({ min: 1 }),
  body('requestIds.*').isMongoId().withMessage('Invalid request ID'),
  body('action', 'Action must be Approve, Reject, or Return').isIn(['Approve', 'Reject', 'Return']),
  body('comments', 'Remarks are required').notEmpty().trim(),
  body('suppliers').optional({ nullable: true }).isArray(),
  body('suppliers.*').optional().isMongoId().withMessage('Invalid supplier ID'),
  validate
];

const receiveValidation = [
  body('damagedQuantity', 'Damaged quantity must be a non-negative integer').optional().isInt({ min: 0 }),
  body('missingQuantity', 'Missing quantity must be a non-negative integer').optional().isInt({ min: 0 }),
  body('damagedComments').optional({ nullable: true }).isString(),
  body('missingComments').optional({ nullable: true }).isString(),
  body('comments').optional({ nullable: true }).isString(),
  validate
];

router.route('/')
  .get(getRequests)
  .post(authorize('Administrator', 'Site Engineer'), requestValidation, createRequest);

router.post(
  '/batch',
  authorize('Administrator', 'Site Engineer'),
  batchValidation,
  createRequestBatch
);

router.put(
  '/bulk-review',
  authorize('Administrator', 'Project Manager'),
  bulkReviewValidation,
  bulkReviewRequests
);

router.route('/:id')
  .get(getRequest)
  .put(authorize('Administrator', 'Site Engineer'), requestValidation, updateRequest)
  .delete(authorize('Administrator', 'Site Engineer'), cancelRequest);

router.put('/:id/review', authorize('Administrator', 'Project Manager'), reviewValidation, reviewRequest);
router.put('/:id/receive', authorize('Administrator', 'Site Engineer'), receiveValidation, receiveMaterials);

module.exports = router;
