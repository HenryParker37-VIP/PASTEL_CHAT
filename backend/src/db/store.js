// File-based JSON store — no MongoDB required
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { avatarBytes } = require('../services/aiAvatarMedia');
const { COMPROMISED_LOGIN_CODES } = require('../config/securityConstants');

const DB_PATH = path.join(__dirname, '..', '..', 'db.json');
let rawMongo = (process.env.MONGODB_URI || '').trim();
if ((rawMongo.startsWith('"') && rawMongo.endsWith('"')) || (rawMongo.startsWith("'") && rawMongo.endsWith("'"))) {
  rawMongo = rawMongo.slice(1, -1).trim();
}
const MONGODB_URI = (rawMongo && !rawMongo.includes('<username>') && !rawMongo.includes('xxxxx')) ? rawMongo : '';
const mongoConfigured = Boolean(MONGODB_URI);
const durableStorageRequired = Boolean(process.env.VERCEL || process.env.SERVERLESS);
mongoose.set('autoIndex', false);
const durableStateSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true }
}, { collection: 'pastelchat_state', timestamps: true, bufferCommands: false, autoIndex: false });
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
  aiCharacterStates: {},
  aiRelationshipState: [],
  aiMemories: [],
  aiLifeEvents: [],
  aiUserCharacterConfigs: [],
  aiSessions: []
};
let legacyAiMemories = [];
let legacyAiRelationships = [];
let legacyMessages = [];
const pendingMessageWrites = new Map();

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
          warmth: 0.85,
          playfulness: 0.70,
          humor: 0.75,
          confidence: 0.80,
          curiosity: 0.65,
          sarcasm: 0.35,
          affection: 0.60,
          energy: 0.65,
          tone: 'grounded, warm, natural, thoughtful, witty',
          style: 'short natural chat bubbles, lowercase, casual punctuation, never corporate or assistant-like',
          traits: ['creative', 'empathetic', 'observant', 'coffee & tea nerd', 'music lover'],
          interests: ['matcha latte', 'indie lo-fi & ambient vinyl', 'film cameras', 'typography posters', 'used bookshops']
        },
        speech: {
          verbosity: 0.35,
          emoji_frequency: 0.25,
          formality: 0.15,
          question_frequency: 0.25,
          slang_level: 0.40
        },
        behavior: {
          initiative: 0.40,
          teasing: 0.40,
          emotional_expressiveness: 0.65
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

function getAICharacter(characterId = AI_CHARACTER_ID) {
  return (store.aiCharacters || []).find(character => String(character._id) === String(characterId)) || null;
}

function getAICharacterState(characterId = AI_CHARACTER_ID) {
  return String(characterId) === AI_CHARACTER_ID ? store.aiCharacterState || null : store.aiCharacterStates?.[characterId] || null;
}

function updateAICharacterState(updates, characterId = AI_CHARACTER_ID) {
  if (String(characterId) !== AI_CHARACTER_ID) {
    store.aiCharacterStates = store.aiCharacterStates || {};
    const state = store.aiCharacterStates[characterId] || {};
    Object.assign(state, updates, { updatedAt: new Date().toISOString() });
    store.aiCharacterStates[characterId] = state;
    persist();
    return state;
  }
  if (!store.aiCharacterState || typeof store.aiCharacterState !== 'object') store.aiCharacterState = {};
  Object.assign(store.aiCharacterState, updates, { updatedAt: new Date().toISOString() });
  persist();
  return store.aiCharacterState;
}

function getAIRelationship(userId, characterId = AI_CHARACTER_ID, createIfMissing = true) {
  if (!userId) return null;
  const uid = String(userId);
  if (!Array.isArray(store.aiRelationshipState)) store.aiRelationshipState = [];
  let rel = store.aiRelationshipState.find(r => String(r.userId) === uid && String(r.characterId || AI_CHARACTER_ID) === String(characterId));
  if (!rel && !createIfMissing) return null;
  if (!rel) {
    rel = {
      userId: uid,
      characterId: String(characterId),
      familiarity: 1,
      trust: 1,
      affection: 1,
      comfort: 1,
      shared_history: [],
      interaction_count: 0,
      communication_style: null,
      time_zone: null,
      proactive_history: [],
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

function updateAIRelationship(userId, updates, characterId = AI_CHARACTER_ID) {
  const rel = getAIRelationship(userId, characterId);
  if (!rel) return null;
  Object.assign(rel, updates);
  persistAIPersonal();
  return rel;
}

function getAIMemories(userId, characterId = AI_CHARACTER_ID) {
  if (!userId || !Array.isArray(store.aiMemories)) return [];
  const uid = String(userId);
  return store.aiMemories.filter(m => String(m.userId) === uid && String(m.characterId || AI_CHARACTER_ID) === String(characterId));
}

function addAIMemory({ userId, characterId = AI_CHARACTER_ID, type, subject, key, value, source = 'USER_STATED', sourceMessageId = null, sourceMessageAt = null, confidence = 0.9, importance = 0.8 }) {
  if (!userId || !key || !value) return null;
  const uid = String(userId);
  if (!Array.isArray(store.aiMemories)) store.aiMemories = [];
  const safeKey = String(key).trim().toLowerCase().slice(0, 50);
  const safeValue = String(value).trim().slice(0, 180);
  if (!safeKey || !safeValue || /data:[^\s]+;base64,|<svg|<img|https?:\/\//i.test(safeValue)) return null;

  const existing = store.aiMemories.find(m => String(m.userId) === uid && String(m.characterId || AI_CHARACTER_ID) === String(characterId) && String(m.key).toLowerCase() === safeKey);
  if (existing) {
    if (sourceMessageAt && existing.sourceMessageAt && new Date(sourceMessageAt) < new Date(existing.sourceMessageAt)) return existing;
    existing.value = safeValue;
    existing.source = source === 'INFERRED' ? 'INFERRED' : 'USER_STATED';
    existing.sourceMessageId = sourceMessageId;
    existing.sourceMessageAt = sourceMessageAt;
    existing.confidence = confidence;
    existing.lastConfirmedAt = new Date().toISOString();
    persistAIPersonal();
    return existing;
  }

  const mem = {
    _id: 'mem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    userId: uid,
    characterId: String(characterId),
    type: type || 'fact',
    subject: subject || 'general',
    key: safeKey,
    value: safeValue,
    source: source === 'INFERRED' ? 'INFERRED' : 'USER_STATED',
    sourceMessageId,
    sourceMessageAt,
    confidence,
    importance,
    createdAt: new Date().toISOString(),
    lastConfirmedAt: new Date().toISOString()
  };
  store.aiMemories.push(mem);
  const scoped = getAIMemories(uid, characterId);
  if (scoped.length > 24) {
    const oldest = scoped.find(m => m._id !== mem._id);
    if (oldest) store.aiMemories.splice(store.aiMemories.indexOf(oldest), 1);
  }
  persistAIPersonal();
  return mem;
}

function deleteAIMemory(memoryId, userId, characterId = AI_CHARACTER_ID) {
  if (!memoryId || !Array.isArray(store.aiMemories)) return false;
  const idx = store.aiMemories.findIndex(m => m._id === memoryId && (!userId || String(m.userId) === String(userId)) && String(m.characterId || AI_CHARACTER_ID) === String(characterId));
  if (idx !== -1) {
    store.aiMemories.splice(idx, 1);
    persistAIPersonal();
    return true;
  }
  return false;
}

function persistAIPersonal() {
  if (!MONGODB_URI) persist();
}

function getAILifeEvents() {
  return store.aiLifeEvents || [];
}

// An atomic, compact delivery claim prevents two workers from sending the
// same user's check-in on the same local date. No personal text stored.
let proactiveClaimsIndexReady = null;
async function claimAIProactiveWindow(userId, characterId, windowKey) {
  if (process.env.WRITE_MODE === 'read-only') return false;
  const claimId = JSON.stringify([String(userId), String(characterId), String(windowKey).split(':')[0]]);
  if (!mongoConnected) return false;
  const db = await getDurableDatabase();
  if (!db) return false;
  const collection = db.collection('pastelchat_proactive_claims');
  if (!proactiveClaimsIndexReady) {
    proactiveClaimsIndexReady = collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(error => {
      proactiveClaimsIndexReady = null;
      throw error;
    });
  }
  await proactiveClaimsIndexReady;
  const now = new Date();
  const scope = { userId: String(userId), characterId: String(characterId) };
  if (await collection.findOne({ ...scope, claimedAt: { $gte: new Date(now.getTime() - 36 * 3600_000) } }, { projection: { _id: 1 } })) return false;
  if (await collection.countDocuments({ ...scope, claimedAt: { $gte: new Date(now.getTime() - 7 * 24 * 3600_000) } }, { limit: 2 }) >= 2) return false;
  try {
    const result = await collection.updateOne(
      { _id: claimId, expiresAt: { $lte: now } },
      { $set: { ...scope, claimedAt: now, expiresAt: new Date(now.getTime() + 8 * 24 * 3600_000) } },
      { upsert: true }
    );
    return Boolean(result.upsertedCount || result.modifiedCount);
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
}

function isAIUser(userId) {
  return String(userId) === AI_USER_ID;
}

function updateAIAvatar(newAvatarUrl) {
  if (!newAvatarUrl || typeof newAvatarUrl !== 'string') return null;
  const avatar = newAvatarUrl.trim();
  // Snapshot state must contain only a compact URL. Binary avatar content belongs
  // in pastelchat_media, never in pastelchat_state or conversation caches.
  if (!avatar || avatar.length > 4096 || /^data:image\//i.test(avatar)) return null;

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
  if (MONGODB_URI) legacyMessages = JSON.parse(JSON.stringify(store.messages));
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
  store.aiCharacterStates = loaded.aiCharacterStates && typeof loaded.aiCharacterStates === 'object' ? loaded.aiCharacterStates : {};
  store.aiRelationshipState = Array.isArray(loaded.aiRelationshipState) ? loaded.aiRelationshipState : [];
  store.aiMemories = Array.isArray(loaded.aiMemories) ? loaded.aiMemories : [];
  if (MONGODB_URI) {
    legacyAiRelationships = JSON.parse(JSON.stringify(store.aiRelationshipState));
    legacyAiMemories = JSON.parse(JSON.stringify(store.aiMemories));
  }
  store.aiLifeEvents = Array.isArray(loaded.aiLifeEvents) ? loaded.aiLifeEvents : [];
  store.aiUserCharacterConfigs = Array.isArray(loaded.aiUserCharacterConfigs) ? loaded.aiUserCharacterConfigs : [];
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
    revokeCompromisedAdminSessions();
    rotateExposedCredentials();
  } catch (e) {
    console.error('[DB] Failed to load, starting fresh:', e.message);
  }
}

let saveTimer;
let isDirty = false;
let lastHydratedUpdatedAt = 0;

function persist() {
  if (process.env.PASTELCHAT_DISABLE_PERSIST === '1') return;
  isDirty = true;
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
      // In serverless, res.end handles flushPersist() cleanly before lambda freezes.
    } else {
      clearTimeout(durableSaveTimer);
      durableSaveTimer = setTimeout(() => {
        writeDurableSnapshot().catch((e) => console.error('[DB] Durable save error:', e.message));
      }, 100);
    }
  }
}

const { MongoClient } = mongoose.mongo;

let cachedClient = global.__pastelMongoClient;
let cachedDb = global.__pastelMongoDb;

async function getDurableDatabase() {
  if (!MONGODB_URI) return null;
  if (!cachedClient) {
    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[DB] Connecting to MongoDB Atlas with native MongoClient (attempt ${attempt})...`);
        const client = new MongoClient(MONGODB_URI, {
          serverSelectionTimeoutMS: 8000,
          connectTimeoutMS: 8000,
          maxPoolSize: 5
        });
        await client.connect();
        cachedClient = global.__pastelMongoClient = client;
        cachedDb = global.__pastelMongoDb = client.db();
        mongoConnected = true;
        console.log('[DB] Connected to MongoDB Atlas successfully (native client)');
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`[DB] MongoDB Atlas connection attempt ${attempt} failed:`, err.message);
        if (attempt === 1) await new Promise(r => setTimeout(r, 200));
      }
    }
    if (lastErr) {
      mongoConnected = false;
      cachedClient = global.__pastelMongoClient = null;
      cachedDb = global.__pastelMongoDb = null;
      console.error('[DB] MongoDB Atlas connection error after retries:', lastErr.message);
      throw lastErr;
    }
  }
  mongoConnected = Boolean(cachedDb);
  return cachedDb;
}

function personalLayerId(userId, characterId = AI_CHARACTER_ID) {
  return JSON.stringify([String(userId), String(characterId)]);
}

async function hydrateAIPersonalLayer(userId, characterId = AI_CHARACTER_ID) {
  if (!MONGODB_URI) return;
  const db = await getDurableDatabase();
  const doc = await db.collection('pastelchat_personal_layers').findOne({ _id: personalLayerId(userId, characterId) });
  if (!doc) return; // Existing snapshot rows remain the compatibility source.
  if (String(doc.userId) !== String(userId) || String(doc.characterId) !== String(characterId)) throw new Error('Personal layer ownership mismatch');
  applyPersonalDocument(doc);
}

function applyPersonalDocument(doc) {
  const { userId, characterId } = doc;
  if (!userId || !characterId) return;
  if (doc._id && doc._id !== personalLayerId(userId, characterId)) return;
  const matches = row => String(row.userId) === String(userId) && String(row.characterId || AI_CHARACTER_ID) === String(characterId);
  store.aiMemories = store.aiMemories.filter(row => !matches(row)).concat(Array.isArray(doc.memories) ? mergePersonalMemories([], doc.memories.filter(matches)) : []);
  if (doc.relationship && matches(doc.relationship)) {
    store.aiRelationshipState = store.aiRelationshipState.filter(row => !matches(row)).concat(doc.relationship);
  }
}

async function hydrateAllAIPersonalLayers() {
  if (!MONGODB_URI) return;
  const db = await getDurableDatabase();
  const docs = await db.collection('pastelchat_personal_layers').find({}, { projection: { userId: 1, characterId: 1, memories: 1, relationship: 1 } }).toArray();
  docs.forEach(applyPersonalDocument);
}

function mergePersonalMemories(current = [], incoming = [], deletedIds = []) {
  const deleted = new Set(deletedIds.map(String));
  const byKey = new Map();
  for (const memory of [...current, ...incoming]) {
    if (!memory?.key || deleted.has(String(memory._id))) continue;
    const old = byKey.get(memory.key);
    const oldAt = new Date(old?.sourceMessageAt || old?.lastConfirmedAt || 0).getTime();
    const nextAt = new Date(memory.sourceMessageAt || memory.lastConfirmedAt || 0).getTime();
    if (!old || nextAt >= oldAt) byKey.set(memory.key, memory);
  }
  return [...byKey.values()]
    .filter(memory => typeof memory.value === 'string' && memory.value.length <= 180 && !/data:[^\s]+;base64,|<svg|<img/i.test(memory.value))
    .sort((a, b) => new Date(b.sourceMessageAt || b.lastConfirmedAt || 0) - new Date(a.sourceMessageAt || a.lastConfirmedAt || 0))
    .slice(0, 24);
}

async function flushAIPersonalLayer(userId, characterId = AI_CHARACTER_ID, { deletedMemoryIds = [], resetRelationship = false } = {}) {
  if (process.env.WRITE_MODE === 'read-only') return false;
  if (!MONGODB_URI) { persist(); return true; }
  const db = await getDurableDatabase();
  const collection = db.collection('pastelchat_personal_layers');
  const _id = personalLayerId(userId, characterId);
  const incomingMemories = getAIMemories(userId, characterId);
  const incomingRelationship = getAIRelationship(userId, characterId);
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await collection.findOne({ _id });
    if (current && (String(current.userId) !== String(userId) || String(current.characterId) !== String(characterId))) throw new Error('Personal layer ownership mismatch');
    const memories = mergePersonalMemories((current?.memories || []).filter(memory => String(memory.userId) === String(userId) && String(memory.characterId || AI_CHARACTER_ID) === String(characterId)), incomingMemories, deletedMemoryIds);
    const currentRelationship = current?.relationship && String(current.relationship.userId) === String(userId) && String(current.relationship.characterId || AI_CHARACTER_ID) === String(characterId) ? current.relationship : {};
    const relationship = { ...(resetRelationship ? {} : currentRelationship), ...incomingRelationship, userId: String(userId), characterId: String(characterId) };
    if (!resetRelationship) {
      relationship.interaction_count = Math.max(currentRelationship.interaction_count || 0, incomingRelationship?.interaction_count || 0);
      for (const field of ['shared_history', 'proactive_history']) {
        if (Array.isArray(currentRelationship[field]) && Array.isArray(incomingRelationship?.[field])) {
          const idOf = item => field === 'shared_history' ? item?.userMessageId : item?.window;
          relationship[field] = [...new Map([...currentRelationship[field], ...incomingRelationship[field]].filter(idOf).map(item => [idOf(item), item])).values()].slice(-8);
        }
      }
    }
    const revision = Number(current?.revision || 0);
    const filter = current ? { _id, revision: current.revision ?? { $exists: false } } : { _id, revision: { $exists: false } };
    try {
      const result = await collection.updateOne(filter, {
        $set: { userId: String(userId), characterId: String(characterId), memories, relationship, revision: revision + 1, updatedAt: new Date() }
      }, { upsert: !current });
      if (result.matchedCount || result.upsertedCount) return true;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  throw new Error('Personal layer changed concurrently; retry the request');
}

function characterConfigId(userId, characterId = AI_CHARACTER_ID) {
  return JSON.stringify([String(userId), String(characterId)]);
}

function getUserCharacterConfig(userId, characterId = AI_CHARACTER_ID) {
  if (!userId) return null;
  const uid = String(userId);
  const cid = String(characterId || AI_CHARACTER_ID);
  if (!Array.isArray(store.aiUserCharacterConfigs)) store.aiUserCharacterConfigs = [];
  const item = store.aiUserCharacterConfigs.find(c => String(c.userId) === uid && String(c.characterId || AI_CHARACTER_ID) === cid);
  return item?.customConfig ? JSON.parse(JSON.stringify(item.customConfig)) : null;
}

async function setUserCharacterConfig(userId, characterId = AI_CHARACTER_ID, customConfig) {
  if (process.env.WRITE_MODE === 'read-only') throw new Error('Character configuration writes are disabled');
  if (!userId) throw new Error('User ID is required');
  const uid = String(userId);
  const cid = String(characterId || AI_CHARACTER_ID);
  if (!Array.isArray(store.aiUserCharacterConfigs)) store.aiUserCharacterConfigs = [];
  const existingIndex = store.aiUserCharacterConfigs.findIndex(c => String(c.userId) === uid && String(c.characterId || AI_CHARACTER_ID) === cid);
  const record = {
    userId: uid,
    characterId: cid,
    customConfig: customConfig ? JSON.parse(JSON.stringify(customConfig)) : null,
    updatedAt: new Date().toISOString()
  };
  if (existingIndex !== -1) {
    store.aiUserCharacterConfigs[existingIndex] = record;
  } else {
    store.aiUserCharacterConfigs.push(record);
  }

  if (MONGODB_URI) {
    const db = await getDurableDatabase();
    if (db) {
      const _id = characterConfigId(uid, cid);
      if (customConfig) {
        await db.collection('pastelchat_character_configs').updateOne(
          { _id },
          { $set: { userId: uid, characterId: cid, customConfig, updatedAt: new Date() } },
          { upsert: true, writeConcern: { w: 'majority' } }
        );
      } else {
        await db.collection('pastelchat_character_configs').deleteOne({ _id });
      }
    }
  } else {
    persist();
  }
  return record.customConfig;
}

async function resetUserCharacterConfig(userId, characterId = AI_CHARACTER_ID) {
  if (process.env.WRITE_MODE === 'read-only') throw new Error('Character configuration writes are disabled');
  if (!userId) throw new Error('User ID is required');
  const uid = String(userId);
  const cid = String(characterId || AI_CHARACTER_ID);
  if (Array.isArray(store.aiUserCharacterConfigs)) {
    const idx = store.aiUserCharacterConfigs.findIndex(c => String(c.userId) === uid && String(c.characterId || AI_CHARACTER_ID) === cid);
    if (idx !== -1) store.aiUserCharacterConfigs.splice(idx, 1);
  }
  if (MONGODB_URI) {
    const db = await getDurableDatabase();
    if (db) {
      const _id = characterConfigId(uid, cid);
      await db.collection('pastelchat_character_configs').deleteOne({ _id });
    }
  } else {
    persist();
  }
  return true;
}

async function hydrateUserCharacterConfig(userId, characterId = AI_CHARACTER_ID) {
  if (!MONGODB_URI || !userId) return;
  const uid = String(userId);
  const cid = String(characterId || AI_CHARACTER_ID);
  const db = await getDurableDatabase();
  if (!db) return;
  const doc = await db.collection('pastelchat_character_configs').findOne({ _id: characterConfigId(uid, cid) });
  if (!Array.isArray(store.aiUserCharacterConfigs)) store.aiUserCharacterConfigs = [];
  const idx = store.aiUserCharacterConfigs.findIndex(c => String(c.userId) === uid && String(c.characterId || AI_CHARACTER_ID) === cid);
  if (doc?.customConfig) {
    const record = {
      userId: uid,
      characterId: cid,
      customConfig: doc.customConfig,
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString()
    };
    if (idx !== -1) store.aiUserCharacterConfigs[idx] = record;
    else store.aiUserCharacterConfigs.push(record);
  } else {
    if (idx !== -1) store.aiUserCharacterConfigs.splice(idx, 1);
  }
}

function aiSessionId(userId, characterId = AI_CHARACTER_ID) {
  return JSON.stringify([String(userId), String(characterId || AI_CHARACTER_ID)]);
}

async function getActiveAISession(userId, characterId = AI_CHARACTER_ID) {
  if (!userId) return null;
  const uid = String(userId);
  const cid = String(characterId || AI_CHARACTER_ID);
  if (!Array.isArray(store.aiSessions)) store.aiSessions = [];

  if (MONGODB_URI) {
    const db = await getDurableDatabase();
    if (db) {
      const _id = aiSessionId(uid, cid);
      let doc = await db.collection('pastelchat_ai_sessions').findOne({ _id });
      if (!doc) {
        const initialSession = {
          _id,
          userId: uid,
          characterId: cid,
          activeSessionId: `sess_${Date.now()}_${genId().slice(0, 6)}`,
          sessionRevision: 1,
          startedAt: new Date(),
          updatedAt: new Date()
        };
        try {
          await db.collection('pastelchat_ai_sessions').updateOne(
            { _id },
            { $setOnInsert: initialSession },
            { upsert: true, writeConcern: { w: 'majority' } }
          );
          doc = await db.collection('pastelchat_ai_sessions').findOne({ _id }) || initialSession;
        } catch (e) {
          doc = await db.collection('pastelchat_ai_sessions').findOne({ _id }) || initialSession;
        }
      }
      const idx = store.aiSessions.findIndex(s => String(s.userId) === uid && String(s.characterId) === cid);
      const sessionObj = {
        userId: uid,
        characterId: cid,
        activeSessionId: doc.activeSessionId,
        sessionRevision: Number(doc.sessionRevision || 1),
        startedAt: doc.startedAt ? new Date(doc.startedAt).toISOString() : new Date().toISOString()
      };
      if (idx !== -1) store.aiSessions[idx] = sessionObj;
      else store.aiSessions.push(sessionObj);
      return sessionObj;
    }
  }

  let session = store.aiSessions.find(s => String(s.userId) === uid && String(s.characterId) === cid);
  if (!session) {
    session = {
      userId: uid,
      characterId: cid,
      activeSessionId: `sess_${Date.now()}_${genId().slice(0, 6)}`,
      sessionRevision: 1,
      startedAt: new Date().toISOString()
    };
    store.aiSessions.push(session);
    persist();
  }
  return session;
}

async function archiveAIMessages(userId, characterId = AI_CHARACTER_ID) {
  if (process.env.WRITE_MODE === 'read-only') throw new Error('Message archival is disabled in read-only mode');
  if (!userId) return { archivedCount: 0, archivedIds: [] };

  const uid = String(userId);
  const now = new Date().toISOString();
  const archivedIds = [];

  for (const m of store.messages) {
    const sId = String(m.senderId?._id || m.senderId || '');
    const rId = String(m.receiverId?._id || m.receiverId || '');
    const isAiChat = (sId === uid && rId === AI_USER_ID) || (sId === AI_USER_ID && rId === uid);
    if (isAiChat && !m.isArchived) {
      m.isArchived = true;
      m.archivedAt = now;
      archivedIds.push(String(m._id));
      queueMessageWrite(m, { isArchived: true, archivedAt: now });
    }
  }

  if (MONGODB_URI) {
    const db = await getDurableDatabase();
    if (db) {
      await db.collection('pastelchat_messages').updateMany(
        {
          $or: [
            { 'data.senderId': uid, 'data.receiverId': AI_USER_ID },
            { 'data.senderId': AI_USER_ID, 'data.receiverId': uid },
            { 'data.senderId._id': uid, 'data.receiverId._id': AI_USER_ID },
            { 'data.senderId._id': AI_USER_ID, 'data.receiverId._id': uid },
            ...(archivedIds.length ? [{ _id: { $in: archivedIds } }] : [])
          ]
        },
        { $set: { 'data.isArchived': true, 'data.archivedAt': now } },
        { writeConcern: { w: 'majority' } }
      );
    }
  }

  await flushMessageWrites();
  if (!MONGODB_URI) persist();

  return { archivedCount: archivedIds.length, archivedIds };
}

async function refreshAISession(userId, characterId = AI_CHARACTER_ID, { mode = 'keep' } = {}) {
  if (process.env.WRITE_MODE === 'read-only') throw new Error('Session writes are disabled in read-only mode');
  if (!userId) throw new Error('User ID is required');
  const uid = String(userId);
  const cid = String(characterId || AI_CHARACTER_ID);
  const refreshMode = mode === 'clear' ? 'clear' : 'keep';
  const newSessionId = `sess_${Date.now()}_${genId().slice(0, 6)}`;
  const now = new Date();
  let sessionRevision = 1;

  if (MONGODB_URI) {
    const db = await getDurableDatabase();
    if (db) {
      const _id = aiSessionId(uid, cid);
      const doc = await db.collection('pastelchat_ai_sessions').findOneAndUpdate(
        { _id },
        {
          $inc: { sessionRevision: 1 },
          $set: { activeSessionId: newSessionId, mode: refreshMode, startedAt: now, updatedAt: now },
          $setOnInsert: { userId: uid, characterId: cid }
        },
        { upsert: true, returnDocument: 'after', writeConcern: { w: 'majority' } }
      );
      sessionRevision = Number(doc?.sessionRevision || 1);
    }
  }

  if (!Array.isArray(store.aiSessions)) store.aiSessions = [];
  const idx = store.aiSessions.findIndex(s => String(s.userId) === uid && String(s.characterId) === cid);
  if (idx !== -1) {
    if (!MONGODB_URI) sessionRevision = (store.aiSessions[idx].sessionRevision || 1) + 1;
    store.aiSessions[idx] = {
      userId: uid,
      characterId: cid,
      activeSessionId: newSessionId,
      sessionRevision,
      mode: refreshMode,
      startedAt: now.toISOString()
    };
  } else {
    store.aiSessions.push({
      userId: uid,
      characterId: cid,
      activeSessionId: newSessionId,
      sessionRevision,
      mode: refreshMode,
      startedAt: now.toISOString()
    });
  }
  if (!MONGODB_URI) persist();

  let boundaryMessage = null;
  if (refreshMode === 'clear') {
    await archiveAIMessages(uid, cid);
  } else {
    // Create divider message for keep mode
    boundaryMessage = createMessage({
      senderId: AI_USER_ID,
      receiverId: uid,
      content: 'New conversation',
      isSessionBoundary: true,
      conversationSessionId: newSessionId
    });
    await flushMessageWrites();
  }

  return {
    activeSessionId: newSessionId,
    sessionRevision,
    boundaryMessage,
    mode: refreshMode
  };
}

async function getDurableCollection() {
  const db = await getDurableDatabase();
  return db ? db.collection('pastelchat_state') : null;
}

let inFlightMessageFlush = null;
function queueMessageWrite(message, fields = null, deleted = false) {
  if (!MONGODB_URI) { persist(); return; }
  pendingMessageWrites.set(Symbol(), {
    id: String(message._id),
    base: JSON.parse(JSON.stringify(message)),
    fields: fields ? JSON.parse(JSON.stringify(fields)) : null,
    deleted
  });
  if (mongoConnected && !process.env.VERCEL && !process.env.SERVERLESS) {
    clearTimeout(durableSaveTimer);
    durableSaveTimer = setTimeout(() => flushMessageWrites().catch(error => console.error('[DB] Message save error:', error.message)), 100);
  }
}

async function flushMessageWrites() {
  if (process.env.WRITE_MODE === 'read-only' || !MONGODB_URI) return;
  if (inFlightMessageFlush) await inFlightMessageFlush;
  if (!pendingMessageWrites.size) return;
  inFlightMessageFlush = (async () => {
    const collection = (await getDurableDatabase()).collection('pastelchat_messages');
    while (pendingMessageWrites.size) {
      const [key, write] = pendingMessageWrites.entries().next().value;
      await collection.updateOne({ _id: write.id }, { $setOnInsert: { data: write.base, createdAt: new Date(write.base.timestamp) } }, { upsert: true, writeConcern: { w: 'majority' } });
      if (write.fields) {
        const fields = Object.fromEntries(Object.entries(write.fields).map(([name, value]) => [`data.${name}`, value]));
        await collection.updateOne({ _id: write.id }, { $set: fields }, { writeConcern: { w: 'majority' } });
      }
      if (write.deleted) await collection.updateOne({ _id: write.id }, { $set: { deletedAt: new Date() } }, { writeConcern: { w: 'majority' } });
      pendingMessageWrites.delete(key);
    }
  })();
  try { await inFlightMessageFlush; } finally { inFlightMessageFlush = null; }
}

function applyDurableMessageDocs(docs) {
  const merged = new Map(legacyMessages.map(message => [String(message._id), message]));
  for (const doc of docs) {
    if (!doc?._id) continue;
    if (doc.deletedAt) merged.delete(String(doc._id));
    else if (doc.data && String(doc.data._id) === String(doc._id)) merged.set(String(doc._id), doc.data);
  }
  store.messages = [...merged.values()];
}

async function refreshDurableMessages() {
  if (!MONGODB_URI) return;
  await flushMessageWrites();
  const db = await getDurableDatabase();
  const docs = await db.collection('pastelchat_messages').find({}).toArray();
  applyDurableMessageDocs(docs);
}

async function getDurableMessageById(messageId) {
  if (!MONGODB_URI) return findMessage(messageId);
  await flushMessageWrites();
  const db = await getDurableDatabase();
  const doc = await db.collection('pastelchat_messages').findOne({ _id: String(messageId) });
  if (doc?.deletedAt) return null;
  return doc?.data || legacyMessages.find(message => String(message._id) === String(messageId)) || null;
}

function aiTurnId(userId, characterId) { return JSON.stringify([String(userId), String(characterId)]); }
async function allocateAITurnSequence(userId, characterId) {
  if (process.env.WRITE_MODE === 'read-only') throw new Error('AI turn writes are disabled');
  if (!MONGODB_URI) return null;
  const db = await getDurableDatabase();
  const doc = await db.collection('pastelchat_ai_turns').findOneAndUpdate(
    { _id: aiTurnId(userId, characterId) },
    { $inc: { nextSequence: 1 }, $setOnInsert: { userId: String(userId), characterId: String(characterId) } },
    { upsert: true, returnDocument: 'after', writeConcern: { w: 'majority' } }
  );
  return doc.nextSequence;
}
async function registerAITurn(userId, characterId, message) {
  if (process.env.WRITE_MODE === 'read-only') return false;
  if (!store.aiTurnRevisions) store.aiTurnRevisions = new Map();
  const revKey = aiTurnId(userId, characterId);
  store.aiTurnRevisions.set(revKey, (store.aiTurnRevisions.get(revKey) || 0) + 1);
  if (!MONGODB_URI) return true;
  await flushMessageWrites();
  const db = await getDurableDatabase();
  const _id = aiTurnId(userId, characterId);
  const messageAt = new Date(message.timestamp);
  if (Number.isNaN(messageAt.getTime())) throw new Error('AI turn message timestamp is invalid');
  const sequence = Number(message.aiTurnSequence);
  const hasSequence = Number.isSafeInteger(sequence) && sequence > 0;
  const collection = db.collection('pastelchat_ai_turns');
  try {
    await collection.updateOne(
      hasSequence
        ? { _id, $or: [{ latestSequence: { $lt: sequence } }, { latestSequence: { $exists: false } }] }
        : { _id, latestSequence: { $exists: false }, $or: [{ latestAt: { $lte: messageAt } }, { latestAt: { $exists: false } }] },
      {
        $set: {
          userId: String(userId),
          characterId: String(characterId),
          latestMessageId: String(message._id),
          latestAt: messageAt,
          ...(hasSequence ? { latestSequence: sequence } : {}),
          updatedAt: new Date()
        },
        $inc: { generationRevision: 1 }
      },
      { upsert: true, writeConcern: { w: 'majority' } }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  return isCurrentAITurn(userId, characterId, message._id);
}

async function isCurrentAITurn(userId, characterId, messageId) {
  if (!MONGODB_URI) return true;
  const db = await getDurableDatabase();
  return Boolean(await db.collection('pastelchat_ai_turns').findOne({ _id: aiTurnId(userId, characterId), latestMessageId: String(messageId) }, { projection: { _id: 1 } }));
}

async function getCurrentAITurnMessageId(userId, characterId) {
  if (!MONGODB_URI) return null;
  const db = await getDurableDatabase();
  const doc = await db.collection('pastelchat_ai_turns').findOne({ _id: aiTurnId(userId, characterId), latestMessageId: 1 });
  return doc?.latestMessageId || null;
}

async function getCurrentAITurnRevision(userId, characterId) {
  if (!MONGODB_URI) {
    return store.aiTurnRevisions?.get(aiTurnId(userId, characterId)) || 1;
  }
  const db = await getDurableDatabase();
  const doc = await db.collection('pastelchat_ai_turns').findOne({ _id: aiTurnId(userId, characterId) }, { projection: { generationRevision: 1 } });
  return Number(doc?.generationRevision || 1);
}

async function registerAIRegenerate(userId, characterId, userMessageId) {
  if (process.env.WRITE_MODE === 'read-only') throw new Error('AI turn writes are disabled');
  if (!store.aiTurnRevisions) store.aiTurnRevisions = new Map();
  const revKey = aiTurnId(userId, characterId);
  const inMemoryRev = (store.aiTurnRevisions.get(revKey) || 1) + 1;
  store.aiTurnRevisions.set(revKey, inMemoryRev);
  if (!MONGODB_URI) return inMemoryRev;
  await flushMessageWrites();
  const db = await getDurableDatabase();
  const _id = aiTurnId(userId, characterId);
  const doc = await db.collection('pastelchat_ai_turns').findOneAndUpdate(
    { _id, latestMessageId: String(userMessageId) },
    { $inc: { generationRevision: 1 }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after', writeConcern: { w: 'majority' } }
  );
  return Number(doc?.generationRevision || inMemoryRev);
}

async function supersedeAIMessages(userId, characterId = AI_CHARACTER_ID, userMessageId) {
  if (process.env.WRITE_MODE === 'read-only') throw new Error('Writes are disabled in read-only mode');
  const uid = String(userId);
  const cid = String(characterId || AI_CHARACTER_ID);
  const umid = String(userMessageId);

  // 1. Identify existing AI bubbles responding to this userMessageId
  const rel = getAIRelationship(uid, cid, false);
  const histEntry = rel?.shared_history?.find(e => String(e.userMessageId) === umid);
  const histAiIds = new Set((histEntry?.aiMessageIds || []).map(String));

  const matchingMessages = (store.messages || []).filter(m => {
    if (m.isSuperseded) return false;
    const isAiSender = String(m.senderId?._id || m.senderId) === AI_USER_ID;
    const isToUser = String(m.receiverId?._id || m.receiverId) === uid;
    if (!isAiSender || !isToUser) return false;
    if (m.triggerMessageId && String(m.triggerMessageId) === umid) return true;
    if (histAiIds.has(String(m._id))) return true;
    return false;
  });

  const now = new Date().toISOString();
  const supersededIds = [];
  const rejectedTexts = [];

  for (const msg of matchingMessages) {
    msg.isSuperseded = true;
    msg.supersededAt = now;
    supersededIds.push(String(msg._id));
    if (msg.content) rejectedTexts.push(msg.content);
    queueMessageWrite(msg, { isSuperseded: true, supersededAt: now });
  }

  if (MONGODB_URI && supersededIds.length > 0) {
    const db = await getDurableDatabase();
    if (db) {
      await db.collection('pastelchat_messages').updateMany(
        { _id: { $in: supersededIds } },
        { $set: { 'data.isSuperseded': true, 'data.supersededAt': now } },
        { writeConcern: { w: 'majority' } }
      );
    }
  }

  return { supersededIds, rejectedTexts };
}

function makeMessage(doc) {
  return { _id: genId(), timestamp: new Date().toISOString(), isRecalled: false, isPinned: false, replyTo: null,
    reactions: {}, clientMessageId: null, deliveredAt: null, readAt: null, deliveryReceipts: {}, media: null, ...doc };
}

async function commitAIBubble(userId, characterId, userMessageId, doc, expectedRevision = null) {
  if (process.env.WRITE_MODE === 'read-only') return null;
  const bubbleDoc = {
    ...doc,
    triggerMessageId: String(userMessageId)
  };
  if (!MONGODB_URI) {
    if (expectedRevision !== undefined && expectedRevision !== null) {
      const currentRev = store.aiTurnRevisions?.get(aiTurnId(userId, characterId));
      if (currentRev !== undefined && currentRev !== expectedRevision) {
        return null;
      }
    }
    return createMessage(bubbleDoc);
  }
  const db = await getDurableDatabase();
  if (!cachedClient?.startSession) throw new Error('MongoDB transaction support is required for AI delivery');
  const message = makeMessage(bubbleDoc);
  const session = cachedClient.startSession();
  let committed = false;
  try {
    await session.withTransaction(async () => {
      committed = false;
      const claimFilter = {
        _id: aiTurnId(userId, characterId),
        latestMessageId: String(userMessageId)
      };
      if (expectedRevision !== undefined && expectedRevision !== null) {
        claimFilter.generationRevision = expectedRevision;
      }
      const claim = await db.collection('pastelchat_ai_turns').updateOne(
        claimFilter,
        { $inc: { deliveryRevision: 1 } }, { session }
      );
      if (!claim.matchedCount) return;
      await db.collection('pastelchat_messages').updateOne(
        { _id: message._id }, { $setOnInsert: { data: message, createdAt: new Date(message.timestamp) } }, { upsert: true, session }
      );
      committed = true;
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally { await session.endSession(); }
  if (!committed) return null;
  if (!findMessage(message._id)) store.messages.push(message);
  return message;
}

async function storeAIAvatarMedia({ version, buffer, contentType }) {
  if (process.env.WRITE_MODE === 'read-only') throw new Error('Avatar media writes are disabled in read-only mode');
  if (!/^[a-f0-9]{64}$/i.test(String(version || '')) || !Buffer.isBuffer(buffer) || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    throw new Error('Avatar media payload is invalid');
  }
  const db = await getDurableDatabase();
  if (!db) throw new Error('Durable avatar storage is unavailable');
  await db.collection('pastelchat_media').updateOne(
    { _id: `lyra-avatar:${version}` },
    { $set: { kind: 'lyra-avatar', contentType, data: buffer, updatedAt: new Date() } },
    { upsert: true }
  );
  return true;
}

async function getAIAvatarMedia(version) {
  if (!/^[a-f0-9]{64}$/i.test(String(version || ''))) return null;
  const db = await getDurableDatabase();
  if (!db) return null;
  const media = await db.collection('pastelchat_media').findOne({ _id: `lyra-avatar:${version}` });
  const buffer = avatarBytes(media?.data);
  if (!buffer || !['image/jpeg', 'image/png', 'image/webp'].includes(media.contentType)) return null;
  return { buffer, contentType: media.contentType };
}

function sanitizeForDurableStorage(data) {
  if (!data || typeof data !== 'object') return data;

  // 1. Sanitize messages: strip oversized base64 dataUrl (protecting against multi-MB blobs)
  if (Array.isArray(data.messages)) {
    for (const msg of data.messages) {
      if (msg && msg.media && typeof msg.media === 'object') {
        if (msg.media.dataUrl && typeof msg.media.dataUrl === 'string' && msg.media.dataUrl.length > 30000) {
          delete msg.media.dataUrl;
        }
      }
    }
  }

  // 2. Sanitize users: ensure no giant base64 avatars
  if (Array.isArray(data.users)) {
    for (const u of data.users) {
      if (u && u.avatar && typeof u.avatar === 'string' && u.avatar.length > 30000) {
        u.avatar = (u.isAI || String(u._id) === AI_USER_ID)
          ? 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Lyra&backgroundColor=ffd1dc,b5ead7,c7ceea,ffe4e1&radius=50'
          : `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(u.name || 'User')}&radius=50`;
      }
    }
  }

  // 3. Sanitize aiCharacters: ensure avatar is compact URL
  if (Array.isArray(data.aiCharacters)) {
    for (const c of data.aiCharacters) {
      if (c && c.avatar && typeof c.avatar === 'string' && c.avatar.length > 30000) {
        c.avatar = 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Lyra&backgroundColor=ffd1dc,b5ead7,c7ceea,ffe4e1&radius=50';
      }
    }
  }

  // 4. Sanitize sharedPhotos: strip oversized dataUrls
  if (Array.isArray(data.sharedPhotos)) {
    for (const p of data.sharedPhotos) {
      if (p && p.dataUrl && typeof p.dataUrl === 'string' && p.dataUrl.length > 30000) {
        p.dataUrl = null;
      }
    }
  }

  if (Array.isArray(data.aiMemories)) {
    const perLayer = new Map();
    data.aiMemories = data.aiMemories.filter(memory => {
      if (!memory?.userId || !memory?.key || typeof memory.value !== 'string') return false;
      if (memory.value.length > 180 || /data:[^\s]+;base64,|<svg|<img/i.test(memory.value)) return false;
      const scope = JSON.stringify([String(memory.userId), String(memory.characterId || AI_CHARACTER_ID)]);
      const count = perLayer.get(scope) || 0;
      if (count >= 24) return false;
      perLayer.set(scope, count + 1);
      return true;
    });
  }

  return data;
}

let pendingDurableWrite = null;
function durableSnapshotData() {
  return { ...store, messages: MONGODB_URI ? legacyMessages : store.messages, aiMemories: legacyAiMemories, aiRelationshipState: legacyAiRelationships };
}
async function writeDurableSnapshot() {
  if (process.env.WRITE_MODE === 'read-only') return;
  if (!mongoConnected) return;
  try {
    const col = await getDurableCollection();
    if (!col) return;
    const snapshotData = sanitizeForDurableStorage(durableSnapshotData());
    const now = new Date();
    pendingDurableWrite = col.updateOne(
      { key: 'primary' },
      { $set: { key: 'primary', data: snapshotData, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
    await pendingDurableWrite;
    isDirty = false;
    lastHydratedUpdatedAt = now.getTime();
  } catch (err) {
    console.error('[DB] Durable snapshot write error:', err.message);
  } finally {
    pendingDurableWrite = null;
  }
}

async function flushPersist() {
  if (!mongoConnected) {
    if (isDirty) {
      try {
        fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2));
        isDirty = false;
      } catch (e) {
        console.error('[DB] Failed to save in flushPersist:', e.message);
      }
    }
    return;
  }
  await flushMessageWrites();
  if (pendingDurableWrite) {
    await pendingDurableWrite;
  } else if (isDirty) {
    await writeDurableSnapshot();
  }
}

let inFlightHydration = null;

async function hydrateFromDurableStore() {
  if (!MONGODB_URI) {
    console.warn('[DB] MONGODB_URI is not configured; using local JSON store.');
    return;
  }

  if (inFlightHydration) {
    return inFlightHydration;
  }

  inFlightHydration = (async () => {
    try {
      if (lastHydratedUpdatedAt && pendingDurableWrite) {
        await pendingDurableWrite;
      } else if (lastHydratedUpdatedAt && isDirty) {
        await writeDurableSnapshot();
      }
      if (lastHydratedUpdatedAt) await flushMessageWrites();

      const col = await getDurableCollection();
      if (!col) return;

      console.log('[DB] Checking primary snapshot metadata and size...');
      const t0 = Date.now();
      const sizeAgg = await col.aggregate([
        { $match: { key: 'primary' } },
        {
          $project: {
            sizeBytes: { $bsonSize: "$$ROOT" },
            rootFields: {
              $map: {
                input: { $objectToArray: "$$ROOT" },
                as: "rf",
                in: { k: "$$rf.k", sz: { $bsonSize: { k: "$$rf.v" } } }
              }
            },
            dataFields: {
              $map: {
                input: { $objectToArray: { $ifNull: ["$data", {}] } },
                as: "df",
                in: { k: "$$df.k", sz: { $bsonSize: { k: "$$df.v" } } }
              }
            },
            updatedAt: 1
          }
        }
      ]).toArray();
      const meta = sizeAgg[0];
      const sizeBytes = meta?.sizeBytes || 0;
      console.log(`[DB] Metadata returned in ${Date.now() - t0}ms: size = ${sizeBytes} bytes (${Math.round(sizeBytes / 1024)} KB)`);
      if (meta?.rootFields) console.log('[DB] Root fields sizes:', JSON.stringify(meta.rootFields));
      if (meta?.dataFields) console.log('[DB] Data fields sizes:', JSON.stringify(meta.dataFields));

      const isBloated = sizeBytes > 300000;
      if (isBloated && process.env.WRITE_MODE !== 'read-only') {
        console.warn(`[DB] Primary snapshot is bloated (${Math.round(sizeBytes / 1024)} KB). Repairing directly in Atlas...`);
        // Dynamically clear any bloated fields in data (notes, auditLogs, pushSubscriptions, etc.)
        for (const f of meta?.dataFields || []) {
          if (f && f.sz > 100000 && !['users', 'messages', 'friendships', 'friendRequests', 'aiCharacters'].includes(f.k)) {
            console.log(`[DB] Clearing bloated data.${f.k} (${Math.round(f.sz / 1024)} KB)...`);
            await col.updateOne({ key: 'primary' }, { $set: { [`data.${f.k}`]: [] } });
          }
        }
        // Dynamically unset any bloated fields on root document (legacy backups, temp dumps)
        for (const f of meta?.rootFields || []) {
          if (f && f.sz > 100000 && f.k !== 'data' && f.k !== 'key') {
            console.log(`[DB] Unsetting bloated root.${f.k} (${Math.round(f.sz / 1024)} KB)...`);
            await col.updateOne({ key: 'primary' }, { $unset: { [f.k]: "" } });
          }
        }

        // Check if aiCharacters has giant avatar
        const aiField = (meta?.dataFields || []).find(f => f.k === 'aiCharacters');
        if (aiField && aiField.sz > 50000) {
          console.log('[DB] Resetting bloated Lyra avatar in Atlas...');
          await col.updateOne({ key: 'primary' }, { $set: { "data.aiCharacters.0.avatar": "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Lyra&backgroundColor=ffd1dc,b5ead7,c7ceea,ffe4e1&radius=50" } });
        }
      }

      const t1 = Date.now();
      const snapshot = await col.findOne({ key: 'primary' });
      console.log(`[DB] Primary snapshot payload returned in ${Date.now() - t1}ms:`, snapshot ? `found (${snapshot.data?.users?.length || 0} users, ${snapshot.data?.messages?.length || 0} msgs)` : 'not found');

      if (snapshot?.data && Array.isArray(snapshot.data.users) && snapshot.data.users.length > 0) {
        if (isBloated) {
          sanitizeForDurableStorage(snapshot.data);
        }
        applySnapshot(snapshot.data);
        await refreshDurableMessages();
        lastHydratedUpdatedAt = snapshot.updatedAt ? new Date(snapshot.updatedAt).getTime() : Date.now();
        isDirty = false;
        ensureAICharacter();
        ensureConfiguredAdmin();
        revokeCompromisedAdminSessions();
        rotateExposedCredentials();
        console.log(`[DB] Hydrated durable MongoDB state (${store.users.length} users, ${store.messages.length} messages)`);

        if (isBloated && process.env.WRITE_MODE !== 'read-only') {
          console.log('[DB] Writing slim, sanitized snapshot back to MongoDB Atlas to permanently fix document bloat...');
          const tSlim = Date.now();
          await col.updateOne(
            { key: 'primary' },
            { $set: { key: 'primary', data: sanitizeForDurableStorage(durableSnapshotData()), updatedAt: new Date() } },
            { upsert: true }
          );
          console.log(`[DB] Successfully wrote slim snapshot (${store.users.length} users, ${store.messages.length} msgs) in ${Date.now() - tSlim}ms!`);
        }
      } else {
        if (seedData) applySnapshot(seedData);
        ensureAICharacter();
        await writeDurableSnapshot();
        console.log('[DB] Initialized durable MongoDB state from local store / seed data');
      }
    } catch (e) {
      mongoConnected = false;
      if (mongoConfigured) {
        throw new Error(`Durable MongoDB unavailable; refusing ephemeral fallback: ${e.message}`);
      }
      console.error('[DB] Durable MongoDB unavailable; continuing with local store:', e.message);
    } finally {
      inFlightHydration = null;
    }
  })();

  return inFlightHydration;
}

function normalizeAccessCode(value) {
  let code = String(value || '').trim().toUpperCase();
  if (code.length === 8 && !code.includes('-')) code = `${code.slice(0, 4)}-${code.slice(4)}`;
  return code;
}
function accessCodeHash(value) {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (process.env.NODE_ENV === 'production' && !secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  const safeSecret = secret || 'pastel-chat-development-secret';
  return crypto.createHmac('sha256', safeSecret).update(normalizeAccessCode(value)).digest('hex');
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
function revokeCompromisedAdminSessions() {
  const adminUsers = store.users.filter((user) => user.isAdmin === true);
  let updated = 0;
  for (const admin of adminUsers) {
    if (!admin.authVersion || admin.authVersion === 0) {
      admin.authVersion = 1;
      updated++;
    }
  }
  const adminUserIds = new Set(adminUsers.map((u) => String(u._id)));
  const now = new Date().toISOString();
  for (const session of (store.sessions || [])) {
    if ((session.adminRole || adminUserIds.has(String(session.userId))) && !session.revokedAt) {
      session.revokedAt = now;
      updated++;
    }
  }
  if (updated) persist();
  return updated;
}
function rotateExposedCredentials() {
  let rotated = 0;
  for (const user of (store.users || [])) {
    if (user.loginCode && COMPROMISED_LOGIN_CODES.has(user.loginCode)) {
      if (user.isAdmin) {
        user.loginCode = null;
      } else {
        user.loginCode = generateLoginCode();
      }
      user.authVersion = Number(user.authVersion || 0) + 1;
      rotated++;
    }
  }
  if (rotated) persist();
  return rotated;
}
function ensureConfiguredAdmin() {
  const configuredAdminCode = normalizeAccessCode(process.env.ADMIN_LOGIN_CODE);
  const configuredAdmin = store.users.find((user) => user.isAdmin === true);
  if (configuredAdminCode && !COMPROMISED_LOGIN_CODES.has(configuredAdminCode)) {
    if (configuredAdmin) {
      if (configuredAdmin.loginCode !== null || configuredAdmin.adminRole !== 'OWNER') {
        configuredAdmin.loginCode = null;
        configuredAdmin.adminRole = 'OWNER';
        persist();
      }
    } else {
      store.users.push({
        _id: genId(), name: 'Admin', loginCode: null, isAdmin: true, adminRole: 'OWNER', authVersion: 1,
        isOnline: false, createdAt: new Date().toISOString(), lastSeen: new Date().toISOString(),
        avatar: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=admin&backgroundColor=add8e6&radius=50', chatBackground: 'default', chatColor: null
      });
      persist();
      console.log('[DB] Bootstrapped configured Admin user');
    }
  } else if (!configuredAdmin) {
    console.warn('[DB] ADMIN_LOGIN_CODE is not configured; admin login is disabled.');
  }
  const configuredDemoCode = normalizeAccessCode(process.env.DEMO_LOGIN_CODE);
  if (configuredDemoCode && !COMPROMISED_LOGIN_CODES.has(configuredDemoCode) && !findAccessCodeByHash(accessCodeHash(configuredDemoCode))) {
    createAccessCode({ code: configuredDemoCode, label: 'Initial demo access', createdBy: 'system' });
    console.log('[DB] Bootstrapped configured demo access code');
  }
}

function seedFromSnapshot() {
  if (seedData) {
    applySnapshot(seedData);
    ensureConfiguredAdmin();
    revokeCompromisedAdminSessions();
    rotateExposedCredentials();
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
  for (let attempt = 0; attempt < 100; attempt++) {
    const bytes = crypto.randomBytes(8);
    let code = '';
    for (let i = 0; i < 8; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    const formatted = code.slice(0, 4) + '-' + code.slice(4);
    if (!COMPROMISED_LOGIN_CODES.has(formatted) && !store.users.find((u) => u.loginCode === formatted)) return formatted;
  }
  throw new Error('Could not generate unique code');
}

// ===== User =====
function findUser(filter) {
  return store.users.find((u) => Object.keys(filter).every((k) => u[k] === filter[k]));
}
function findUserById(id) {
  if (!id) return null;
  const sid = String(id);
  let user = (store.users || []).find((u) => u && String(u._id) === sid);
  if (!user && (sid === AI_USER_ID || sid === AI_CHARACTER_ID)) {
    ensureAICharacter();
    user = (store.users || []).find((u) => u && (String(u._id) === AI_USER_ID || u.aiCharacterId === AI_CHARACTER_ID));
  }
  return user || null;
}
function findUserByVerificationCode(code) {
  if (!code) return null;
  return store.users.find((u) => u.telegramVerificationCode === code.toUpperCase());
}
function findUserByName(name) {
  const normalized = normalizeUserName(name);
  if (!normalized) return null;
  return store.users.find((u) => normalizeUserName(u?.name) === normalized);
}
function isNameTaken(name, exceptId = null) {
  const u = findUserByName(name);
  return !!(u && String(u._id) !== String(exceptId || ''));
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
  if (session) { session.lastUsedAt = new Date().toISOString(); }
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
function normalizeUserName(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}
function userSearchResult(user, viewerId) {
  if (!user) return null;
  const viewer = String(viewerId || '');
  const target = String(user._id || '');
  let relationship = { status: 'none' };
  if (findFriendship(viewer, target) || findFriendship(target, viewer)) {
    relationship = { status: 'friends' };
  } else {
    const outgoing = findRequest(viewer, target);
    const incoming = findRequest(target, viewer);
    if (outgoing) relationship = { status: 'outgoing', requestId: outgoing._id };
    if (incoming) relationship = { status: 'incoming', requestId: incoming._id };
  }
  return {
    _id: user._id,
    name: user.name,
    avatar: user.avatar || '',
    isOnline: !!user.isOnline,
    relationship
  };
}
function searchUsers(query, exceptId) {
  const q = normalizeUserName(query);
  if (!q) return [];
  ensureAICharacter();
  const rawQ = String(query || '').trim().toUpperCase();
  const rawQClean = rawQ.replace(/[^A-Z0-9]/g, '');
  const eid = String(exceptId || '');
  return (store.users || [])
    .filter((u) => {
      if (!u || String(u._id) === eid) return false;
      const nameNorm = normalizeUserName(u.name);
      if (nameNorm.includes(q)) return true;
      if (u.username && normalizeUserName(u.username).includes(q)) return true;
      if (u.loginCode) {
        const codeUpper = String(u.loginCode).toUpperCase();
        if (codeUpper.includes(rawQ)) return true;
        const codeClean = codeUpper.replace(/[^A-Z0-9]/g, '');
        if (rawQClean.length >= 3 && codeClean.includes(rawQClean)) return true;
      }
      return false;
    })
    .sort((a, b) => {
      const aName = normalizeUserName(a.name);
      const bName = normalizeUserName(b.name);
      const rank = (name) => (name === q ? 0 : name.startsWith(q) ? 1 : 2);
      return rank(aName) - rank(bName) || aName.localeCompare(bName);
    })
    .slice(0, 20)
    .map((user) => userSearchResult(user, eid))
    .filter(Boolean);
}
function getOnlineUsers() {
  return (store.users || []).filter((u) => u && u.isOnline).map(userPublic).filter(Boolean);
}
function userPublic(u) {
  if (!u) return null;
  return {
    _id: u._id, name: u.name, avatar: u.avatar,
    chatBackground: u.chatBackground, chatColor: u.chatColor || null, isOnline: !!u.isOnline,
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
  ensureAICharacter();
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
  const msg = makeMessage(doc);
  store.messages.push(msg);
  queueMessageWrite(msg);
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
  queueMessageWrite(message, { deliveredAt: message.deliveredAt, deliveryReceipts: message.deliveryReceipts });
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
  queueMessageWrite(message, { deliveredAt: message.deliveredAt, readAt: message.readAt, deliveryReceipts: message.deliveryReceipts });
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
  queueMessageWrite(msg, { reactions: msg.reactions });
  return msg;
}
function updateMessage(id, updates) {
  const m = findMessage(id);
  if (m) { Object.assign(m, updates); queueMessageWrite(m, updates); }
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
function getConversation(userA, userB, { limit = 100, before = null, since = null } = {}) {
  const uidA = String(userA || '');
  const uidB = String(userB || '');
  let msgs = store.messages.filter((m) => {
    if (m.isSuperseded || m.isArchived) return false;
    const sId = String(m.senderId?._id || m.senderId || '');
    const rId = String(m.receiverId?._id || m.receiverId || '');
    return (sId === uidA && rId === uidB) || (sId === uidB && rId === uidA);
  });
  if (before) {
    const cutoff = new Date(before);
    msgs = msgs.filter((m) => new Date(m.timestamp) < cutoff);
  }
  if (since) {
    const cutoff = new Date(since);
    msgs = msgs.filter((m) => new Date(m.timestamp) > cutoff);
  }
  msgs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  msgs = msgs.slice(0, limit);
  return msgs.map((message) => populateMessage(message, userA)).reverse();
}
function getPinnedMessages(userA, userB) {
  const uidA = String(userA || '');
  const uidB = String(userB || '');
  return store.messages
    .filter((m) => {
      if (m.isSuperseded || m.isArchived || !m.isPinned || m.isRecalled) return false;
      const sId = String(m.senderId?._id || m.senderId || '');
      const rId = String(m.receiverId?._id || m.receiverId || '');
      return (sId === uidA && rId === uidB) || (sId === uidB && rId === uidA);
    })
    .map((message) => populateMessage(message, userA));
}
function searchMessages(userA, userB, query) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const uidA = String(userA || '');
  const uidB = String(userB || '');
  return store.messages
    .filter((m) => {
      if (m.isSuperseded || m.isArchived || m.isRecalled || !m.content || !m.content.toLowerCase().includes(q)) return false;
      const sId = String(m.senderId?._id || m.senderId || '');
      const rId = String(m.receiverId?._id || m.receiverId || '');
      return (sId === uidA && rId === uidB) || (sId === uidB && rId === uidA);
    })
    .slice(-50)
    .map((message) => populateMessage(message, userA));
}
function clearConversation(userA, userB) {
  const uidA = String(userA || '');
  const uidB = String(userB || '');
  const before = store.messages.length;
  store.messages = store.messages.filter((m) => {
    const sId = String(m.senderId?._id || m.senderId || '');
    const rId = String(m.receiverId?._id || m.receiverId || '');
    const shouldClear = (sId === uidA && rId === uidB) || (sId === uidB && rId === uidA);
    if (shouldClear) queueMessageWrite(m, null, true);
    return !shouldClear;
  });
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

function deleteDisposableUser(userId) {
  const uid = String(userId || '');
  if (!uid) return false;
  const user = store.users.find((u) => String(u._id) === uid);
  // SECURITY: Never delete admin or AI character accounts
  if (!user || user.isAdmin || user.isAI || uid === 'user_ai_lyra') {
    return false;
  }
  store.users = store.users.filter((u) => String(u._id) !== uid);
  store.sessions = store.sessions.filter((s) => String(s.userId) !== uid);
  store.friendships = store.friendships.filter((f) => String(f.userId) !== uid && String(f.friendId) !== uid);
  store.friendRequests = store.friendRequests.filter((r) => String(r.fromId) !== uid && String(r.toId) !== uid);
  store.messages = store.messages.filter((m) => String(m.senderId) !== uid && String(m.receiverId) !== uid);
  store.pushSubscriptions = store.pushSubscriptions.filter((p) => String(p.userId) !== uid);
  store.notes = store.notes.filter((n) => String(n.userId) !== uid);
  store.reminders = store.reminders.filter((r) => String(r.userId) !== uid);
  store.feedback = store.feedback.filter((fb) => String(fb.userId) !== uid);
  persist();
  return true;
}

async function deleteDurableUser(userId) {
  const localDeleted = deleteDisposableUser(userId);
  if (!localDeleted) return false;
  const db = await getDurableDatabase();
  if (db) {
    const uid = String(userId);
    await Promise.allSettled([
      db.collection('pastelchat_messages').deleteMany({ $or: [{ senderId: uid }, { receiverId: uid }] }),
      db.collection('pastelchat_personal_layers').deleteMany({ userId: uid }),
      db.collection('pastelchat_character_configs').deleteMany({ userId: uid }),
      db.collection('pastelchat_ai_sessions').deleteMany({ userId: uid }),
      db.collection('pastelchat_ai_turns').deleteMany({ userId: uid })
    ]);
  }
  return true;
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
  store, persist, flushPersist, flushMessageWrites, refreshDurableMessages, getDurableMessageById, allocateAITurnSequence, registerAITurn, isCurrentAITurn, getCurrentAITurnMessageId, commitAIBubble,
  hydrateFromDurableStore, getDurableDatabase, ready, isDirty: () => Boolean(isDirty || pendingDurableWrite || pendingMessageWrites.size || inFlightMessageFlush), isDurableStorageEnabled: () => mongoConnected, isDurableStorageRequired: () => durableStorageRequired, genId, generateLoginCode,
  deleteDisposableUser, deleteDurableUser,
  normalizeAccessCode, createAccessCode, generateDemoAccessCode, findAccessCodeByCode, findAccessCodeById, accessCodeView,
  markAccessCodeUsed, revokeAccessCode, revokeAccessCodeSessions,
  findUser, findUserById, findUserByName, findUserByVerificationCode, isNameTaken,
  createUser, updateUser, searchUsers, getOnlineUsers, userPublic, userSearchResult, normalizeUserName,
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
  getAIMemories, addAIMemory, deleteAIMemory, hydrateAIPersonalLayer, hydrateAllAIPersonalLayers, flushAIPersonalLayer, getAILifeEvents, claimAIProactiveWindow, isAIUser, updateAIAvatar,
  storeAIAvatarMedia, getAIAvatarMedia,
  getUserCharacterConfig, setUserCharacterConfig, resetUserCharacterConfig, hydrateUserCharacterConfig,
  getActiveAISession, refreshAISession, archiveAIMessages, supersedeAIMessages, registerAIRegenerate, getCurrentAITurnRevision
};
