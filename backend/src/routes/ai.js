const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const storeDb = require('../db/store');
const { syncCharacterRhythm, getConversationDebug } = require('../ai/conversationDirector');
const { triggerProactiveTick } = require('../ai/proactiveEngine');
const { parseAvatarDataUrl, avatarMediaPath } = require('../services/aiAvatarMedia');
const { emitToAuthenticatedUsers } = require('../services/userSocket');

// GET /ai/status - Public or authenticated info about Lyra's current state
router.get('/status', (req, res) => {
  try {
    const character = storeDb.getAICharacter();
    const characterState = syncCharacterRhythm(storeDb);
    const lifeEvents = storeDb.getAILifeEvents();
    const aiUser = storeDb.findUserById('user_ai_lyra');

    const { GEMINI_API_KEY, NVIDIA_API_KEY, OPENROUTER_API_KEY } = require('../ai/config');

    res.json({
      character,
      state: characterState,
      activeLifeEvents: (lifeEvents || []).filter(e => e.status === 'active'),
      user: aiUser ? storeDb.userPublic(aiUser) : null,
      providers: {
        openrouter: !!OPENROUTER_API_KEY,
        nvidia: !!NVIDIA_API_KEY,
        gemini: !!GEMINI_API_KEY
      }
    });
  } catch (err) {
    console.error('[AI Routes] Status error:', err.message);
    res.status(500).json({ message: 'Failed to retrieve AI status' });
  }
});

// GET /ai/memories - Authenticated user's memories stored by Lyra
router.get('/memories', authMiddleware, async (req, res) => {
  try {
    await storeDb.hydrateAIPersonalLayer(req.user._id);
    const memories = storeDb.getAIMemories(req.user._id);
    res.json(memories);
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve memories' });
  }
});

// DELETE /ai/memories/:id - Remove a memory
router.delete('/memories/:id', authMiddleware, async (req, res) => {
  try {
    await storeDb.hydrateAIPersonalLayer(req.user._id);
    const success = storeDb.deleteAIMemory(req.params.id, req.user._id);
    if (success) await storeDb.flushAIPersonalLayer(req.user._id, 'char_lyra', { deletedMemoryIds: [req.params.id] });
    res.json({ success });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete memory' });
  }
});

// GET /ai/relationship - Authenticated user's relationship with Lyra
router.get('/relationship', authMiddleware, async (req, res) => {
  try {
    await storeDb.hydrateAIPersonalLayer(req.user._id);
    const rel = storeDb.getAIRelationship(req.user._id);
    res.json(rel);
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve relationship' });
  }
});

const { validTimeZone } = require('../ai/temporalContext');

function sanitizeCustomConfig(input = {}) {
  if (!input || typeof input !== 'object') return null;
  const cleanStr = (val, max = 2000) => {
    if (typeof val !== 'string') return '';
    return val.replace(/data:[^\s]+;base64,/gi, '').trim().slice(0, max);
  };

  const about = cleanStr(input.about, 2000);
  const personality = cleanStr(input.personality, 2000);
  const personalityTags = Array.isArray(input.personalityTags)
    ? input.personalityTags.map(t => cleanStr(t, 50)).filter(Boolean).slice(0, 15)
    : [];
  const speakingStyle = cleanStr(input.speakingStyle, 2000);
  const wordsUsed = cleanStr(input.wordsUsed, 500);
  const wordsAvoided = cleanStr(input.wordsAvoided, 500);
  const thoughtProcess = cleanStr(input.thoughtProcess, 2000);
  const relationship = cleanStr(input.relationship, 2000);
  const lore = cleanStr(input.lore, 3000);
  const shouldRules = cleanStr(input.shouldRules, 2000);
  const shouldNotRules = cleanStr(input.shouldNotRules, 2000);
  const location = cleanStr(input.location, 100);
  const rawTimezone = cleanStr(input.timezone, 64);
  const timezone = rawTimezone ? (validTimeZone(rawTimezone) || '') : '';
  const examples = Array.isArray(input.examples)
    ? input.examples.map((ex, i) => ({
        id: String(ex.id || `ex_${i}_${Date.now()}`),
        user: cleanStr(ex.user, 1000),
        lyra: cleanStr(ex.lyra, 1000)
      })).filter(ex => ex.user || ex.lyra).slice(0, 10)
    : [];

  const hasContent = Boolean(
    about || personality || personalityTags.length || speakingStyle ||
    wordsUsed || wordsAvoided || thoughtProcess || relationship || lore ||
    shouldRules || shouldNotRules || location || timezone || examples.length
  );

  if (!hasContent) return null;

  return {
    about,
    personality,
    personalityTags,
    speakingStyle,
    wordsUsed,
    wordsAvoided,
    thoughtProcess,
    relationship,
    lore,
    examples,
    shouldRules,
    shouldNotRules,
    location,
    timezone
  };
}

