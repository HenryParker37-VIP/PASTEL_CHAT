/**
 * Memory and Relationship State Engine for PastelChat AI Characters.
 * Separates raw conversational history from durable long-term facts.
 */

const DURABLE_FACT_KEYS = new Set(['name', 'nickname', 'job', 'work', 'birthday', 'city', 'location', 'pet', 'interest', 'hobby', 'favorite']);

/**
 * Filter memories relevant to current context.
 * Durable core facts (name, key preferences) are kept; situational facts are matched by keywords.
 */
function filterRelevantMemories(allMemories = [], currentMessage = '', history = []) {
  if (!Array.isArray(allMemories) || allMemories.length === 0) return [];

  const contextText = `${currentMessage} ${(history || []).slice(-4).map(m => m.content || '').join(' ')}`.toLowerCase();
  const contextWords = new Set(contextText.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 2));

  return allMemories.filter(mem => {
    if (!mem || !mem.key || !mem.value) return false;
    const key = String(mem.key).toLowerCase();

    // Always include critical durable identity facts (e.g. user name or key traits)
    if (DURABLE_FACT_KEYS.has(key)) return true;

    // Keyword match on key, subject, or value
    const memWords = `${key} ${mem.subject || ''} ${mem.value || ''}`.toLowerCase().split(/[\s_]+/);
    return memWords.some(w => contextWords.has(w));
  }).slice(-8);
}

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
    consecutive_ignored_count: 0
  };

  if (activeLanguage) {
    updates.active_language = activeLanguage;
  }

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
  filterRelevantMemories,
  processMemoryUpdates,
  updateRelationshipOnInteraction
};
