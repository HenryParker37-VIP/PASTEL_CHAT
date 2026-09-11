const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const storeDb = require('../db/store');
const { syncCharacterRhythm } = require('../ai/conversationDirector');
const { triggerProactiveTick } = require('../ai/proactiveEngine');

// GET /ai/status - Public or authenticated info about Lyra's current state
router.get('/status', (req, res) => {
  try {
    const character = storeDb.getAICharacter();
    const characterState = syncCharacterRhythm(storeDb);
    const lifeEvents = storeDb.getAILifeEvents();
    const aiUser = storeDb.findUserById('user_ai_lyra');

    res.json({
      character,
      state: characterState,
      activeLifeEvents: (lifeEvents || []).filter(e => e.status === 'active'),
      user: aiUser ? storeDb.userPublic(aiUser) : null
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

module.exports = router;
