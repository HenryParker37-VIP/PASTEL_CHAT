/**
 * aiTypingPacing.js
 * Pacing calculations and latency compensation for Lyra's natural message delivery.
 */

export const PACING_CONFIG = {
  BASE_DELAY_MIN: 380,
  BASE_DELAY_MAX: 580,
  CHAR_RATE_MIN: 28, // ms per character
  CHAR_RATE_MAX: 40, // ms per character
  PUNCTUATION_PER_MARK: 70, // ms per punctuation mark
  PUNCTUATION_CAP: 280, // max punctuation delay in ms
  MIN_COMPOSITION_TIME: 550, // minimum total composition time in ms
  MAX_COMPOSITION_TIME: 5500, // maximum total composition time in ms
  MIN_LATENCY_COMPENSATION_FLOOR: 380, // brief visual cue if LLM generation was slow
  INTER_BUBBLE_PAUSE_MIN: 260,
  INTER_BUBBLE_PAUSE_MAX: 500,
  REACTION_WINDOW_MIN: 220,
  REACTION_WINDOW_MAX: 480
};

/**
 * Calculates human composition time for a given text bubble.
 * Accounts for base initiation, character count with natural jitter, and capped punctuation.
 *
 * @param {string} text - Message text
 * @param {object} [options]
 * @param {boolean} [options.randomJitter=true] - Whether to apply random variations
 * @returns {number} Duration in milliseconds
 */
export function calculateHumanCompositionTime(text = '', options = {}) {
  const { randomJitter = true } = options;
  const str = typeof text === 'string' ? text : '';
  const charCount = str.length;

  // Base initiation delay
  const baseDelay = randomJitter
    ? PACING_CONFIG.BASE_DELAY_MIN + Math.random() * (PACING_CONFIG.BASE_DELAY_MAX - PACING_CONFIG.BASE_DELAY_MIN)
    : (PACING_CONFIG.BASE_DELAY_MIN + PACING_CONFIG.BASE_DELAY_MAX) / 2;

  // Typing rate per character with subtle jitter
  const charRate = randomJitter
    ? PACING_CONFIG.CHAR_RATE_MIN + Math.random() * (PACING_CONFIG.CHAR_RATE_MAX - PACING_CONFIG.CHAR_RATE_MIN)
    : (PACING_CONFIG.CHAR_RATE_MIN + PACING_CONFIG.CHAR_RATE_MAX) / 2;

  // Jitter multiplier (+-12%)
  const jitterMultiplier = randomJitter ? (0.88 + Math.random() * 0.24) : 1.0;
  const typingTime = charCount * charRate * jitterMultiplier;

  // Punctuation contribution, strictly capped (e.g. max 280ms)
  const punctuationMatches = str.match(/[,.!?…~—]/g);
  const punctuationCount = punctuationMatches ? punctuationMatches.length : 0;
  const punctuationDelay = Math.min(
    punctuationCount * PACING_CONFIG.PUNCTUATION_PER_MARK,
    PACING_CONFIG.PUNCTUATION_CAP
  );

  const rawTotal = baseDelay + typingTime + punctuationDelay;

  // Clamp within boundaries
  return Math.round(
    Math.min(
      Math.max(rawTotal, PACING_CONFIG.MIN_COMPOSITION_TIME),
      PACING_CONFIG.MAX_COMPOSITION_TIME
    )
  );
}

/**
 * Calculates remaining typing delay with latency compensation.
 * Formula: remainingTypingDelay = targetHumanCompositionTime - elapsedGenerationTime
 * If generation was slower than human typing, returns a brief visual transition floor (~380ms).
 *
 * @param {string} text
 * @param {number} elapsedGenerationTime
 * @param {object} [options]
 * @returns {number} Milliseconds
 */
export function calculateRemainingTypingDelay(text = '', elapsedGenerationTime = 0, options = {}) {
  const targetHumanCompositionTime = calculateHumanCompositionTime(text, options);
  const remaining = targetHumanCompositionTime - Math.max(0, elapsedGenerationTime);

  return Math.round(
    Math.max(remaining, PACING_CONFIG.MIN_LATENCY_COMPENSATION_FLOOR)
  );
}

/**
 * Natural inter-bubble pause between consecutive bubbles (~260-500ms).
 *
 * @param {boolean} [randomJitter=true]
 * @returns {number} Milliseconds
 */
export function calculateInterBubblePause(randomJitter = true) {
  if (!randomJitter) {
    return Math.round((PACING_CONFIG.INTER_BUBBLE_PAUSE_MIN + PACING_CONFIG.INTER_BUBBLE_PAUSE_MAX) / 2);
  }
  return Math.round(
    PACING_CONFIG.INTER_BUBBLE_PAUSE_MIN +
    Math.random() * (PACING_CONFIG.INTER_BUBBLE_PAUSE_MAX - PACING_CONFIG.INTER_BUBBLE_PAUSE_MIN)
  );
}

/**
 * Natural reaction window before exposing the typing indicator (~220-480ms).
 *
 * @param {boolean} [randomJitter=true]
 * @returns {number} Milliseconds
 */
export function calculateReactionDelay(randomJitter = true) {
  if (!randomJitter) {
    return Math.round((PACING_CONFIG.REACTION_WINDOW_MIN + PACING_CONFIG.REACTION_WINDOW_MAX) / 2);
  }
  return Math.round(
    PACING_CONFIG.REACTION_WINDOW_MIN +
    Math.random() * (PACING_CONFIG.REACTION_WINDOW_MAX - PACING_CONFIG.REACTION_WINDOW_MIN)
  );
}
