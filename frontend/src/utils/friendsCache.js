/**
 * friendsCache.js
 * High-performance, resilient Stale-While-Revalidate caching for Pastel Chat friends,
 * requests, and groups.
 * 
 * Features:
 * - Two-tier storage: In-memory Map (instant <0.1ms) + localStorage persistence.
 * - Stable user ID merging: matches by friendId (or _id) without key collisions or UI jumps.
 * - Background prefetch & warming: keeps the friends list warm after login / Home navigation.
 * - Safe reconciliation: preserves local customizations (e.g. customNickname, resolved avatar)
 *   while updating online presence and server metadata.
 */

const MEMORY_FRIENDS = new Map();
const MEMORY_REQUESTS = new Map();
const MEMORY_GROUPS = new Map();

const FRIENDS_PREFIX = 'pastel_chat_friends_v1';
const REQUESTS_PREFIX = 'pastel_chat_requests_v1';
const GROUPS_PREFIX = 'pastel_chat_groups_v1';

function getKey(prefix, userId) {
  if (!userId) return null;
  return `${prefix}:${String(userId)}`;
}

function safeStorageGet(key) {
  if (typeof window === 'undefined' || !window.localStorage || !key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[FriendsCache] Failed to parse localStorage key:', key, err.message);
    return null;
  }
}

function safeStorageSet(key, value) {
  if (typeof window === 'undefined' || !window.localStorage || !key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('[FriendsCache] Failed to write localStorage key:', key, err.message);
  }
}

// ===== FRIENDS CACHE =====

export function getCachedFriends(userId) {
  const key = getKey(FRIENDS_PREFIX, userId);
  if (!key) return null;

  if (MEMORY_FRIENDS.has(key)) {
    return MEMORY_FRIENDS.get(key);
  }

  const persisted = safeStorageGet(key);
  if (Array.isArray(persisted)) {
    MEMORY_FRIENDS.set(key, persisted);
    return persisted;
  }

  return null;
}

export function setCachedFriends(userId, friends) {
  const key = getKey(FRIENDS_PREFIX, userId);
  if (!key || !Array.isArray(friends)) return;

  MEMORY_FRIENDS.set(key, friends);
  safeStorageSet(key, friends);
}

// ===== REQUESTS CACHE =====

export function getCachedRequests(userId) {
  const key = getKey(REQUESTS_PREFIX, userId);
  if (!key) return null;

  if (MEMORY_REQUESTS.has(key)) {
    return MEMORY_REQUESTS.get(key);
  }

  const persisted = safeStorageGet(key);
  if (Array.isArray(persisted)) {
    MEMORY_REQUESTS.set(key, persisted);
    return persisted;
  }

  return null;
}

export function setCachedRequests(userId, requests) {
  const key = getKey(REQUESTS_PREFIX, userId);
  if (!key || !Array.isArray(requests)) return;

  MEMORY_REQUESTS.set(key, requests);
  safeStorageSet(key, requests);
}

// ===== GROUPS CACHE =====

export function getCachedGroups(userId) {
  const key = getKey(GROUPS_PREFIX, userId);
  if (!key) return null;

  if (MEMORY_GROUPS.has(key)) {
    return MEMORY_GROUPS.get(key);
  }

  const persisted = safeStorageGet(key);
  if (Array.isArray(persisted)) {
    MEMORY_GROUPS.set(key, persisted);
    return persisted;
  }

  return null;
}

export function setCachedGroups(userId, groups) {
  const key = getKey(GROUPS_PREFIX, userId);
  if (!key || !Array.isArray(groups)) return;

  MEMORY_GROUPS.set(key, groups);
  safeStorageSet(key, groups);
}

/**
 * Reconcile cached friends with fresh server data.
 * - Server list is authoritative for membership (additions/removals).
 * - Matches by stable friendId / _id.
 * - Preserves existing custom nickname or avatar if server doesn't override with non-empty.
 */
export function mergeFriends(cachedFriends = [], serverFriends = []) {
  if (!Array.isArray(serverFriends)) return Array.isArray(cachedFriends) ? cachedFriends : [];
  if (!Array.isArray(cachedFriends) || cachedFriends.length === 0) return serverFriends;

  const cachedMap = new Map();
  cachedFriends.forEach((f) => {
    if (!f) return;
    const fid = String(f.friendId || f._id || '');
    if (fid) cachedMap.set(fid, f);
  });

  return serverFriends.map((serverFriend) => {
    if (!serverFriend) return null;
    const fid = String(serverFriend.friendId || serverFriend._id || '');
    const cached = cachedMap.get(fid);
    if (!cached) return serverFriend;

    return {
      ...cached,
      ...serverFriend,
      // If server returned empty or missing customNickname, retain cached nickname
      customNickname: serverFriend.customNickname || cached.customNickname || serverFriend.realName,
      // Preserve avatar if cached was custom-uploaded/resolved
      avatar: serverFriend.avatar || cached.avatar
    };
  }).filter(Boolean);
}

// ===== PREFETCH / WARMING =====

let inFlightPrefetch = null;
let lastPrefetchTime = 0;
const PREFETCH_COOLDOWN_MS = 10000;

export async function prefetchFriends(api, userId, force = false) {
  if (!userId || !api) return null;
  const now = Date.now();
  if (!force && inFlightPrefetch) {
    return inFlightPrefetch;
  }
  if (!force && now - lastPrefetchTime < PREFETCH_COOLDOWN_MS) {
    return {
      friends: getCachedFriends(userId) || [],
      requests: getCachedRequests(userId) || [],
      groups: getCachedGroups(userId) || []
    };
  }

  inFlightPrefetch = (async () => {
    try {
      const [friendsRes, requestsRes, groupsRes] = await Promise.allSettled([
        api.get('/friends'),
        api.get('/friends/requests'),
        api.get('/groups')
      ]);

      let friendsData = null;
      if (friendsRes.status === 'fulfilled') {
        const raw = friendsRes.value.data;
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.friends) ? raw.friends : []);
        const current = getCachedFriends(userId) || [];
        friendsData = mergeFriends(current, list);
        setCachedFriends(userId, friendsData);
      }

      let requestsData = null;
      if (requestsRes.status === 'fulfilled') {
        const raw = requestsRes.value.data;
        requestsData = Array.isArray(raw) ? raw : (Array.isArray(raw?.requests) ? raw.requests : []);
        setCachedRequests(userId, requestsData);
      }

      let groupsData = null;
      if (groupsRes.status === 'fulfilled') {
        const raw = groupsRes.value.data;
        groupsData = Array.isArray(raw) ? raw : (Array.isArray(raw?.groups) ? raw.groups : []);
        setCachedGroups(userId, groupsData);
      }

      lastPrefetchTime = Date.now();
      return {
        friends: friendsData || getCachedFriends(userId) || [],
        requests: requestsData || getCachedRequests(userId) || [],
        groups: groupsData || getCachedGroups(userId) || []
      };
    } catch (err) {
      console.warn('[FriendsCache] Prefetch error:', err.message);
      return {
        friends: getCachedFriends(userId) || [],
        requests: getCachedRequests(userId) || [],
        groups: getCachedGroups(userId) || []
      };
    } finally {
      inFlightPrefetch = null;
    }
  })();

  return inFlightPrefetch;
}
