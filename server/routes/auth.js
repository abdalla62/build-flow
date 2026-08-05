const express = require('express');
const { body } = require('express-validator');
const {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  updateDetails,
  updatePassword
} = require('../controllers/auth');

const router = express.Router();

const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const { authLimiter } = require('../middlewares/rateLimiter');
const { uploadAvatar } = require('../middlewares/upload');

// Input validation rules
const registerValidation = [
  body('name', 'Name is required').notEmpty().trim(),
  body('email', 'Please provide a valid email').isEmail().normalizeEmail(),
  body('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  body('role', 'Valid role is required').isIn([
    'Administrator',
    'Procurement Officer',
    'Project Manager',
    'Site Engineer',
    'Supplier',
    'Accountant',
    'Delivery Staff'
  ]),
  validate
];

const loginValidation = [
  body('email', 'Please provide a valid email').isEmail().normalizeEmail(),
  body('password', 'Password is required').notEmpty(),
  validate
];

const forgotValidation = [
  body('email', 'Please provide a valid email').isEmail().normalizeEmail(),
  validate
];

const resetValidation = [
  body('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  validate
];

const updateDetailsValidation = [
  body('name', 'Name is required').optional().notEmpty().trim(),
  body('email', 'Please provide a valid email').optional().isEmail().normalizeEmail(),
  validate
];

const updatePasswordValidation = [
  body('currentPassword', 'Current password is required').notEmpty(),
  body('newPassword', 'New password must be at least 6 characters').isLength({ min: 6 }),
  validate
];

// Public Auth routes
router.post('/register', authLimiter, registerValidation, register);
router.post('/login', authLimiter, loginValidation, login);
router.post('/forgot-password', authLimiter, forgotValidation, forgotPassword);
router.put('/reset-password/:resettoken', authLimiter, resetValidation, resetPassword);

// Protected Auth routes
router.get('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, uploadAvatar, updateDetailsValidation, updateDetails);
router.put('/change-password', protect, updatePasswordValidation, updatePassword);

module.exports = router;
