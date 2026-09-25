/**
 * Test Suite: Lyra Texting Rhythm, Message Formatting & Structured Output Safety
 * Verifies:
 * 1. Simple response can remain 1 short bubble (no artificial padding)
 * 2. Casual multi-thought response naturally splits into 2–4 bubbles
 * 3. Explanatory response may use longer bubbles when genuinely necessary
 * 4. No forced fixed bubble count
 * 5. Character Studio long-message preference can override default rhythm
 * 6. Regenerate uses same rhythm
 * 7. Malformed JSON never appears in chat
 * 8. Truncated {"bubbles": never appears in chat
 * 9. Parser recovery across variations
 * 10. Provider malformed-output handling and strict format retry
 * 11. Existing 1–5 bubble ceiling
 * 12. Typing pacing between bubbles
 * 13. Full regression suites
 */

const assert = require('assert');
const {
  parseAndRecoverResponse,
  cleanBubbleText,
  isRawStructuredArtifact,
  isValidBubbleText,
  normalizeConversationBeats,
  userPrefersLongMessages,
  AIModelRouter
} = require('../src/ai/modelRouter');
const { CharacterConfig } = require('../src/ai/characterConfig');
const { buildCharacterSystemPrompt } = require('../src/ai/promptBuilder');
const { calculateTypingDuration, getInterBubblePause } = require('../src/ai/timingEngine');
const storeDb = require('../src/db/store');
const { handleUserMessageToAI, executeLatestUserMessage } = require('../src/ai/conversationDirector');

