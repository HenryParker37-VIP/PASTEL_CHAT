const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const storeDb = require('../db/store');
const { syncCharacterRhythm, getConversationDebug } = require('../ai/conversationDirector');
const { triggerProactiveTick } = require('../ai/proactiveEngine');
const { parseAvatarDataUrl, avatarMediaPath } = require('../services/aiAvatarMedia');

function emitToAuthenticatedUsers(io, event, payload) {
  const sockets = io?.sockets?.sockets;
  if (!sockets) return;
  sockets.forEach((socket) => {
    if (socket.user?._id) socket.emit(event, payload);
  });
}

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
router.get('/memories', authMiddleware, (req, res) => {
  try {
    const memories = storeDb.getAIMemories(req.user._id);
    res.json(memories);
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve memories' });
  }
});

// DELETE /ai/memories/:id - Remove a memory
router.delete('/memories/:id', authMiddleware, (req, res) => {
  try {
    const success = storeDb.deleteAIMemory(req.params.id, req.user._id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete memory' });
  }
});

// GET /ai/relationship - Authenticated user's relationship with Lyra
router.get('/relationship', authMiddleware, (req, res) => {
  try {
    const rel = storeDb.getAIRelationship(req.user._id);
    res.json(rel);
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve relationship' });
  }
});

// Structured operational diagnostics only. Never includes prompts, hidden
// reasoning, credentials, or another user's conversation data.
router.get('/debug/conversation', authMiddleware, (req, res) => {
  if (process.env.NODE_ENV === 'production' && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Debug access is restricted' });
  }
  try {
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
    const { targetUserId } = req.body;
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
router.post('/debug/reset-relationship', authMiddleware, (req, res) => {
  try {
    const memories = storeDb.getAIMemories(req.user._id);
    memories.forEach(m => storeDb.deleteAIMemory(m._id, req.user._id));

    storeDb.updateAIRelationship(req.user._id, {
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
    });

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
    await storeDb.flushPersist();

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
