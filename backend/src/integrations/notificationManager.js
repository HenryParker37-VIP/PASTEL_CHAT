const { findUserById } = require('../db/store');
const {
  sendTelegramNotification,
  formatCallNotification,
  buildOpenAppButton,
  formatMessageNotification,
  formatStickerNotification,
  formatGifNotification,
  formatFriendRequestNotification
} = require('../utils/telegram');

// Send notification to user via appropriate channels
async function notifyUser(userId, notificationType, notificationData = {}) {
  const user = findUserById(userId);
  if (!user) return;

  const { sender, message, stickerName, gifName, preferences } = notificationData;

  // Only send Telegram if user has it connected and enabled
  if (!user.telegramConnected || !user.telegramVerified) {
    return;
  }

  const userPrefs = user.notificationPreferences || {};

  // Filter by notification type and user preferences
  let shouldNotify = false;
  let text = '';

  switch (notificationType) {
    case 'incoming_call':
      if (!userPrefs.enableTelegramNotifications || !userPrefs.enableTelegramCalls) return;
      shouldNotify = true;
      text = formatCallNotification(sender, { callType: notificationData.callType });
      break;

    case 'missed_call':
      if (!userPrefs.enableTelegramNotifications || !userPrefs.enableTelegramCalls) return;
      shouldNotify = true;
      text = formatCallNotification(sender, { missed: true, callType: notificationData.callType });
      break;

    case 'new_message':
      if (!userPrefs.enableTelegramNotifications || !userPrefs.enableTelegramMessages) return;
      shouldNotify = true;
      text = formatMessageNotification(sender, message);
      break;

    case 'sticker':
      if (!userPrefs.enableTelegramNotifications || !userPrefs.enableTelegramMessages) return;
      shouldNotify = true;
      text = formatStickerNotification(sender);
      break;

    case 'gif':
      if (!userPrefs.enableTelegramNotifications || !userPrefs.enableTelegramMessages) return;
      shouldNotify = true;
      text = formatGifNotification(sender);
      break;

    case 'friend_request':
      if (!userPrefs.enableTelegramNotifications) return;
      shouldNotify = true;
      text = formatFriendRequestNotification(sender);
      break;

    default:
      return;
  }

  if (shouldNotify && text) {
    try {
      const isCall = notificationType === 'incoming_call' || notificationType === 'missed_call';
      const options = isCall ? { replyMarkup: buildOpenAppButton() } : {};
      await sendTelegramNotification(user.telegramChatId, text, options);
    } catch (e) {
      console.error(`[NotificationManager] Failed to send ${notificationType} to Telegram:`, e.message);
    }
  }
}

// Send notification for incoming call
async function notifyIncomingCall(userId, caller, callType = 'voice') {
  return notifyUser(userId, 'incoming_call', { sender: caller, callType });
}

// Send notification for missed call
async function notifyMissedCall(userId, caller) {
  return notifyUser(userId, 'missed_call', { sender: caller });
}

// Send notification for new message
async function notifyNewMessage(userId, sender, message) {
  return notifyUser(userId, 'new_message', { sender, message });
}

// Send notification for sticker
async function notifySticker(userId, sender, stickerName) {
  return notifyUser(userId, 'sticker', { sender, stickerName });
}

// Send notification for GIF
async function notifyGif(userId, sender, gifName) {
  return notifyUser(userId, 'gif', { sender, gifName });
}

// Send notification for friend request
async function notifyFriendRequest(userId, requester) {
  return notifyUser(userId, 'friend_request', { sender: requester });
}

module.exports = {
  notifyUser,
  notifyIncomingCall,
  notifyMissedCall,
  notifyNewMessage,
  notifySticker,
  notifyGif,
  notifyFriendRequest
};
