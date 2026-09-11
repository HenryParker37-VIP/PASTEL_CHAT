const assert = require('assert');
const storeDb = require('../src/db/store');
const { AIModelRouter, parseStructuredResponse, localHeuristicEngine } = require('../src/ai/modelRouter');
const { calculateTypingDuration, calculateInitialDelay, getInterBubblePause } = require('../src/ai/timingEngine');
const { processMemoryUpdates, updateRelationshipOnInteraction } = require('../src/ai/memoryEngine');
const { syncCharacterRhythm, handleUserMessageToAI } = require('../src/ai/conversationDirector');
const { triggerProactiveTick, getProactiveCandidates } = require('../src/ai/proactiveEngine');

async function runAITests() {
  console.log('🧪 Starting AI Contact (Lyra) Test Suite...');

  // Test 1: Store & Character initialization
  const character = storeDb.getAICharacter();
  assert(character, 'Character Lyra must exist in store');
  assert.strictEqual(character.name, 'Lyra');
  assert.strictEqual(character.userId, 'user_ai_lyra');
  assert(Array.isArray(character.dailySchedule), 'Character must have daily schedule');
  console.log('  ✅ Lyra character profile and schedule initialized');

  // Test 2: AI User in store
  const aiUser = storeDb.findUserById('user_ai_lyra');
  assert(aiUser, 'AI user user_ai_lyra must exist');
  assert.strictEqual(aiUser.isAI, true);
  assert.strictEqual(aiUser.aiCharacterId, 'char_lyra');
  console.log('  ✅ Lyra user record exists with isAI: true');

  // Test 3: Rhythm & Activity synchronization
  const state = syncCharacterRhythm(storeDb);
  assert(state, 'Character state must exist');
  assert(state.current_activity, 'Character must have a current activity');
  assert(typeof state.busy_level === 'number', 'Busy level must be numeric');
  console.log(`  ✅ Rhythm synced: current activity is "${state.current_activity}" (mood: ${state.mood})`);

  // Test 4: Timing Engine calculations
  const shortBubbleTime = calculateTypingDuration('hey!');
  const longBubbleTime = calculateTypingDuration('just finished steaming some milk at the cafe, taking a quick break now.');
  assert(shortBubbleTime >= 400 && shortBubbleTime <= 1000, `Short bubble typing time (${shortBubbleTime}ms) within bounds`);
  assert(longBubbleTime > shortBubbleTime && longBubbleTime <= 2800, `Long bubble typing time (${longBubbleTime}ms) within bounds`);

  const initialDelayCompensated = calculateInitialDelay(20, 2000);
  assert(initialDelayCompensated >= 250, 'Initial delay must have minimum threshold');
  console.log('  ✅ Timing engine calculates natural human typing delays and compensates latency');

  // Test 5: Local Heuristic Engine & Structured Response
  const heuristicGreeting = localHeuristicEngine({
    userMessage: 'hey Lyra!',
    character,
    characterState: state,
    userName: 'Henry'
  });
  assert(Array.isArray(heuristicGreeting.bubbles) && heuristicGreeting.bubbles.length > 0, 'Greeting must yield bubbles');
  assert(heuristicGreeting.bubbles.length <= 3, 'Greeting must be 1-3 bubbles');
  console.log('  ✅ Local heuristic engine produces multi-bubble conversational greeting');

  // Test 6: Sleep intent detection
  const heuristicSleep = localHeuristicEngine({
    userMessage: 'im going to sleep now, good night!',
    character,
    characterState: state,
    userName: 'Henry'
  });
  assert.strictEqual(heuristicSleep.sleep_intent, true, 'Sleep intent must be detected');
  assert.strictEqual(heuristicSleep.reaction, '❤️', 'Should react warmly to goodnight');
  console.log('  ✅ Sleep intent detected and flagged correctly');

  // Test 7: Memory Engine & Persistence
  const testUserId = 'test_user_' + Date.now();
  const memoryToSave = [
    { type: 'preference', subject: 'beverages', key: 'favorite_tea', value: 'ceremonial matcha' },
    { type: 'fact', subject: 'music', key: 'favorite_genre', value: 'indie folk' }
  ];
  const savedMemories = processMemoryUpdates(storeDb, testUserId, 'char_lyra', memoryToSave);
  assert.strictEqual(savedMemories.length, 2, 'Should save 2 memories');

  const retrieved = storeDb.getAIMemories(testUserId);
  assert.strictEqual(retrieved.length, 2, 'Should retrieve stored memories');
  assert.strictEqual(retrieved[0].value, 'ceremonial matcha');

  // Test 8: Memory reinforcement
  storeDb.addAIMemory({ userId: testUserId, key: 'favorite_tea', value: 'ceremonial matcha' });
  const updatedMemories = storeDb.getAIMemories(testUserId);
  assert.strictEqual(updatedMemories.length, 2, 'Should not duplicate existing key');
  console.log('  ✅ Deep memory extraction, storage, and reinforcement verified');

  // Test 9: Relationship State & Sleep Intent update
  const rel = updateRelationshipOnInteraction(storeDb, testUserId, { sleepIntent: true });
  assert(rel.familiarity > 1, 'Familiarity should increment');
  assert.strictEqual(rel.sleep_intent_received, true, 'Relationship must store sleep intent');
  console.log('  ✅ Relationship growth and sleep tracking verified');

  // Test 10: Proactive messaging & attention budget
  const mockIo = { emit: () => {} };
  // Target user has sleep intent active, so proactive tick should respect it
  const proactiveResult = await triggerProactiveTick(storeDb, mockIo, testUserId);
  assert(proactiveResult, 'Proactive tick must return result');
  console.log('  ✅ Proactive scheduler attention budget evaluated successfully');

  // Test 11: End-to-end conversation simulation with Lyra
  const testUser = { _id: testUserId, name: 'Alice' };
  const userMsg = { _id: 'msg_test_1', content: 'what are you working on today?' };
  const replies = await handleUserMessageToAI({
    storeDb,
    io: mockIo,
    user: testUser,
    userMessage: userMsg,
    fastMode: true
  });
  assert(Array.isArray(replies) && replies.length > 0, 'Lyra must reply with messages');
  assert(replies.every(r => (r.senderId?._id || r.senderId) === 'user_ai_lyra'), 'Replies must come from Lyra');
  console.log(`  ✅ Conversation director executed end-to-end (${replies.length} bubbles received)`);

  // Cleanup test user memories
  retrieved.forEach(m => storeDb.deleteAIMemory(m._id, testUserId));

  console.log('\n🎉 All AI Contact (Lyra) tests passed successfully!\n');
}

runAITests().catch(err => {
  console.error('❌ AI Test suite failed:', err);
  process.exit(1);
});