async function runTextingRhythmAndSafetyTests() {
  console.log('====================================================');
  console.log('🧪 Starting Lyra Texting Rhythm & Safety Test Suite...');
  console.log('====================================================\n');

  // ----------------------------------------------------------------
  // Test 1: Simple response can remain 1 short bubble (no padding)
  // ----------------------------------------------------------------
  console.log('1. Testing simple response remains 1 short bubble...');
  const simpleInputs = ['yeah', 'mhm 😭', 'wait what', 'no wayyy', 'definitely!'];
  for (const input of simpleInputs) {
    const result = normalizeConversationBeats([input]);
    assert.strictEqual(result.length, 1, `Simple response "${input}" must remain exactly 1 bubble`);
    assert.strictEqual(result[0], input);
  }
  console.log('  ✅ Simple responses remain 1 short bubble without artificial padding');

  // ----------------------------------------------------------------
  // Test 2: Casual multi-thought response naturally splits into 2-4 bubbles
  // ----------------------------------------------------------------
  console.log('\n2. Testing casual multi-thought response splits into 2-4 bubbles...');
  const userExample = "and yeah, i do know what it means. it's 'i love you'... a lot! it's pretty strong, usually for a significant other. you're trying to make me blush, aren't you? 😉";
  const splitExample = normalizeConversationBeats([userExample]);
  assert(splitExample.length >= 2 && splitExample.length <= 4, `Must split into 2-4 bubbles, got ${splitExample.length}`);
  assert.strictEqual(splitExample[0], 'and yeah, i do know what it means.');
  assert(splitExample[1].includes("'i love you'"));
  assert(splitExample[splitExample.length - 1].includes("aren't you?"));
  console.log(`  ✅ User example split cleanly into ${splitExample.length} natural conversational beats:`);
  splitExample.forEach((b, idx) => console.log(`     Bubble ${idx + 1}: "${b}"`));

  // Also test Vietnamese multi-thought
  const viExample = "Ừ đúng rồi, mình biết nghĩa của nó mà. Nó có nghĩa là 'tôi yêu bạn' nhiều lắm luôn á! Cậu đang định làm mình ngại đúng không? 😭";
  const viSplit = normalizeConversationBeats([viExample]);
  assert(viSplit.length >= 2 && viSplit.length <= 4, `Vietnamese response must split into 2-4 bubbles, got ${viSplit.length}`);
  console.log(`  ✅ Vietnamese example split into ${viSplit.length} natural beats`);

  // ----------------------------------------------------------------
  // Test 3: Explanatory response may use longer bubbles when genuinely necessary
  // ----------------------------------------------------------------
  console.log('\n3. Testing explanatory response preserves structure when necessary...');
  const codeBlock = 'Here is how you do it:\n```javascript\nconst a = 1;\nconsole.log(a);\n```';
  const codeResult = normalizeConversationBeats([codeBlock]);
  assert.strictEqual(codeResult.length, 1, 'Code blocks must not be fragmented into multiple bubbles');
  assert(codeResult[0].includes('const a = 1'));
  console.log('  ✅ Code block preserved as a single cohesive explanatory bubble');

  // ----------------------------------------------------------------
  // Test 4: No forced fixed bubble count
  // ----------------------------------------------------------------
  console.log('\n4. Testing diversity of bubble counts (no forced fixed count)...');
  const count1 = normalizeConversationBeats(['sounds good!']);
  const count2 = normalizeConversationBeats(['wait really?', 'i had no idea!']);
  const count3 = normalizeConversationBeats([userExample]);
  const countSet = new Set([count1.length, count2.length, count3.length]);
  assert(countSet.size >= 2, 'Must exhibit diverse bubble counts (1, 2, 4)');
  console.log(`  ✅ Diverse bubble counts verified: 1-bubble (${count1.length}), 2-bubble (${count2.length}), 4-bubble (${count3.length})`);

  // ----------------------------------------------------------------
  // Test 5: Character Studio long-message preference overrides default rhythm
  // ----------------------------------------------------------------
  console.log('\n5. Testing Character Studio long-message preference override...');
  const customConfigLong = {
    speakingStyle: 'write long detailed paragraphs and explain everything in depth',
    shouldRules: 'use longer messages'
  };
  assert.strictEqual(userPrefersLongMessages(customConfigLong), true);
  const preservedLong = normalizeConversationBeats([userExample], customConfigLong);
  assert.strictEqual(preservedLong.length, 1, 'Long message preference must keep bubble as a single paragraph');
  assert.strictEqual(preservedLong[0], userExample);
  console.log('  ✅ Character Studio long-message preference successfully overrides default splitting');

  // ----------------------------------------------------------------
  // Test 6: Regenerate uses same rhythm
  // ----------------------------------------------------------------
  console.log('\n6. Testing Regenerate uses same rhythm...');
  const regenRouter = new AIModelRouter({ openrouterKey: 'test', nvidiaKey: 'test', geminiKey: 'test' });
  regenRouter.request = async () => ({
    choices: [{
      message: {
        content: JSON.stringify({
          bubbles: [userExample],
          reaction: '❤️'
        })
      }
    }]
  });
  const regenResult = await regenRouter.generate({
    userMessage: 'what does it mean?',
    rejectedResponses: ['previous long answer'],
    conversationKey: 'test-regen-key'
  });
  assert(regenResult.bubbles.length >= 2 && regenResult.bubbles.length <= 4, 'Regenerated reply must follow 2-4 conversational beats');
  console.log(`  ✅ Regenerate Reply returned ${regenResult.bubbles.length} natural conversational beats`);

  // ----------------------------------------------------------------
  // Test 7: Malformed JSON never appears in chat
  // ----------------------------------------------------------------
  console.log('\n7. Testing malformed JSON never appears in chat...');
  const adversarialMalformed = [
    '{"bubbles": [}}',
    '{"bubbles": {}}',
    '{"reaction": "❤️"',
    '```json\n{"bubbles":\n```',
    '{"messages": [{"text": "leaked'
  ];
  for (const malformed of adversarialMalformed) {
    const recovered = parseAndRecoverResponse(malformed);
    if (recovered && recovered.bubbles) {
      for (const b of recovered.bubbles) {
        assert(!isRawStructuredArtifact(b), `Bubble must not be raw structured artifact: "${b}"`);
        assert(isValidBubbleText(b), `Bubble must be valid text: "${b}"`);
      }
    }
  }
  console.log('  ✅ Malformed JSON inputs safely rejected or sanitized without exposing raw syntax');

  // ----------------------------------------------------------------
  // Test 8: Truncated {"bubbles": never appears in chat
  // ----------------------------------------------------------------
  console.log('\n8. Testing truncated {"bubbles": never appears in chat...');
  const truncatedPrefixes = [
    '{"bubbles":',
    '{"bubbles": [',
    '{"bubbles": ["',
    '{"bubbles":\n'
  ];
  for (const prefix of truncatedPrefixes) {
    const res = parseAndRecoverResponse(prefix);
    assert.strictEqual(res, null, `Truncated prefix "${prefix}" must return null, got: ${JSON.stringify(res)}`);
    assert(isRawStructuredArtifact(prefix), `Prefix must be identified as raw structured artifact: "${prefix}"`);
    assert(!isValidBubbleText(prefix), `Prefix must be invalid bubble text: "${prefix}"`);
  }
  console.log('  ✅ Truncated {"bubbles": strictly returns null and is completely blocked from chat');

  // ----------------------------------------------------------------
  // Test 9: Parser recovery across variations
  // ----------------------------------------------------------------
  console.log('\n9. Testing parser recovery across varied formats...');
  // Case A: Truncated valid array
  const truncatedArray = '{"bubbles": ["first beat", "second beat';
  const recA = parseAndRecoverResponse(truncatedArray);
  assert(recA && recA.bubbles.length >= 1, 'Should recover bubbles from truncated array');
  assert.strictEqual(recA.bubbles[0], 'first beat');

  // Case B: Markdown code fences
  const fenced = '```json\n{"bubbles": ["hello", "world"]}\n```';
  const recB = parseAndRecoverResponse(fenced);
  assert.deepStrictEqual(recB.bubbles, ['hello', 'world']);

  // Case C: Trailing commas
  const trailingComma = '{"bubbles": ["one", "two",], "reaction": "❤️",}';
  const recC = parseAndRecoverResponse(trailingComma);
  assert.deepStrictEqual(recC.bubbles, ['one', 'two']);
  assert.strictEqual(recC.reaction, '❤️');

  // Case D: Python single quotes
  const pythonQuotes = "{'bubbles': ['alpha', 'beta'], 'reaction': '👍'}";
  const recD = parseAndRecoverResponse(pythonQuotes);
  assert.deepStrictEqual(recD.bubbles, ['alpha', 'beta']);
  assert.strictEqual(recD.reaction, '👍');

  // Case E: Unquoted keys
  const unquotedKeys = '{bubbles: ["gamma", "delta"]}';
  const recE = parseAndRecoverResponse(unquotedKeys);
  assert.deepStrictEqual(recE.bubbles, ['gamma', 'delta']);

  // Case F: Reasoning tags
  const reasoning = '<think>I should be nice to the user.</think>\n{"bubbles": ["hi there!"]}';
  const recF = parseAndRecoverResponse(reasoning);
  assert.deepStrictEqual(recF.bubbles, ['hi there!']);

  console.log('  ✅ Parser successfully recovered 6 different structured variations');

  // ----------------------------------------------------------------
  // Test 10: Provider malformed-output handling and strict format retry
  // ----------------------------------------------------------------
  console.log('\n10. Testing strict formatting regeneration retry on unparseable output...');
  let callCount = 0;
  const mockRouter = new AIModelRouter({ openrouterKey: 'test' });
  mockRouter.request = async (url, options) => {
    callCount++;
    const body = JSON.parse(options.body);
    const lastMsg = body.messages[body.messages.length - 1]?.content || '';
    const sysPrompt = body.messages[0]?.content || '';

    // First call returns corrupted/unparseable output
    if (callCount === 1) {
      return { choices: [{ message: { content: '{"bubbles": [corrupted}' } }] };
    }
    // Second call (strict formatting retry)
    assert(sysPrompt.includes('STRICT') || sysPrompt.includes('CRITICAL JSON FORMATTING'), 'Retry must include strict formatting directive');
    return { choices: [{ message: { content: '{"bubbles": ["recovered bubble 1", "recovered bubble 2"], "reaction": "❤️"}' } }] };
  };

  const retryResult = await mockRouter.generate({
    userMessage: 'test message',
    conversationKey: 'test-retry-key'
  });
  assert.strictEqual(callCount, 2, 'Must have attempted initial call + 1 strict format retry');
  assert.deepStrictEqual(retryResult.bubbles, ['recovered bubble 1', 'recovered bubble 2']);
  assert.strictEqual(retryResult.reaction, '❤️');
  console.log('  ✅ Strict formatting regeneration retry succeeded on malformed output');

  // ----------------------------------------------------------------
  // Test 11: Existing 1-5 bubble ceiling
  // ----------------------------------------------------------------
  console.log('\n11. Testing existing 1-5 bubble ceiling...');
  const eightSentences = 'First thought is here. Second thought comes next. Third thought is interesting. Fourth thought adds nuance. Fifth thought wraps up. Sixth thought continues. Seventh thought is long. Eighth thought finishes.';
  const ceilingResult = normalizeConversationBeats([eightSentences]);
  assert(ceilingResult.length <= 5, `Must never exceed 5 bubbles, got ${ceilingResult.length}`);
  assert(ceilingResult.length >= 2, 'Should split into multiple bubbles');
  console.log(`  ✅ 8-sentence input bounded to exactly ${ceilingResult.length} bubbles (<= 5 ceiling)`);

  // ----------------------------------------------------------------
  // Test 12: Typing pacing between bubbles
  // ----------------------------------------------------------------
  console.log('\n12. Testing typing pacing between bubbles...');
  const pause = getInterBubblePause();
  assert(pause >= 300 && pause <= 800, `Inter-bubble pause must be between 300ms and 800ms, got ${pause}ms`);
  const typeDuration = calculateTypingDuration('hello there! how are you doing today?');
  assert(typeDuration >= 400 && typeDuration <= 3000, `Typing duration must be reasonable, got ${typeDuration}ms`);
  console.log(`  ✅ Typing duration (${typeDuration}ms) and inter-bubble pause (${pause}ms) verified`);

  // ----------------------------------------------------------------
  // Test 13: Full regression check (Director execution end-to-end)
  // ----------------------------------------------------------------
  console.log('\n13. Testing full director regression with natural conversational beats...');
  const testUser = storeDb.createUser({
    name: 'RhythmTester',
    email: `rhythm_${Date.now()}@example.com`,
    password: 'password123'
  });
  const userMsg = storeDb.createMessage({
    senderId: testUser._id,
    receiverId: 'user_ai_lyra',
    content: 'Do you know what it means?'
  });

  const testDirectorRouter = new AIModelRouter({ openrouterKey: 'test' });
  testDirectorRouter.request = async () => ({
    choices: [{
      message: {
        content: JSON.stringify({
          bubbles: [userExample],
          reaction: '😂'
        })
      }
    }]
  });

  const replies = await handleUserMessageToAI({
    storeDb,
    io: { to: () => ({ emit: () => {} }) },
    user: testUser,
    userMessage: userMsg,
    recentHistory: [userMsg],
    fastMode: true,
    router: testDirectorRouter
  });

  assert(Array.isArray(replies) && replies.length >= 2 && replies.length <= 4, `Director must produce 2-4 bubbles, got ${replies.length}`);
  for (const reply of replies) {
    assert(!isRawStructuredArtifact(reply.content), `Bubble must not be raw JSON: "${reply.content}"`);
    assert(isValidBubbleText(reply.content), `Bubble must be valid text: "${reply.content}"`);
  }
  console.log(`  ✅ Full director execution produced ${replies.length} natural bubbles with zero raw JSON`);

  console.log('\n====================================================');
  console.log('🎉 ALL 13 LYRA TEXTING RHYTHM & SAFETY TESTS PASSED!');
  console.log('====================================================\n');
}

runTextingRhythmAndSafetyTests().catch(err => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
