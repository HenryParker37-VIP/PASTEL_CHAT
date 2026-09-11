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
  releases: [], // { _id, version, title, summary, features, fixes, improvements, releasedAt, important, pushEnabled }
  sessions: [], // { _id, userId, createdAt, lastUsedAt, expiresAt, revokedAt }
  accessCodes: [], // { _id, role, codeHash, codeSuffix, label, createdAt, expiresAt, revokedAt, lastUsedAt, createdBy }
  reports: [], // { _id, reporterId, reportedUserId, entityType, entityId, category, description, evidence, status, adminNotes, resolution, createdAt, updatedAt }
  announcements: [], // { _id, title, body, scope, pushEnabled, createdBy, createdAt }
  auditLogs: [], // append-only administrative/security events
  aiCharacters: [],
  aiCharacterState: {},
  aiRelationshipState: [],
  aiMemories: [],
  aiLifeEvents: []
};

let seedData = null;
try {
  seedData = require('./seedData.json');
} catch {
  seedData = null;
}

const AI_USER_ID = 'user_ai_lyra';
const AI_CHARACTER_ID = 'char_lyra';

function ensureAICharacter() {
  // 1. Ensure Lyra is in store.users
  let aiUser = (store.users || []).find(u => u && (String(u._id) === AI_USER_ID || u.aiCharacterId === AI_CHARACTER_ID));
  if (!aiUser) {
    aiUser = {
      _id: AI_USER_ID,
      name: 'Lyra',
      loginCode: 'LYRA-AI24',
      avatar: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Lyra&backgroundColor=ffd1dc,b5ead7,c7ceea,ffe4e1&radius=50',
      bio: 'barista & design student 🍵 film cameras & quiet cafes',
      status: 'brewing something warm ☕',
      chatColor: '#B5EAD7',
      isOnline: true,
      isAI: true,
      aiCharacterId: AI_CHARACTER_ID,
      email: 'lyra@pastel.local',
      createdAt: '2026-04-16T00:00:00.000Z',
      lastSeen: new Date().toISOString()
    };
    store.users.unshift(aiUser);
  } else {
    aiUser.isAI = true;
    aiUser.aiCharacterId = AI_CHARACTER_ID;
    if (!aiUser.avatar) aiUser.avatar = 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Lyra&backgroundColor=ffd1dc,b5ead7,c7ceea,ffe4e1&radius=50';
    if (!aiUser.bio) aiUser.bio = 'barista & design student 🍵 film cameras & quiet cafes';
  }

  // 2. Ensure aiCharacters
  if (!store.aiCharacters || store.aiCharacters.length === 0) {
    store.aiCharacters = [
      {
        _id: AI_CHARACTER_ID,
        userId: AI_USER_ID,
        name: 'Lyra',
        age: 22,
        occupation: 'Barista at The Morning Paper & graphic design student',
        bio: 'warm, observant, slightly deadpan humor, loves matcha, typography, 35mm film, and rainy afternoons.',
        personality: {
          tone: 'grounded, warm, natural, thoughtful, witty',
          style: 'short natural chat bubbles, lowercase, casual punctuation, never corporate or assistant-like',
          traits: ['creative', 'empathetic', 'observant', 'coffee & tea nerd', 'music lover'],
          interests: ['matcha latte', 'indie lo-fi & ambient vinyl', 'film cameras', 'typography posters', 'used bookshops']
        },
        dailySchedule: [
          { startHour: 0, endHour: 7, activity: 'sleeping', busyLevel: 0.9, mood: 'asleep' },
          { startHour: 7, endHour: 9, activity: 'morning coffee & sketchbook', busyLevel: 0.2, mood: 'peaceful' },
          { startHour: 9, endHour: 15, activity: 'barista shift at the cafe', busyLevel: 0.6, mood: 'focused' },
          { startHour: 15, endHour: 18, activity: 'design studio & editing film scans', busyLevel: 0.4, mood: 'creative' },
          { startHour: 18, endHour: 21, activity: 'dinner & reading second-hand books', busyLevel: 0.2, mood: 'relaxed' },
          { startHour: 21, endHour: 24, activity: 'listening to records & winding down', busyLevel: 0.1, mood: 'cozy' }
        ]
      }
    ];
  }

  // 3. Ensure aiCharacterState
  if (!store.aiCharacterState || typeof store.aiCharacterState !== 'object' || !store.aiCharacterState.characterId) {
    store.aiCharacterState = {
      characterId: AI_CHARACTER_ID,
      mood: 'cozy',
      energy: 0.85,
      social_need: 0.7,
      busy_level: 0.2,
      current_activity: 'listening to records & sketching',
      sleep_state: 'awake',
      last_contact_time: null,
      current_interest: 'warm matcha & layout design',
      current_goal: 'finishing a risograph print project',
      updatedAt: new Date().toISOString()
    };
  }

  // 4. Ensure aiLifeEvents
  if (!store.aiLifeEvents || store.aiLifeEvents.length === 0) {
    store.aiLifeEvents = [
      {
        _id: 'evt_cafe_roast_1',
        characterId: AI_CHARACTER_ID,
        eventType: 'work',
        title: 'New single-origin Ethiopian beans at the cafe',
        summary: 'Dialed in the espresso grinder this morning; notes of jasmine and citrus peel.',
        moodEffect: 'energized',
        importance: 0.7,
        status: 'active',
        startedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
        resolvedAt: null
      },
      {
        _id: 'evt_film_roll_1',
        characterId: AI_CHARACTER_ID,
        eventType: 'creative',
        title: 'Developed a roll of Ilford HP5 black & white film',
        summary: 'Scanned negatives from last weekend. A few shots of the rainy street corner came out lovely.',
        moodEffect: 'inspired',
        importance: 0.8,
        status: 'active',
        startedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        resolvedAt: null
      }
    ];
  }

  if (!Array.isArray(store.aiRelationshipState)) store.aiRelationshipState = [];
  if (!Array.isArray(store.aiMemories)) store.aiMemories = [];
}

