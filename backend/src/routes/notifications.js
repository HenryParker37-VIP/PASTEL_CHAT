const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead
} = require('../db/store');

router.get('/', authMiddleware, (req, res) => {
  res.json({
    notifications: getUserNotifications(req.user._id),
    unreadCount: getUnreadNotificationCount(req.user._id)
  });
});

router.post('/:id/read', authMiddleware, (req, res) => {
  const notification = markNotificationRead(req.params.id, req.user._id);
  if (!notification) return res.status(404).json({ message: 'Notification not found' });
  res.json(notification);
});

router.post('/read-all', authMiddleware, (req, res) => {
  res.json({ updated: markAllNotificationsRead(req.user._id) });
});

module.exports = router;
