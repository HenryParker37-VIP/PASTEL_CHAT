const assert = require('assert');

async function runTypingPacingTests() {
  console.log('🧪 Starting AI Typing Pacing & Delivery Test Suite...');

  const {
    PACING_CONFIG,
    calculateHumanCompositionTime,
    calculateRemainingTypingDelay,
    calculateInterBubblePause,
    calculateReactionDelay
  } = await import('../../frontend/src/utils/aiTypingPacing.js');

  // Test 1: Short bubble composition time
  const shortText = 'hey :)';
  const shortTime = calculateHumanCompositionTime(shortText, { randomJitter: false });
  console.log(`  Short bubble ("${shortText}") duration: ${shortTime}ms`);
  assert(shortTime >= PACING_CONFIG.MIN_COMPOSITION_TIME, 'Short bubble must be at or above min composition time (550ms)');
  assert(shortTime <= 900, 'Short bubble should be quick (~600-800ms)');

  // Test 2: Medium/long bubble composition time
  const mediumText = "i'm studying graphic design right now, but honestly half the time it feels like i'm just arguing with colors until something looks right 😭";
  const mediumTime = calculateHumanCompositionTime(mediumText, { randomJitter: false });
  console.log(`  Medium bubble (${mediumText.length} chars) duration: ${mediumTime}ms`);
  assert(mediumTime > 4000 && mediumTime <= PACING_CONFIG.MAX_COMPOSITION_TIME, 'Medium text should scale with character length up to max cap');

  // Test 3: Extreme length clamp
  const hugeText = 'a'.repeat(500);
  const hugeTime = calculateHumanCompositionTime(hugeText, { randomJitter: false });
  console.log(`  Huge bubble (500 chars) duration: ${hugeTime}ms (max cap is ${PACING_CONFIG.MAX_COMPOSITION_TIME}ms)`);
  assert.strictEqual(hugeTime, PACING_CONFIG.MAX_COMPOSITION_TIME, 'Huge text must be clamped to MAX_COMPOSITION_TIME');

  // Test 4: Punctuation cap check
  // Compare 30 exclamation marks vs 30 letters of identical length
  const spamPunct = 'WHAT' + '!'.repeat(30);
  const lettersOnly = 'WHAT' + 'x'.repeat(30);
  const spamTime = calculateHumanCompositionTime(spamPunct, { randomJitter: false });
  const lettersTime = calculateHumanCompositionTime(lettersOnly, { randomJitter: false });
  const punctDiff = spamTime - lettersTime;
  console.log(`  Punctuation contribution for 30 marks: ${punctDiff}ms (cap is ${PACING_CONFIG.PUNCTUATION_CAP}ms)`);
  assert.strictEqual(punctDiff, PACING_CONFIG.PUNCTUATION_CAP, `Punctuation contribution must equal capped value (${PACING_CONFIG.PUNCTUATION_CAP}ms)`);

  // Test 5: Latency compensation
  // Case A: Fast generation (50ms) -> should leave most typing delay intact
  const remainingFast = calculateRemainingTypingDelay(shortText, 50, { randomJitter: false });
  console.log(`  Fast generation (50ms elapsed): remaining typing delay = ${remainingFast}ms`);
  assert(remainingFast >= 500, 'Fast generation retains typing delay');

  // Case B: Slow generation (5000ms) -> should fall back to brief visual cue (~380ms)
  const remainingSlow = calculateRemainingTypingDelay(shortText, 5000, { randomJitter: false });
  console.log(`  Slow generation (5000ms elapsed): remaining typing delay = ${remainingSlow}ms`);
  assert.strictEqual(remainingSlow, PACING_CONFIG.MIN_LATENCY_COMPENSATION_FLOOR, 'Slow generation floors at minimum visual transition');

  // Case C: Medium text with 2000ms generation
  const remainingMed = calculateRemainingTypingDelay(mediumText, 2000, { randomJitter: false });
  console.log(`  Medium generation (2000ms elapsed on ${mediumText.length} chars): remaining typing delay = ${remainingMed}ms`);
  assert(remainingMed > PACING_CONFIG.MIN_LATENCY_COMPENSATION_FLOOR, 'Medium generation with long bubble still has natural typing left');

  // Test 6: Reaction window bounds
  for (let i = 0; i < 20; i++) {
    const rx = calculateReactionDelay(true);
    assert(rx >= PACING_CONFIG.REACTION_WINDOW_MIN && rx <= PACING_CONFIG.REACTION_WINDOW_MAX, `Reaction delay ${rx} within bounds`);
  }
  console.log('  ✅ Natural reaction window bounds verified (220-480ms)');

  // Test 7: Inter-bubble pause bounds
  for (let i = 0; i < 20; i++) {
    const pause = calculateInterBubblePause(true);
    assert(pause >= PACING_CONFIG.INTER_BUBBLE_PAUSE_MIN && pause <= PACING_CONFIG.INTER_BUBBLE_PAUSE_MAX, `Pause ${pause} within bounds`);
  }
  console.log('  ✅ Inter-bubble pause bounds verified (260-500ms)');

  // Test 8: Generation revision invalidation logic
  let activeTurn = {
    generationId: 'gen-1',
    revision: 1,
    deliveryState: 'typing',
    pendingBubbles: [{ _id: 'bubble-1', content: 'older reply' }],
    deliveredBubbles: []
  };

  const isTurnValid = (turn, currentRevision, currentGenId) => {
    return turn && turn.revision === currentRevision && turn.generationId === currentGenId && turn.deliveryState !== 'cancelled';
  };

  assert.strictEqual(isTurnValid(activeTurn, 1, 'gen-1'), true, 'Turn 1 is valid before revision bump');

  // User sends new message -> bump revision to 2 and mark activeTurn cancelled
  activeTurn.deliveryState = 'cancelled';
  const newActiveTurn = {
    generationId: 'gen-2',
    revision: 2,
    deliveryState: 'reacting',
    pendingBubbles: [{ _id: 'bubble-2', content: 'newer reply' }],
    deliveredBubbles: []
  };

  assert.strictEqual(isTurnValid(activeTurn, 2, 'gen-2'), false, 'Older turn 1 must be rejected after revision bump');
  assert.strictEqual(isTurnValid(newActiveTurn, 2, 'gen-2'), true, 'Newer turn 2 is valid');
  console.log('  ✅ Generation revision invalidation and cancellation verified');

  console.log('🎉 All AI Typing Pacing tests passed successfully!\n');
}

runTypingPacingTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
