/**
 * Conversation Director for PastelChat AI Characters.
 * Coordinates CharacterConfig, state, memory retrieval, prompt construction,
 * model routing, and human-like typing pacing.
 */

const { AIModelRouter } = require('./modelRouter');
const { CharacterConfig } = require('./characterConfig');
const { buildCharacterSystemPrompt } = require('./promptBuilder');
const { sleep, calculateTypingDuration, calculateInitialDelay, getInterBubblePause } = require('./timingEngine');
const { filterRelevantMemories, extractExplicitMemoryCandidates, processMemoryUpdates, updateRelationshipOnInteraction } = require('./memoryEngine');
const { notifyInApp } = require('../services/inAppNotifications');
const { sendMessagePush } = require('../services/pushService');
const { emitToUser } = require('../services/userSocket');

const modelRouter = new AIModelRouter();
const conversationQueues = new Map();
const latestMessageByConversation = new Map();

function getConversationKey(userId, characterId = 'char_lyra') {
  return JSON.stringify([String(userId), String(characterId)]);
}

/**
 * Updates character activity based on time of day schedule.
 */
function syncCharacterRhythm(storeDb, characterId = 'char_lyra') {
  const character = storeDb.getAICharacter(characterId);
  const state = storeDb.getAICharacterState(characterId);
  if (!character || !character.dailySchedule || !state) return state;

  const currentHour = new Date().getHours();
  const scheduleItem = character.dailySchedule.find(s => currentHour >= s.startHour && currentHour < s.endHour);

  if (scheduleItem && state.current_activity !== scheduleItem.activity) {
    storeDb.updateAICharacterState({
      current_activity: scheduleItem.activity,
      busy_level: scheduleItem.busyLevel,
      mood: scheduleItem.mood,
      sleep_state: scheduleItem.activity === 'sleeping' ? 'sleeping' : 'awake'
    }, characterId);
  }

  return storeDb.getAICharacterState(characterId);
}

/**
 * Clean history to prevent duplicated latest messages and maintain strict turn order.
 */
function prepareContextHistory(history = [], currentMessageContent = '', characterUserId = 'user_ai_lyra') {
  const normCurrent = String(currentMessageContent || '').trim().toLowerCase();
  const rows = (history || []).slice(-15);

  // If the last item in history is already the current user message, exclude it from history
  // because it will be passed explicitly as userMessage.
  if (rows.length > 0) {
    const last = rows[rows.length - 1];
    const isUser = !last.isAI && last.senderId !== characterUserId && last.senderId?._id !== characterUserId;
    if (isUser && String(last.content || '').trim().toLowerCase() === normCurrent) {
      return rows.slice(0, -1);
    }
  }
  return rows;
}

/**
 * Executes full conversational response from an AI character to a user message.
 */
