const express = require('express');
const { body } = require('express-validator');
const {
  getProjects,
  getProject,
  getProjectBudget,
  createProject,
  updateProject,
  deleteProject
} = require('../controllers/project');
const { protect, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');

const router = express.Router();

router.use(protect); // All routes require authentication

const projectValidation = [
  body('name', 'Project name is required').notEmpty().trim(),
  body('location', 'Location is required').notEmpty().trim(),
  body('budget', 'Budget must be a positive number').isNumeric().isFloat({ min: 0 }),
  body('manager', 'Assigned manager ID is required').isMongoId(),
  body('status', 'Invalid project status').optional().isIn(['Pending', 'Active', 'Completed', 'On Hold']),
  validate
];

// All authenticated roles can fetch project details. Modifications are restricted.
router.route('/')
  .get(getProjects)
  .post(authorize('Administrator'), projectValidation, createProject);

router.get('/:id/budget', getProjectBudget);

router.route('/:id')
  .get(getProject)
  .put(authorize('Administrator'), projectValidation, updateProject)
  .delete(authorize('Administrator'), deleteProject);

module.exports = router;
