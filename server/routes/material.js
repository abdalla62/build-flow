const express = require('express');
const { body } = require('express-validator');
const { getMaterials, getMaterial, createMaterial, updateMaterial, deleteMaterial } = require('../controllers/material');
const { protect, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const { uploadMaterialImage } = require('../middlewares/upload');

const router = express.Router();

router.use(protect);

/** Parse multipart fields (suppliers JSON string, numbers as strings) */
const parseMaterialBody = (req, res, next) => {
  if (typeof req.body.suppliers === 'string') {
    try {
      req.body.suppliers = JSON.parse(req.body.suppliers);
    } catch {
      req.body.suppliers = [];
    }
  }
  if (req.body.estimatedPrice !== undefined) {
    req.body.estimatedPrice = Number(req.body.estimatedPrice);
  }
  if (req.body.currentStock !== undefined && req.body.currentStock !== '') {
    req.body.currentStock = Number(req.body.currentStock);
  }
  if (req.body.minimumStock !== undefined && req.body.minimumStock !== '') {
    req.body.minimumStock = Number(req.body.minimumStock);
  }
  next();
};

const materialValidation = [
  body('name', 'Material name is required').notEmpty().trim(),
  body('category', 'Category ID is required').isMongoId(),
  body('unit', 'Unit of measurement is required').notEmpty().trim(),
  body('estimatedPrice', 'Estimated price must be a positive number').isFloat({ min: 0 }),
  body('currentStock', 'Current stock cannot be negative').optional({ nullable: true }).isInt({ min: 0 }),
  body('minimumStock', 'Minimum stock cannot be negative').optional({ nullable: true }).isInt({ min: 0 }),
  body('suppliers', 'Select at least one supplier').isArray({ min: 1 }),
  body('suppliers.*', 'Invalid supplier ID').isMongoId(),
  body('status', 'Invalid material status').optional().isIn(['Active', 'Inactive']),
  validate
];

router.route('/')
  .get(getMaterials)
  .post(
    authorize('Administrator', 'Procurement Officer'),
    uploadMaterialImage,
    parseMaterialBody,
    materialValidation,
    createMaterial
  );

router.route('/:id')
  .get(getMaterial)
  .put(
    authorize('Administrator', 'Procurement Officer'),
    uploadMaterialImage,
    parseMaterialBody,
    materialValidation,
    updateMaterial
  )
  .delete(authorize('Administrator', 'Procurement Officer'), deleteMaterial);

module.exports = router;