async function executeLatestUserMessage({
  storeDb,
  io,
  user,
  userMessage,
  recentHistory = [],
  fastMode = false,
  characterUserId = 'user_ai_lyra',
  router = modelRouter,
  delay = sleep,
  timeZone = null
}) {
  if (process.env.WRITE_MODE === 'read-only') return [];
  const aiUser = storeDb.findUserById(characterUserId);
  if (!aiUser?.isAI) {
    console.error('[AI Director] AI user record not found in database');
    return [];
  }

  const characterId = aiUser.aiCharacterId || 'char_lyra';
  const key = getConversationKey(user._id, characterId);
  const isCurrentTurn = async () =>
    latestMessageByConversation.get(key) === String(userMessage._id) &&
    (!storeDb.isCurrentAITurn || await storeDb.isCurrentAITurn(user._id, characterId, userMessage._id));

  // A newer user message arrived while this turn was queued.
  if (!await isCurrentTurn()) {
    console.log('[AI Director] Aborting obsolete turn in favor of newer turn');
    return [];
  }

  await storeDb.hydrateAIPersonalLayer?.(user._id, characterId);
  await storeDb.hydrateUserCharacterConfig?.(user._id, characterId);
  if (!await isCurrentTurn()) return [];
  if (storeDb.getAIRelationship(user._id, characterId, false)?.shared_history?.some(entry => entry.userMessageId === String(userMessage._id))) return [];

  const rawCharacter = storeDb.getAICharacter(characterId) || {
    name: aiUser.name || 'Lyra',
    age: 22,
    occupation: 'Barista & design student',
    bio: aiUser.bio || 'coffee, design, film cameras, quiet cafes'
  };
  const customConfig = storeDb.getUserCharacterConfig?.(user._id, characterId);
  const characterConfig = new CharacterConfig(rawCharacter, customConfig);
  const characterState = syncCharacterRhythm(storeDb, characterId);
  // Only the current authenticated user turn may produce new durable facts.
  const candidates = extractExplicitMemoryCandidates(userMessage.content);
  processMemoryUpdates(storeDb, user._id, characterId, candidates, userMessage._id, userMessage.timestamp);
  const communication = storeDb.getAIMemories(user._id, characterId).find(memory => memory.key === 'communication_preference');
  if (communication) storeDb.updateAIRelationship(user._id, { communication_style: communication.value }, characterId);
  const relationship = updateRelationshipOnInteraction(storeDb, user._id, {
    characterId, messageId: userMessage._id, timeZone,
    sleepIntent: /\b(?:good night|going to sleep|i'm going to bed)\b/i.test(userMessage.content || '')
  });
  await storeDb.flushAIPersonalLayer?.(user._id, characterId);
  const allMemories = storeDb.getAIMemories(user._id, characterId);
  const relevantMemories = filterRelevantMemories(allMemories, userMessage.content, recentHistory);

  // Build high-priority system prompt
  const systemPrompt = buildCharacterSystemPrompt({
    characterConfig,
    characterState,
    customConfig,
    memories: relevantMemories,
    relationship,
    detectedLanguage: relationship?.active_language || 'auto'
  });

  const cleanHistory = prepareContextHistory(recentHistory, userMessage.content, aiUser._id);
  const startTime = Date.now();

  const lyraSender = {
    _id: aiUser._id,
    name: aiUser.name,
    avatar: aiUser.avatar
  };

  const emitTyping = (isTyping) => {
    emitToUser(io, user._id, `typing:${user._id}`, { from: lyraSender, isTyping });
  };

  let plan;
  try {
    emitTyping(true);

    plan = await router.generate({
      userMessage: userMessage.content,
      history: cleanHistory,
      systemPrompt,
      conversationKey: key,
      memoryCount: relevantMemories.length
    });
  } catch (err) {
    emitTyping(false);
    console.error(`[AI Director] Real LLM Generation failed: ${err.message}`);
    // Rethrow to caller so diagnostics/logging can capture the real failure
    throw err;
  }

  // Check again if a newer message arrived while the LLM was thinking
  if (!await isCurrentTurn()) {
    emitTyping(false);
    return [];
  }

  const llmDuration = Date.now() - startTime;

  // Initial Reading Delay & Typing Start
  if (!fastMode) {
    const readingDelay = calculateInitialDelay((userMessage.content || '').length, llmDuration);
    await delay(readingDelay);
  }

  if (!await isCurrentTurn()) {
    emitTyping(false);
    return [];
  }

  // Apply Reaction to User Message if planned
  if (plan.reaction && userMessage._id && await isCurrentTurn()) {
    try {
      const updated = storeDb.toggleReaction(userMessage._id, aiUser._id, plan.reaction);
      const populated = storeDb.populateMessage(updated, user._id);
      emitToUser(io, user._id, `msg_reaction:${user._id}:${aiUser._id}`, { messageId: userMessage._id, reactions: populated.reactions });
      emitToUser(io, user._id, `msg_reaction:${aiUser._id}:${user._id}`, { messageId: userMessage._id, reactions: populated.reactions });
    } catch (err) {
      console.warn('[AI Director] Reaction warning:', err.message);
    }
  }

  const createdMessages = [];

  // Deliver Bubbles Sequentially with natural human pacing
  for (let i = 0; i < plan.bubbles.length; i++) {
    const bubbleText = plan.bubbles[i];

    if (typeof bubbleText !== 'string' || !bubbleText.trim() || /data:[^\s]+;base64,|<svg|<img/i.test(bubbleText)) continue;

    if (!await isCurrentTurn()) break;

    if (!fastMode) {
      const typingTime = calculateTypingDuration(bubbleText);
      await delay(typingTime);
    }
    if (!await isCurrentTurn()) break;

    const bubble = {
      senderId: aiUser._id,
      receiverId: user._id,
      content: bubbleText,
      aiDeliveryMode: fastMode ? 'client-paced' : 'server-paced',
      replyTo: null
    };
    const msg = storeDb.commitAIBubble
      ? await storeDb.commitAIBubble(user._id, characterId, userMessage._id, bubble)
      : storeDb.createMessage(bubble);
    if (!msg) break;

    const populated = storeDb.populateMessage(msg, user._id);
    createdMessages.push(populated);

    try {
      emitToUser(io, user._id, `msg:${aiUser._id}:${user._id}`, populated);
      emitToUser(io, user._id, `msg:${user._id}:${aiUser._id}`, populated);

      if (i === 0) notifyInApp(io, user._id, {
          type: 'new_message',
          from: lyraSender,
          preview: populated.content.slice(0, 80),
          messageId: populated._id
        }, {
          title: `Tin nhắn mới từ ${aiUser.name}`,
          body: populated.content.slice(0, 160),
          data: { route: `/chat/${aiUser._id}`, friendId: aiUser._id, messageId: populated._id }
      });
    } catch (e) {
      console.warn('[AI Director] Socket emit warning:', e.message);
    }

    if (i === 0) sendMessagePush(user._id, lyraSender, populated.content).catch(e =>
      console.error('[Push] AI push notification error:', e.message)
    );

    if (i < plan.bubbles.length - 1 && !fastMode) {
      await delay(getInterBubblePause());
    }
  }

  emitTyping(false);

  if (createdMessages.length) {
    router.recordRecentOutputs?.(key, createdMessages.map(message => message.content));
    const rel = storeDb.getAIRelationship(user._id, characterId);
    const history = (rel?.shared_history || []).filter(entry => entry?.userMessageId !== String(userMessage._id));
    storeDb.updateAIRelationship(user._id, {
      shared_history: [...history, { userMessageId: String(userMessage._id), aiMessageIds: createdMessages.map(message => message._id), at: new Date().toISOString() }].slice(-8)
    }, characterId);
    await storeDb.flushAIPersonalLayer?.(user._id, characterId);
  }

  return createdMessages;
}

function handleUserMessageToAI(args) {
  const aiUserId = args.characterUserId || 'user_ai_lyra';
  const characterId = args.storeDb.findUserById(aiUserId)?.aiCharacterId || 'char_lyra';
  const key = getConversationKey(args.user._id, characterId);
  latestMessageByConversation.set(key, String(args.userMessage._id));

  const previous = conversationQueues.get(key) || Promise.resolve();
  const task = previous
    .catch(() => undefined)
    .then(() => executeLatestUserMessage(args))
    .finally(() => {
      if (conversationQueues.get(key) === task) {
        conversationQueues.delete(key);
      }
    });

  conversationQueues.set(key, task);
  return task;
}

function getConversationDebug(userId, characterId = 'char_lyra') {
  return modelRouter.getDebug(getConversationKey(userId, characterId));
}

function invalidateConversation(userId, characterId, messageId) {
  latestMessageByConversation.set(getConversationKey(userId, characterId), String(messageId));
}

module.exports = {
  handleUserMessageToAI,
  syncCharacterRhythm,
  getConversationDebug,
  invalidateConversation,
  modelRouter
};
