// File-based JSON store — no MongoDB required
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

const DB_PATH = path.join(__dirname, '..', '..', 'db.json');
const MONGODB_URI = process.env.MONGODB_URI;
const mongoConfigured = Boolean(MONGODB_URI);
const durableStateSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true }
}, { collection: 'pastelchat_state', timestamps: true });
const DurableState = mongoose.models.PastelChatState || mongoose.model('PastelChatState', durableStateSchema);
let mongoConnected = false;
let durableSaveTimer;

const store = {
  users: [],        // { _id, name, loginCode, avatar, chatBackground, chatColor, createdAt, isOnline, lastSeen }
  friendships: [],  // { _id, userId, friendId, customNickname, createdAt }
  friendRequests: [], // { _id, fromId, toId, createdAt }
  messages: [],     // { _id, senderId, receiverId|null, groupId|null, content, replyTo, isRecalled, isPinned, timestamp }
  groups: [],       // { _id, name, avatar, creatorId, members: [userId], createdAt }
  feedback: [],     // { _id, userId, type, message, createdAt }
  notes: [],        // { _id, userId, title, content, sharedWith: [userId], createdAt }
  reminders: [],    // { _id, userId, date, time, text, createdAt }
  birthdays: [],    // { _id, userId, friendId, friendName, date (MM-DD), createdAt }
  sharedPhotos: [], // { _id, dataUrl, caption, uploadedBy: {_id,name,avatar}, createdAt }
  pushSubscriptions: [], // { userId, subscriptions: [PushSubscription, ...] }
  notifications: [], // { _id, userId, type, title, body, from, data, read, createdAt }
  releases: [] // { _id, version, title, summary, features, fixes, improvements, releasedAt, important, pushEnabled }
};

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const loaded = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      store.users = loaded.users || [];
      store.friendships = loaded.friendships || [];
      store.friendRequests = loaded.friendRequests || [];
      store.messages = loaded.messages || [];
      store.groups = loaded.groups || [];
      store.feedback = loaded.feedback || [];
      store.notes = loaded.notes || [];
      store.reminders = loaded.reminders || [];
      store.birthdays = loaded.birthdays || [];
      store.sharedPhotos = loaded.sharedPhotos || [];
      store.pushSubscriptions = loaded.pushSubscriptions || [];
      store.notifications = loaded.notifications || [];
      store.releases = loaded.releases || [];
      console.log(`[DB] Loaded ${store.users.length} users, ${store.messages.length} messages, ${store.friendships.length} friendships, ${store.groups.length} groups`);
    } else {
      console.log('[DB] Starting fresh at', DB_PATH);
    }
    
    // Automatically bootstrap the Admin user (idempotent)
    if (!store.users.find(u => u.loginCode === 'ADMN-0307')) {
      store.users.push({
        _id: genId(),
        name: 'Admin',
        loginCode: 'ADMN-0307',
        isAdmin: true,
        isOnline: false,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        avatar: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=admin&backgroundColor=add8e6&radius=50',
        chatBackground: 'default',
        chatColor: null
      });
      persist();
      console.log('[DB] Bootstrapped default Admin user (ADMN-0307)');
    }
  } catch (e) {
    console.error('[DB] Failed to load, starting fresh:', e.message);
  }
}

let saveTimer;
function persist() {
  if (!mongoConfigured) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2));
      } catch (e) {
        console.error('[DB] Save error:', e.message);
      }
    }, 50);
  }

  if (mongoConnected) {
    clearTimeout(durableSaveTimer);
    durableSaveTimer = setTimeout(() => {
      writeDurableSnapshot().catch((e) => console.error('[DB] Durable save error:', e.message));
    }, 100);
  }
}

async function writeDurableSnapshot() {
  if (!mongoConnected) return;
  await DurableState.findOneAndUpdate(
    { key: 'primary' },
    { key: 'primary', data: store },
    { upsert: true, setDefaultsOnInsert: true }
  ).exec();
}

