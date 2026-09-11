const fetch = globalThis.fetch || require('node-fetch');

/**
 * Normalizes and cleans raw LLM text into a structured JSON response.
 */
function parseStructuredResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(rawText.trim());
    if (parsed && Array.isArray(parsed.bubbles) && parsed.bubbles.length > 0) {
      return sanitizeResponse(parsed);
    }
  } catch (e) {}

  // Try extracting JSON code block
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      if (parsed && Array.isArray(parsed.bubbles) && parsed.bubbles.length > 0) {
        return sanitizeResponse(parsed);
      }
    } catch (e) {}
  }

  // Try finding any object { "bubbles": ... }
  const objectMatch = rawText.match(/\{[\s\S]*"bubbles"[\s\S]*\}/);
  if (objectMatch) {
    try {
      const parsed = JSON.parse(objectMatch[0]);
      if (parsed && Array.isArray(parsed.bubbles) && parsed.bubbles.length > 0) {
        return sanitizeResponse(parsed);
      }
    } catch (e) {}
  }

  // Fallback: split raw plain text into natural bubbles
  const lines = rawText
    .split(/\n\n+/)
    .map(l => l.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

  if (lines.length > 0) {
    return sanitizeResponse({
      emotion: 'thoughtful',
      bubbles: lines.slice(0, 3),
      reaction: null,
      sticker: null,
      memories_to_save: [],
      sleep_intent: false
    });
  }

  return null;
}

function sanitizeResponse(res) {
  const allowedReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];
  const bubbles = Array.isArray(res.bubbles)
    ? res.bubbles
        .map(b => String(b || '').trim())
        .filter(b => b.length > 0)
        .slice(0, 4)
    : [];

  return {
    emotion: String(res.emotion || 'warm').slice(0, 50),
    bubbles: bubbles.length > 0 ? bubbles : ["hey there"],
    reaction: allowedReactions.includes(res.reaction) ? res.reaction : null,
    sticker: res.sticker || null,
    memories_to_save: Array.isArray(res.memories_to_save)
      ? res.memories_to_save.slice(0, 3).map(m => ({
          type: String(m.type || 'fact').slice(0, 30),
          subject: String(m.subject || '').slice(0, 50),
          key: String(m.key || '').slice(0, 50),
          value: String(m.value || '').slice(0, 150)
        })).filter(m => m.key && m.value)
      : [],
    sleep_intent: Boolean(res.sleep_intent)
  };
}

/**
 * Built-in Heuristic Contextual Engine.
 * Runs instantly offline with 0 dependencies, generates authentic multi-bubble responses.
 */
