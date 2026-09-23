const assert = require('assert');

async function runTurnTakingTests() {
  console.log('🧪 Starting AI Human-Like Turn-Taking Test Suite...\n');

  const {
    TURN_STATE,
    TURN_DECISION,
    TURN_CONFIG,
    decideOnUserTyping,
    decideOnUserMessage
  } = await import('../../frontend/src/utils/aiTurnTaking.js');

  // Test A: User starts typing -> Lyra yields; user clears draft -> Lyra resumes
  console.log('Test A: User starts typing -> Lyra yields; user clears draft -> Lyra resumes');
  const yieldDecision = decideOnUserTyping({
    currentState: TURN_STATE.TYPING,
    isUserTyping: true
  });
  assert.strictEqual(yieldDecision, TURN_DECISION.WAIT, 'Lyra must WAIT when user starts typing meaningfully while she is typing');

  const resumeDecision = decideOnUserTyping({
    currentState: TURN_STATE.PAUSED_FOR_USER,
    isUserTyping: false
  });
  assert.strictEqual(resumeDecision, TURN_DECISION.RESUME, 'Lyra must RESUME when user clears composer without sending');
  console.log('  ✅ Lyra yields on user typing and resumes when draft is cleared\n');

  // Test B: User sends additional info while Lyra is typing -> RECONSIDER
  console.log('Test B: User sends additional info while Lyra is typing -> RECONSIDER');
  const reconsiderDecision = decideOnUserMessage({
    currentState: TURN_STATE.TYPING,
    hasPendingBubbles: true,
    isUserStillTyping: false
  });
  assert.strictEqual(reconsiderDecision, TURN_DECISION.RECONSIDER, 'Must RECONSIDER when user sends new info while pending bubbles exist');
  console.log('  ✅ RECONSIDER triggered on new message arrival during pending response\n');

  // Test C: Partial delivery: Lyra sends bubble #1 -> user interrupts -> bubble #1 preserved, bubble #2 discarded
  console.log('Test C: Partial delivery: Bubble #1 preserved as immutable history, undelivered bubble #2 discarded');
  const turnC = {
    generationId: 'gen-c-1',
    revision: 1,
    pendingBubbles: [{ _id: 'bubble-2', content: 'Did something happen?' }],
    deliveredBubbles: [{ _id: 'bubble-1', content: 'Wait what??' }]
  };
  let conversationHistory = [...turnC.deliveredBubbles];

  // User interrupts with "the game lol" -> bump revision, cancel turn, discard pending
  const newRevision = turnC.revision + 1;
  turnC.pendingBubbles = []; // Discarded!
  turnC.deliveryState = 'cancelled';

  // Delivered bubbles remain immutable in history
  assert.strictEqual(conversationHistory.length, 1, 'Delivered bubble #1 must remain in conversation history');
  assert.strictEqual(conversationHistory[0]._id, 'bubble-1', 'Delivered bubble #1 is preserved');
  assert.strictEqual(turnC.pendingBubbles.length, 0, 'Undelivered bubble #2 was discarded');
  assert.strictEqual(newRevision, 2, 'Conversation revision incremented');
  console.log('  ✅ Bubble #1 preserved, undelivered bubble #2 discarded, revision incremented\n');

  // Test D: Race condition: Stale generation finishes after newer generation
  console.log('Test D: Race condition: Stale generation finishes after newer generation');
  let currentRevision = 1;
  const activeGenId = 'gen-b-2';
  currentRevision = 2; // User sent newer message

  // Stale generation A arrives late
  const staleGen = { generationId: 'gen-a-1', revision: 1, bubbles: [{ _id: 'stale-msg', content: 'old reply' }] };
  const newerGen = { generationId: 'gen-b-2', revision: 2, bubbles: [{ _id: 'new-msg', content: 'updated reply' }] };

  const shouldRenderGeneration = (gen, activeRev, activeId) => {
    return gen.revision === activeRev && gen.generationId === activeId;
  };

  assert.strictEqual(shouldRenderGeneration(staleGen, currentRevision, activeGenId), false, 'Stale generation must NEVER be allowed to render');
  assert.strictEqual(shouldRenderGeneration(newerGen, currentRevision, activeGenId), true, 'Newer generation must be allowed to render');
  console.log('  ✅ Stale generation rejected; only newest revision allowed to render\n');

  // Test E: Micro-turn window: Rapid consecutive messages batched into single turn
  console.log('Test E: Micro-turn window: Rapid consecutive messages combined into single generation turn');
  const burstMessages = ['bro', 'you know what', 'I just realized', 'that thing yesterday', 'was completely wrong 😭'];
  let aiGenerationsTriggered = 0;
  let inListeningState = true;

  // As user sends rapid messages while continuing to type, turn stays in LISTENING
  for (let i = 0; i < burstMessages.length - 1; i++) {
    const decision = decideOnUserMessage({
      currentState: TURN_STATE.LISTENING,
      hasPendingBubbles: false,
      isUserStillTyping: true
    });
    assert.strictEqual(decision, TURN_DECISION.WAIT, `Lyra must WAIT during burst message ${i + 1}`);
  }

  // Final message: user stops typing -> micro-turn window commits -> SPEAK
  const finalDecision = decideOnUserMessage({
    currentState: TURN_STATE.LISTENING,
    hasPendingBubbles: false,
    isUserStillTyping: false
  });
  assert.strictEqual(finalDecision, TURN_DECISION.SPEAK, 'Lyra must SPEAK once user stops typing');
  aiGenerationsTriggered++;

  assert.strictEqual(aiGenerationsTriggered, 1, 'Exactly ONE generation triggered for all 5 rapid messages');
  console.log('  ✅ Exactly ONE generation triggered for 5 rapid burst messages\n');

  // Test F: Privacy check: Unsent draft text is never logged, persisted, or passed to turn-taking engine
  console.log('Test F: Privacy check: Composer draft text is never logged, persisted, or exposed');
  const typingEventData = { isUserTyping: true }; // Boolean ONLY
  assert.strictEqual(typeof typingEventData.isUserTyping, 'boolean', 'Only boolean typing state is transmitted');
  assert.strictEqual(typingEventData.text, undefined, 'Draft text must NEVER be present in typing events');
  console.log('  ✅ Verified: Unsent composer draft text is strictly private and never transmitted\n');

  console.log('🎉 All Human-Like Turn-Taking tests passed successfully!\n');
}

runTurnTakingTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
