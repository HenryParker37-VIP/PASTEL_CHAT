/**
 * Conversation Director for PastelChat AI Characters.
 * Coordinates CharacterConfig, state, memory retrieval, prompt construction,
 * model routing, and human-like typing pacing.
 */

const { AIModelRouter } = require('./modelRouter');
const { CharacterConfig } = require('./characterConfig');
const { buildCharacterSystemPrompt } = require('./promptBuilder');
const { sleep, calculateTypingDuration, calculateInitialDelay, getInterBubblePause } = require('./timingEngine');
const { filterRelevantMemories, processMemoryUpdates, updateRelationshipOnInteraction } = require('./memoryEngine');
const { notifyInApp } = require('../services/inAppNotifications');
const { sendMessagePush } = require('../services/pushService');

const modelRouter = new AIModelRouter();
const conversationQueues = new Map();
const latestMessageByConversation = new Map();

function getConversationKey(userId, characterUserId = 'user_ai_lyra') {
  return `${String(userId)}:${String(characterUserId)}`;
}

/**
 * Updates character activity based on time of day schedule.
 */
function syncCharacterRhythm(storeDb) {
  const character = storeDb.getAICharacter();
  const state = storeDb.getAICharacterState();
  if (!character || !character.dailySchedule || !state) return state;

  const currentHour = new Date().getHours();
  const scheduleItem = character.dailySchedule.find(s => currentHour >= s.startHour && currentHour < s.endHour);

  if (scheduleItem && state.current_activity !== scheduleItem.activity) {
    storeDb.updateAICharacterState({
      current_activity: scheduleItem.activity,
      busy_level: scheduleItem.busyLevel,
      mood: scheduleItem.mood,
      sleep_state: scheduleItem.activity === 'sleeping' ? 'sleeping' : 'awake'
    });
  }

  return storeDb.getAICharacterState();
}

/**
 * Clean history to prevent duplicated latest messages and maintain strict turn order.
 */
function prepareContextHistory(history = [], currentMessageContent = '') {
  const normCurrent = String(currentMessageContent || '').trim().toLowerCase();
  const rows = (history || []).slice(-15);

  // If the last item in history is already the current user message, exclude it from history
  // because it will be passed explicitly as userMessage.
  if (rows.length > 0) {
    const last = rows[rows.length - 1];
    const isUser = !last.isAI && last.senderId !== 'user_ai_lyra' && last.senderId?._id !== 'user_ai_lyra';
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
  fastMode = false
}) {
  const aiUser = storeDb.findUserById('user_ai_lyra');
  if (!aiUser) {
    console.error('[AI Director] AI user record not found in database');
    return [];
  }

  const key = getConversationKey(user._id, aiUser._id);

  // A newer user message arrived while this turn was queued.
  if (latestMessageByConversation.get(key) !== String(userMessage._id)) {
    console.log('[AI Director] Aborting obsolete turn in favor of newer turn');
    return [];
  }

  const rawCharacter = storeDb.getAICharacter() || {
    name: aiUser.name || 'Lyra',
    age: 22,
    occupation: 'Barista & design student',
    bio: aiUser.bio || 'coffee, design, film cameras, quiet cafes'
  };
  const characterConfig = new CharacterConfig(rawCharacter);
  const characterState = syncCharacterRhythm(storeDb);
  const allMemories = storeDb.getAIMemories(user._id);
  const relevantMemories = filterRelevantMemories(allMemories, userMessage.content, recentHistory);
  const relationship = storeDb.getAIRelationship(user._id);

  // Build high-priority system prompt
  const systemPrompt = buildCharacterSystemPrompt({
    characterConfig,
    characterState,
    memories: relevantMemories,
    relationship,
    detectedLanguage: relationship?.active_language || 'auto'
  });

  const cleanHistory = prepareContextHistory(recentHistory, userMessage.content);
  const startTime = Date.now();

  const lyraSender = {
    _id: aiUser._id,
    name: aiUser.name,
    avatar: aiUser.avatar
  };

  const emitTyping = (isTyping) => {
    if (io && typeof io.emit === 'function') {
      try {
        io.emit(`typing:${user._id}`, { from: lyraSender, isTyping });
      } catch (err) {
        console.warn('[AI Director] Typing emit warning:', err.message);
      }
    }
  };

  let plan;
  try {
    emitTyping(true);

    plan = await modelRouter.generate({
      userMessage: userMessage.content,
      history: cleanHistory,
      systemPrompt,
      conversationKey: key,
      memoryCount: relevantMemories.length
    });
  } catch (err) {
    emitTyping(false);
    console.error(`[AI Director] Real LLM Generation failed: ${err.message}`);
    // NEVER use a fake conversational fallback! Log and return empty to indicate failure.
    return [];
  }

  // Check again if a newer message arrived while the LLM was thinking
  if (latestMessageByConversation.get(key) !== String(userMessage._id)) {
    emitTyping(false);
    return [];
  }

  const llmDuration = Date.now() - startTime;

  // Initial Reading Delay & Typing Start
  if (!fastMode) {
    const readingDelay = calculateInitialDelay((userMessage.content || '').length, llmDuration);
    await sleep(readingDelay);
  }

  // Apply Reaction to User Message if planned
  if (plan.reaction && userMessage._id) {
    try {
      const updated = storeDb.toggleReaction(userMessage._id, aiUser._id, plan.reaction);
      const populated = storeDb.populateMessage(updated, user._id);
      if (io && typeof io.emit === 'function') {
        io.emit(`msg_reaction:${user._id}:${aiUser._id}`, { messageId: userMessage._id, reactions: populated.reactions });
        io.emit(`msg_reaction:${aiUser._id}:${user._id}`, { messageId: userMessage._id, reactions: populated.reactions });
      }
    } catch (err) {
      console.warn('[AI Director] Reaction warning:', err.message);
    }
  }

  const createdMessages = [];

  // Deliver Bubbles Sequentially with natural human pacing
  for (let i = 0; i < plan.bubbles.length; i++) {
    const bubbleText = plan.bubbles[i];

    if (!fastMode) {
      const typingTime = calculateTypingDuration(bubbleText);
      await sleep(typingTime);
    }

    const msg = storeDb.createMessage({
      senderId: aiUser._id,
      receiverId: user._id,
      content: bubbleText,
      replyTo: null
    });

    const populated = storeDb.populateMessage(msg, user._id);
    createdMessages.push(populated);

    if (io && typeof io.emit === 'function') {
      try {
        io.emit(`msg:${aiUser._id}:${user._id}`, populated);
        io.emit(`msg:${user._id}:${aiUser._id}`, populated);

        notifyInApp(io, user._id, {
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
    }

    sendMessagePush(user._id, lyraSender, populated.content).catch(e =>
      console.error('[Push] AI push notification error:', e.message)
    );

    if (i < plan.bubbles.length - 1 && !fastMode) {
      await sleep(getInterBubblePause());
    }
  }

  emitTyping(false);

  // Post-Turn Updates: Relationship
  updateRelationshipOnInteraction(storeDb, user._id);

  return createdMessages;
}

function handleUserMessageToAI(args) {
  const aiUserId = 'user_ai_lyra';
  const key = getConversationKey(args.user._id, aiUserId);
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

function getConversationDebug(userId) {
  return modelRouter.getDebug(getConversationKey(userId));
}

module.exports = {
  handleUserMessageToAI,
  syncCharacterRhythm,
  getConversationDebug,
  modelRouter
};