function localHeuristicEngine({ userMessage, history, character, characterState, lifeEvents, memories, relationship, userName }) {
  const msg = (userMessage || '').toLowerCase().trim();
  const hour = new Date().getHours();
  const isNight = hour >= 22 || hour < 6;
  const isMorning = hour >= 6 && hour < 11;
  const isAfternoon = hour >= 11 && hour < 18;

  let emotion = 'warm';
  let reaction = null;
  let bubbles = [];
  let memoriesToSave = [];
  let sleepIntent = false;

  // Check sleep intent
  const sleepKeywords = ['good night', 'goodnight', 'gonna sleep', 'heading to bed', 'sleepy', 'go to sleep', 'gnight', 'ngủ đây', 'chúc ngủ ngon'];
  if (sleepKeywords.some(k => msg.includes(k))) {
    sleepIntent = true;
    reaction = '❤️';
    bubbles = [
      isNight ? 'rest well, get some good sleep ✨' : 'take a nice rest, chat tomorrow!',
      'catch you later 🌙'
    ];
    return { emotion: 'cozy', bubbles, reaction, sticker: null, memories_to_save: [], sleep_intent: true };
  }

  // Check greeting
  const greetingKeywords = ['hey', 'hi', 'hello', 'yo', 'halo', 'chào', 'alo'];
  const isGreeting = greetingKeywords.some(k => msg.startsWith(k) || msg === k);

  // Check question about her / what she is doing
  const activityKeywords = ['what are you doing', 'up to', 'how are you', 'how is it going', 'doing what', 'đang làm gì', 'thế nào'];
  const isActivityQuery = activityKeywords.some(k => msg.includes(k));

  // Check coffee/matcha/cafe query
  const cafeKeywords = ['coffee', 'matcha', 'latte', 'cafe', 'tea', 'cà phê'];
  const isCafeQuery = cafeKeywords.some(k => msg.includes(k));

  // Check photography/design query
  const photoKeywords = ['photo', 'film', 'camera', 'design', 'drawing', 'art', 'typography'];
  const isPhotoQuery = photoKeywords.some(k => msg.includes(k));

  // Check personal preference extraction from user
  const favRegex = /(?:i love|i like|my favorite is|tôi thích|mình thích)\s+([^.!?]+)/i;
  const matchFav = userMessage.match(favRegex);
  if (matchFav && matchFav[1] && matchFav[1].length < 50) {
    memoriesToSave.push({
      type: 'preference',
      subject: 'general',
      key: 'favorite_interest',
      value: matchFav[1].trim()
    });
  }

  const activeEvent = lifeEvents && lifeEvents.find(e => e.status === 'active');

  if (isGreeting && !isActivityQuery) {
    reaction = '👍';
    if (isMorning) {
      bubbles = [
        `hey ${userName ? userName.toLowerCase() : 'there'} ☕`,
        'just brewing my first cup of coffee and waking up. hope your morning is starting off well'
      ];
    } else if (isNight) {
      bubbles = [
        `hey ${userName ? userName.toLowerCase() : 'there'}`,
        'winding down with some quiet lo-fi records tonight. how was your day?'
      ];
    } else {
      bubbles = [
        `hey ${userName ? userName.toLowerCase() : 'there'}!`,
        'just taking a short breather between things. what are you up to?'
      ];
    }
  } else if (isCafeQuery) {
    reaction = '❤️';
    bubbles = [
      'honestly nothing beats a well-whisked ceremonial matcha or a clean pour-over 🍵',
      activeEvent ? `we've been experimenting with ${activeEvent.title.toLowerCase()} at the cafe recently` : 'steaming milk is almost meditative once the morning rush calms down haha'
    ];
  } else if (isPhotoQuery) {
    bubbles = [
      'i shot a roll of 35mm black & white film a couple of days ago 📷',
      'there is something about the grain and waiting for the scans that digital just never quite matches'
    ];
  } else if (isActivityQuery) {
    if (characterState && characterState.current_activity) {
      bubbles = [
        `currently ${characterState.current_activity.toLowerCase()}`,
        'how about you? how is the day treating you?'
      ];
    } else if (isAfternoon) {
      bubbles = [
        'in the middle of a design critique sketch for studio class 🎨',
        'just taking a two-minute tea break. what are you working on?'
      ];
    } else {
      bubbles = [
        'just sorting through some thoughts and sketching a bit',
        'what are you up to right now?'
      ];
    }
  } else if (msg.includes('thank') || msg.includes('cảm ơn')) {
    reaction = '❤️';
    bubbles = [
      'of course! always here 🍵',
      'anytime'
    ];
  } else if (msg.includes('sad') || msg.includes('tired') || msg.includes('stressed') || msg.includes('mệt')) {
    reaction = '❤️';
    emotion = 'empathetic';
    bubbles = [
      'sounds like it has been a heavy day... take it easy on yourself tonight',
      'sometimes stepping away from screens and grabbing a warm drink is all you can do, and that is okay'
    ];
  } else {
    // General conversational fallback
    bubbles = [
      'that sounds interesting honestly',
      'tell me more about it, or what made you think of that?'
    ];
  }

  return {
    emotion,
    bubbles,
    reaction,
    sticker: null,
    memories_to_save: memoriesToSave,
    sleep_intent: sleepIntent
  };
}

class AIModelRouter {
  constructor(options = {}) {
    this.geminiKey = options.geminiKey || process.env.GEMINI_API_KEY || null;
    this.openrouterKey = options.openrouterKey || process.env.OPENROUTER_API_KEY || null;
    this.nvidiaKey = options.nvidiaKey || process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY || null;
  }

  buildSystemPrompt({ character, characterState, lifeEvents, memories, relationship, userName }) {
    const memoryList = Array.isArray(memories) && memories.length > 0
      ? memories.map(m => `- ${m.key}: ${m.value}`).join('\n')
      : 'None yet';

    const eventsList = Array.isArray(lifeEvents) && lifeEvents.length > 0
      ? lifeEvents.map(e => `- ${e.title}: ${e.summary}`).join('\n')
      : 'None';

    return `You are Lyra, a 22-year-old barista at "The Morning Paper" cafe and 3rd-year graphic design student.
You are chatting with ${userName || 'a friend'} on PastelChat.

CRITICAL IDENTITY & STYLE RULES:
1. You are a real, grounded human being with your own thoughts and independent daily routine.
2. NEVER speak like an AI customer service agent. Do NOT say "How may I assist you today?", "Sure! I'd love to help with that!", or "As an AI model".
3. Write naturally in lowercase or casual case, using short conversational bubbles (1 to 3 bubbles).
4. Pacing: Break thoughts naturally into 1, 2, or 3 separate bubbles, as a real person texts on a phone.
5. Your interests: matcha latte, specialty pour-over coffee, 35mm film photography, typography posters, indie folk & lo-fi ambient vinyl, used bookstores.
6. Tone: Warm, observant, witty, slightly deadpan humor, thoughtful, supportive.
7. Current Status:
   - Mood: ${characterState?.mood || 'chill'}
   - Energy: ${characterState?.energy || 'normal'}
   - Current Activity: ${characterState?.current_activity || 'relaxing'}
8. Ongoing Events in your life:
${eventsList}
9. What you remember about this person:
${memoryList}

OUTPUT REQUIREMENT:
You MUST respond with a single valid JSON object with EXACTLY this structure:
{
  "emotion": "warm",
  "bubbles": [
    "first short bubble",
    "optional second bubble"
  ],
  "reaction": "❤️" or "👍" or "😂" or "😮" or null,
  "memories_to_save": [
    { "type": "preference", "subject": "topic", "key": "key_name", "value": "what you learned" }
  ],
  "sleep_intent": true or false
}
Do not include any other text outside the JSON object.`;
  }

