const express = require('express');
const { body } = require('express-validator');
const { getCategories, getCategory, createCategory, updateCategory, deleteCategory } = require('../controllers/category');
const { protect, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');

const router = express.Router();

router.use(protect); // All routes require authentication

const categoryValidation = [
  body('name', 'Category name is required').notEmpty().trim(),
  body('description', 'Description is required').notEmpty().trim(),
  validate
];

router.route('/')
  .get(getCategories)
  .post(authorize('Administrator', 'Procurement Officer'), categoryValidation, createCategory);

router.route('/:id')
  .get(getCategory)
  .put(authorize('Administrator', 'Procurement Officer'), categoryValidation, updateCategory)
  .delete(authorize('Administrator', 'Procurement Officer'), deleteCategory);

module.exports = router;