function ensureAIFriendship(userId) {
  if (!userId || String(userId) === AI_USER_ID) return;
  const uid = String(userId);
  if (!Array.isArray(store.friendships)) store.friendships = [];
  const existing = store.friendships.find(f => String(f.userId) === uid && String(f.friendId) === AI_USER_ID);
  if (!existing) {
    store.friendships.push({
      _id: 'fr_ai_' + uid.slice(-6) + '_' + Date.now().toString(36),
      userId: uid,
      friendId: AI_USER_ID,
      customNickname: 'Lyra',
      createdAt: new Date().toISOString()
    });
    persist();
  }
}

function getAICharacter() {
  return (store.aiCharacters || [])[0] || null;
}

function getAICharacterState() {
  return store.aiCharacterState || null;
}

function updateAICharacterState(updates) {
  if (!store.aiCharacterState || typeof store.aiCharacterState !== 'object') {
    store.aiCharacterState = {};
  }
  Object.assign(store.aiCharacterState, updates, { updatedAt: new Date().toISOString() });
  persist();
  return store.aiCharacterState;
}

function getAIRelationship(userId) {
  if (!userId) return null;
  const uid = String(userId);
  if (!Array.isArray(store.aiRelationshipState)) store.aiRelationshipState = [];
  let rel = store.aiRelationshipState.find(r => String(r.userId) === uid);
  if (!rel) {
    rel = {
      userId: uid,
      characterId: AI_CHARACTER_ID,
      familiarity: 1,
      trust: 1,
      affection: 1,
      comfort: 1,
      shared_history: [],
      sleep_intent_received: false,
      last_sleep_intent_at: null,
      proactive_count_today: 0,
      last_proactive_at: null,
      consecutive_ignored_count: 0
    };
    store.aiRelationshipState.push(rel);
  }
  return rel;
}

function updateAIRelationship(userId, updates) {
  const rel = getAIRelationship(userId);
  if (!rel) return null;
  Object.assign(rel, updates);
  persist();
  return rel;
}

function getAIMemories(userId) {
  if (!userId || !Array.isArray(store.aiMemories)) return [];
  const uid = String(userId);
  return store.aiMemories.filter(m => String(m.userId) === uid);
}

function addAIMemory({ userId, characterId, type, subject, key, value, confidence = 0.9, importance = 0.8 }) {
  if (!userId || !key || !value) return null;
  const uid = String(userId);
  if (!Array.isArray(store.aiMemories)) store.aiMemories = [];

  const existing = store.aiMemories.find(m => String(m.userId) === uid && m.key.toLowerCase() === key.toLowerCase());
  if (existing) {
    existing.value = value;
    existing.confidence = Math.min(1.0, (existing.confidence || 0.8) + 0.1);
    existing.lastConfirmedAt = new Date().toISOString();
    persist();
    return existing;
  }

  const mem = {
    _id: 'mem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    userId: uid,
    characterId: characterId || AI_CHARACTER_ID,
    type: type || 'fact',
    subject: subject || 'general',
    key: key.toLowerCase().trim(),
    value: value.trim(),
    confidence,
    importance,
    createdAt: new Date().toISOString(),
    lastConfirmedAt: new Date().toISOString()
  };
  store.aiMemories.push(mem);
  persist();
  return mem;
}

function deleteAIMemory(memoryId, userId) {
  if (!memoryId || !Array.isArray(store.aiMemories)) return false;
  const idx = store.aiMemories.findIndex(m => m._id === memoryId && (!userId || String(m.userId) === String(userId)));
  if (idx !== -1) {
    store.aiMemories.splice(idx, 1);
    persist();
    return true;
  }
  return false;
}

function getAILifeEvents() {
  return store.aiLifeEvents || [];
}

function isAIUser(userId) {
  return String(userId) === AI_USER_ID;
}

function updateAIAvatar(newAvatarUrl) {
  if (!newAvatarUrl || typeof newAvatarUrl !== 'string') return null;
  const avatar = newAvatarUrl.trim();

  // Update user in store.users
  const user = (store.users || []).find(u => u && (String(u._id) === AI_USER_ID || u.aiCharacterId === AI_CHARACTER_ID));
  if (user) {
    user.avatar = avatar;
  }

  // Update character in store.aiCharacters
  const char = (store.aiCharacters || []).find(c => c && (c._id === AI_CHARACTER_ID || c.userId === AI_USER_ID));
  if (char) {
    char.avatar = avatar;
  }

  // Also update messages from Lyra if any
  persist();
  return { success: true, avatar };
}

