const { createNotification } = require('../db/store');

const notifyInApp = (io, userId, payload, { title, body, data = {} } = {}) => {
  try {
    const notification = createNotification({
      userId: String(userId),
      type: payload?.type || 'notification',
      title,
      body,
      from: payload?.from,
      data: { ...data, ...payload }
    });
    if (io && typeof io.to === 'function') {
      try {
        io.to(`user:${String(userId)}`).emit(`notify:${userId}`, { ...payload, notificationId: notification?._id });
      } catch (ioErr) {
        console.warn('[InAppNotifications] io.emit warning:', ioErr.message);
      }
    }
    return notification;
  } catch (err) {
    console.error('[InAppNotifications] notifyInApp error:', err.message);
    return null;
  }
};

module.exports = { notifyInApp };
