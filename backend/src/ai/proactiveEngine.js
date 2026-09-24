/** Per-user, per-character check-ins. Automatic ticks run only on one persistent writer. */
const crypto = require('crypto');
const { AIModelRouter } = require('./modelRouter');
const { CharacterConfig } = require('./characterConfig');
const { buildCharacterSystemPrompt } = require('./promptBuilder');
const { validTimeZone } = require('./memoryEngine');
const { notifyInApp } = require('../services/inAppNotifications');
const { sendMessagePush } = require('../services/pushService');
const { emitToUser } = require('../services/userSocket');

const router = new AIModelRouter();
const inFlight = new Set();
const WINDOWS = [{ name: 'morning', start: 8, end: 11 }, { name: 'afternoon', start: 12, end: 17 }, { name: 'evening', start: 18, end: 21 }];

function localWindow(timeZone, now = new Date()) {
  const zone = validTimeZone(timeZone);
  if (!zone) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const field = type => parts.find(part => part.type === type)?.value;
  const hour = Number(field('hour'));
  const window = WINDOWS.find(item => hour >= item.start && hour < item.end);
  return window ? { name: window.name, key: `${field('year')}-${field('month')}-${field('day')}:${window.name}` } : null;
}

function eligibleUser(storeDb, user, characterId, now = new Date()) {
  if (!user || user.isAI || user.isSuspended) return null;
  const rel = storeDb.getAIRelationship(user._id, characterId, false);
  const window = localWindow(rel?.time_zone, now);
  if (!window || !rel?.last_interaction_at) return null;
  const sinceInteraction = now - new Date(rel.last_interaction_at);
  if (!Number.isFinite(sinceInteraction)) return null;
  if (sinceInteraction < 8 * 3600_000 || sinceInteraction > 14 * 24 * 3600_000) return null;
  if (rel.last_proactive_at && now - new Date(rel.last_proactive_at) < 36 * 3600_000) return null;
  if ((rel.consecutive_ignored_count || 0) >= 2) return null;
  if (rel.sleep_intent_received && rel.last_sleep_intent_at && now - new Date(rel.last_sleep_intent_at) < 10 * 3600_000) return null;
  const history = (rel.proactive_history || []).filter(item => now - new Date(item.at) < 7 * 24 * 3600_000);
  if (history.length >= 2 || history.some(item => item.window === window.key)) return null;
  return { rel, window, history };
}

function getProactiveCandidates(storeDb, now = new Date(), characterId = 'char_lyra') {
  return (storeDb.store.users || []).filter(user => eligibleUser(storeDb, user, characterId, now));
}

function shouldInitiate(userId, windowKey, hasRelevantEvent) {
  const digest = crypto.createHash('sha256').update(`${userId}:${windowKey}`).digest();
  return digest[0] < (hasRelevantEvent ? 150 : 55); // Many windows intentionally stay quiet.
}

function tooSimilar(left, right) {
  const a = new Set(String(left || '').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []);
  const b = new Set(String(right || '').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []);
  if (!a.size || !b.size) return false;
  let shared = 0;
  a.forEach(word => { if (b.has(word)) shared += 1; });
  return shared / Math.min(a.size, b.size) >= 0.75;
}

