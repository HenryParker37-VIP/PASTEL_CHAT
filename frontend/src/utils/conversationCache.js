/**
 * conversationCache.js
 * High-performance, resilient Stale-While-Revalidate caching for Pastel Chat conversations.
 * 
 * Features:
 * - Two-tier storage: In-memory memory map (instant <1ms) + localStorage persistence.
 * - Stable message reconciliation: deduplicates by _id and clientMessageId, preserves local pending/sending messages.
 * - Synchronous avatar & participant profile persistence: instant rendering on component mount across navigations.
 */

const MEMORY_CACHE = new Map();
const CACHE_PREFIX = 'pastel_chat_conv_v1';
const AVATAR_PREFIX = 'pastel_chat_avatar_v1';
const MAX_CACHED_MESSAGES = 100;

function getStorageKey(userId, friendId) {
  if (!userId || !friendId) return null;
  return `${CACHE_PREFIX}:${String(userId)}:${String(friendId)}`;
}

function getAvatarKey(userId, friendId) {
  if (!friendId) return null;
  return `${AVATAR_PREFIX}:${String(userId || 'anon')}:${String(friendId)}`;
}

/**
 * Safely read from localStorage with JSON parse error protection
 */
function safeStorageGet(key) {
  if (typeof window === 'undefined' || !window.localStorage || !key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[ConversationCache] Failed to parse localStorage key:', key, err.message);
    return null;
  }
}

/**
 * Safely write to localStorage with quota protection
 */
function safeStorageSet(key, value) {
  if (typeof window === 'undefined' || !window.localStorage || !key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('[ConversationCache] Failed to write localStorage key:', key, err.message);
  }
}

/**
 * Get cached conversation data (messages, friend profile, resolved avatar)
 * Checks In-Memory Map first (<0.1ms), then falls back to localStorage.
 */
export function getCachedConversation(userId, friendId) {
  const key = getStorageKey(userId, friendId);
  if (!key) return null;

  // 1. In-memory check
  if (MEMORY_CACHE.has(key)) {
    return MEMORY_CACHE.get(key);
  }

  // 2. localStorage check
  const persisted = safeStorageGet(key);
  if (persisted && typeof persisted === 'object') {
    MEMORY_CACHE.set(key, persisted);
    return persisted;
  }

  return null;
}

/**
 * Update cached conversation (messages, friend profile, resolved avatar)
 * Writes to both in-memory map and localStorage.
 */
export function setCachedConversation(userId, friendId, { messages, friend, resolvedAvatar } = {}) {
  const key = getStorageKey(userId, friendId);
  if (!key) return;

  const current = getCachedConversation(userId, friendId) || {};
  
  // Truncate messages to last N to preserve storage space
  let safeMsgs = current.messages || [];
  if (Array.isArray(messages)) {
    safeMsgs = messages.slice(-MAX_CACHED_MESSAGES);
  }

  const updatedFriend = friend !== undefined ? friend : current.friend;
  const avatarToStore = resolvedAvatar || updatedFriend?.avatar || current.resolvedAvatar || null;

  const payload = {
    messages: safeMsgs,
    friend: updatedFriend || null,
    resolvedAvatar: avatarToStore,
    timestamp: Date.now()
  };

  MEMORY_CACHE.set(key, payload);
  safeStorageSet(key, payload);

  // Also store dedicated avatar cache key for instant standalone lookup
  if (avatarToStore) {
    const avatarKey = getAvatarKey(userId, friendId);
    if (avatarKey) {
      safeStorageSet(avatarKey, { avatar: avatarToStore, updatedAt: Date.now() });
    }
  }
}

/**
 * Get cached friend/character profile
 */
export function getCachedFriend(userId, friendId) {
  const conv = getCachedConversation(userId, friendId);
  return conv?.friend || null;
}

/**
 * Get cached avatar URL for friend/character
 */
