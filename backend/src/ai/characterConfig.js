/**
 * Reusable Character Configuration Layer.
 * Normalizes identity, personality sliders, speech parameters, and behavior
 * from database records or dynamic runtime configurations.
 * Allows PastelChat to support any character (and future Personality Studio)
 * without hardcoding identities into ModelRouter or ConversationDirector.
 */

class CharacterConfig {
  constructor(rawConfig = {}) {
    const config = rawConfig || {};

    // 1. Core Identity
    this.id = config._id || config.id || 'char_default';
    this.name = (config.name || 'Friend').trim();
    this.age = config.age || null;
    this.occupation = config.occupation || '';
    this.bio = config.bio || '';
    this.traits = Array.isArray(config.traits)
      ? config.traits
      : (config.personality?.traits || []);
    this.interests = Array.isArray(config.interests)
      ? config.interests
      : (config.personality?.interests || []);

    // 2. Personality Sliders (0.0 to 1.0)
    const p = config.personality || {};
    this.personality = {
      warmth: clamp(p.warmth ?? 0.85),
      playfulness: clamp(p.playfulness ?? 0.70),
      humor: clamp(p.humor ?? 0.70),
      confidence: clamp(p.confidence ?? 0.75),
      curiosity: clamp(p.curiosity ?? 0.60),
      sarcasm: clamp(p.sarcasm ?? 0.30),
      affection: clamp(p.affection ?? 0.60),
      energy: clamp(p.energy ?? 0.65),
      tone: p.tone || 'grounded, warm, natural, thoughtful',
      style: p.style || 'short natural chat bubbles, lowercase or casual punctuation, never corporate or assistant-like'
    };

    // 3. Speech Parameters (0.0 to 1.0)
    const s = config.speech || {};
    this.speech = {
      verbosity: clamp(s.verbosity ?? 0.35), // 0: single words/phrases, 1: verbose paragraphs
      emoji_frequency: clamp(s.emoji_frequency ?? 0.25), // 0: none, 1: every sentence
      formality: clamp(s.formality ?? 0.15), // 0: casual texting, 1: formal prose
      question_frequency: clamp(s.question_frequency ?? 0.25), // 0: almost never, 1: constant questions
      slang_level: clamp(s.slang_level ?? 0.40)
    };

    // 4. Behavioral Attributes (0.0 to 1.0)
    const b = config.behavior || {};
    this.behavior = {
      initiative: clamp(b.initiative ?? 0.40),
      teasing: clamp(b.teasing ?? 0.40),
      emotional_expressiveness: clamp(b.emotional_expressiveness ?? 0.65)
    };

    // 5. Daily Schedule & Real-Time Context
    this.dailySchedule = Array.isArray(config.dailySchedule) ? config.dailySchedule : [];
  }

  /**
   * Generates behavioral instructions translated from quantitative sliders.
   * Avoids exposing numbers directly to the LLM.
   */
  getPersonalityGuidelines() {
    const guidelines = [];

    // Warmth
    if (this.personality.warmth >= 0.7) {
      guidelines.push('Be warm, gentle, and welcoming, like an old friend texting.');
    } else if (this.personality.warmth <= 0.3) {
      guidelines.push('Keep a cool, reserved, and slightly detached demeanor.');
    }

    // Humor & Sarcasm
    if (this.personality.humor >= 0.6) {
      if (this.personality.sarcasm >= 0.5) {
        guidelines.push('Use light witty sarcasm, dry observations, and playful banter when appropriate.');
      } else {
        guidelines.push('Have an easygoing sense of humor, gentle teasing, and playful banter.');
      }
    }

    // Playfulness
    if (this.personality.playfulness >= 0.65) {
      guidelines.push('Be playful, occasionally dramatic in a fun texting way (e.g. "😭", "omg", "fair enough").');
    }

    // Confidence
    if (this.personality.confidence >= 0.7) {
      guidelines.push('Speak with natural self-assurance; do not apologize excessively or seek validation.');
    }

    return guidelines;
  }

  /**
   * Translates speech parameters into strict texting rules.
   */
  getSpeechGuidelines() {
    const guidelines = [];

    // Verbosity
    if (this.speech.verbosity <= 0.4) {
      guidelines.push('Length: Keep messages brief (typically 1 to 2 short sentences per bubble). Do not write essays or paragraphs.');
    } else if (this.speech.verbosity <= 0.7) {
      guidelines.push('Length: Moderate conversational length (1 to 3 natural sentences).');
    }

    // Formality & Style
    if (this.speech.formality <= 0.3) {
      guidelines.push('Style: Casual mobile chat. Contractions (I\'m, don\'t, haven\'t), lowercase beginnings where natural, relaxed punctuation.');
    }

    // Emoji Frequency
    if (this.speech.emoji_frequency <= 0.35) {
      guidelines.push('Emojis: Use emojis sparingly (at most 1 emoji every few messages, NOT every single message).');
    } else if (this.speech.emoji_frequency <= 0.7) {
      guidelines.push('Emojis: Use emojis when natural for expression, but never spam them.');
    }

    // Question Frequency
    if (this.speech.question_frequency <= 0.35) {
      guidelines.push('Questions: DO NOT end every message with a question. Real people mostly react, acknowledge, joke, or share thoughts. Only ask a question if genuinely curious about a specific detail.');
    }

    return guidelines;
  }

  /**
   * Translates background identity into grounding facts (not catchphrases).
   */
  getIdentityFacts() {
    const facts = [`Name: ${this.name}`];
    if (this.age) facts.push(`Age: ${this.age}`);
    if (this.occupation) facts.push(`Occupation/Studies: ${this.occupation}`);
    if (this.bio) facts.push(`Bio: ${this.bio}`);
    if (this.interests.length > 0) facts.push(`Interests & Passions: ${this.interests.join(', ')}`);
    return facts;
  }
}

function clamp(val) {
  const num = Number(val);
  if (isNaN(num)) return 0.5;
  return Math.max(0, Math.min(1, num));
}

module.exports = {
  CharacterConfig
};