// GET /ai/character/config - Get authenticated user's character customization
router.get('/character/config', authMiddleware, async (req, res) => {
  try {
    const characterId = 'char_lyra';
    await storeDb.hydrateUserCharacterConfig?.(req.user._id, characterId);
    const customConfig = storeDb.getUserCharacterConfig(req.user._id, characterId);
    const defaultCharacter = storeDb.getAICharacter(characterId);
    res.json({
      customConfig: customConfig || null,
      defaultCharacter: defaultCharacter ? {
        name: defaultCharacter.name,
        age: defaultCharacter.age,
        occupation: defaultCharacter.occupation,
        bio: defaultCharacter.bio,
        traits: defaultCharacter.traits,
        interests: defaultCharacter.interests
      } : null
    });
  } catch (err) {
    console.error('[AI Routes] Get character config error:', err.message);
    res.status(500).json({ message: 'Failed to retrieve character configuration' });
  }
});

// PUT /ai/character/config - Save authenticated user's character customization
router.put('/character/config', authMiddleware, async (req, res) => {
  if (process.env.WRITE_MODE === 'read-only') {
    return res.status(503).json({ message: 'Character customization writes are disabled' });
  }
  try {
    const characterId = 'char_lyra';
    const validated = sanitizeCustomConfig(req.body?.customConfig !== undefined ? req.body.customConfig : req.body);
    await storeDb.setUserCharacterConfig(req.user._id, characterId, validated);
    res.json({ success: true, customConfig: validated });
  } catch (err) {
    console.error('[AI Routes] Save character config error:', err.message);
    res.status(err.status || 500).json({ message: err.message || 'Failed to save character configuration' });
  }
});

// DELETE /ai/character/config - Reset authenticated user's character customization
router.delete('/character/config', authMiddleware, async (req, res) => {
  if (process.env.WRITE_MODE === 'read-only') {
    return res.status(503).json({ message: 'Character customization writes are disabled' });
  }
  try {
    const characterId = 'char_lyra';
    await storeDb.resetUserCharacterConfig(req.user._id, characterId);
    res.json({ success: true, message: 'Character customization reset to default' });
  } catch (err) {
    console.error('[AI Routes] Reset character config error:', err.message);
    res.status(err.status || 500).json({ message: err.message || 'Failed to reset character configuration' });
  }
});

