const { createNotification } = require('../db/store');

const notifyInApp = (io, userId, payload, { title, body, data = {} } = {}) => {
  const notification = createNotification({
    userId,
    type: payload.type,
    title,
    body,
    from: payload.from,
    data: { ...data, ...payload }
  });
  io.emit(`notify:${userId}`, { ...payload, notificationId: notification._id });
  return notification;
};

module.exports = { notifyInApp };
