const { validTimeZone, isTransientTemporalStatement } = require('./temporalContext');

/** Small, explicit, user-owned facts. Conversation messages remain short-term context. */
const AI_CHARACTER_ID = 'char_lyra';
const STOP_WORDS = new Set(['the', 'and', 'for', 'you', 'your', 'what', 'how', 'are', 'was', 'with', 'that', 'this', 'about']);

function words(value) {
  return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

function filterRelevantMemories(allMemories = [], currentMessage = '', history = []) {
  if (!Array.isArray(allMemories)) return [];
  const context = new Set(words(`${currentMessage} ${(history || []).slice(-3).map(message => message.content || '').join(' ')}`));
  return allMemories
    .filter(memory => memory?.key && typeof memory?.value === 'string' && memory.value.length <= 180 && !/data:[^\s]+;base64,|<svg|<img/i.test(memory.value) && memory.source !== 'INFERRED')
    .map(memory => {
      const terms = words(`${memory.key.replace(/_/g, ' ')} ${memory.subject || ''} ${memory.value}`);
      const matches = terms.filter(term => context.has(term)).length;
      const questionMatch = (memory.key === 'name' && /\b(name|call me)\b/i.test(currentMessage)) ||
        (memory.key === 'city' && /\b(live|city|location|where)\b/i.test(currentMessage)) ||
        (memory.key === 'communication_preference' && /\b(reply|replies|respond|style)\b/i.test(currentMessage)) ||
        (memory.key.startsWith('interest_') && /\b(hobb(?:y|ies)|interests?)\b/i.test(currentMessage));
      return { memory, score: matches + (questionMatch ? 2 : 0) };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.memory.lastConfirmedAt || 0) - new Date(a.memory.lastConfirmedAt || 0))
    .slice(0, 5)
    .map(item => item.memory);
}

const FACT_PATTERNS = [
  { regex: /\bmy name is\s+([^.!?\n]{2,60})/i, key: 'name', type: 'fact', subject: 'identity' },
  { regex: /\b(?:i live in|i moved to)\s+([^.!?\n]{2,80})/i, key: 'city', type: 'fact', subject: 'location' },
  { regex: /\b(?:i work as|my job is)\s+([^.!?\n]{2,100})/i, key: 'work', type: 'fact', subject: 'work' },
  { regex: /\b(?:my favorite|my favourite)\s+(tea|food|music|movie|book)\s+is\s+([^.!?\n]{2,100})/i, dynamicKey: true, type: 'preference', subject: 'favorites' },
  { regex: /\b(?:i prefer|please (?:use|keep))\s+([^.!?\n]{3,100})/i, key: 'communication_preference', type: 'preference', subject: 'communication' },
  { regex: /\b(?:i am interested in|i'm interested in|my hobby is)\s+([^.!?\n]{3,100})/i, interest: true, type: 'interest', subject: 'hobbies' },
  { regex: /\bmy birthday is\s+([^.!?\n]{3,60})/i, key: 'birthday', type: 'fact', subject: 'identity' },
  { regex: /\b(?:i am worried about|i'm worried about)\s+([^.!?\n]{3,100})/i, key: 'current_concern', type: 'event', subject: 'concerns' },
  { regex: /(?:^|[.!?]\s+)(?:thật ra[, ]+)?(?:mình|tôi) tên là\s+([^.!?\n]{2,60})/i, key: 'name', type: 'fact', subject: 'identity' },
  { regex: /(?:^|[.!?]\s+)(?:thật ra[, ]+)?(?:mình|tôi) sống ở\s+([^.!?\n]{2,80})/i, key: 'city', type: 'fact', subject: 'location' },
  { regex: /\bi (?:have|am taking|am going to|will have)\s+(an? (?:interview|exam|trip|appointment|presentation))\s+([^.!?\n]{2,100})/i, key: 'upcoming_event', type: 'event', subject: 'plans' }
];

function extractExplicitMemoryCandidates(message = '') {
  const text = String(message || '').trim();
  if (!text || text.length > 2000 || /data:[^\s]+;base64,|<svg|<img|https?:\/\//i.test(text)) return [];
  const candidates = [];
  for (const originalClause of text.match(/[^.!?\n]+[.!?]?/g) || []) {
    const clause = originalClause.trim().replace(/^(?:actually|to clarify|thật ra)[,\s]+/i, '').trim();
    if (!clause || clause.endsWith('?')) continue;
    if (isTransientTemporalStatement(clause)) continue;
    if (/^(?:why|how|do|does|did|could|would|should|what if|imagine|suppose|maybe|perhaps)\b/i.test(clause)) continue;
    if (/\b(?:never|not|don't|doesn't|didn't|can't|cannot|won't|might|maybe|perhaps|probably)\b/i.test(clause)) continue;
    for (const pattern of FACT_PATTERNS) {
      const match = clause.match(pattern.regex);
      // A fact embedded in a quote, denial, or report about someone else is
      // not an explicit first-person statement by this user.
      if (!match || match.index !== 0) continue;
      const key = pattern.dynamicKey ? `favorite_${match[1].toLowerCase()}` : pattern.interest ? `interest_${String(match[1]).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 35)}` : pattern.key;
      const rawValue = pattern.type === 'event' && match[2] ? `${match[1]} ${match[2]}` : match[pattern.dynamicKey ? 2 : 1];
      const value = String(rawValue).replace(/\s+(?:and|but)\s+.*$/i, '').trim();
      if (!value || isTransientTemporalStatement(value)) continue;
      candidates.push({ key, value, type: pattern.type, subject: pattern.subject, source: 'USER_STATED' });
    }
  }
  return candidates;
}

function processMemoryUpdates(storeDb, userId, characterId = AI_CHARACTER_ID, memoriesToSave = [], sourceMessageId = null, sourceMessageAt = null) {
  if (!storeDb || !userId || !Array.isArray(memoriesToSave)) return [];
  const saved = [];
  for (const candidate of memoriesToSave) {
    if (!candidate?.key || !candidate?.value || candidate.source === 'INFERRED') continue;
    if (isTransientTemporalStatement(candidate.key) || isTransientTemporalStatement(candidate.value, candidate.key)) continue;
    const existing = storeDb.getAIMemories?.(userId, characterId)?.find(memory => memory.key === candidate.key);
    if (existing?.sourceMessageId === sourceMessageId && sourceMessageId) continue;
    if (sourceMessageAt && existing?.sourceMessageAt && new Date(sourceMessageAt) < new Date(existing.sourceMessageAt)) continue;
    const added = storeDb.addAIMemory({ ...candidate, userId: String(userId), characterId, sourceMessageId, sourceMessageAt });
    if (added) saved.push(added);
  }
  return saved;
}

function updateRelationshipOnInteraction(storeDb, userId, { characterId = AI_CHARACTER_ID, messageId = null, sleepIntent = false, activeLanguage = null, timeZone = null } = {}) {
  if (!storeDb || !userId) return null;
  const current = storeDb.getAIRelationship(userId, characterId);
  if (messageId && current?.last_user_message_id === String(messageId)) return current;
  const updates = {
    interaction_count: (current?.interaction_count || 0) + 1,
    last_interaction_at: new Date().toISOString(),
    consecutive_ignored_count: 0,
    familiarity: Math.min(10, (current?.familiarity || 1) + 0.2),
    context_confidence: Math.min(1, (storeDb.getAIMemories?.(userId, characterId)?.length || 0) / 8)
  };
  if (messageId) updates.last_user_message_id = String(messageId);
  if (activeLanguage) updates.active_language = activeLanguage;
  if (validTimeZone(timeZone)) updates.time_zone = validTimeZone(timeZone);
  if (sleepIntent) {
    updates.sleep_intent_received = true;
    updates.last_sleep_intent_at = new Date().toISOString();
  }
  return storeDb.updateAIRelationship(userId, updates, characterId);
}

module.exports = {
  filterRelevantMemories,
  extractExplicitMemoryCandidates,
  processMemoryUpdates,
  updateRelationshipOnInteraction,
  validTimeZone
};