// POST /ai/character/preview - Isolated preview of custom character behavior
router.post('/character/preview', authMiddleware, async (req, res) => {
  try {
    const { userMessage, history = [], customConfig } = req.body || {};
    if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
      return res.status(400).json({ message: 'User message is required' });
    }
    const aiUser = storeDb.findUserById('user_ai_lyra');
    const characterId = aiUser?.aiCharacterId || 'char_lyra';

    // Hydrate personal layer so preview knows relationship context if exists, but will NOT mutate it
    await storeDb.hydrateAIPersonalLayer?.(req.user._id, characterId);
    const allMemories = storeDb.getAIMemories(req.user._id, characterId);
    const { filterRelevantMemories } = require('../ai/memoryEngine');
    const relevantMemories = filterRelevantMemories(allMemories, userMessage, history);
    const relationship = storeDb.getAIRelationship(req.user._id, characterId, false) || {};

    const rawCharacter = storeDb.getAICharacter(characterId) || {
      name: aiUser?.name || 'Lyra',
      age: 22,
      occupation: 'Barista & design student',
      bio: aiUser?.bio || 'coffee, design, film cameras, quiet cafes'
    };
    const { CharacterConfig } = require('../ai/characterConfig');
    const validatedConfig = sanitizeCustomConfig(customConfig);
    const characterConfig = new CharacterConfig(rawCharacter, validatedConfig);
    const { syncCharacterRhythm } = require('../ai/conversationDirector');
    const characterState = syncCharacterRhythm(storeDb, characterId);

    const { buildCharacterSystemPrompt } = require('../ai/promptBuilder');
    const userTimeZone = req.body?.timeZone || req.headers['x-user-timezone'] || req.user?.timezone;
    const systemPrompt = buildCharacterSystemPrompt({
      characterConfig,
      characterState,
      customConfig: validatedConfig,
      memories: relevantMemories,
      relationship,
      detectedLanguage: relationship?.active_language || 'auto',
      userTimeZone
    });

    const cleanHistory = (Array.isArray(history) ? history : []).slice(-10).map(item => ({
      content: String(item.content || '').slice(0, 1000),
      isAI: item.sender === 'ai' || item.isAI === true,
      senderId: item.sender === 'ai' || item.isAI ? aiUser?._id : req.user._id
    }));

    const { modelRouter } = require('../ai/conversationDirector');
    const plan = await modelRouter.generate({
      userMessage: userMessage.trim().slice(0, 1000),
      history: cleanHistory,
      systemPrompt,
      conversationKey: `preview:${req.user._id}:${characterId}`,
      memoryCount: relevantMemories.length
    });

    res.json({
      bubbles: Array.isArray(plan?.bubbles) ? plan.bubbles : [String(plan?.bubbles || 'Hello!')],
      reaction: plan?.reaction || null
    });
  } catch (err) {
    console.error('[AI Routes] Character preview error:', err.message);
    res.status(500).json({ message: 'Failed to generate preview' });
  }
});

