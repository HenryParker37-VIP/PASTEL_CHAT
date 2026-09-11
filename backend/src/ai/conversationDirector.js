/**
 * Conversation Director for AI Contact Lyra.
 * Coordinates character state, memory retrieval, model routing, and pacing.
 */

const { AIModelRouter } = require('./modelRouter');
const { sleep, calculateTypingDuration, calculateInitialDelay, getInterBubblePause } = require('./timingEngine');
const { processMemoryUpdates, updateRelationshipOnInteraction } = require('./memoryEngine');
const { notifyInApp } = require('../services/inAppNotifications');
const { sendMessagePush } = require('../services/pushService');

const modelRouter = new AIModelRouter();

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
 * Executes full conversational response from Lyra to a user message.
 */
async function handleUserMessageToAI({
  storeDb,
  io,
  user,
  userMessage,
  recentHistory = [],
  fastMode = false // true when running in tight synchronous serverless context
}) {
  const aiUser = storeDb.findUserById('user_ai_lyra');
  if (!aiUser) {
    console.error('[AI Director] AI user user_ai_lyra not found');
    return [];
  }

  const character = storeDb.getAICharacter();
  const characterState = syncCharacterRhythm(storeDb);
  const lifeEvents = storeDb.getAILifeEvents();
  const memories = storeDb.getAIMemories(user._id);
  const relationship = storeDb.getAIRelationship(user._id);

  const startTime = Date.now();

  // 1. Generate Structured Response Plan
  const plan = await modelRouter.generate({
    userMessage: userMessage.content,
    history: recentHistory,
    character,
    characterState,
    lifeEvents,
    memories,
    relationship,
    userName: user.name
  });

  const llmDuration = Date.now() - startTime;

  // 2. Initial Reading Delay & Typing Start
  if (!fastMode) {
    const readingDelay = calculateInitialDelay((userMessage.content || '').length, llmDuration);
    await sleep(readingDelay);
  }

  const lyraSender = {
    _id: aiUser._id,
    name: aiUser.name,
    avatar: aiUser.avatar
  };

  // Broadcast typing indicator to user
  const emitTyping = (isTyping) => {
    if (io && typeof io.emit === 'function') {
      try {
        io.emit(`typing:${user._id}`, { from: lyraSender, isTyping });
      } catch (err) {
        console.warn('[AI Director] Typing emit warning:', err.message);
      }
    }
  };

  emitTyping(true);

  // 3. Apply Reaction to User Message if planned
  if (plan.reaction && userMessage._id) {
    try {
      const updated = storeDb.toggleReaction(userMessage._id, aiUser._id, plan.reaction);
      const populated = storeDb.populateMessage(updated, user._id);
      if (io && typeof io.emit === 'function') {
        io.emit(`msg_reaction:${user._id}:${aiUser._id}`, { messageId: userMessage._id, reactions: populated.reactions });
        io.emit(`msg_reaction:${aiUser._id}:${user._id}`, { messageId: userMessage._id, reactions: populated.reactions });
      }
    } catch (err) {
      console.warn('[AI Director] Reaction error:', err.message);
    }
  }

  const createdMessages = [];

  // 4. Deliver Bubbles Sequentially
  for (let i = 0; i < plan.bubbles.length; i++) {
    const bubbleText = plan.bubbles[i];

    if (!fastMode) {
      const typingTime = calculateTypingDuration(bubbleText);
      await sleep(typingTime);
    }

    // Insert bubble into database
    const msg = storeDb.createMessage({
      senderId: aiUser._id,
      receiverId: user._id,
      content: bubbleText,
      replyTo: i === 0 && userMessage._id ? userMessage._id : null
    });

    const populated = storeDb.populateMessage(msg, user._id);
    createdMessages.push(populated);

    // Emit to sockets
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

    // Web push notification
    sendMessagePush(user._id, lyraSender, populated.content).catch(e =>
      console.error('[Push] Failed to send AI push notification:', e.message)
    );

    // If there is another bubble, pause briefly between bubbles
    if (i < plan.bubbles.length - 1 && !fastMode) {
      const interPause = getInterBubblePause();
      await sleep(interPause);
    }
  }

  emitTyping(false);

  // 5. Post-Turn Updates: Memory & Relationship
  processMemoryUpdates(storeDb, user._id, 'char_lyra', plan.memories_to_save);
  updateRelationshipOnInteraction(storeDb, user._id, { sleepIntent: plan.sleep_intent });

  return createdMessages;
}

module.exports = {
  handleUserMessageToAI,
  syncCharacterRhythm
};