async function triggerProactiveTick(storeDb, io, targetUserId = null, { now = new Date(), model = router, characterUserId = 'user_ai_lyra' } = {}) {
  if (process.env.WRITE_MODE === 'read-only') return { triggered: 0, reason: 'read_only' };
  const aiUser = storeDb.findUserById(characterUserId);
  if (!aiUser?.isAI) return { triggered: 0, reason: 'AI user not found' };
  const characterId = aiUser.aiCharacterId || 'char_lyra';
  if (targetUserId) await storeDb.hydrateAIPersonalLayer?.(targetUserId, characterId);
  else await storeDb.hydrateAllAIPersonalLayers?.();
  const users = targetUserId ? [storeDb.findUserById(targetUserId)].filter(Boolean) : getProactiveCandidates(storeDb, now, characterId);
  let triggered = 0;
  for (const user of users) {
    if (triggered >= 2) break;
    const eligibility = eligibleUser(storeDb, user, characterId, now);
    if (!eligibility) continue;
    const scopedMemories = storeDb.getAIMemories(user._id, characterId);
    const event = scopedMemories.find(memory => ['upcoming_event', 'current_concern'].includes(memory.key) && memory.source === 'USER_STATED' && now - new Date(memory.lastConfirmedAt || memory.createdAt) < 14 * 24 * 3600_000);
    if (!shouldInitiate(user._id, eligibility.window.key, Boolean(event))) continue;
    const key = JSON.stringify([user._id, characterId]);
    if (inFlight.has(key)) continue;
    inFlight.add(key);
    try {
      // The claim is atomic in Atlas. Failed generations consume this window,
      // which is safer than duplicate messages from concurrent workers.
      if (!await storeDb.claimAIProactiveWindow(user._id, characterId, eligibility.window.key)) continue;
      const characterConfig = new CharacterConfig(storeDb.getAICharacter(characterId));
      const systemPrompt = buildCharacterSystemPrompt({
        characterConfig,
        characterState: storeDb.getAICharacterState(characterId),
        memories: event ? [event] : [],
        relationship: eligibility.rel
      });
      const instruction = event
        ? `You may send a brief, natural check-in during the user's ${eligibility.window.name}. They explicitly mentioned ${JSON.stringify(event.value)}. Ask gently without claiming that it already happened or inventing details.`
        : `You may send a brief, natural check-in during the user's ${eligibility.window.name}. You have no specific event to follow up on. Do not invent one.`;
      const plan = await model.generate({ userMessage: instruction, history: [], systemPrompt, conversationKey: key, memoryCount: event ? 1 : 0 });
      await storeDb.hydrateAIPersonalLayer?.(user._id, characterId);
      const freshEligibility = eligibleUser(storeDb, user, characterId, now);
      if (!freshEligibility) continue;
      const content = plan.bubbles.join(' ').trim().slice(0, 500);
      if (/data:[^\s]+;base64,|<svg|<img/i.test(content)) continue;
      if (!event && /\byou (?:said|mentioned|told me)\b|\byour (?:interview|exam|trip|appointment|presentation)\b/i.test(content)) continue;
      const fingerprint = crypto.createHash('sha256').update(content.toLowerCase()).digest('hex').slice(0, 16);
      if (!content || freshEligibility.history.some(item => item.fingerprint === fingerprint || tooSimilar(item.sample, content))) continue;
      const msg = storeDb.createMessage({ senderId: aiUser._id, receiverId: user._id, content, clientMessageId: `proactive:${eligibility.window.key}:${user._id}` });
      await storeDb.flushMessageWrites?.();
      model.recordRecentOutputs?.(key, [content]);
      const populated = storeDb.populateMessage(msg, user._id);
      const previous = freshEligibility.history;
      storeDb.updateAIRelationship(user._id, {
        proactive_history: [...previous, { at: now.toISOString(), window: eligibility.window.key, fingerprint, sample: content.slice(0, 120) }].slice(-8),
        last_proactive_at: now.toISOString(),
        consecutive_ignored_count: (freshEligibility.rel.consecutive_ignored_count || 0) + 1
      }, characterId);
      await storeDb.flushAIPersonalLayer?.(user._id, characterId);
      emitToUser(io, user._id, `msg:${aiUser._id}:${user._id}`, populated);
      emitToUser(io, user._id, `msg:${user._id}:${aiUser._id}`, populated);
      notifyInApp(io, user._id, { type: 'new_message', from: { _id: aiUser._id, name: aiUser.name, avatar: aiUser.avatar }, preview: content.slice(0, 80), messageId: msg._id }, {
        title: `Tin nhắn mới từ ${aiUser.name}`, body: content.slice(0, 160), data: { route: `/chat/${aiUser._id}`, friendId: aiUser._id, messageId: msg._id }
      });
      sendMessagePush(user._id, aiUser, content).catch(() => {});
      triggered += 1;
    } finally {
      inFlight.delete(key);
    }
  }
  return { triggered };
}

function startProactiveScheduler(storeDb, io) {
  if (process.env.PERSISTENT_SERVICE !== 'true' || process.env.PROACTIVE_LYRA !== 'true' || process.env.WRITE_MODE === 'read-only' || process.env.LYRA_SINGLE_WRITER !== 'true') return null;
  const tick = () => {
    if (!storeDb.isDurableStorageEnabled()) return;
    triggerProactiveTick(storeDb, io).catch(error => console.error('[Lyra Proactive] Tick failed:', error.message));
  };
  const timer = setInterval(tick, 45 * 60_000);
  timer.unref?.();
  return () => clearInterval(timer);
}

module.exports = { triggerProactiveTick, getProactiveCandidates, eligibleUser, localWindow, shouldInitiate, startProactiveScheduler };
