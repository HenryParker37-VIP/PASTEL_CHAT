/**
 * Memory and Relationship State Engine for AI Contact Lyra.
 */

function processMemoryUpdates(storeDb, userId, characterId, memoriesToSave = []) {
  if (!storeDb || !userId || !Array.isArray(memoriesToSave) || memoriesToSave.length === 0) return [];
  const saved = [];

  memoriesToSave.forEach(mem => {
    if (!mem.key || !mem.value) return;
    const added = storeDb.addAIMemory({
      userId: String(userId),
      characterId: characterId || 'char_lyra',
      type: mem.type || 'preference',
      subject: mem.subject || 'general',
      key: String(mem.key).trim().toLowerCase().slice(0, 50),
      value: String(mem.value).trim().slice(0, 200),
      confidence: 0.9,
      importance: 0.8
    });
    if (added) saved.push(added);
  });

  return saved;
}

function updateRelationshipOnInteraction(storeDb, userId, { sleepIntent = false, activeLanguage = null } = {}) {
  if (!storeDb || !userId) return null;
  const currentRel = storeDb.getAIRelationship(userId) || {
    userId: String(userId),
    characterId: 'char_lyra',
    familiarity: 1,
    trust: 1,
    affection: 1,
    comfort: 1,
    sleep_intent_received: false,
    last_sleep_intent_at: null,
    proactive_count_today: 0,
    last_proactive_at: null,
    consecutive_ignored_count: 0
  };

  const updates = {
    last_interaction_at: new Date().toISOString(),
    consecutive_ignored_count: 0 // Reset ignored counter when user interacts
  };

  if (activeLanguage) {
    updates.active_language = activeLanguage;
  }

  // Grow relationship metrics slowly up to 10
  if (currentRel.familiarity < 10) updates.familiarity = Math.min(10, (currentRel.familiarity || 1) + 0.2);
  if (currentRel.comfort < 10) updates.comfort = Math.min(10, (currentRel.comfort || 1) + 0.15);
  if (currentRel.trust < 10) updates.trust = Math.min(10, (currentRel.trust || 1) + 0.1);

  if (sleepIntent) {
    updates.sleep_intent_received = true;
    updates.last_sleep_intent_at = new Date().toISOString();
  }

  return storeDb.updateAIRelationship(userId, updates);
}

module.exports = {
  processMemoryUpdates,
  updateRelationshipOnInteraction
};