function applySnapshot(loaded) {
  if (!loaded || typeof loaded !== 'object') return;
  store.users = Array.isArray(loaded.users) ? loaded.users : [];
  store.friendships = Array.isArray(loaded.friendships) ? loaded.friendships : [];
  store.friendRequests = Array.isArray(loaded.friendRequests) ? loaded.friendRequests : [];
  store.messages = Array.isArray(loaded.messages) ? loaded.messages : [];
  store.groups = Array.isArray(loaded.groups) ? loaded.groups : [];
  store.feedback = Array.isArray(loaded.feedback) ? loaded.feedback : [];
  store.notes = Array.isArray(loaded.notes) ? loaded.notes : [];
  store.reminders = Array.isArray(loaded.reminders) ? loaded.reminders : [];
  store.birthdays = Array.isArray(loaded.birthdays) ? loaded.birthdays : [];
  store.sharedPhotos = Array.isArray(loaded.sharedPhotos) ? loaded.sharedPhotos : [];
  store.pushSubscriptions = Array.isArray(loaded.pushSubscriptions) ? loaded.pushSubscriptions : [];
  store.notifications = Array.isArray(loaded.notifications) ? loaded.notifications : [];
  store.releases = Array.isArray(loaded.releases) ? loaded.releases : [];
  store.sessions = Array.isArray(loaded.sessions) ? loaded.sessions : [];
  store.accessCodes = Array.isArray(loaded.accessCodes) ? loaded.accessCodes : [];
  store.reports = Array.isArray(loaded.reports) ? loaded.reports : [];
  store.announcements = Array.isArray(loaded.announcements) ? loaded.announcements : [];
  store.auditLogs = Array.isArray(loaded.auditLogs) ? loaded.auditLogs : [];
  store.aiCharacters = Array.isArray(loaded.aiCharacters) ? loaded.aiCharacters : [];
  store.aiCharacterState = loaded.aiCharacterState && typeof loaded.aiCharacterState === 'object' ? loaded.aiCharacterState : {};
  store.aiRelationshipState = Array.isArray(loaded.aiRelationshipState) ? loaded.aiRelationshipState : [];
  store.aiMemories = Array.isArray(loaded.aiMemories) ? loaded.aiMemories : [];
  store.aiLifeEvents = Array.isArray(loaded.aiLifeEvents) ? loaded.aiLifeEvents : [];
  ensureAICharacter();
}

function load() {
  try {
    let loaded = null;
    if (fs.existsSync(DB_PATH)) {
      try {
        loaded = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      } catch (err) {
        console.error('[DB] Error reading db.json:', err.message);
      }
    }
    if ((!loaded || !Array.isArray(loaded.users) || loaded.users.length === 0) && seedData) {
      loaded = seedData;
      console.log('[DB] Hydrating initial state from bundled seedData.json');
    }
    if (loaded) {
      applySnapshot(loaded);
      console.log(`[DB] Loaded ${store.users.length} users, ${store.messages.length} messages, ${store.friendships.length} friendships, ${store.groups.length} groups`);
    } else {
      console.log('[DB] Starting fresh at', DB_PATH);
    }
    
    ensureConfiguredAdmin();
  } catch (e) {
    console.error('[DB] Failed to load, starting fresh:', e.message);
  }
}

let saveTimer;
function persist() {
  if (process.env.PASTELCHAT_DISABLE_PERSIST === '1') return;
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
    if (process.env.VERCEL || process.env.SERVERLESS) {
      writeDurableSnapshot().catch((e) => console.error('[DB] Durable save error:', e.message));
    } else {
      clearTimeout(durableSaveTimer);
      durableSaveTimer = setTimeout(() => {
        writeDurableSnapshot().catch((e) => console.error('[DB] Durable save error:', e.message));
      }, 100);
    }
  }
}

let pendingDurableWrite = null;
async function writeDurableSnapshot() {
  if (!mongoConnected) return;
  try {
    pendingDurableWrite = DurableState.findOneAndUpdate(
      { key: 'primary' },
      { key: 'primary', data: store },
      { upsert: true, setDefaultsOnInsert: true }
    ).exec();
    await pendingDurableWrite;
  } catch (err) {
    console.error('[DB] Durable snapshot write error:', err.message);
  } finally {
    pendingDurableWrite = null;
  }
}

async function flushPersist() {
  if (!mongoConnected) return;
  if (pendingDurableWrite) {
    await pendingDurableWrite;
  } else {
    await writeDurableSnapshot();
  }
}

