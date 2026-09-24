// Spawned only by the local MongoDB concurrency integration test.
process.env.NODE_ENV = 'test';
const storeDb = require('../../src/db/store');
const { handleUserMessageToAI, invalidateConversation } = require('../../src/ai/conversationDirector');
const { resolveAITurn } = require('../../src/ai/resolveAITurn');
const heldProviders = new Map();

function socketCapture() {
  const events = [];
  const sockets = new Map(['alice', 'bob', 'cara', 'observer'].map(id => [id, {
    user: { _id: id }, emit: (event, payload) => events.push({ recipient: id, event, content: payload?.content || null })
  }]));
  return { io: { sockets: { sockets } }, events };
}

async function perform(command, args, requestId) {
  await storeDb.ready;
  if (command === 'allocate') return { sequence: await storeDb.allocateAITurnSequence(args.userId, 'char_lyra') };
  if (command === 'create') {
    const receiverId = args.receiverId || 'user_ai_lyra';
    const aiTurnSequence = receiverId === 'user_ai_lyra'
      ? (args.aiTurnSequence || await storeDb.allocateAITurnSequence(args.userId, 'char_lyra')) : null;
    const message = storeDb.createMessage({ senderId: args.userId, receiverId, content: args.content,
      ...(aiTurnSequence ? { aiTurnSequence } : {}), ...(args.timestamp ? { timestamp: args.timestamp } : {}) });
    await storeDb.flushMessageWrites();
    if (message.receiverId === 'user_ai_lyra') {
      await storeDb.registerAITurn(args.userId, 'char_lyra', message);
      invalidateConversation(args.userId, 'char_lyra', message._id);
    }
    return { id: message._id };
  }
  if (command === 'resolve') {
    const resolved = await resolveAITurn(storeDb, {
      userId: args.userId, characterUser: storeDb.findUserById('user_ai_lyra'), messageId: args.messageId
    });
    return { id: resolved.exactMessage._id, history: resolved.recentHistory.map(message => message._id) };
  }
  if (command === 'generate') {
    await storeDb.refreshDurableMessages();
    const message = await storeDb.getDurableMessageById(args.messageId);
    const { io, events } = socketCapture();
    const originalCommit = storeDb.commitAIBubble;
    if (args.holdCommit) {
      storeDb.commitAIBubble = async (...commitArgs) => {
        process.send({ event: 'provider_started', requestId });
        await new Promise(resolve => heldProviders.set(requestId, resolve));
        return originalCommit(...commitArgs);
      };
    }
    const router = {
      async generate() {
        if (args.hold) {
          process.send({ event: 'provider_started', requestId });
          await new Promise(resolve => heldProviders.set(requestId, resolve));
        }
        return { bubbles: args.bubbles || [`reply for ${args.userId}`], reaction: null };
      }
    };
    try {
      const replies = await handleUserMessageToAI({
        storeDb, io, user: storeDb.findUserById(args.userId),
        userMessage: storeDb.populateMessage(message, args.userId),
        recentHistory: storeDb.getConversation(args.userId, 'user_ai_lyra', { limit: 10 }),
        router, fastMode: true
      });
      return { replies: replies.map(reply => reply.content), events };
    } finally { storeDb.commitAIBubble = originalCommit; }
  }
  if (command === 'release') {
    const release = heldProviders.get(args.requestId);
    if (!release) throw new Error('Provider was not waiting');
    heldProviders.delete(args.requestId);
    release();
    return { released: true };
  }
  if (command === 'snapshot') {
    storeDb.persist();
    await storeDb.flushPersist();
    return { messages: storeDb.store.messages.length };
  }
  if (command === 'deleteMemory') {
    await storeDb.hydrateAIPersonalLayer(args.userId, 'char_lyra');
    const memory = storeDb.getAIMemories(args.userId, 'char_lyra').find(item => item.key === args.key);
    if (!memory) return { deleted: false };
    storeDb.deleteAIMemory(memory._id, args.userId, 'char_lyra');
    await storeDb.flushAIPersonalLayer(args.userId, 'char_lyra', { deletedMemoryIds: [memory._id] });
    return { deleted: true };
  }
  if (command === 'clear') {
    await storeDb.refreshDurableMessages();
    const count = storeDb.clearConversation(args.userId, args.receiverId);
    await storeDb.flushMessageWrites();
    return { count };
  }
  if (command === 'conversation') {
    await storeDb.refreshDurableMessages();
    return { messages: storeDb.getConversation(args.userId, args.receiverId, { limit: 100 }).map(message => message._id) };
  }
  throw new Error(`Unknown command: ${command}`);
}

process.on('message', async ({ requestId, command, args = {} }) => {
  try { process.send({ requestId, result: await perform(command, args, requestId) }); }
  catch (error) { process.send({ requestId, error: { status: error.status || 500, message: error.message } }); }
});
