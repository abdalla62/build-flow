const Notification = require('../models/Notification');

// @desc    Get current user notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      $or: [
        { user: req.user.id },
        { targetRole: req.user.role },
        { targetRole: 'All' }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(50);

    // Map to include read status per user
    const formatted = notifications.map(n => ({
      _id: n._id,
      title: n.title,
      message: n.message,
      type: n.type,
      createdAt: n.createdAt,
      read: n.isRead || n.readBy.includes(req.user.id)
    }));

    res.status(200).json({ success: true, notifications: formatted });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    if (notification.user) {
      notification.isRead = true;
    } else {
      if (!notification.readBy.includes(req.user.id)) {
        notification.readBy.push(req.user.id);
      }
    }
    await notification.save();

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllRead = async (req, res, next) => {
  try {
    const userNotifies = await Notification.find({
      $or: [
        { user: req.user.id },
        { targetRole: req.user.role },
        { targetRole: 'All' }
      ]
    });

    for (let notification of userNotifies) {
      if (notification.user) {
        notification.isRead = true;
      } else {
        if (!notification.readBy.includes(req.user.id)) {
          notification.readBy.push(req.user.id);
        }
      }
      await notification.save();
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};