async function hydrateFromDurableStore() {
  if (!MONGODB_URI) {
    console.warn('[DB] MONGODB_URI is not configured; local db.json is ephemeral on Render.');
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    mongoConnected = true;
    const snapshot = await DurableState.findOne({ key: 'primary' }).lean().exec();
    if (snapshot?.data) {
      Object.keys(store).forEach((key) => {
        if (Array.isArray(snapshot.data[key])) store[key] = snapshot.data[key];
      });
      console.log(`[DB] Hydrated durable MongoDB state (${store.users.length} users, ${store.messages.length} messages)`);
    } else {
      await writeDurableSnapshot();
      console.log('[DB] Initialized durable MongoDB state from local store');
    }
  } catch (e) {
    mongoConnected = false;
    if (mongoConfigured) {
      throw new Error(`Durable MongoDB unavailable; refusing ephemeral fallback: ${e.message}`);
    }
    console.error('[DB] Durable MongoDB unavailable; continuing with local store:', e.message);
  }
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
    if (formatted === 'ADMN-0307') continue; // Prevent admin collision
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
function findUserByVerificationCode(code) {
  if (!code) return null;
  return store.users.find((u) => u.telegramVerificationCode === code.toUpperCase());
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
    chatColor: null,
    chatColors: {},
    seenReleaseVersions: [],
    bio: '',
    status: '',
    loginMethod: 'code',
    isGoogleVerified: false,
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
  return {
    _id: u._id, name: u.name, avatar: u.avatar,
    chatBackground: u.chatBackground, chatColor: u.chatColor || null, chatColors: u.chatColors || {}, isOnline: !!u.isOnline,
    bio: u.bio || '', status: u.status || '',
    loginMethod: u.loginMethod || 'code',
    isGoogleVerified: !!u.isGoogleVerified
  };
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
    reactions: {}, // { emoji: [userId, ...] }
    media: null,   // { type: 'image'|'file', dataUrl, name, size }
    ...doc
  };
  store.messages.push(msg);
  persist();
  return msg;
}