export function getCachedAvatar(userId, friendId) {
  let resolvedUserId = userId;
  if (!resolvedUserId && typeof window !== 'undefined' && window.localStorage) {
    try {
      const u = JSON.parse(window.localStorage.getItem('user'));
      if (u?._id) resolvedUserId = u._id;
    } catch {}
  }

  // Check conversation cache first
  if (resolvedUserId) {
    const conv = getCachedConversation(resolvedUserId, friendId);
    if (conv?.resolvedAvatar) return conv.resolvedAvatar;
    if (conv?.friend?.avatar) return conv.friend.avatar;

    // Check dedicated avatar cache
    const avatarKey = getAvatarKey(resolvedUserId, friendId);
    if (avatarKey) {
      const stored = safeStorageGet(avatarKey);
      if (stored?.avatar) return stored.avatar;
    }
  }

  // Fallback: check anon cache key
  const anonKey = getAvatarKey('anon', friendId);
  if (anonKey) {
    const storedAnon = safeStorageGet(anonKey);
    if (storedAnon?.avatar) return storedAnon.avatar;
  }

  // Global fallback across storage keys matching friendId
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && (k.startsWith(AVATAR_PREFIX) || k.startsWith(CACHE_PREFIX)) && k.endsWith(`:${friendId}`)) {
          const item = safeStorageGet(k);
          if (item?.avatar) return item.avatar;
          if (item?.resolvedAvatar) return item.resolvedAvatar;
          if (item?.friend?.avatar) return item.friend.avatar;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Reconcile and merge cached messages with fresh server messages and local pending messages.
 * Guarantees:
 * 1. Zero duplicates by matching both _id and clientMessageId.
 * 2. Unconfirmed local sending/failed messages are preserved.
 * 3. Server-confirmed messages replace pending placeholders seamlessly.
 * 4. Chronological ordering is strictly preserved.
 */
export function mergeMessages(cachedMessages = [], serverMessages = [], pendingMessages = []) {
  const messageMap = new Map();
  const clientMsgIdToId = new Map();

  const addOrUpdate = (msg) => {
    if (!msg) return;
    const msgId = msg._id ? String(msg._id) : null;
    const clientMsgId = msg.clientMessageId ? String(msg.clientMessageId) : null;

    // Check if we already have this message by clientMessageId
    let existingKey = null;
    if (clientMsgId && clientMsgIdToId.has(clientMsgId)) {
      existingKey = clientMsgIdToId.get(clientMsgId);
    } else if (msgId && messageMap.has(msgId)) {
      existingKey = msgId;
    }

    if (existingKey) {
      const existing = messageMap.get(existingKey);
      // Merge properties: server data takes precedence, but keep pending/failed status if not yet confirmed
      const merged = {
        ...existing,
        ...msg,
        deliveryStatus: msg.deliveryStatus || existing.deliveryStatus || 'sent'
      };
      messageMap.set(existingKey, merged);
      if (clientMsgId) clientMsgIdToId.set(clientMsgId, existingKey);
    } else {
      const key = msgId || clientMsgId || `tmp-${Date.now()}-${Math.random()}`;
      messageMap.set(key, msg);
      if (clientMsgId) clientMsgIdToId.set(clientMsgId, key);
      if (msgId) clientMsgIdToId.set(msgId, key);
    }
  };

  // 1. Seed with cached messages
  if (Array.isArray(cachedMessages)) {
    cachedMessages.forEach(addOrUpdate);
  }

  // 2. Overlay fresh server messages (authoritative source of truth)
  if (Array.isArray(serverMessages)) {
    serverMessages.forEach(addOrUpdate);
  }

  // 3. Overlay any unconfirmed pending/sending messages so newly sent messages never vanish
  if (Array.isArray(pendingMessages)) {
    pendingMessages.forEach(addOrUpdate);
  }

  // 4. Sort chronologically by timestamp
  const result = Array.from(messageMap.values());
  result.sort((a, b) => {
    const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
    const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return String(a._id || '').localeCompare(String(b._id || ''));
  });

  return result;
}
