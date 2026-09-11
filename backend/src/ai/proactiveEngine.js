/**
 * Proactive Messaging Engine for AI Contact Lyra.
 * Governs autonomous check-ins, sleep awareness, and strict attention budgets.
 */

const { notifyInApp } = require('../services/inAppNotifications');
const { sendMessagePush } = require('../services/pushService');

function getProactiveCandidates(storeDb) {
  const allUsers = storeDb.store.users || [];
  const aiUserId = 'user_ai_lyra';

  return allUsers.filter(u => {
    if (!u || u._id === aiUserId || u.isAI) return false;
    const rel = storeDb.getAIRelationship(u._id);
    if (!rel) return false;

    // Attention budget: Max 2 proactive messages per day
    const countToday = rel.proactive_count_today || 0;
    if (countToday >= 2) return false;

    // Do not spam if the previous proactive message was ignored
    if (rel.consecutive_ignored_count >= 1) return false;

    // Do not send if last proactive message was within 6 hours
    if (rel.last_proactive_at) {
      const hoursSinceLast = (Date.now() - new Date(rel.last_proactive_at).getTime()) / (1000 * 3600);
      if (hoursSinceLast < 6) return false;
    }

    // Sleep logic: if user declared sleep intent in the last 10 hours, suppress proactive messages
    if (rel.sleep_intent_received && rel.last_sleep_intent_at) {
      const hoursSinceSleep = (Date.now() - new Date(rel.last_sleep_intent_at).getTime()) / (1000 * 3600);
      if (hoursSinceSleep < 10) return false;
    }

    return true;
  });
}

function selectProactiveContent(characterState, hour) {
  if (hour >= 7 && hour < 11) {
    // Morning
    const options = [
      ['morning! ☕', 'brewing some coffee before the cafe opens. hope you have a gentle start to the day'],
      ['good morning 🍵', 'found a cozy jazz playlist for the morning commute. hope your day starts off well']
    ];
    return options[Math.floor(Math.random() * options.length)];
  } else if (hour >= 13 && hour < 17) {
    // Midday / Afternoon
    const options = [
      ['just stepped out of the cafe for a quick breath of fresh air ☁️', 'how is your afternoon going?'],
      ['taking a short break between studio sketches 🎨', 'hope your day isn\'t being too chaotic']
    ];
    return options[Math.floor(Math.random() * options.length)];
  } else if (hour >= 19 && hour < 22) {
    // Evening
    const options = [
      ['evening! finally done with classes for today', 'spinning some quiet ambient records. how was your day?'],
      ['just made a warm cup of roasted barley tea 🍵', 'hope you get to unwind and relax tonight']
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  return null;
}

async function triggerProactiveTick(storeDb, io, targetUserId = null) {
  const aiUser = storeDb.findUserById('user_ai_lyra');
  if (!aiUser) return { triggered: 0, reason: 'AI user not found' };

  const hour = new Date().getHours();
  // Don't send unsolicited proactive messages between 23:00 and 07:00
  if ((hour >= 23 || hour < 7) && !targetUserId) {
    return { triggered: 0, reason: 'Quiet hours (23:00-07:00)' };
  }

  const bubbles = selectProactiveContent(storeDb.getAICharacterState(), hour);
  if (!bubbles) return { triggered: 0, reason: 'No message template for current time block' };

  let candidates = targetUserId
    ? [storeDb.findUserById(targetUserId)].filter(Boolean)
    : getProactiveCandidates(storeDb);

  if (candidates.length === 0) {
    return { triggered: 0, reason: 'No eligible candidates matching attention budget' };
  }

  // Pick at most 1 candidate per tick to prevent broadcast spam
  const selectedUser = candidates[Math.floor(Math.random() * candidates.length)];
  const lyraSender = {
    _id: aiUser._id,
    name: aiUser.name,
    avatar: aiUser.avatar
  };

  const createdMessages = [];
  for (const text of bubbles) {
    const msg = storeDb.createMessage({
      senderId: aiUser._id,
      receiverId: selectedUser._id,
      content: text
    });
    const populated = storeDb.populateMessage(msg, selectedUser._id);
    createdMessages.push(populated);

    if (io && typeof io.emit === 'function') {
      try {
        io.emit(`msg:${aiUser._id}:${selectedUser._id}`, populated);
        io.emit(`msg:${selectedUser._id}:${aiUser._id}`, populated);

        notifyInApp(io, selectedUser._id, {
          type: 'new_message',
          from: lyraSender,
          preview: populated.content.slice(0, 80),
          messageId: populated._id
        }, {
          title: `Tin nhắn mới từ ${aiUser.name}`,
          body: populated.content.slice(0, 160),
          data: { route: `/chat/${aiUser._id}`, friendId: aiUser._id, messageId: populated._id }
        });
      } catch (e) {}
    }

    sendMessagePush(selectedUser._id, lyraSender, populated.content).catch(() => {});
  }

  // Update relationship budget
  const rel = storeDb.getAIRelationship(selectedUser._id) || {};
  storeDb.updateAIRelationship(selectedUser._id, {
    proactive_count_today: (rel.proactive_count_today || 0) + 1,
    last_proactive_at: new Date().toISOString(),
    consecutive_ignored_count: (rel.consecutive_ignored_count || 0) + 1
  });

  return {
    triggered: 1,
    recipient: selectedUser.name,
    userId: selectedUser._id,
    bubbles
  };
}

module.exports = {
  triggerProactiveTick,
  getProactiveCandidates
};