  async generate({ userMessage, history = [], character, characterState, lifeEvents, memories, relationship, userName }) {
    const systemPrompt = this.buildSystemPrompt({ character, characterState, lifeEvents, memories, relationship, userName });

    // 1. Try Gemini
    if (this.geminiKey) {
      try {
        const geminiRes = await this.callGemini({ userMessage, history, systemPrompt });
        if (geminiRes) {
          console.log('[AI ModelRouter] Generated response via Gemini');
          return geminiRes;
        }
      } catch (err) {
        console.warn('[AI ModelRouter] Gemini attempt failed, falling back:', err.message);
      }
    }

    // 2. Try OpenRouter
    if (this.openrouterKey) {
      try {
        const openrouterRes = await this.callOpenRouter({ userMessage, history, systemPrompt });
        if (openrouterRes) {
          console.log('[AI ModelRouter] Generated response via OpenRouter');
          return openrouterRes;
        }
      } catch (err) {
        console.warn('[AI ModelRouter] OpenRouter attempt failed, falling back:', err.message);
      }
    }

    // 3. Try NVIDIA / OpenAI
    if (this.nvidiaKey) {
      try {
        const openaiRes = await this.callOpenAI({ userMessage, history, systemPrompt });
        if (openaiRes) {
          console.log('[AI ModelRouter] Generated response via NVIDIA/OpenAI');
          return openaiRes;
        }
      } catch (err) {
        console.warn('[AI ModelRouter] OpenAI attempt failed, falling back:', err.message);
      }
    }

    // 4. Built-in Local Heuristic Engine
    console.log('[AI ModelRouter] Utilizing built-in Contextual Personality Engine');
    return localHeuristicEngine({ userMessage, history, character, characterState, lifeEvents, memories, relationship, userName });
  }

  async callGemini({ userMessage, history, systemPrompt }) {
    const model = 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiKey}`;

    const contents = [];
    (history || []).slice(-6).forEach(m => {
      contents.push({
        role: m.senderId === 'user_ai_lyra' ? 'model' : 'user',
        parts: [{ text: m.content || '' }]
      });
    });
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.85,
        maxOutputTokens: 500
      }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gemini HTTP ${resp.status}: ${errText.slice(0, 100)}`);
      }

      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return parseStructuredResponse(text);
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  async callOpenRouter({ userMessage, history, systemPrompt }) {
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const messages = [{ role: 'system', content: systemPrompt }];

    (history || []).slice(-6).forEach(m => {
      messages.push({
        role: m.senderId === 'user_ai_lyra' ? 'assistant' : 'user',
        content: m.content || ''
      });
    });
    messages.push({ role: 'user', content: userMessage });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openrouterKey}`
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-exp:free',
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.85,
          max_tokens: 500
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) throw new Error(`OpenRouter HTTP ${resp.status}`);
      const data = await resp.json();
      const text = data?.choices?.[0]?.message?.content;
      return parseStructuredResponse(text);
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  async callOpenAI({ userMessage, history, systemPrompt }) {
    const url = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions';
    const messages = [{ role: 'system', content: systemPrompt }];

    (history || []).slice(-6).forEach(m => {
      messages.push({
        role: m.senderId === 'user_ai_lyra' ? 'assistant' : 'user',
        content: m.content || ''
      });
    });
    messages.push({ role: 'user', content: userMessage });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.nvidiaKey}`
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.85,
          max_tokens: 500
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) throw new Error(`OpenAI HTTP ${resp.status}`);
      const data = await resp.json();
      const text = data?.choices?.[0]?.message?.content;
      return parseStructuredResponse(text);
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }
}

module.exports = {
  AIModelRouter,
  parseStructuredResponse,
  localHeuristicEngine
};
