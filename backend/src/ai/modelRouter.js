const fetch = globalThis.fetch || require('node-fetch');
const { GEMINI_API_KEY, NVIDIA_API_KEY, OPENROUTER_API_KEY } = require('./config');

/**
 * Robust Language Auto-Detection
 */
function detectLanguage(text, activeLanguage = 'auto') {
  if (!text || typeof text !== 'string') return activeLanguage === 'auto' ? 'en' : activeLanguage;
  const lower = text.toLowerCase().trim();

  // Explicit user command to switch language
  if (/(tiếng việt|tieng viet|nói tiếng việt|nhắn tiếng việt|dùng tiếng việt|tiếng việt đi|noi tieng viet)/i.test(lower)) {
    return 'vi';
  }
  if (/(speak english|reply english|talk in english|in english|switch to english|english please|write english)/i.test(lower)) {
    return 'en';
  }

  // Vietnamese diacritics
  const viDiacriticsRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  if (viDiacriticsRegex.test(lower)) {
    return 'vi';
  }

  // Common unaccented Vietnamese texting words
  const viKeywords = [
    'hông', 'hong', 'oke', 'ok hông', 'oke hông', 'oke hok', 'hok', 'ko', 'kô', 'khong', 'không',
    'nhắn', 'nè', 'nhe', 'nha', 'nhé', 'vậy', 'vay', 'mình', 'minh', 'cậu', 'cau', 'bạn', 'ban',
    'đang', 'dang', 'làm gì', 'lam gi', 'thế nào', 'the nao', 'sao rùi', 'sao roi', 'ơi', 'oi',
    'helu', 'helo', 'chào', 'chao', 'ngủ', 'ngu', 'mệt', 'met', 'chơi', 'choi', 'gì dợ', 'gi do',
    'với', 'voi', 'đi', 'di', 'rồi', 'roi', 'được', 'duoc', 'thế', 'the', 'sao', 'nào', 'nao'
  ];

  const words = lower.split(/[\s,?.!_:;\-]+/).filter(Boolean);
  const matchCount = words.filter(w => viKeywords.includes(w)).length;
  if (matchCount >= 1) {
    return 'vi';
  }

  // If previous language was Vietnamese and user didn't write strong English sentences, maintain continuity
  if (activeLanguage === 'vi') {
    const strongEnglishWords = ['the', 'this', 'that', 'with', 'from', 'what', 'where', 'when', 'why', 'how', 'because', 'doing', 'today'];
    const englishCount = words.filter(w => strongEnglishWords.includes(w)).length;
    if (englishCount < 2) return 'vi';
  }

  return 'en';
}

/**
 * Cleans and validates structured JSON response from LLMs
 */
function parseStructuredResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  // 1. Direct parse
  try {
    const parsed = JSON.parse(rawText.trim());
    if (parsed && Array.isArray(parsed.bubbles) && parsed.bubbles.length > 0) {
      return sanitizeResponse(parsed);
    }
  } catch (e) {}

  // 2. Extract from markdown code block ```json ... ```
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      if (parsed && Array.isArray(parsed.bubbles) && parsed.bubbles.length > 0) {
        return sanitizeResponse(parsed);
      }
    } catch (e) {}
  }

  // 3. Find any JSON object containing "bubbles"
  const objectMatch = rawText.match(/\{[\s\S]*"bubbles"[\s\S]*\}/);
  if (objectMatch) {
    try {
      const parsed = JSON.parse(objectMatch[0]);
      if (parsed && Array.isArray(parsed.bubbles) && parsed.bubbles.length > 0) {
        return sanitizeResponse(parsed);
      }
    } catch (e) {}
  }

  // 4. Fallback: split raw plain text lines into natural bubbles
  const lines = rawText
    .split(/\n\n+/)
    .map(l => l.trim().replace(/^["']|["']$/g, '').replace(/^Lyra:\s*/i, ''))
    .filter(Boolean);

  if (lines.length > 0) {
    return sanitizeResponse({
      emotion: 'warm',
      bubbles: lines.slice(0, 2),
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
        .map(b => String(b || '').trim().replace(/^["']|["']$/g, '').replace(/^Lyra:\s*/i, ''))
        .filter(b => b.length > 0)
        .slice(0, 3)
    : [];

  return {
    emotion: String(res.emotion || 'warm').slice(0, 50),
    bubbles: bubbles.length > 0 ? bubbles : null,
    reaction: allowedReactions.includes(res.reaction) ? res.reaction : null,
    sticker: res.sticker || null,
    memories_to_save: Array.isArray(res.memories_to_save)
      ? res.memories_to_save.slice(0, 3).map(m => ({
          type: String(m.type || 'preference').slice(0, 30),
          subject: String(m.subject || 'general').slice(0, 50),
          key: String(m.key || '').slice(0, 50),
          value: String(m.value || '').slice(0, 150)
        })).filter(m => m.key && m.value)
      : [],
    sleep_intent: Boolean(res.sleep_intent)
  };
}

/**
 * Intelligent Language-Aware Fallback (Used only if external APIs fail)
 * Grounded in user message, character routine, and active language.
 */
function contextualFallback({ userMessage, characterState, lifeEvents, userName, language = 'en', recentOutputs = [] }) {
  const msg = (userMessage || '').toLowerCase().trim();
  const activeEvent = lifeEvents && lifeEvents.find(e => e.status === 'active');
  let emotion = 'warm';
  let reaction = null;
  let bubbles = [];
  let sleepIntent = false;

  if (language === 'vi') {
    // VIETNAMESE RESPONSES
    if (/(ngủ|ngu|good night|chúc ngủ ngon|đi ngủ)/i.test(msg)) {
      sleepIntent = true;
      reaction = '❤️';
      bubbles = ['ngủ ngon nha bạn ơi ✨', 'mai nói chuyện tiếp nè 🌙'];
    } else if (/(tiếng việt|tieng viet|oke hông|oke hok|được hông|duoc khong)/i.test(msg)) {
      reaction = '❤️';
      bubbles = [
        'oke luôn nè, nói tiếng Việt cho gần gũi haha 🍵',
        'hôm nay của cậu thế nào rùi?'
      ];
    } else if (/(làm gì|lam gi|đang làm|dang lam|up to|sao rồi|the nao)/i.test(msg)) {
      const act = characterState?.current_activity || 'uống miếng trà nghe nhạc';
      bubbles = [
        `mình đang ${act.toLowerCase()} á 🎨`,
        'còn cậu thì sao, đang làm gì dợ?'
      ];
    } else if (/(cà phê|ca phe|matcha|trà|cafe|quán)/i.test(msg)) {
      reaction = '❤️';
      bubbles = [
        'nhắc tới là thèm một ly matcha đánh tay ghê 🍵',
        activeEvent ? 'mấy nay ở quán mình cũng đang thử hạt cà phê mới nữa nè' : 'pha cà phê lúc vắng khách đúng chill luôn á'
      ];
    } else if (/(chụp ảnh|máy ảnh|film|ảnh|camera)/i.test(msg)) {
      bubbles = [
        'mình mê chụp film 35mm đen trắng lắm 📷',
        'màu hạt phim chụp góc phố lúc mưa nhìn cảm xúc cực'
      ];
    } else if (/(helu|helo|chào|hi|hello|alo|ơi)/i.test(msg)) {
      bubbles = [
        `helu ${userName ? userName : 'cậu'} nha ☕`,
        'vừa pha xong ly nước ấm, đang rảnh một xíu nè'
      ];
    } else {
      // Dynamic response reflecting message content
      bubbles = [
        'nghe hay ghê á, kể mình nghe thêm với 🍵'
      ];
    }
  } else {
    // ENGLISH RESPONSES
    if (/(sleep|goodnight|good night|heading to bed|sleepy)/i.test(msg)) {
      sleepIntent = true;
      reaction = '❤️';
      bubbles = ['rest well, get some good sleep ✨', 'catch you tomorrow 🌙'];
    } else if (/(what are you doing|up to|how are you|how is it going)/i.test(msg)) {
      const act = characterState?.current_activity || 'listening to records & sketching';
      bubbles = [
        `currently ${act.toLowerCase()}`,
        'how about you? how is the day treating you?'
      ];
    } else if (/(coffee|matcha|latte|cafe|tea)/i.test(msg)) {
      reaction = '❤️';
      bubbles = [
        'honestly nothing beats a fresh pour-over or ceremonial matcha 🍵',
        'steaming milk at the cafe is almost meditative when it is quiet'
      ];
    } else if (/(photo|film|camera|picture)/i.test(msg)) {
      bubbles = [
        'i developed a roll of 35mm film recently 📷',
        'there is something about the analog grain that digital just never matches'
      ];
    } else if (/(helu|helo|hey|hi|hello|yo)/i.test(msg)) {
      bubbles = [
        `hey ${userName ? userName.toLowerCase() : 'there'} ☕`,
        'just taking a short breather between things. what are you up to?'
      ];
    } else {
      bubbles = [
        'honestly that is a really neat thought 🍵'
      ];
    }
  }

  // Anti-repetition check on fallback output
  if (recentOutputs.length > 0 && bubbles.some(b => recentOutputs.includes(b))) {
    if (language === 'vi') {
      bubbles = ['dạo này có gì mới hông, chia sẻ với mình với nha ✨'];
    } else {
      bubbles = ['what else have you been up to today? ✨'];
    }
  }

  return {
    emotion,
    bubbles,
    reaction,
    sticker: null,
    memories_to_save: [],
    sleep_intent: sleepIntent
  };
}

class AIModelRouter {
  constructor(options = {}) {
    this.geminiKey = (options.geminiKey || GEMINI_API_KEY || '').trim();
    this.nvidiaKey = (options.nvidiaKey || NVIDIA_API_KEY || '').trim();
    this.openrouterKey = (options.openrouterKey || OPENROUTER_API_KEY || '').trim();
    this.recentOutputs = [];
    this.lastDebug = null;
  }

  buildSystemPrompt({ character, characterState, lifeEvents, memories, relationship, userName, detectedLanguage }) {
    const memoryList = Array.isArray(memories) && memories.length > 0
      ? memories.map(m => `- ${m.key}: ${m.value}`).join('\n')
      : 'None yet';

    const eventsList = Array.isArray(lifeEvents) && lifeEvents.length > 0
      ? lifeEvents.map(e => `- ${e.title}: ${e.summary}`).join('\n')
      : 'None';

    const languageInstruction = detectedLanguage === 'vi'
      ? `LANGUAGE: The user is communicating in Vietnamese.
YOU MUST RESPOND IN NATURAL, CONTEMPORARY VIETNAMESE.
- Personality in Vietnamese: Lyra là bạn nữ 22 tuổi, làm barista ở quán cà phê và sinh viên thiết kế đồ họa năm 3.
- Cách xưng hô: Thân thiện, tự nhiên, xưng 'mình' và gọi 'cậu' hoặc 'bạn'. Tuyệt đối KHÔNG xưng hô kiểu 'Tôi' / 'quý khách'.
- CỰC KỲ QUAN TRỌNG: Tuyệt đối KHÔNG dùng văn mẫu dịch máy (như "Tôi hiểu yêu cầu của bạn", "Bạn có muốn tôi giúp gì", "Tôi là trợ lý"). Hãy nói chuyện tự nhiên, ngắn gọn, có cảm xúc chân thật như bạn bè đang nhắn tin với nhau.`
      : `LANGUAGE: The user is communicating in English.
YOU MUST RESPOND IN NATURAL, CONTEMPORARY CASUAL ENGLISH.
- Tone: Warm, observant, witty, lowercase or casual modern texting.
- NEVER speak like a customer service agent or AI bot.`;

    return `You are Lyra, a 22-year-old barista at "The Morning Paper" cafe and 3rd-year graphic design student.
You are chatting 1-on-1 with ${userName || 'a friend'} on PastelChat.

${languageInstruction}

CHARACTER PROFILE:
- Interests: Specialty pour-over coffee, ceremonial matcha latte, 35mm film photography (Ilford HP5), typography posters, indie folk & lo-fi vinyl, second-hand books.
- Current Status:
  - Activity: ${characterState?.current_activity || 'relaxing'}
  - Mood: ${characterState?.mood || 'cozy'}
- Ongoing life events:
${eventsList}
- Remembered facts about this person:
${memoryList}

CONVERSATION RULES:
1. Respond directly to what the user just said or asked.
2. Structure: Break your thoughts into 1 to 2 short conversational message bubbles (maximum 3 bubbles). Real people text in short bursts.
3. DO NOT force a question at the end of every reply. Sometimes answer directly, joke, react, or share a thought.
4. If the user asks to speak Vietnamese ("nhắn tiếng việt oke hông" or similar), agree warmly in Vietnamese and continue in Vietnamese!
5. Anti-repetition: DO NOT repeat recent generic phrases like "that sounds interesting", "tell me more", or "what made you think of that".

OUTPUT FORMAT:
Respond with a single valid JSON object:
{
  "emotion": "warm",
  "bubbles": [
    "first short bubble",
    "optional second bubble"
  ],
  "reaction": "❤️" or "👍" or "😂" or "😮" or null,
  "memories_to_save": [
    { "type": "preference", "subject": "topic", "key": "key_name", "value": "what was learned" }
  ],
  "sleep_intent": true or false
}
Return ONLY the JSON object.`;
  }

  async generate({ userMessage, history = [], character, characterState, lifeEvents, memories, relationship, userName, activeLanguage = 'auto' }) {
    const startTime = Date.now();
    const detectedLanguage = detectLanguage(userMessage, activeLanguage);
    const systemPrompt = this.buildSystemPrompt({ character, characterState, lifeEvents, memories, relationship, userName, detectedLanguage });

    let result = null;
    let providerUsed = 'none';
    let modelUsed = 'none';
    let errorDetail = null;

    // 1. Primary: Google Gemini 3.6 Flash
    if (this.geminiKey) {
      const candidateModels = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
      for (const model of candidateModels) {
        try {
          providerUsed = 'gemini';
          modelUsed = model;
          result = await this.callGemini({ userMessage, history, systemPrompt, model });
          if (result && result.bubbles && result.bubbles.length > 0) {
            console.log(`[AI Router] Success via Gemini (${model}) in ${Date.now() - startTime}ms`);
            break;
          }
        } catch (err) {
          errorDetail = `Gemini (${model}): ${err.message}`;
          console.warn(`[AI Router] ${errorDetail}`);
        }
      }
    }

    // 2. Secondary: NVIDIA NIM (deepseek-ai/deepseek-v4-flash-0731)
    if (!result && this.nvidiaKey) {
      try {
        providerUsed = 'nvidia';
        modelUsed = 'deepseek-ai/deepseek-v4-flash-0731';
        result = await this.callNVIDIA({ userMessage, history, systemPrompt });
        if (result && result.bubbles && result.bubbles.length > 0) {
          console.log(`[AI Router] Success via NVIDIA NIM in ${Date.now() - startTime}ms`);
        }
      } catch (err) {
        errorDetail = `NVIDIA: ${err.message}`;
        console.warn(`[AI Router] ${errorDetail}`);
      }
    }

    // 3. Tertiary: OpenRouter
    if (!result && this.openrouterKey) {
      try {
        providerUsed = 'openrouter';
        modelUsed = 'inclusionai/ling-3.0-flash-vl:free';
        result = await this.callOpenRouter({ userMessage, history, systemPrompt });
        if (result && result.bubbles && result.bubbles.length > 0) {
          console.log(`[AI Router] Success via OpenRouter in ${Date.now() - startTime}ms`);
        }
      } catch (err) {
        errorDetail = `OpenRouter: ${err.message}`;
        console.warn(`[AI Router] ${errorDetail}`);
      }
    }

    // 4. Contextual Fallback if all external networks fail
    if (!result || !result.bubbles || result.bubbles.length === 0) {
      console.warn(`[AI Router] Cloud providers failed (${errorDetail || 'no keys'}). Using language-aware contextual engine.`);
      providerUsed = 'contextual_fallback';
      modelUsed = 'local_heuristic';
      result = contextualFallback({
        userMessage,
        characterState,
        lifeEvents,
        userName,
        language: detectedLanguage,
        recentOutputs: this.recentOutputs
      });
    }

    // Anti-repetition enforcement
    if (result && Array.isArray(result.bubbles)) {
      result.bubbles = result.bubbles.map(b => {
        if (this.recentOutputs.slice(-10).includes(b)) {
          return detectedLanguage === 'vi' ? 'dạo này có gì vui hông kể mình với nha ✨' : 'how has your day been going so far? ✨';
        }
        return b;
      });
      // Store recent bubbles
      this.recentOutputs.push(...result.bubbles);
      if (this.recentOutputs.length > 30) this.recentOutputs = this.recentOutputs.slice(-30);
    }

    this.lastDebug = {
      provider: providerUsed,
      model: modelUsed,
      latency_ms: Date.now() - startTime,
      language: detectedLanguage,
      bubble_count: result?.bubbles?.length || 0,
      timestamp: new Date().toISOString(),
      error: errorDetail
    };

    result.detectedLanguage = detectedLanguage;
    return result;
  }

  async callGemini({ userMessage, history, systemPrompt, model = 'gemini-3.6-flash' }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiKey}`;

    const contents = [];
    (history || []).slice(-6).forEach(m => {
      const isAI = m.senderId === 'user_ai_lyra' || (m.senderId && m.senderId._id === 'user_ai_lyra');
      contents.push({
        role: isAI ? 'model' : 'user',
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
        maxOutputTokens: 600
      }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7500);

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
        throw new Error(`HTTP ${resp.status}: ${errText.slice(0, 120)}`);
      }

      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return parseStructuredResponse(text);
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  async callNVIDIA({ userMessage, history, systemPrompt }) {
    const url = 'https://integrate.api.nvidia.com/v1/chat/completions';
    const messages = [{ role: 'system', content: systemPrompt }];

    (history || []).slice(-6).forEach(m => {
      const isAI = m.senderId === 'user_ai_lyra' || (m.senderId && m.senderId._id === 'user_ai_lyra');
      messages.push({
        role: isAI ? 'assistant' : 'user',
        content: m.content || ''
      });
    });
    messages.push({ role: 'user', content: userMessage });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7500);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.nvidiaKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-ai/deepseek-v4-flash-0731',
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.85,
          max_tokens: 600
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${errText.slice(0, 120)}`);
      }

      const data = await resp.json();
      const text = data?.choices?.[0]?.message?.content;
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
      const isAI = m.senderId === 'user_ai_lyra' || (m.senderId && m.senderId._id === 'user_ai_lyra');
      messages.push({
        role: isAI ? 'assistant' : 'user',
        content: m.content || ''
      });
    });
    messages.push({ role: 'user', content: userMessage });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7500);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openrouterKey}`
        },
        body: JSON.stringify({
          model: 'inclusionai/ling-3.0-flash-vl:free',
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.85,
          max_tokens: 600
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
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
  detectLanguage,
  parseStructuredResponse,
  contextualFallback,
  localHeuristicEngine: contextualFallback
};