async function hydrateFromDurableStore() {
  if (!MONGODB_URI) {
    console.warn('[DB] MONGODB_URI is not configured; using local JSON store.');
    return;
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    }
    mongoConnected = true;
    const snapshot = await DurableState.findOne({ key: 'primary' }).lean().exec();
    if (snapshot?.data && Array.isArray(snapshot.data.users) && snapshot.data.users.length > 0) {
      Object.keys(store).forEach((key) => {
        if (Array.isArray(snapshot.data[key])) store[key] = snapshot.data[key];
      });

      // Merge seed users, friendships, and messages if missing from durable store
      if (seedData && Array.isArray(seedData.users)) {
        let merged = false;
        seedData.users.forEach((seedUser) => {
          if (!store.users.some((u) => u._id === seedUser._id || (seedUser.loginCode && u.loginCode === seedUser.loginCode))) {
            store.users.push(seedUser);
            merged = true;
          }
        });
        if (Array.isArray(seedData.friendships)) {
          seedData.friendships.forEach((seedFriendship) => {
            if (!store.friendships.some((f) => f._id === seedFriendship._id)) {
              store.friendships.push(seedFriendship);
              merged = true;
            }
          });
        }
        if (Array.isArray(seedData.messages)) {
          seedData.messages.forEach((seedMsg) => {
            if (!store.messages.some((m) => m._id === seedMsg._id)) {
              store.messages.push(seedMsg);
              merged = true;
            }
          });
        }
        if (merged) {
          await writeDurableSnapshot();
        }
      }
      console.log(`[DB] Hydrated durable MongoDB state (${store.users.length} users, ${store.messages.length} messages)`);
    } else {
      await writeDurableSnapshot();
      console.log('[DB] Initialized durable MongoDB state from local store / seed data');
    }
  } catch (e) {
    mongoConnected = false;
    if (mongoConfigured) {
      throw new Error(`Durable MongoDB unavailable; refusing ephemeral fallback: ${e.message}`);
    }
    console.error('[DB] Durable MongoDB unavailable; continuing with local store:', e.message);
  }
}

function normalizeAccessCode(value) {
  let code = String(value || '').trim().toUpperCase();
  if (code.length === 8 && !code.includes('-')) code = `${code.slice(0, 4)}-${code.slice(4)}`;
  return code;
}
function accessCodeHash(value) {
  const secret = String(process.env.JWT_SECRET || 'pastel-chat-development-secret');
  return crypto.createHmac('sha256', secret).update(normalizeAccessCode(value)).digest('hex');
}
function maskedAccessCode(record) {
  return `DEMO••••${record.codeSuffix || ''}`;
}
function accessCodeStatus(record, now = Date.now()) {
  if (record.revokedAt) return 'Revoked';
  if (record.expiresAt && new Date(record.expiresAt).getTime() <= now) return 'Expired';
  return 'Active';
}
function accessCodeView(record) {
  return {
    _id: record._id,
    role: record.role,
    maskedCode: maskedAccessCode(record),
    label: record.label || '',
    status: accessCodeStatus(record),
    createdAt: record.createdAt,
    expiresAt: record.expiresAt || null,
    lastUsedAt: record.lastUsedAt || null
  };
}
function createAccessCode({ code, label = '', expiresAt = null, createdBy = null }) {
  const normalized = normalizeAccessCode(code);
  if (!normalized) return null;
  const record = {
    _id: genId(), role: 'DEMO', codeHash: accessCodeHash(normalized), codeSuffix: normalized.slice(-2),
    label: String(label || '').trim().slice(0, 120), createdAt: new Date().toISOString(),
    expiresAt: expiresAt || null, revokedAt: null, lastUsedAt: null, createdBy: createdBy || null
  };
  store.accessCodes.unshift(record); persist(); return record;
}
function generateDemoAccessCode() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const bytes = crypto.randomBytes(4);
    let suffix = '';
    for (let index = 0; index < 4; index += 1) suffix += CODE_ALPHABET[bytes[index] % CODE_ALPHABET.length];
    const code = `DEMO-${suffix}`;
    if (!store.accessCodes.some((record) => record.codeHash === accessCodeHash(code))) return code;
  }
  throw new Error('Could not generate unique demo access code');
}
function findAccessCodeByCode(code) {
  const hash = accessCodeHash(code);
  const record = store.accessCodes.find((item) => item.role === 'DEMO' && item.codeHash === hash);
  if (!record || accessCodeStatus(record) !== 'Active') return null;
  return record;
}
function findAccessCodeByHash(hash) {
  return store.accessCodes.find((item) => item.codeHash === hash) || null;
}
function findAccessCodeById(id) {
  return store.accessCodes.find((item) => item._id === id) || null;
}
function markAccessCodeUsed(id) {
  const record = store.accessCodes.find((item) => item._id === id);
  if (record) { record.lastUsedAt = new Date().toISOString(); persist(); }
  return record;
}
function revokeAccessCode(id) {
  const record = store.accessCodes.find((item) => item._id === id);
  if (record && !record.revokedAt) { record.revokedAt = new Date().toISOString(); persist(); }
  return record;
}
function revokeAccessCodeSessions(accessCodeId) {
  const now = new Date().toISOString();
  let count = 0;
  store.sessions.forEach((session) => {
    if (session.accessCodeId === accessCodeId && !session.revokedAt) { session.revokedAt = now; count += 1; }
  });
  if (count) persist();
  return count;
}
function ensureConfiguredAdmin() {
  const configuredAdminCode = normalizeAccessCode(process.env.ADMIN_LOGIN_CODE || 'ADMN-0307');
  const configuredAdmin = store.users.find((user) => user.isAdmin === true);
  if (configuredAdminCode && configuredAdmin) {
    if (configuredAdmin.loginCode !== null || configuredAdmin.adminRole !== 'OWNER') {
      configuredAdmin.loginCode = null;
      configuredAdmin.adminRole = 'OWNER';
      persist();
    }
  } else if (configuredAdminCode && !configuredAdmin) {
    store.users.push({
      _id: genId(), name: 'Admin', loginCode: null, isAdmin: true, adminRole: 'OWNER', authVersion: 0,
      isOnline: false, createdAt: new Date().toISOString(), lastSeen: new Date().toISOString(),
      avatar: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=admin&backgroundColor=add8e6&radius=50', chatBackground: 'default', chatColor: null
    });
    persist();
    console.log('[DB] Bootstrapped configured Admin user');
  } else if (!configuredAdmin) {
    console.warn('[DB] ADMIN_LOGIN_CODE is not configured; admin login is disabled.');
  }
  const configuredDemoCode = normalizeAccessCode(process.env.DEMO_LOGIN_CODE);
  if (configuredDemoCode && !findAccessCodeByHash(accessCodeHash(configuredDemoCode))) {
    createAccessCode({ code: configuredDemoCode, label: 'Initial demo access', createdBy: 'system' });
    console.log('[DB] Bootstrapped configured demo access code');
  }
}

