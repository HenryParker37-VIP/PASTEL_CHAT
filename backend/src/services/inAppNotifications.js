const { createNotification } = require('../db/store');
const { emitToUser } = require('./userSocket');

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
    emitToUser(io, userId, `notify:${userId}`, { ...payload, notificationId: notification?._id });
    return notification;
  } catch (err) {
    console.error('[InAppNotifications] notifyInApp error:', err.message);
    return null;
  }
};

module.exports = { notifyInApp };