// Structured operational diagnostics only. Never includes prompts, hidden
// reasoning, credentials, or another user's conversation data.
router.get('/debug/conversation', authMiddleware, async (req, res) => {
  if (process.env.NODE_ENV === 'production' && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Debug access is restricted' });
  }
  try {
    await storeDb.hydrateAIPersonalLayer(req.user._id);
    const relationship = storeDb.getAIRelationship(req.user._id);
    const state = storeDb.getAICharacterState();
    const debug = getConversationDebug(req.user._id);
    res.json({
      debug,
      memory_count: storeDb.getAIMemories(req.user._id).length,
      relationship: relationship ? {
        familiarity: relationship.familiarity,
        comfort: relationship.comfort,
        active_language: relationship.active_language || 'auto',
        sleep_intent_received: relationship.sleep_intent_received
      } : null,
      character_state: state ? {
        mood: state.mood,
        current_activity: state.current_activity,
        busy_level: state.busy_level,
        sleep_state: state.sleep_state
      } : null
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve AI diagnostics' });
  }
});

// POST /ai/proactive/tick - Trigger proactive check-in (admin or debug)
router.post('/proactive/tick', authMiddleware, async (req, res) => {
  try {
    const io = req.app.get('io');
    const { targetUserId } = req.body || {};
    // Allow triggering for self if not admin, or any target if admin
    const target = (req.user.isAdmin && targetUserId) ? targetUserId : req.user._id;
    const result = await triggerProactiveTick(storeDb, io, target);
    res.json(result);
  } catch (err) {
    console.error('[AI Routes] Proactive tick error:', err.message);
    res.status(500).json({ message: 'Proactive tick failed' });
  }
});

// POST /ai/debug/reset-relationship - Reset memories and relationship for test
router.post('/debug/reset-relationship', authMiddleware, async (req, res) => {
  try {
    await storeDb.hydrateAIPersonalLayer(req.user._id);
    const memories = storeDb.getAIMemories(req.user._id);
    memories.forEach(m => storeDb.deleteAIMemory(m._id, req.user._id));

    storeDb.updateAIRelationship(req.user._id, {
      familiarity: 1,
      trust: 1,
      affection: 1,
      comfort: 1,
      interaction_count: 0,
      communication_style: null,
      context_confidence: 0,
      time_zone: null,
      last_interaction_at: null,
      last_user_message_id: null,
      shared_history: [],
      proactive_history: [],
      sleep_intent_received: false,
      last_sleep_intent_at: null,
      proactive_count_today: 0,
      last_proactive_at: null,
      consecutive_ignored_count: 0
    });
    await storeDb.flushAIPersonalLayer(req.user._id, 'char_lyra', { deletedMemoryIds: memories.map(memory => memory._id), resetRelationship: true });

    res.json({ success: true, message: 'Relationship and memories reset' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reset relationship' });
  }
});

// POST /ai/avatar - Store image bytes separately and keep only a versioned URL in state.
router.post('/avatar', authMiddleware, async (req, res) => {
  try {
    const { avatar } = req.body;
    if (!avatar || typeof avatar !== 'string') {
      return res.status(400).json({ message: 'Avatar image is required' });
    }

    const trimmed = avatar.trim();
    const isDataImage = /^data:image\//i.test(trimmed);
    const isHttpUrl = /^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(trimmed) || /^https?:\/\/api\.dicebear\.com\/.+/i.test(trimmed);

    if (!isDataImage && !isHttpUrl) {
      return res.status(400).json({
        message: 'Invalid image format. Must be JPG, JPEG, PNG, or WEBP.'
      });
    }

    let storedAvatar = trimmed;
    if (isDataImage) {
      let media;
      try {
        media = parseAvatarDataUrl(trimmed);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
      try {
        await storeDb.storeAIAvatarMedia(media);
      } catch (error) {
        console.error('[AI Routes] Avatar media storage failed:', error.message);
        return res.status(503).json({ message: 'Avatar storage is temporarily unavailable' });
      }
      storedAvatar = avatarMediaPath(media.version);
    }

    const updated = storeDb.updateAIAvatar(storedAvatar);
    if (!updated) {
      return res.status(500).json({ message: 'Failed to update avatar' });
    }
    try {
      await storeDb.flushPersist();
      if (storeDb.isDirty?.()) throw new Error('Avatar state remains unflushed');
    } catch (error) {
      console.error('[AI Routes] Avatar state storage failed:', error.message);
      return res.status(503).json({ message: 'Avatar state storage is temporarily unavailable' });
    }

    // Notify connected clients via socket
    const io = req.app.get('io');
    emitToAuthenticatedUsers(io, 'user_updated', { userId: 'user_ai_lyra', avatar: storedAvatar });

    res.json({ success: true, avatar: storedAvatar });
  } catch (err) {
    console.error('[AI Routes] Avatar update error:', err.message);
    res.status(500).json({ message: 'Failed to update avatar' });
  }
});

// Public, immutable image bytes. The version is a content hash; profile state
// retains only the compact path above.
router.get('/avatar/media/:version', async (req, res) => {
  try {
    const media = await storeDb.getAIAvatarMedia(req.params.version);
    if (!media) return res.status(404).json({ message: 'Avatar image not found' });
    res.set({
      'Content-Type': media.contentType,
      'Content-Length': String(media.buffer.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: `"${req.params.version}"`,
      'X-Content-Type-Options': 'nosniff'
    });
    return res.status(200).send(media.buffer);
  } catch (err) {
    console.error('[AI Routes] Avatar media read failed:', err.message);
    return res.status(503).json({ message: 'Avatar image is temporarily unavailable' });
  }
});

module.exports = router;
