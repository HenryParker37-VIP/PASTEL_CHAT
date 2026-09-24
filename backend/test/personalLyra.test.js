const assert = require('assert');
const { issueToken, verifyToken } = require('../src/config/auth');
const { handleUserMessageToAI } = require('../src/ai/conversationDirector');
const { extractExplicitMemoryCandidates, filterRelevantMemories } = require('../src/ai/memoryEngine');
const { AIModelRouter, parseAndRecoverResponse } = require('../src/ai/modelRouter');
const { triggerProactiveTick, shouldInitiate, localWindow } = require('../src/ai/proactiveEngine');
const durableStore = require('../src/db/store');
const authMiddleware = require('../src/middleware/auth');
const aiRoutes = require('../src/routes/ai');

class TestStore {
  constructor() {
    this.store = { users: [], messages: [] };
    this.memories = [];
    this.relationships = [];
    this.claims = new Set();
    this.store.users.push({ _id: 'user_ai_lyra', aiCharacterId: 'char_lyra', isAI: true, name: 'Lyra', avatar: '/avatar' });
  }
  findUserById(id) { return this.store.users.find(user => user._id === id); }
  getAICharacter() { return { name: 'Lyra', personality: {}, speech: {}, behavior: {}, dailySchedule: [] }; }
  getAICharacterState() { return { current_activity: 'relaxing' }; }
  getAIMemories(userId, characterId = 'char_lyra') { return this.memories.filter(item => item.userId === userId && item.characterId === characterId); }
  addAIMemory(record) {
    let item = this.getAIMemories(record.userId, record.characterId).find(memory => memory.key === record.key);
    if (item) Object.assign(item, { value: record.value, source: record.source, sourceMessageId: record.sourceMessageId, lastConfirmedAt: new Date().toISOString() });
    else { item = { _id: `memory-${this.memories.length}`, ...record, createdAt: new Date().toISOString() }; this.memories.push(item); }
    return item;
  }
  getAIRelationship(userId, characterId = 'char_lyra') {
    let item = this.relationships.find(row => row.userId === userId && row.characterId === characterId);
    if (!item) { item = { userId, characterId, familiarity: 1, interaction_count: 0 }; this.relationships.push(item); }
    return item;
  }
  updateAIRelationship(userId, updates, characterId = 'char_lyra') { return Object.assign(this.getAIRelationship(userId, characterId), updates); }
  createMessage(doc) { const message = { _id: `message-${this.store.messages.length}`, ...doc }; this.store.messages.push(message); return message; }
  populateMessage(message) { return { ...message, senderId: this.findUserById(message.senderId) }; }
  toggleReaction() { return null; }
  async claimAIProactiveWindow(userId, characterId, window) {
    const key = `${userId}:${characterId}:${window}`;
    if (this.claims.has(key)) return false;
    this.claims.add(key);
    return true;
  }
}

function socketsFor(ids) {
  const events = new Map(ids.map(id => [id, []]));
  const sockets = new Map(ids.map(id => [id, { user: { _id: id }, emit: (name, payload) => events.get(id).push({ name, payload }) }]));
  return { io: { sockets: { sockets } }, events };
}