// Toggle a reaction — add if not present, remove if already there
function toggleReaction(messageId, userId, emoji) {
  const msg = findMessage(messageId);
  if (!msg) return null;
  if (!msg.reactions) msg.reactions = {};
  const users = msg.reactions[emoji] || [];
  const idx = users.indexOf(userId);
  if (idx === -1) {
    msg.reactions[emoji] = [...users, userId];
  } else {
    msg.reactions[emoji] = users.filter(id => id !== userId);
    if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
  }
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

// ===== Groups =====
function createGroup({ name, creatorId, memberIds = [] }) {
  const members = [creatorId, ...memberIds.filter(id => id !== creatorId)];
  const group = {
    _id: genId(),
    name: (name || '').trim().slice(0, 60),
    creatorId,
    members,
    createdAt: new Date().toISOString()
  };
  store.groups.push(group);
  persist();
  return group;
}
function findGroup(id) {
  return store.groups.find(g => String(g._id) === String(id));
}
function getGroupsForUser(userId) {
  return store.groups.filter(g => g.members.includes(userId));
}
function groupPublic(g) {
  if (!g) return null;
  return {
    _id: g._id,
    name: g.name,
    creatorId: g.creatorId,
    members: g.members.map(id => userPublic(findUserById(id))).filter(Boolean),
    createdAt: g.createdAt
  };
}
function addGroupMember(groupId, userId) {
  const g = findGroup(groupId);
  if (!g || g.members.includes(userId)) return g;
  g.members.push(userId);
  persist();
  return g;
}
function removeGroupMember(groupId, userId) {
  const g = findGroup(groupId);
  if (!g) return null;
  g.members = g.members.filter(id => id !== userId);
  if (g.members.length === 0) {
    store.groups = store.groups.filter(x => x._id !== groupId);
  }
  persist();
  return g;
}
function updateGroup(groupId, updates) {
  const g = findGroup(groupId);
  if (!g) return null;
  if (updates.name) g.name = updates.name.trim().slice(0, 60);
  persist();
  return g;
}
function getGroupConversation(groupId, { limit = 100, before = null } = {}) {
  let msgs = store.messages.filter(m => m.groupId === groupId);
  if (before) {
    const cutoff = new Date(before);
    msgs = msgs.filter(m => new Date(m.timestamp) < cutoff);
  }
  msgs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  msgs = msgs.slice(0, limit);
  return msgs.map(m => populateMessage(m)).reverse();
}

// ===== Private Space: Notes =====
function createNote(userId, { title, content, sharedWith = [], images = [] }) {
  const note = {
    _id: genId(),
    userId,
    title: (title || '').slice(0, 120),
    content: (content || '').slice(0, 5000),
    sharedWith: Array.isArray(sharedWith) ? sharedWith : [],
    images: Array.isArray(images) ? images : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.notes.push(note);
  persist();
  return note;
}
function findNote(noteId) {
  return store.notes.find(n => n._id === noteId);
}
function getUserNotes(userId) {
  return store.notes.filter(n => n.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function deleteNote(noteId) {
  const idx = store.notes.findIndex(n => n._id === noteId);
  if (idx !== -1) {
    store.notes.splice(idx, 1);
    persist();
    return true;
  }
  return false;
}
function updateNote(noteId, updates) {
  const n = findNote(noteId);
  if (!n) return null;
  if (updates.title !== undefined) n.title = (updates.title || '').slice(0, 120);
  if (updates.content !== undefined) n.content = (updates.content || '').slice(0, 5000);
  if (updates.sharedWith !== undefined) n.sharedWith = updates.sharedWith;
  if (updates.images !== undefined) n.images = Array.isArray(updates.images) ? updates.images : [];
  n.updatedAt = new Date().toISOString();
  persist();
  return n;
}

// ===== Private Space: Reminders =====
function createReminder(userId, { date, time, text }) {
  const reminder = {
    _id: genId(),
    userId,
    date,
    time,
    text: (text || '').slice(0, 500),
    createdAt: new Date().toISOString()
  };
  store.reminders.push(reminder);
  persist();
  return reminder;
}
function getUserReminders(userId) {
  return store.reminders.filter(r => r.userId === userId).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}
function findReminder(reminderId) {
  return store.reminders.find(r => r._id === reminderId);
}
function deleteReminder(reminderId) {
  const idx = store.reminders.findIndex(r => r._id === reminderId);
  if (idx !== -1) {
    store.reminders.splice(idx, 1);
    persist();
    return true;
  }
  return false;
}

// ===== Private Space: Birthdays =====
function createBirthday(userId, { friendId, friendName, date }) {
  const bday = {
    _id: genId(),
    userId,
    friendId,
    friendName: (friendName || '').slice(0, 100),
    date, // MM-DD format
    createdAt: new Date().toISOString()
  };
  store.birthdays.push(bday);
  persist();
  return bday;
}
function getUserBirthdays(userId) {
  return store.birthdays.filter(b => b.userId === userId).sort((a, b) => a.date.localeCompare(b.date));
}
function findBirthday(birthdayId) {
  return store.birthdays.find(b => b._id === birthdayId);
}
function deleteBirthday(birthdayId) {
  const idx = store.birthdays.findIndex(b => b._id === birthdayId);
  if (idx !== -1) {
    store.birthdays.splice(idx, 1);
    persist();
    return true;
  }
  return false;
}

// ===== Shared Photos =====
function addSharedPhoto({ _id, dataUrl, caption, uploadedBy, createdAt, isHidden = false }) {
  const photo = { _id, dataUrl, caption, uploadedBy, createdAt, isHidden: !!isHidden };
  store.sharedPhotos.unshift(photo);
  if (store.sharedPhotos.length > 200) store.sharedPhotos = store.sharedPhotos.slice(0, 200);
  persist();
  return photo;
}
function getSharedPhotos() {
  return store.sharedPhotos.slice(0, 50);
}
function togglePhotoEncryption(photoId, userId, isHidden) {
  const photo = store.sharedPhotos.find(p => p._id === photoId);
  if (!photo) return null;
  if (photo.uploadedBy._id !== userId) return null;
  photo.isHidden = !!isHidden;
  persist();
  return photo;
}

// ===== Push Subscriptions =====
function storePushSubscription(userId, subscription) {
  let entry = store.pushSubscriptions.find(e => e.userId === userId);
  if (!entry) {
    entry = { userId, subscriptions: [] };
    store.pushSubscriptions.push(entry);
  }
  const exists = entry.subscriptions.find(s => s.endpoint === subscription.endpoint);
  if (!exists) entry.subscriptions.push(subscription);
  else if (subscription.language) exists.language = subscription.language;
  persist();
}
function removePushSubscription(userId, endpoint) {
  const entry = store.pushSubscriptions.find(e => e.userId === userId);
  if (entry) {
    entry.subscriptions = entry.subscriptions.filter(s => s.endpoint !== endpoint);
    persist();
  }
}
function getPushSubscriptions(userId) {
  const entry = store.pushSubscriptions.find(e => e.userId === userId);
  return entry ? entry.subscriptions : [];
}
function getPushLanguage(userId) {
  const entry = store.pushSubscriptions.find(e => e.userId === userId);
  return entry?.subscriptions?.find(s => s.language)?.language || 'en';
}

// ===== In-app notifications =====
function createNotification({ userId, type, title, body, from = null, data = {} }) {
  const notification = {
    _id: genId(),
    userId,
    type,
    title: String(title || 'Pastel Chat').slice(0, 160),
    body: String(body || '').slice(0, 500),
    from: from ? { _id: from._id, name: from.name, avatar: from.avatar || '' } : null,
    data,
    read: false,
    createdAt: new Date().toISOString()
  };
  store.notifications.unshift(notification);
  if (store.notifications.length > 1000) store.notifications.length = 1000;
  persist();
  return notification;
}
function getUserNotifications(userId, limit = 60) {
  return store.notifications
    .filter(n => n.userId === userId)
    .slice(0, Math.min(Number(limit) || 60, 100));
}
function getUnreadNotificationCount(userId) {
  return store.notifications.filter(n => n.userId === userId && !n.read).length;
}
function markNotificationRead(notificationId, userId) {
  const notification = store.notifications.find(n => n._id === notificationId && n.userId === userId);
  if (!notification) return null;
  notification.read = true;
  persist();
  return notification;
}
function markAllNotificationsRead(userId) {
  let count = 0;
  store.notifications.forEach((notification) => {
    if (notification.userId === userId && !notification.read) {
      notification.read = true;
      count += 1;
    }
  });
  if (count) persist();
  return count;
}

// ===== Release notes =====
function normalizeRelease(release) {
  return {
    _id: release._id || genId(),
    version: String(release.version || '').trim(),
    title: String(release.title || '').trim().slice(0, 160),
    titleVi: String(release.titleVi || '').trim().slice(0, 160),
    summary: String(release.summary || '').trim().slice(0, 500),
    summaryVi: String(release.summaryVi || '').trim().slice(0, 500),
    features: Array.isArray(release.features) ? release.features.map(String).map(s => s.trim()).filter(Boolean).slice(0, 20) : [],
    fixes: Array.isArray(release.fixes) ? release.fixes.map(String).map(s => s.trim()).filter(Boolean).slice(0, 20) : [],
    improvements: Array.isArray(release.improvements) ? release.improvements.map(String).map(s => s.trim()).filter(Boolean).slice(0, 20) : [],
    featuresVi: Array.isArray(release.featuresVi) ? release.featuresVi.map(String).map(s => s.trim()).filter(Boolean).slice(0, 20) : [],
    fixesVi: Array.isArray(release.fixesVi) ? release.fixesVi.map(String).map(s => s.trim()).filter(Boolean).slice(0, 20) : [],
    improvementsVi: Array.isArray(release.improvementsVi) ? release.improvementsVi.map(String).map(s => s.trim()).filter(Boolean).slice(0, 20) : [],
    releasedAt: release.releasedAt || new Date().toISOString(),
    important: Boolean(release.important),
    pushEnabled: Boolean(release.pushEnabled)
  };
}
function compareVersions(a, b) {
  const left = String(a || '').split('.').map(Number);
  const right = String(b || '').split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    if ((left[i] || 0) !== (right[i] || 0)) return (left[i] || 0) - (right[i] || 0);
  }
  return 0;
}
function getReleases() {
  return [...store.releases].sort((a, b) => compareVersions(b.version, a.version) || new Date(b.releasedAt) - new Date(a.releasedAt));
}
function findRelease(version) {
  return store.releases.find(release => release.version === String(version));
}
function createRelease(input) {
  const release = normalizeRelease(input);
  if (!release.version || !release.title) return null;
  if (findRelease(release.version)) return findRelease(release.version);
  store.releases.push(release);
  persist();
  return release;
}
function notifyUsersOfRelease(release) {
  let created = 0;
  store.users.forEach((user) => {
    const exists = store.notifications.some(notification =>
      notification.userId === user._id && notification.type === 'release_published' && notification.data?.releaseVersion === release.version
    );
    if (!exists) {
      createNotification({
        userId: user._id,
        type: 'release_published',
        title: 'PastelChat has been updated ✨',
        body: `Version ${release.version} is now available. See what’s new and what we fixed.`,
        data: { releaseVersion: release.version, route: `/whats-new/${encodeURIComponent(release.version)}` }
      });
      created += 1;
    }
  });
  return created;
}
function markReleaseSeen(userId, version) {
  const user = findUserById(userId);
  const release = findRelease(version);
  if (!user || !release) return null;
  const seen = Array.isArray(user.seenReleaseVersions) ? user.seenReleaseVersions : [];
  if (!seen.includes(release.version)) {
    user.seenReleaseVersions = [...seen, release.version].slice(-50);
    persist();
  }
  return release;
}
function hasSeenRelease(userId, version) {
  const user = findUserById(userId);
  return Boolean(user?.seenReleaseVersions?.includes(String(version)));
}

const INITIAL_RELEASE = {
  version: '1.1.0',
  title: 'More colorful, more connected',
  titleVi: 'Nhiều màu sắc hơn, kết nối gần hơn',
  summary: 'PastelChat is now more durable, expressive, and helpful across devices.',
  summaryVi: 'PastelChat nay bền vững, nhiều cảm xúc và hữu ích hơn trên mọi thiết bị.',
  features: ['Push Notifications', 'Notification deep linking', 'Custom pastel chat colors', 'What’s New release history', 'Custom PastelChat toast and confirmation feedback'],
  featuresVi: ['Thông báo đẩy', 'Liên kết sâu từ thông báo', 'Màu pastel tùy chỉnh cho cuộc trò chuyện', 'Lịch sử Có gì mới', 'Toast và hộp xác nhận mang phong cách PastelChat'],
  fixes: ['Chat history now survives deployments', 'Sessions remain logged in after updates', 'Removed the production dependency on ephemeral db.json storage', 'MongoDB persistence enabled'],
  fixesVi: ['Lịch sử chat vẫn được giữ sau khi triển khai', 'Phiên đăng nhập vẫn được duy trì sau khi cập nhật', 'Đã loại bỏ phụ thuộc production vào db.json tạm thời', 'Đã bật lưu trữ MongoDB'],
  improvements: ['Vietnamese/English notification localization', 'Improved PWA update behavior', 'Draft preservation during updates', 'Improved install guide and platform UI'],
  improvementsVi: ['Bản địa hóa thông báo tiếng Việt/Anh', 'Cải thiện cập nhật PWA', 'Giữ lại tin nhắn nháp khi cập nhật', 'Cải thiện hướng dẫn cài đặt và giao diện nền tảng'],
  important: true,
  pushEnabled: false
};

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
const ready = hydrateFromDurableStore();
ready.then(() => {
  if (store.releases.length === 0) {
    const release = createRelease(INITIAL_RELEASE);
    if (release) notifyUsersOfRelease(release);
  }
}).catch(() => {});

module.exports = {
  store, persist, ready, isDurableStorageEnabled: () => mongoConnected, genId, generateLoginCode,
  findUser, findUserById, findUserByName, findUserByVerificationCode, isNameTaken,
  createUser, updateUser, searchUsers, getOnlineUsers, userPublic,
  getFriends, findFriendship, addFriend, updateFriend, removeFriend,
  createRequest, findRequest, findRequestById, removeRequest, getRequests,
  findMessage, createMessage, updateMessage, populateMessage, toggleReaction,
  getConversation, getPinnedMessages, searchMessages, clearConversation,
  createGroup, findGroup, getGroupsForUser, groupPublic,
  addGroupMember, removeGroupMember, updateGroup, getGroupConversation,
  createNote, findNote, getUserNotes, deleteNote, updateNote,
  createReminder, getUserReminders, findReminder, deleteReminder,
  createBirthday, getUserBirthdays, findBirthday, deleteBirthday,
  addSharedPhoto, getSharedPhotos, togglePhotoEncryption,
  storePushSubscription, removePushSubscription, getPushSubscriptions, getPushLanguage,
  createNotification, getUserNotifications, getUnreadNotificationCount,
  markNotificationRead, markAllNotificationsRead,
  getReleases, findRelease, createRelease, notifyUsersOfRelease, markReleaseSeen, hasSeenRelease,
  createFeedback
};
