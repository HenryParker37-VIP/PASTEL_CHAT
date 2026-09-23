/**
 * aiTurnTaking.js
 * Human-like Turn-Taking Engine for Lyra on Pastel Chat.
 *
 * Coordinates when to SPEAK, when to WAIT, when to RESUME, and when to RECONSIDER.
 */

export const TURN_STATE = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  GENERATING: 'GENERATING',
  TYPING: 'TYPING',
  PAUSED_FOR_USER: 'PAUSED_FOR_USER',
  DELIVERING: 'DELIVERING'
};

export const TURN_DECISION = {
  SPEAK: 'SPEAK',
  WAIT: 'WAIT',
  RESUME: 'RESUME',
  RECONSIDER: 'RECONSIDER'
};

export const TURN_CONFIG = {
  USER_TYPING_DEBOUNCE_MS: 180,     // Debounce to filter accidental keypresses
  MICRO_TURN_WINDOW_MS: 480,        // Adaptive micro turn window for rapid message bursts
  USER_STOP_GRACE_PERIOD_MS: 700,   // Grace period after clearing draft before resuming Lyra
  USER_IDLE_TIMEOUT_MS: 5500        // If user leaves draft unsent and goes idle, Lyra resumes
};

/**
 * Determines turn decision when user starts or stops typing.
 */
export function decideOnUserTyping({ currentState, isUserTyping }) {
  if (isUserTyping) {
    if (currentState === TURN_STATE.TYPING || currentState === TURN_STATE.DELIVERING || currentState === TURN_STATE.GENERATING) {
      return TURN_DECISION.WAIT;
    }
    if (currentState === TURN_STATE.LISTENING) {
      return TURN_DECISION.WAIT;
    }
    return null;
  } else {
    if (currentState === TURN_STATE.PAUSED_FOR_USER) {
      return TURN_DECISION.RESUME;
    }
    if (currentState === TURN_STATE.LISTENING) {
      return TURN_DECISION.SPEAK;
    }
    return null;
  }
}

/**
 * Determines turn decision when user sends a new message.
 */
export function decideOnUserMessage({ currentState, hasPendingBubbles, isUserStillTyping }) {
  // If Lyra had pending undelivered bubbles or was generating, user sending a new message means RECONSIDER
  if (currentState === TURN_STATE.TYPING || currentState === TURN_STATE.GENERATING || currentState === TURN_STATE.PAUSED_FOR_USER || hasPendingBubbles) {
    return TURN_DECISION.RECONSIDER;
  }

  // If user immediately continues typing in composer, wait in micro-turn window
  if (isUserStillTyping) {
    return TURN_DECISION.WAIT;
  }

  return TURN_DECISION.SPEAK;
}
