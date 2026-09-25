class TurnResolutionError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// The second request names the message returned by POST /messages. Never
// select a different user turn from a warm worker's cached conversation.
async function resolveAITurn(storeDb, { userId, characterUser, messageId }) {
  if (typeof messageId !== 'string' || !messageId || messageId.length > 128) {
    throw new TurnResolutionError(400, 'Exact user messageId is required');
  }
  await storeDb.refreshDurableMessages?.();
  const exactMessage = await storeDb.getDurableMessageById(messageId);
  if (!exactMessage || String(exactMessage.senderId) !== String(userId) || String(exactMessage.receiverId) !== String(characterUser._id)) {
    throw new TurnResolutionError(409, 'Expected user message is unavailable');
  }
  const history = storeDb.getConversation(userId, characterUser._id, { limit: 10 });
  const recentHistory = [
    ...history.filter(message =>
      !message.isSessionBoundary &&
      !message.isSuperseded &&
      !message.isArchived &&
      (!exactMessage.conversationSessionId || message.conversationSessionId === exactMessage.conversationSessionId) &&
      String(message._id) !== String(messageId)
    ),
    storeDb.populateMessage(exactMessage, userId)
  ];
  const characterId = characterUser.aiCharacterId || 'char_lyra';
  const currentId = await storeDb.getCurrentAITurnMessageId(userId, characterId);
  if (currentId && String(currentId) !== String(messageId)) {
    throw new TurnResolutionError(409, 'A newer user message superseded this turn');
  }
  if (!currentId) {
    const latest = [...recentHistory].reverse().find(message => String(message.senderId?._id || message.senderId) === String(userId));
    if (!latest || String(latest._id) !== String(messageId) ||
        !await storeDb.registerAITurn(userId, characterId, exactMessage)) {
      throw new TurnResolutionError(409, 'A newer user message superseded this turn');
    }
  }
  return { exactMessage, recentHistory };
}

module.exports = { resolveAITurn, TurnResolutionError };
