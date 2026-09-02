const webpush = require('web-push');
const {
  getPushSubscriptions,
  removePushSubscription,
  getPushLanguage
} = require('../db/store');

// Configure VAPID details if keys are present
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@pastelchat.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      VAPID_EMAIL.startsWith('mailto:') ? VAPID_EMAIL : `mailto:${VAPID_EMAIL}`,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    console.log('[Push] ✅ VAPID details configured successfully');
  } catch (err) {
    console.error('[Push] ❌ Error setting VAPID details:', err.message);
  }
} else {
  console.warn('[Push] ⚠️ VAPID keys missing in environment — Web Push notifications disabled.');
}

// Active chat tracker to prevent notification spam when user is currently viewing the chat
// Map of userId -> Set of friendIds they are actively looking at
const activeUserChats = new Map();

function setActiveChat(userId, friendId) {
  if (!userId || !friendId) return;
  const uid = String(userId);
  const fid = String(friendId);
  if (!activeUserChats.has(uid)) {
    activeUserChats.set(uid, new Set());
  }
  activeUserChats.get(uid).add(fid);
}

function clearActiveChat(userId, friendId) {
  if (!userId) return;
  const uid = String(userId);
  if (!activeUserChats.has(uid)) return;
  if (friendId) {
    const fid = String(friendId);
    activeUserChats.get(uid).delete(fid);
    if (activeUserChats.get(uid).size === 0) {
      activeUserChats.delete(uid);
    }
  } else {
    activeUserChats.delete(uid);
  }
}

function isUserInActiveChat(userId, senderId) {
  if (!userId || !senderId) return false;
  const uid = String(userId);
  const sid = String(senderId);
  const activeChats = activeUserChats.get(uid);
  return Boolean(activeChats && activeChats.has(sid));
}

/**
 * Send a web push notification to all subscriptions of a specific user.
 * 
 * @param {string} toUserId - Recipient user ID
 * @param {object} payload - Notification payload { title, body, icon, badge, tag, url, data }
 * @param {object} options - Options { senderId }
 */
async function sendPushToUser(toUserId, payload, options = {}) {
  const { senderId } = options;

  // Never send push to oneself
  if (senderId && String(toUserId) === String(senderId)) {
    return { sent: 0, suppressed: true, reason: 'self' };
  }

  // Suppress push if recipient is actively looking at the sender's conversation
  if (senderId && isUserInActiveChat(toUserId, senderId)) {
    console.log(`[Push] Suppressed push for user ${toUserId} (actively viewing chat with ${senderId})`);
    return { sent: 0, suppressed: true, reason: 'active_chat' };
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[Push] VAPID keys not configured, skipping sendNotification');
    return { sent: 0, suppressed: true, reason: 'no_vapid_keys' };
  }

  const subscriptions = getPushSubscriptions(toUserId);
  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, suppressed: false, reason: 'no_subscriptions' };
  }

  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

  let successCount = 0;
  const sendPromises = subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(sub, payloadString);
      successCount++;
    } catch (err) {
      // 410 (Gone), 404 (Not Found) or expired/unregistered subscription
      if (err.statusCode === 410 || err.statusCode === 404) {
        console.log(`[Push] Subscription expired or gone (${err.statusCode}), removing endpoint for user ${toUserId}`);
        removePushSubscription(toUserId, sub.endpoint);
      } else {
        console.warn(`[Push] Error sending push to user ${toUserId}:`, err.message || err);
      }
    }
  });

  await Promise.allSettled(sendPromises);
  return { sent: successCount, total: subscriptions.length };
}

/**
 * Format and send a push notification for a new message.
 * Expected preview format:
 * Title: PastelChat
 * Body: <sender name>: <message preview>
 * Deep-link: /chat/<senderId>
 */
async function sendMessagePush(receiverId, sender, contentOrMedia) {
  if (!receiverId || !sender) return null;

  let preview = '';
  if (typeof contentOrMedia === 'string' && contentOrMedia.trim()) {
    preview = contentOrMedia.trim().slice(0, 100);
  } else if (contentOrMedia && typeof contentOrMedia === 'object') {
    if (contentOrMedia.content && contentOrMedia.content.trim()) {
      preview = contentOrMedia.content.trim().slice(0, 100);
    } else if (contentOrMedia.media) {
      const m = contentOrMedia.media;
      if (m.type === 'sticker') preview = m.name ? `Sent a sticker (${m.name})` : 'Sent a sticker 📌';
      else if (m.type === 'gif') preview = 'Sent a GIF 🎬';
      else if (m.type === 'image') preview = 'Sent a photo 📷';
      else preview = 'Sent an attachment 📎';
    } else if (contentOrMedia.type === 'sticker') {
      preview = contentOrMedia.name ? `Sent a sticker (${contentOrMedia.name})` : 'Sent a sticker 📌';
    } else if (contentOrMedia.type === 'gif') {
      preview = 'Sent a GIF 🎬';
    } else if (contentOrMedia.type === 'image') {
      preview = 'Sent a photo 📷';
    } else {
      preview = 'Sent an attachment 📎';
    }
  } else {
    preview = 'Sent a message';
  }

  const senderName = sender.name || 'Someone';
  const senderId = sender._id || sender.id;

  const payload = {
    type: 'new_message',
    title: senderName,
    body: preview,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: `msg-${senderId}`,
    url: `/chat/${senderId}`,
    data: {
      url: `/chat/${senderId}`,
      senderId: senderId,
      senderName: senderName,
      type: 'new_message'
    }
  };

  return sendPushToUser(receiverId, payload, { senderId });
}

/**
 * Format and send a push notification for a friend request.
 * Expected preview format:
 * Title: PastelChat
 * Body: <sender name> sent you a friend request
 * Deep-link: /friends
 */
async function sendFriendRequestPush(receiverId, sender) {
  if (!receiverId || !sender) return null;

  const senderName = sender.name || 'Someone';
  const senderId = sender._id || sender.id;
  const language = getPushLanguage(receiverId);

  const payload = {
    type: 'friend_request',
    title: language === 'vi' ? 'Lời mời kết bạn' : 'Friend request',
    body: language === 'vi' ? `${senderName} đã gửi cho bạn lời mời kết bạn` : `${senderName} sent you a friend request`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: `friend-req-${senderId}`,
    url: '/friends',
    data: {
      url: '/friends',
      senderId: senderId,
      senderName: senderName,
      type: 'friend_request'
    }
  };

  return sendPushToUser(receiverId, payload, { senderId });
}

/**
 * Send a test push notification to verify the device subscription.
 */
async function sendTestPush(userId) {
  if (!userId) return null;

  const payload = {
    type: 'test_push',
    title: 'Pastel Chat',
    body: '🌸 Push notifications are working perfectly on your device!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'test-push',
    url: '/privacy',
    data: {
      url: '/privacy',
      type: 'test_push'
    }
  };

  return sendPushToUser(userId, payload);
}

module.exports = {
  setActiveChat,
  clearActiveChat,
  isUserInActiveChat,
  sendPushToUser,
  sendMessagePush,
  sendFriendRequestPush,
  sendTestPush,
  getVapidPublicKey: () => VAPID_PUBLIC_KEY
};
