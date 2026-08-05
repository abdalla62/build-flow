const express = require('express');
const { getNotifications, markRead, markAllRead } = require('../controllers/notification');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect); // Require auth for all paths

router.route('/')
  .get(getNotifications);

router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);

module.exports = router;
