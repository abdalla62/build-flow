const express = require('express');
const { body } = require('express-validator');
const { getUsers, updateUserStatus, updateUserRole, getRoles, createUser, deleteUser } = require('../controllers/user');
const { protect, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');

const router = express.Router();

router.use(protect); // All routes require authentication

const createValidation = [
  body('name', 'Name is required').notEmpty().trim(),
  body('email', 'Valid email is required').isEmail(),
  body('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  body('role', 'Role is required').notEmpty().trim(),
  validate
];

// Global role route
router.get('/roles', getRoles);

// Admin-only user routes
router.route('/')
  .get(authorize('Administrator', 'Procurement Officer'), getUsers)
  .post(authorize('Administrator'), createValidation, createUser);

router.delete('/:id', authorize('Administrator'), deleteUser);

router.put('/:id/status',
  authorize('Administrator'),
  body('status', 'Status must be Active or Inactive').isIn(['Active', 'Inactive']),
  validate,
  updateUserStatus
);

router.put('/:id/role',
  authorize('Administrator'),
  body('role', 'Valid role string is required').notEmpty(),
  validate,
  updateUserRole
);

module.exports = router;