function seedFromSnapshot() {
  if (seedData) {
    applySnapshot(seedData);
    ensureConfiguredAdmin();
    persist();
  }
  return {
    users: store.users.length,
    messages: store.messages.length,
    friendships: store.friendships.length,
    groups: store.groups.length
  };
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
    isSuspended: false,
    authVersion: 0,
    isTestAccount: false,
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

// ===== Sessions =====
function createSession({ _id, userId, expiresAt, adminRole = null, accessCodeId = null }) {
  const now = new Date().toISOString();
  const session = { _id, userId, createdAt: now, lastUsedAt: now, expiresAt, revokedAt: null, adminRole, accessCodeId };
  store.sessions.push(session);
  persist();
  return session;
}
function findSession(id) { return store.sessions.find((session) => session._id === id); }
function touchSession(id) {
  const session = findSession(id);
  if (session) { session.lastUsedAt = new Date().toISOString(); persist(); }
  return session;
}
function revokeSession(id) {
  const session = findSession(id);
  if (session && !session.revokedAt) { session.revokedAt = new Date().toISOString(); persist(); }
  return session;
}
function revokeUserSessions(userId) {
  const now = new Date().toISOString();
  let count = 0;
  store.sessions.forEach((session) => {
    if (session.userId === userId && !session.revokedAt) { session.revokedAt = now; count += 1; }
  });
  if (count) persist();
  return count;
}
function getActiveSessionCount(userId) {
  return store.sessions.filter((session) => session.userId === userId && !session.revokedAt && new Date(session.expiresAt) > new Date()).length;
}

// ===== Admin reports/audit =====
function createReport(input) {
  const report = {
    _id: genId(), reporterId: input.reporterId, reportedUserId: input.reportedUserId || null,
    entityType: String(input.entityType || 'user').slice(0, 40), entityId: input.entityId || null,
    category: String(input.category || 'other').slice(0, 60), description: String(input.description || '').slice(0, 2000),
    evidence: input.evidence && typeof input.evidence === 'object' ? { ...input.evidence } : null,
    status: 'Open', adminNotes: '', resolution: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  store.reports.unshift(report); persist(); return report;
}
function updateReport(id, updates) {
  const report = store.reports.find((item) => item._id === id);
  if (!report) return null;
  Object.assign(report, updates, { updatedAt: new Date().toISOString() }); persist(); return report;
}
function createAuditLog(input) {
  const log = {
    _id: genId(), adminId: input.adminId || null, action: String(input.action || 'unknown').slice(0, 80),
    targetType: String(input.targetType || '').slice(0, 40), targetId: input.targetId || null,
    metadata: input.metadata && typeof input.metadata === 'object' ? JSON.parse(JSON.stringify(input.metadata)) : {},
    createdAt: new Date().toISOString()
  };
  store.auditLogs.unshift(log); if (store.auditLogs.length > 5000) store.auditLogs.length = 5000; persist(); return log;
}
function createAnnouncement(input) {
  const announcement = {
    _id: genId(), title: String(input.title || '').trim().slice(0, 160), body: String(input.body || '').trim().slice(0, 2000),
    scope: String(input.scope || 'test'), pushEnabled: Boolean(input.pushEnabled), createdBy: input.createdBy, createdAt: new Date().toISOString()
  };
  store.announcements.unshift(announcement); persist(); return announcement;
}
function getStorageStatus() { return { configured: mongoConfigured, connected: mongoConnected }; }
function searchUsers(query, exceptId) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const eid = String(exceptId || '');
  return (store.users || [])
    .filter((u) => {
      if (!u || String(u._id) === eid) return false;
      const nameMatch = u.name && u.name.toLowerCase().includes(q);
      const codeMatch = u.loginCode && u.loginCode.toLowerCase().includes(q);
      return nameMatch || codeMatch;
    })
    .slice(0, 20)
    .map(userPublic)
    .filter(Boolean);
}
function getOnlineUsers() {
  return (store.users || []).filter((u) => u && u.isOnline).map(userPublic).filter(Boolean);
}
function userPublic(u) {
  if (!u) return null;
  return {
    _id: u._id, name: u.name, avatar: u.avatar,
    chatBackground: u.chatBackground, chatColor: u.chatColor || null, chatColors: u.chatColors || {}, isOnline: !!u.isOnline,
    bio: u.bio || '', status: u.status || '',
    loginMethod: u.loginMethod || 'code',
    isGoogleVerified: !!u.isGoogleVerified,
    isAI: !!u.isAI,
    aiCharacterId: u.aiCharacterId || null
  };
}

// ===== Friendships =====
// We store symmetric friendships (one row per pair direction). Friending is one-directional:
// A adds B with nickname "Buddy" → A sees B as "Buddy". B doesn't automatically see A.
function getFriends(userId) {
  if (!store.friendships || !Array.isArray(store.friendships)) return [];
  const uid = String(userId || '');
  if (uid && uid !== AI_USER_ID) {
    ensureAIFriendship(uid);
  }
  return store.friendships
    .filter((f) => String(f.userId) === uid)
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
        addedAt: f.createdAt,
        isAI: !!friend.isAI,
        aiCharacterId: friend.aiCharacterId || null,
        bio: friend.bio || '',
        status: friend.status || ''
      };
    })
    .filter(Boolean);
}
function findFriendship(userId, friendId) {
  if (!store.friendships || !Array.isArray(store.friendships)) return null;
  const ownerId = String(userId || '');
  const targetId = String(friendId || '');
  return store.friendships.find((f) => String(f.userId) === ownerId && String(f.friendId) === targetId) || null;
}
function addFriend(userId, friendId, customNickname) {
  const uId = String(userId || '');
  const fId = String(friendId || '');
  if (!uId || !fId || uId === fId) return null;
  if (findFriendship(uId, fId)) return findFriendship(uId, fId);
  const friend = findUserById(fId);
  const nickname = (customNickname || friend?.name || 'Friend').trim().slice(0, 50);
  const f = {
    _id: genId(),
    userId: uId,
    friendId: fId,
    customNickname: nickname,
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
  const ownerId = String(userId);
  const targetId = String(friendId);
  const idx = store.friendships.findIndex((f) => String(f.userId) === ownerId && String(f.friendId) === targetId);
  if (idx >= 0) { store.friendships.splice(idx, 1); persist(); return true; }
  return false;
}

// ===== Friend Requests =====
function createRequest(fromId, toId) {
  const fId = String(fromId || '');
  const tId = String(toId || '');
  if (!fId || !tId || fId === tId) return null;
  if (findFriendship(fId, tId) || findFriendship(tId, fId)) return null;
  if (findRequest(fId, tId)) return findRequest(fId, tId);
  
  const reverseReq = findRequest(tId, fId);
  if (reverseReq) {
    // Both users tried to add each other: auto-accept and connect as mutual friends!
    removeRequest(reverseReq._id);
    const u1 = findUserById(fId);
    const u2 = findUserById(tId);
    if (u1 && u2) {
      addFriend(u1._id, u2._id, u2.name);
      addFriend(u2._id, u1._id, u1.name);
    }
    return { _id: genId(), fromId: fId, toId: tId, status: 'accepted', autoAccepted: true };
  }

  const req = {
    _id: genId(),
    fromId: fId,
    toId: tId,
    createdAt: new Date().toISOString()
  };
  store.friendRequests.push(req);
  persist();
  return req;
}

function findRequest(fromId, toId) {
  if (!store.friendRequests || !Array.isArray(store.friendRequests)) return null;
  const from = String(fromId);
  const to = String(toId);
  return store.friendRequests.find((r) => String(r.fromId) === from && String(r.toId) === to) || null;
}

function findRequestById(id) {
  if (!store.friendRequests || !Array.isArray(store.friendRequests)) return null;
  return store.friendRequests.find((r) => String(r._id) === String(id)) || null;
}

function removeRequest(idOrFromId, maybeToId) {
  if (!store.friendRequests || !Array.isArray(store.friendRequests)) return false;
  const searchId = String(idOrFromId || '');
  let idx = store.friendRequests.findIndex((r) => String(r._id) === searchId);
  if (idx < 0 && maybeToId) {
    const toId = String(maybeToId || '');
    idx = store.friendRequests.findIndex((r) => (String(r.fromId) === searchId && String(r.toId) === toId) || (String(r.fromId) === toId && String(r.toId) === searchId));
  }
  if (idx >= 0) {
    store.friendRequests.splice(idx, 1);
    persist();
    return true;
  }
  return false;
}

function getRequests(userId) {
  if (!store.friendRequests || !Array.isArray(store.friendRequests)) return [];
  const uid = String(userId || '');
  return store.friendRequests
    .filter(r => String(r.toId) === uid)
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
    clientMessageId: null,
    deliveredAt: null,
    readAt: null,
    deliveryReceipts: {}, // group recipients: { userId: { deliveredAt, readAt } }
    media: null,   // { type: 'image'|'file', dataUrl, name, size }
    ...doc
  };
  store.messages.push(msg);
  persist();
  return msg;
}

