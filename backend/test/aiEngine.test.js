const assert = require('assert');
const storeDb = require('../src/db/store');
const { CharacterConfig } = require('../src/ai/characterConfig');
const { buildCharacterSystemPrompt } = require('../src/ai/promptBuilder');
const { AIModelRouter, parseAndRecoverResponse } = require('../src/ai/modelRouter');
const { calculateTypingDuration, calculateInitialDelay, getInterBubblePause } = require('../src/ai/timingEngine');
const { filterRelevantMemories, processMemoryUpdates, updateRelationshipOnInteraction } = require('../src/ai/memoryEngine');
const { syncCharacterRhythm, handleUserMessageToAI } = require('../src/ai/conversationDirector');
const { triggerProactiveTick, getProactiveCandidates } = require('../src/ai/proactiveEngine');

async function runAITests() {
  console.log('🧪 Starting AI Character (Lyra) Test Suite...');

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

  // Test 5: CharacterConfig normalization & behavioral translation
  const config = new CharacterConfig(character);
  assert.strictEqual(config.name, 'Lyra');
  assert(config.personality.warmth >= 0.7, 'Lyra warmth slider must be set');
  const personalityNotes = config.getPersonalityGuidelines();
  const speechNotes = config.getSpeechGuidelines();
  assert(personalityNotes.length > 0, 'Must produce qualitative personality guidelines');
  assert(speechNotes.some(n => n.includes('DO NOT end every message with a question')), 'Must enforce natural question policy');
  console.log('  ✅ Reusable CharacterConfig layer translates sliders into natural guidelines');

  // Test 6: Dynamic Prompt Builder
  const prompt = buildCharacterSystemPrompt({
    characterConfig: config,
    characterState: state,
    memories: [{ key: 'favorite_tea', value: 'matcha' }],
    detectedLanguage: 'en'
  });
  assert(prompt.includes('Lyra'), 'Prompt must establish identity');
  assert(prompt.includes('RELEVANCE TO CURRENT MESSAGE COMES FIRST'), 'Prompt must establish highest priority for current message');
  assert(!prompt.includes('As an AI assistant'), 'Must not speak like an assistant');
  console.log('  ✅ Prompt builder constructs prioritized character prompt');

  // Test 7: Structured Output & Formatting Recovery (NO canned fallbacks)
  const validJson = '{"bubbles": ["hey!", "how are you?"]}';
  const parsed1 = parseAndRecoverResponse(validJson);
  assert.deepStrictEqual(parsed1.bubbles, ['hey!', 'how are you?']);

  // Plain text formatting recovery (must extract model text, never substitute canned response)
  const plainText = 'oh wow\nthat sounds really interesting!';
  const parsed2 = parseAndRecoverResponse(plainText);
  assert.strictEqual(parsed2.bubbles.length, 1, 'A single paragraph must not be split into artificial bubbles');
  assert(parsed2.bubbles[0].startsWith('oh wow'));
  console.log('  ✅ Structured output parser and formatting recovery verified');

  // Test 8: Memory Engine & Persistence
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

  // Test relevance filter
  const relevant = filterRelevantMemories(retrieved, 'do you want tea?', []);
  assert(relevant.some(m => m.key === 'favorite_tea'), 'Relevance filter must retrieve tea memory for tea query');
  console.log('  ✅ Memory extraction, storage, and relevance filtering verified');

  // Test 9: Relationship State update
  const rel = updateRelationshipOnInteraction(storeDb, testUserId, { sleepIntent: true });
  assert(rel.familiarity > 1, 'Familiarity should increment');
  assert.strictEqual(rel.sleep_intent_received, true, 'Relationship must store sleep intent');
  console.log('  ✅ Relationship growth and sleep tracking verified');

  // Test 10: Proactive messaging & attention budget
  const mockIo = { emit: () => {} };
  const proactiveResult = await triggerProactiveTick(storeDb, mockIo, testUserId);
  assert(proactiveResult, 'Proactive tick must return result');
  console.log('  ✅ Proactive scheduler attention budget evaluated successfully');

  // Test 11: End-to-end conversation simulation with real backend routing
  const testUser = { _id: testUserId, name: 'Alice' };
  const userMsg = { _id: 'msg_test_' + Date.now(), content: 'what are you working on today?' };
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

  console.log('\n🎉 All AI Character (Lyra) tests passed successfully!\n');
}

runAITests().catch(err => {
  console.error('❌ AI Test suite failed:', err);
  process.exit(1);
});