async function run() {
  const notificationStart = durableStore.store.notifications.length;
  const store = new TestStore();
  const ids = ['alice', 'bob', 'cara'];
  ids.forEach(id => store.store.users.push({ _id: id, name: id }));
  const sessions = [];
  const authenticated = ids.map(id => {
    const user = store.findUserById(id);
    const token = issueToken(user, session => sessions.push(session));
    assert.strictEqual(verifyToken(token).userId, id);
    return user;
  });
  assert.strictEqual(sessions.length, 3);
  const { io, events } = socketsFor([...ids, 'observer']);
  const prompts = new Map();
  const model = { async generate(input) {
    prompts.set(input.conversationKey, input.systemPrompt);
    return { bubbles: [`reply for ${input.conversationKey}`], reaction: null };
  } };
  const facts = ['My name is Alice. I live in Hanoi.', 'My name is Bob. I live in Paris.', 'My name is Cara. I live in Manila.'];
  await Promise.all(authenticated.map((user, index) => handleUserMessageToAI({
    storeDb: store, io, user,
    userMessage: { _id: `turn-${user._id}`, senderId: user._id, content: facts[index] },
    router: model, fastMode: true, timeZone: 'Asia/Ho_Chi_Minh'
  })));
  for (const user of authenticated) {
    const memory = store.getAIMemories(user._id).find(item => item.key === 'name');
    assert(memory && memory.value === user.name[0].toUpperCase() + user.name.slice(1));
    assert.strictEqual(memory.source, 'USER_STATED');
    assert(events.get(user._id).some(event => event.name.startsWith('msg:')));
    assert(events.get(user._id).filter(event => event.payload?.content).every(event => event.payload.content.includes(`["${user._id}","char_lyra"]`)));
  }
  assert.strictEqual(events.get('observer').length, 0);
  assert.strictEqual(store.getAIMemories('alice').some(item => item.value === 'Bob'), false);
  assert.strictEqual(store.getAIMemories('bob').some(item => item.value === 'Alice'), false);
  assert(!prompts.get('["alice","char_lyra"]').includes('Paris'));
  assert(!prompts.get('["bob","char_lyra"]').includes('Hanoi'));

  const countsBeforeBurst = ids.map(id => store.store.messages.filter(message => message.receiverId === id).length);
  await Promise.all(authenticated.flatMap(user => [0, 1, 2].map(index => handleUserMessageToAI({
    storeDb: store, io, user,
    userMessage: { _id: `burst-${user._id}-${index}`, senderId: user._id, content: `Burst ${index} from ${user._id}` },
    router: model, fastMode: true
  }))));
  ids.forEach((id, index) => {
    assert.strictEqual(store.store.messages.filter(message => message.receiverId === id).length - countsBeforeBurst[index], 1);
    assert(!events.get(id).some(event => event.payload?.content && !event.payload.content.includes(`["${id}","char_lyra"]`)));
  });

  // A second authenticated session for the same identity sees the same layer.
  const secondAliceToken = issueToken(authenticated[0], session => sessions.push(session));
  assert.notStrictEqual(sessions[0]._id, sessions[3]._id);
  assert.strictEqual(verifyToken(secondAliceToken).userId, 'alice');
  assert.strictEqual(store.getAIMemories(verifyToken(secondAliceToken).userId).find(item => item.key === 'city').value, 'Hanoi');
  const hydrated = new TestStore();
  hydrated.memories = JSON.parse(JSON.stringify(store.memories));
  hydrated.relationships = JSON.parse(JSON.stringify(store.relationships));
  assert.strictEqual(hydrated.getAIMemories('alice').find(item => item.key === 'city').value, 'Hanoi');
  await handleUserMessageToAI({ storeDb: store, io, user: authenticated[0], userMessage: { _id: 'correction', senderId: 'alice', content: 'Actually, I live in Da Nang.' }, router: model, fastMode: true });
  assert.strictEqual(store.getAIMemories('alice').filter(item => item.key === 'city').length, 1);
  assert.strictEqual(store.getAIMemories('alice').find(item => item.key === 'city').value, 'Da Nang');
  assert.strictEqual(store.getAIMemories('bob').find(item => item.key === 'city').value, 'Paris');
  assert.strictEqual(extractExplicitMemoryCandidates('Maybe I live in Berlin.').length, 0);
  assert(extractExplicitMemoryCandidates('Mình tên là An.').some(item => item.key === 'name' && item.value === 'An'));
  assert(extractExplicitMemoryCandidates('My hobby is photography.').some(item => item.key === 'interest_photography'));
  assert.strictEqual(filterRelevantMemories(store.getAIMemories('alice'), 'What about my city?', []).length, 1);
  assert.strictEqual(filterRelevantMemories(store.getAIMemories('alice'), 'What is the weather?', []).length, 0);
  assert.strictEqual(extractExplicitMemoryCandidates('I am worried about my exam.')[0].value, 'my exam');

  const aliceRepliesBeforeRetry = store.store.messages.filter(message => message.receiverId === 'alice').length;
  await handleUserMessageToAI({ storeDb: store, io, user: authenticated[0], userMessage: { _id: 'correction', senderId: 'alice', content: 'Actually, I live in Da Nang.' }, router: model, fastMode: true });
  assert.strictEqual(store.store.messages.filter(message => message.receiverId === 'alice').length, aliceRepliesBeforeRetry);

  // One delivered bubble remains; a newer message discards obsolete pending bubbles.
  let releasePause;
  const pause = new Promise(resolve => { releasePause = resolve; });
  let delayCount = 0;
  const threeBubbles = { generate: async () => ({ bubbles: ['first', 'obsolete second', 'obsolete third'], reaction: null }) };
  const first = handleUserMessageToAI({ storeDb: store, io, user: authenticated[0], userMessage: { _id: 'burst-one', senderId: 'alice', content: 'hello' }, router: threeBubbles, delay: async () => { if (++delayCount === 3) await pause; } });
  while (store.store.messages.filter(message => message.receiverId === 'alice' && message.content === 'first').length === 0) await new Promise(resolve => setImmediate(resolve));
  await Promise.all([authenticated[1], authenticated[2]].map(user => handleUserMessageToAI({
    storeDb: store, io, user, userMessage: { _id: `during-alice-${user._id}`, senderId: user._id, content: `Hello from ${user._id}` }, router: model, fastMode: true
  })));
  const newest = handleUserMessageToAI({ storeDb: store, io, user: authenticated[0], userMessage: { _id: 'burst-two', senderId: 'alice', content: 'Actually, what about my city?' }, router: model, fastMode: true });
  releasePause();
  const oldMessages = await first;
  await newest;
  assert.deepStrictEqual(oldMessages.map(message => message.content), ['first']);
  assert(!store.store.messages.some(message => message.content === 'obsolete second'));
  assert(!store.store.messages.some(message => message.content === 'obsolete third'));

  // A provider failure for Alice must not open a circuit for Bob; both retain their prompts.
  const fallback = new AIModelRouter({ openrouterKey: 'test', nvidiaKey: 'test', geminiKey: '' });
  fallback.callOpenRouter = async () => { throw new Error('test provider unavailable'); };
  fallback.callNVIDIA = async ({ systemPrompt }) => ({ bubbles: [systemPrompt.includes('Da Nang') ? 'Da Nang' : 'other'], reaction: null });
  const alicePrompt = prompts.get('["alice","char_lyra"]');
  assert(alicePrompt.includes('Da Nang'));
  const result = await fallback.generate({ userMessage: 'Where do I live?', systemPrompt: alicePrompt, conversationKey: '["alice","char_lyra"]' });
  assert.deepStrictEqual(result.bubbles, ['Da Nang']);
  assert(fallback.isProviderHealthy('openrouter', '["bob","char_lyra"]'));
  assert.strictEqual(parseAndRecoverResponse(JSON.stringify({ bubbles: ['one', 'two', 'three', 'four', 'five', 'six'] })).bubbles.length, 5);

  const uniqueUser = `personal_test_${Date.now()}`;
  const lyraRecord = durableStore.addAIMemory({ userId: uniqueUser, characterId: 'char_lyra', key: 'city', value: 'Hanoi', sourceMessageAt: '2026-09-25T10:00:00.000Z' });
  durableStore.addAIMemory({ userId: uniqueUser, characterId: 'char_lyra', key: 'city', value: 'Outdated city', sourceMessageAt: '2026-09-24T10:00:00.000Z' });
  const otherCharacterRecord = durableStore.addAIMemory({ userId: uniqueUser, characterId: 'char_future_test', key: 'city', value: 'Paris' });
  assert.deepStrictEqual(durableStore.getAIMemories(uniqueUser, 'char_lyra').map(item => item.value), ['Hanoi']);
  assert.deepStrictEqual(durableStore.getAIMemories(uniqueUser, 'char_future_test').map(item => item.value), ['Paris']);
  assert.strictEqual(durableStore.addAIMemory({ userId: uniqueUser, key: 'image', value: 'data:image/png;base64,AAAA' }), null);
  const otherUserId = `${uniqueUser}_other`;
  const otherUserRecord = durableStore.addAIMemory({ userId: otherUserId, key: 'city', value: 'Tokyo' });
  const testUser = { _id: uniqueUser, name: 'Route test' };
  durableStore.store.users.push(testUser);
  const token = issueToken(testUser, session => durableStore.store.sessions.push(session));
  const sessionId = verifyToken(token).sid;
  const request = { headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, query: { userId: otherUserId } };
  let responseBody;
  const response = { json(value) { responseBody = value; return this; }, status() { throw new Error('Authenticated request rejected'); } };
  authMiddleware(request, response, () => {});
  const memoryRoute = aiRoutes.stack.find(layer => layer.route?.path === '/memories' && layer.route.methods.get);
  await memoryRoute.route.stack.at(-1).handle(request, response);
  assert.deepStrictEqual(responseBody.map(item => item.value), ['Hanoi']);
  durableStore.store.users.splice(durableStore.store.users.indexOf(testUser), 1);
  durableStore.store.sessions.splice(durableStore.store.sessions.findIndex(session => session._id === sessionId), 1);
  durableStore.deleteAIMemory(lyraRecord._id, uniqueUser, 'char_lyra');
  durableStore.deleteAIMemory(otherCharacterRecord._id, uniqueUser, 'char_future_test');
  durableStore.deleteAIMemory(otherUserRecord._id, otherUserId, 'char_lyra');

  // Proactive eligibility is local-time-aware and the same window is claimed once.
  const now = new Date('2026-09-25T09:00:00.000Z');
  const window = localWindow('UTC', now);
  assert.strictEqual(window.name, 'morning');
  let proactiveId = null;
  for (let i = 0; i < 1000; i++) if (shouldInitiate(`proactive-${i}`, window.key, true)) { proactiveId = `proactive-${i}`; break; }
  assert(proactiveId);
  store.store.users.push({ _id: proactiveId, name: 'Proactive user' });
  store.updateAIRelationship(proactiveId, { time_zone: 'UTC', last_interaction_at: new Date(now - 24 * 3600_000).toISOString(), interaction_count: 2 });
  store.addAIMemory({ userId: proactiveId, characterId: 'char_lyra', key: 'upcoming_event', value: 'an interview next week', source: 'USER_STATED', createdAt: now.toISOString() });
  const proactiveModel = { generate: async () => ({ bubbles: ['Hope the interview planning is going okay.'], reaction: null }) };
  const firstTick = await triggerProactiveTick(store, io, proactiveId, { now, model: proactiveModel });
  const secondTick = await triggerProactiveTick(store, io, proactiveId, { now, model: proactiveModel });
  assert.strictEqual(firstTick.triggered, 1);
  assert.strictEqual(secondTick.triggered, 0);
  assert.strictEqual(store.store.messages.filter(message => message.receiverId === proactiveId).length, 1);
  durableStore.store.notifications.splice(notificationStart);
  durableStore.persist();
  console.log('Personal Lyra: authenticated identity, 3 concurrent users, memory isolation/correction, relevance, interruption, provider fallback, 5 bubbles, proactive deduplication PASS');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
