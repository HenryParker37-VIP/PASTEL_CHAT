// File-based JSON store — no MongoDB required
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', '..', 'db.json');

const store = {
  users: [],       // { _id, name, loginCode, avatar, chatBackground, createdAt, isOnline, lastSeen }
  friendships: [], // { _id, userId, friendId, customNickname, createdAt }
  friendRequests: [], // { _id, fromId, toId, createdAt }
  messages: [],    // { _id, senderId, receiverId, content, replyTo, isRecalled, isPinned, timestamp }
  feedback: []     // { _id, userId, type, message, createdAt }
};

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const loaded = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      store.users = loaded.users || [];
      store.friendships = loaded.friendships || [];
      store.friendRequests = loaded.friendRequests || [];
      store.messages = loaded.messages || [];
      store.feedback = loaded.feedback || [];
      console.log(`[DB] Loaded ${store.users.length} users, ${store.messages.length} messages, ${store.friendships.length} friendships, ${store.friendRequests.length} friend requests`);
    } else {
      console.log('[DB] Starting fresh at', DB_PATH);
    }
  } catch (e) {
    console.error('[DB] Failed to load, starting fresh:', e.message);
  }
}

let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2));
    } catch (e) {
      console.error('[DB] Save error:', e.message);
    }
  }, 50);
}

function genId() { return crypto.randomBytes(12).toString('hex'); }

// Readable login code: 8 chars, no ambiguous letters (0/O/1/I/L)
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function generateLoginCode() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const bytes = crypto.randomBytes(8);
    let code = '';
    for (let i = 0; i < 8; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    const formatted = code.slice(0, 4) + '-' + code.slice(4);
    if (!store.users.find((u) => u.loginCode === formatted)) return formatted;
  }
  throw new Error('Could not generate unique code');
}

// ===== User =====
function findUser(filter) {
  return store.users.find((u) => Object.keys(filter).every((k) => u[k] === filter[k]));
}
function findUserById(id) {
  if (!id) return null;
  return store.users.find((u) => String(u._id) === String(id));
}
function findUserByName(name) {
  if (!name) return null;
  const lower = name.trim().toLowerCase();
  return store.users.find((u) => u.name.toLowerCase() === lower);
}
function isNameTaken(name, exceptId = null) {
  const u = findUserByName(name);
  return !!(u && u._id !== exceptId);
}
function createUser(doc) {
  const user = {
    _id: genId(),
    isOnline: false,
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    avatar: '',
    chatBackground: 'default',
    ...doc
  };
  store.users.push(user);
  persist();
  return user;
}
function updateUser(id, updates) {
  const user = findUserById(id);
  if (user) { Object.assign(user, updates); persist(); }
  return user;
}
function searchUsers(query, exceptId) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  return store.users
    .filter((u) => u._id !== exceptId && u.name.toLowerCase().includes(q))
    .slice(0, 20)
    .map(userPublic);
}
function getOnlineUsers() {
  return store.users.filter((u) => u.isOnline).map(userPublic);
}
function userPublic(u) {
  if (!u) return null;
  return { _id: u._id, name: u.name, avatar: u.avatar, chatBackground: u.chatBackground, isOnline: !!u.isOnline };
}

// ===== Friendships =====
// We store symmetric friendships (one row per pair direction). Friending is one-directional:
// A adds B with nickname "Buddy" → A sees B as "Buddy". B doesn't automatically see A.
function getFriends(userId) {
  return store.friendships
    .filter((f) => f.userId === userId)
    .map((f) => {
      const friend = findUserById(f.friendId);
      if (!friend) return null;
      return {
        _id: f._id,
        friendId: friend._id,
        customNickname: f.customNickname || friend.name,
        realName: friend.name,
        avatar: friend.avatar,
        isOnline: !!friend.isOnline,
        addedAt: f.createdAt
      };
    })
    .filter(Boolean);
}
function findFriendship(userId, friendId) {
  return store.friendships.find((f) => f.userId === userId && f.friendId === friendId);
}
function addFriend(userId, friendId, customNickname) {
  if (userId === friendId) return null;
  if (findFriendship(userId, friendId)) return findFriendship(userId, friendId);
  const friend = findUserById(friendId);
  if (!friend) return null;
  const f = {
    _id: genId(),
    userId,
    friendId,
    customNickname: (customNickname || friend.name).trim().slice(0, 50),
    createdAt: new Date().toISOString()
  };
  store.friendships.push(f);
  persist();
  return f;
}
function updateFriend(userId, friendId, customNickname) {
  const f = findFriendship(userId, friendId);
  if (f) { f.customNickname = customNickname.trim().slice(0, 50); persist(); }
  return f;
}
function removeFriend(userId, friendId) {
  const idx = store.friendships.findIndex((f) => f.userId === userId && f.friendId === friendId);
  if (idx >= 0) { store.friendships.splice(idx, 1); persist(); return true; }
  return false;
}

