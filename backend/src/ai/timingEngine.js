/**
 * Timing Engine for Realistic Human Conversational Pacing.
 */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculates typing duration for a bubble based on length, punctuation, and jitter.
 * @param {string} text - Message text
 * @param {number} cpm - Target characters per minute (default ~240 CPM, approx 48 WPM)
 * @returns {number} duration in milliseconds
 */
function calculateTypingDuration(text, cpm = 240) {
  if (!text || !text.trim()) return 300;
  const len = text.trim().length;

  // Base ms per character: (60,000 ms / cpm) -> ~250ms for 240 CPM is wrong! 60,000 / 240 = 250 ms per character?
  // Wait: 240 CPM = 4 characters per second = 250ms per character.
  // Wait! In fast phone messaging, 40 WPM = 200 CPM = 300ms/char? No, texting on phone is often 30-50ms per character!
  // Let's check: a 30-char message "hey, just making coffee" at 35ms/char is 1050ms (1.05s) typing time! That feels very realistic!
  // A 60-char message at 30ms/char is 1.8s typing time!
  const msPerChar = 32;
  let duration = len * msPerChar;

  // Punctuation pauses
  const punctuationCount = (text.match(/[,.!?]/g) || []).length;
  duration += punctuationCount * 120;

  // Human jitter: +/- 15%
  const jitter = (Math.random() * 0.3) - 0.15;
  duration = Math.round(duration * (1 + jitter));

  // Cap between 400ms and 3000ms per bubble so chat never feels stalled
  return Math.min(Math.max(duration, 400), 2800);
}

/**
 * Calculates initial thinking/reading delay compensated for LLM latency.
 * @param {number} userMessageLength
 * @param {number} llmDurationMs
 * @returns {number} delay in milliseconds
 */
function calculateInitialDelay(userMessageLength = 10, llmDurationMs = 0) {
  // Reading time: ~15ms per character of user's message + base 300ms
  const readingTime = Math.min(300 + (userMessageLength * 12), 1200);
  
  // If LLM already took time, subtract it from the initial reading time
  const remainingDelay = readingTime - llmDurationMs;
  return Math.max(remainingDelay, 250);
}

/**
 * Pause between consecutive bubbles.
 */
function getInterBubblePause() {
  // Random pause between 350ms and 750ms
  return Math.floor(Math.random() * 400) + 350;
}

module.exports = {
  sleep,
  calculateTypingDuration,
  calculateInitialDelay,
  getInterBubblePause
};