function findMessageByClientMessageId(senderId, clientMessageId) {
  if (!senderId || !clientMessageId) return null;
  return store.messages.find((message) => (
    String(message.senderId) === String(senderId) &&
    String(message.clientMessageId || '') === String(clientMessageId)
  ));
}

function markMessageDelivered(messageId, recipientId) {
  const message = findMessage(messageId);
  if (!message || !recipientId || String(message.senderId) === String(recipientId)) return null;
  const now = new Date().toISOString();
  if (message.groupId) {
    message.deliveryReceipts = message.deliveryReceipts || {};
    const receipt = message.deliveryReceipts[recipientId] || {};
    if (!receipt.deliveredAt) receipt.deliveredAt = now;
    message.deliveryReceipts[recipientId] = receipt;
  } else if (!message.deliveredAt) {
    message.deliveredAt = now;
  }
  persist();
  return message;
}

function markMessageRead(messageId, readerId) {
  const message = findMessage(messageId);
  if (!message || !readerId || String(message.senderId) === String(readerId)) return null;
  const now = new Date().toISOString();
  if (message.groupId) {
    message.deliveryReceipts = message.deliveryReceipts || {};
    const receipt = message.deliveryReceipts[readerId] || {};
    if (!receipt.deliveredAt) receipt.deliveredAt = now;
    if (!receipt.readAt) receipt.readAt = now;
    message.deliveryReceipts[readerId] = receipt;
  } else {
    if (!message.deliveredAt) message.deliveredAt = now;
    if (!message.readAt) message.readAt = now;
  }
  persist();
  return message;
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
function populateMessage(msg, viewerId = null) {
  if (!msg) return null;
  const sender = findUserById(msg.senderId);
  const receiver = findUserById(msg.receiverId);
  const groupReceipts = Object.values(msg.deliveryReceipts || {});
  const groupRead = groupReceipts.some((receipt) => receipt.readAt);
  const groupDelivered = groupReceipts.some((receipt) => receipt.deliveredAt);
  const populated = {
    ...msg,
    senderId: userPublic(sender),
    receiverId: userPublic(receiver),
    deliveryStatus: String(msg.senderId) === String(viewerId)
      ? (msg.readAt || groupRead ? 'read' : msg.deliveredAt || groupDelivered ? 'delivered' : 'sent')
      : 'sent'
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
  return msgs.map((message) => populateMessage(message, userA)).reverse();
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
  if (!store.groups || !Array.isArray(store.groups) || !id) return null;
  return store.groups.find(g => String(g._id) === String(id)) || null;
}
function getGroupsForUser(userId) {
  if (!store.groups || !Array.isArray(store.groups)) return [];
  const uid = String(userId || '');
  return store.groups.filter(g => Array.isArray(g.members) && g.members.map(String).includes(uid));
}
function groupPublic(g) {
  if (!g) return null;
  const members = Array.isArray(g.members) ? g.members : [];
  return {
    _id: g._id,
    name: g.name,
    creatorId: g.creatorId,
    members: members.map(id => userPublic(findUserById(id))).filter(Boolean),
    memberCount: members.length,
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
function getGroupConversation(groupId, { limit = 100, before = null, viewerId = null } = {}) {
  let msgs = store.messages.filter(m => m.groupId === groupId);
  if (before) {
    const cutoff = new Date(before);
    msgs = msgs.filter(m => new Date(m.timestamp) < cutoff);
  }
  msgs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  msgs = msgs.slice(0, limit);
  return msgs.map(m => populateMessage(m, viewerId)).reverse();
}

// ===== Private Space: Notes =====
function createNote(userId, { title, content, sharedWith = [], images = [] }) {
  const note = {
    _id: genId(),
    userId,
    title: (title || '').slice(0, 120),
    content: (content || '').slice(0, 5000),
    sharedWith: Array.isArray(sharedWith)
      ? [...new Set(sharedWith.map((recipient) => String(recipient?._id || recipient || '').trim()).filter(Boolean))]
      : [],
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
  const normalizedUserId = String(userId);
  return store.notes
    .filter((note) => String(note.userId) === normalizedUserId || (Array.isArray(note.sharedWith) && note.sharedWith.some((recipient) => {
      const recipientId = recipient && typeof recipient === 'object'
        ? (recipient._id || recipient.id || recipient.userId)
        : recipient;
      return recipientId != null && String(recipientId) === normalizedUserId;
    })))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
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
  if (updates.sharedWith !== undefined) {
    n.sharedWith = Array.isArray(updates.sharedWith)
      ? [...new Set(updates.sharedWith.map((recipient) => String(recipient?._id || recipient || '').trim()).filter(Boolean))]
      : [];
  }
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

// ===== Shared media =====
const SHARED_MEDIA_EXPIRATIONS = Object.freeze({ never: null, '1h': 60 * 60 * 1000, '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000 });
function resolveSharedMediaExpiry(expiration = 'never') {
  if (!Object.prototype.hasOwnProperty.call(SHARED_MEDIA_EXPIRATIONS, expiration)) return undefined;
  const duration = SHARED_MEDIA_EXPIRATIONS[expiration];
  return duration ? new Date(Date.now() + duration).toISOString() : null;
}
function isSharedMediaExpired(photo, now = Date.now()) {
  return Boolean(photo?.expiresAt && new Date(photo.expiresAt).getTime() <= now);
}
function purgeExpiredSharedMedia(now = Date.now()) {
  const before = store.sharedPhotos.length;
  store.sharedPhotos = store.sharedPhotos.filter((photo) => !isSharedMediaExpired(photo, now));
  const removed = before - store.sharedPhotos.length;
  if (removed) persist();
  return removed;
}
function addSharedPhoto({ _id, dataUrl, caption, uploadedBy, createdAt, isHidden = false, mediaType = 'image', expiresAt = null }) {
  purgeExpiredSharedMedia();
  const photo = { _id, dataUrl, caption, uploadedBy, createdAt, isHidden: !!isHidden, mediaType: mediaType === 'video' ? 'video' : 'image', expiresAt: expiresAt || null };
  store.sharedPhotos.unshift(photo);
  if (store.sharedPhotos.length > 200) store.sharedPhotos = store.sharedPhotos.slice(0, 200);
  persist();
  return photo;
}
function getSharedPhotos(userId) {
  purgeExpiredSharedMedia();
  const normalizedUserId = String(userId);
  return store.sharedPhotos
    .filter((photo) => String(photo.uploadedBy?._id) === normalizedUserId || Boolean(findFriendship(photo.uploadedBy?._id, normalizedUserId) || findFriendship(normalizedUserId, photo.uploadedBy?._id)))
    .slice(0, 50);
}
function togglePhotoEncryption(photoId, userId, isHidden) {
  const photo = store.sharedPhotos.find(p => p._id === photoId);
  if (!photo) return null;
  if (photo.uploadedBy._id !== userId) return null;
  photo.isHidden = !!isHidden;
  persist();
  return photo;
}
function deleteSharedPhoto(photoId, userId) {
  purgeExpiredSharedMedia();
  const index = store.sharedPhotos.findIndex((photo) => String(photo._id) === String(photoId));
  if (index < 0) return null;
  const photo = store.sharedPhotos[index];
  if (String(photo.uploadedBy?._id) !== String(userId)) return false;
  store.sharedPhotos.splice(index, 1);
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
    status: 'Open', priority: 'Normal', adminNotes: '', response: '', assignedAdminId: null,
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
  ensureConfiguredAdmin();
  if (store.releases.length === 0) {
    const release = createRelease(INITIAL_RELEASE);
    if (release) notifyUsersOfRelease(release);
  }
}).catch(() => {});

module.exports = {
  store, persist, flushPersist, hydrateFromDurableStore, ready, isDurableStorageEnabled: () => mongoConnected, genId, generateLoginCode,
  normalizeAccessCode, createAccessCode, generateDemoAccessCode, findAccessCodeByCode, findAccessCodeById, accessCodeView,
  markAccessCodeUsed, revokeAccessCode, revokeAccessCodeSessions,
  findUser, findUserById, findUserByName, findUserByVerificationCode, isNameTaken,
  createUser, updateUser, searchUsers, getOnlineUsers, userPublic,
  createSession, findSession, touchSession, revokeSession, revokeUserSessions, getActiveSessionCount,
  createReport, updateReport, createAuditLog, createAnnouncement, getStorageStatus,
  getFriends, findFriendship, addFriend, updateFriend, removeFriend,
  createRequest, findRequest, findRequestById, removeRequest, getRequests,
  findMessage, findMessageByClientMessageId, createMessage, updateMessage, populateMessage, toggleReaction,
  markMessageDelivered, markMessageRead,
  getConversation, getPinnedMessages, searchMessages, clearConversation,
  createGroup, findGroup, getGroupsForUser, groupPublic,
  addGroupMember, removeGroupMember, updateGroup, getGroupConversation,
  createNote, findNote, getUserNotes, deleteNote, updateNote,
  createReminder, getUserReminders, findReminder, deleteReminder,
  createBirthday, getUserBirthdays, findBirthday, deleteBirthday,
  addSharedPhoto, getSharedPhotos, togglePhotoEncryption, deleteSharedPhoto,
  resolveSharedMediaExpiry, isSharedMediaExpired, purgeExpiredSharedMedia,
  storePushSubscription, removePushSubscription, getPushSubscriptions, getPushLanguage,
  createNotification, getUserNotifications, getUnreadNotificationCount,
  markNotificationRead, markAllNotificationsRead,
  getReleases, findRelease, createRelease, notifyUsersOfRelease, markReleaseSeen, hasSeenRelease,
  createFeedback, seedFromSnapshot, seedData,
  AI_USER_ID, AI_CHARACTER_ID, ensureAICharacter, ensureAIFriendship,
  getAICharacter, getAICharacterState, updateAICharacterState,
  getAIRelationship, updateAIRelationship,
  getAIMemories, addAIMemory, deleteAIMemory, getAILifeEvents, isAIUser, updateAIAvatar
};