// ===== Friend Requests =====
function createRequest(fromId, toId) {
  if (fromId === toId) return null;
  if (findFriendship(fromId, toId) || findFriendship(toId, fromId)) return null;
  if (findRequest(fromId, toId)) return findRequest(fromId, toId);
  if (findRequest(toId, fromId)) return null; // Already requested in reverse

  const req = {
    _id: genId(),
    fromId,
    toId,
    createdAt: new Date().toISOString()
  };
  store.friendRequests.push(req);
  persist();
  return req;
}

function findRequest(fromId, toId) {
  return store.friendRequests.find((r) => r.fromId === fromId && r.toId === toId);
}

function findRequestById(id) {
  return store.friendRequests.find((r) => r._id === id);
}

function removeRequest(id) {
  const idx = store.friendRequests.findIndex((r) => r._id === id);
  if (idx >= 0) { store.friendRequests.splice(idx, 1); persist(); return true; }
  return false;
}

function getRequests(userId) {
  return store.friendRequests
    .filter(r => r.toId === userId)
    .map(r => {
      const fromUser = findUserById(r.fromId);
      if (!fromUser) return null;
      return {
        _id: r._id,
        fromId: fromUser._id,
        name: fromUser.name,
        avatar: fromUser.avatar,
        createdAt: r.createdAt
      };
    }).filter(Boolean);
}

// ===== Messages =====
function findMessage(id) {
  if (!id) return null;
  return store.messages.find((m) => String(m._id) === String(id));
}
function createMessage(doc) {
  const msg = {
    _id: genId(),
    timestamp: new Date().toISOString(),
    isRecalled: false,
    isPinned: false,
    replyTo: null,
    ...doc
  };
  store.messages.push(msg);
  persist();
  return msg;
}
function updateMessage(id, updates) {
  const m = findMessage(id);
  if (m) { Object.assign(m, updates); persist(); }
  return m;
}
function populateMessage(msg) {
  if (!msg) return null;
  const sender = findUserById(msg.senderId);
  const receiver = findUserById(msg.receiverId);
  const populated = {
    ...msg,
    senderId: userPublic(sender),
    receiverId: userPublic(receiver)
  };
  if (msg.replyTo) {
    const reply = findMessage(msg.replyTo);
    if (reply) {
      populated.replyTo = {
        ...reply,
        senderId: userPublic(findUserById(reply.senderId)),
        receiverId: userPublic(findUserById(reply.receiverId))
      };
    } else {
      populated.replyTo = null;
    }
  }
  return populated;
}
// Fetch 1-on-1 messages between userA and userB (either direction)
function getConversation(userA, userB, { limit = 100, before = null } = {}) {
  let msgs = store.messages.filter(
    (m) =>
      (m.senderId === userA && m.receiverId === userB) ||
      (m.senderId === userB && m.receiverId === userA)
  );
  if (before) {
    const cutoff = new Date(before);
    msgs = msgs.filter((m) => new Date(m.timestamp) < cutoff);
  }
  msgs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  msgs = msgs.slice(0, limit);
  return msgs.map(populateMessage).reverse();
}
function getPinnedMessages(userA, userB) {
  return store.messages
    .filter(
      (m) =>
        m.isPinned &&
        !m.isRecalled &&
        ((m.senderId === userA && m.receiverId === userB) ||
          (m.senderId === userB && m.receiverId === userA))
    )
    .map(populateMessage);
}
function searchMessages(userA, userB, query) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  return store.messages
    .filter(
      (m) =>
        !m.isRecalled &&
        m.content.toLowerCase().includes(q) &&
        ((m.senderId === userA && m.receiverId === userB) ||
          (m.senderId === userB && m.receiverId === userA))
    )
    .slice(-50)
    .map(populateMessage);
}
function clearConversation(userA, userB) {
  const before = store.messages.length;
  store.messages = store.messages.filter(
    (m) =>
      !(
        (m.senderId === userA && m.receiverId === userB) ||
        (m.senderId === userB && m.receiverId === userA)
      )
  );
  persist();
  return before - store.messages.length;
}

// ===== Feedback =====
function createFeedback(userId, type, message) {
  const fb = {
    _id: genId(),
    userId,
    type,
    message: (message || '').slice(0, 2000),
    createdAt: new Date().toISOString()
  };
  store.feedback.push(fb);
  persist();
  console.log(`[Feedback] ${type} from ${userId}: ${fb.message.slice(0, 100)}`);
  return fb;
}

load();

module.exports = {
  store, persist, genId, generateLoginCode,
  findUser, findUserById, findUserByName, isNameTaken,
  createUser, updateUser, searchUsers, getOnlineUsers, userPublic,
  getFriends, findFriendship, addFriend, updateFriend, removeFriend,
  createRequest, findRequest, findRequestById, removeRequest, getRequests,
  findMessage, createMessage, updateMessage, populateMessage,
  getConversation, getPinnedMessages, searchMessages, clearConversation,
  createFeedback
};
