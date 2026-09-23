/**
 * characterAvatar.js
 *
 * Single shared source of truth for character & contact avatar resolution across:
 * - Chat Header
 * - Profile Card
 * - Normal Incoming Message Bubbles (MessageItem)
 * - Natural Typing Indicator (TypingIndicator)
 *
 * Invariant: If a user customizes Lyra's avatar, all surfaces immediately
 * resolve and display the exact same updated avatar.
 */

export const DEFAULT_LYRA_AVATAR =
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Lyra&backgroundColor=ffd1dc,b5ead7,c7ceea,ffe4e1&radius=50';

/**
 * Resolves the active avatar URL for a friend or character.
 *
 * Priority order:
 * 1. Current friend object avatar (live state in chat header & coordinator)
 * 2. Message sender avatar (persisted on message object)
 * 3. Most recent message from this sender in conversation history
 * 4. Default character fallback if no custom avatar exists
 *
 * @param {Object} options
 * @param {Object} [options.friend] - Current friend/character object from state
 * @param {Object} [options.sender] - Sender object from message.senderId
 * @param {Array} [options.messages] - Message history array
 * @param {string} [options.friendId] - Explicit friend or character user ID
 * @returns {string|null} Resolved avatar URL or data URI, or null
 */
export function resolveCharacterAvatar({ friend = null, sender = null, messages = [], friendId = null } = {}) {
  // 1. Live friend object from active chat state (highest priority)
  if (friend && typeof friend.avatar === 'string' && friend.avatar.trim()) {
    return friend.avatar.trim();
  }

  // 2. Sender object on a message
  if (sender && typeof sender.avatar === 'string' && sender.avatar.trim()) {
    return sender.avatar.trim();
  }

  // 3. Scan conversation history for the latest known avatar from this contact
  const targetId = friendId || friend?._id || sender?._id;
  if (Array.isArray(messages) && messages.length > 0 && targetId) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg) continue;
      const msgSender = typeof msg.senderId === 'object' ? msg.senderId : null;
      const msgSenderId = msgSender?._id || msg.senderId;
      if (String(msgSenderId) === String(targetId) && msgSender?.avatar && typeof msgSender.avatar === 'string') {
        const trimmed = msgSender.avatar.trim();
        if (trimmed) return trimmed;
      }
    }
  }

  // 4. Default fallback for Lyra / AI contact when no customized avatar exists
  const isLyra = targetId === 'user_ai_lyra' || friend?.isAI || sender?.isAI;
  if (isLyra) {
    return DEFAULT_LYRA_AVATAR;
  }

  return null;
}
