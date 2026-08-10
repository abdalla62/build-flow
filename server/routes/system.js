const express = require('express');
const { clearDemoData } = require('../controllers/system');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);
router.post('/clear-demo-data', authorize('Administrator'), clearDemoData);

module.exports = router;
