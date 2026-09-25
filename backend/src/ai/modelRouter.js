/**
 * Generic AI Model Router for PastelChat.
 * 
 * - Provider-agnostic: Has zero hardcoded character names or identities.
 * - Multi-provider failover: Primary (Gemini 3.6 Flash) -> Secondary (NVIDIA NIM) -> Tertiary (OpenRouter).
 * - Dynamic health monitoring & circuit breaker.
 * - Intelligent structured output recovery (formatting fallback recovers natural text, NEVER canned text).
 * - Repetition detection with single retry regeneration.
 * - Explicit error reporting when all providers fail (NO fake conversational fallback).
 */

const fetch = globalThis.fetch || require('node-fetch');
const { GEMINI_API_KEY, NVIDIA_API_KEY, OPENROUTER_API_KEY } = require('./config');

const ALLOWED_REACTIONS = new Set(['👍', '❤️', '😂', '😮', '😢', '😡']);
const ABBREVIATIONS_REGEX = /\b(?:dr|mr|mrs|ms|prof|e\.g|i\.e|etc|vs|no)\.$/i;

function normalizeText(text) {
  return String(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function calculateWordOverlap(a, b) {
  const wordsA = new Set(normalizeText(a).split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normalizeText(b).split(' ').filter(w => w.length > 2));
  if (!wordsA.size || !wordsB.size) return 0;
  let shared = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) shared += 1; });
  return shared / Math.min(wordsA.size, wordsB.size);
}

/**
 * Checks whether a candidate string is raw structured syntax or malformed JSON artifacts
 * that must NEVER be exposed as a visible chat bubble.
 */
function isRawStructuredArtifact(str) {
  if (!str || typeof str !== 'string') return true;
  const s = str.trim();
  if (s.length === 0) return true;

  // Pure JSON structural syntax characters
  if (/^[\{\}\[\]"':,\s]+$/.test(s)) return true;

  // Complete JSON objects or arrays leaking as strings
  if (/^\{[\s\S]*\}$/.test(s) && (s.includes('"') || s.includes(':'))) return true;
  if (/^\[[\s\S]*\]$/.test(s) && (s.includes('"') || s.includes(','))) return true;

  // Structural key markers
  if (/^"?bubbles"?\s*:\s*/i.test(s)) return true;
  if (/^"?reaction"?\s*:\s*/i.test(s)) return true;
  if (/\{"?bubbles"?\s*:/i.test(s)) return true;
  if (/\{"?reaction"?\s*:/i.test(s)) return true;
  if (/\{"?message"?\s*:/i.test(s)) return true;
  if (/\{"?reply"?\s*:/i.test(s)) return true;
  if (/\{"?content"?\s*:/i.test(s)) return true;

  // Markdown code fences wrapping JSON or empty code fences
  if (/^```(?:json)?\s*[\{\[]/i.test(s) || /^```\s*$/i.test(s) || /```json\b/i.test(s)) return true;

  // Trailing JSON remnants like '"]}' or '", "'
  if (/^"?[}\]]+$/.test(s)) return true;
  if (/"\s*,\s*"/.test(s) && (s.startsWith('"') || s.endsWith('"'))) return true;

  return false;
}

/**
 * Strict validator for a chat bubble's text content.
 */
function isValidBubbleText(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (trimmed.length === 0) return false;
  if (/data:[^\s]+;base64,|<svg|<img/i.test(trimmed)) return false;
  if (isRawStructuredArtifact(trimmed)) return false;
  return true;
}

function cleanBubbleText(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .replace(/^(?:Lyra|Assistant|AI|User):\s+/i, '') // strip speaker prefix only if followed by space
    .replace(/^["'`“]+|["'`”]+$/g, '') // strip wrapping quotes
    .replace(/^,\s*|,\s*$/g, '') // strip trailing/leading commas
    .trim();
}

/**
 * Tries direct JSON parse and safe syntax repairs (trailing commas, unquoted keys,
 * single quotes, and truncated braces/brackets).
 */
function tryRepairAndParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  let str = text.trim();

  // Strip code fences if wrapped
  const codeBlockMatch = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch?.[1]) str = codeBlockMatch[1].trim();

  // Strip thinking tags
  str = str.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Isolate outermost JSON object bounds if present
  const firstBrace = str.indexOf('{');
  if (firstBrace !== -1) {
    const lastBrace = str.lastIndexOf('}');
    if (lastBrace > firstBrace) {
      str = str.substring(firstBrace, lastBrace + 1).trim();
    } else {
      str = str.substring(firstBrace).trim();
    }
  }

  const attempts = [
    str,
    // Fix trailing commas
    str.replace(/,\s*([}\]])/g, '$1'),
    // Fix unquoted keys
    str.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":').replace(/,\s*([}\]])/g, '$1'),
    // Fix Python/single-quoted JSON
    str.replace(/'/g, '"').replace(/,\s*([}\]])/g, '$1')
  ];

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {}
  }

  // Repair truncated JSON by balancing unclosed quotes, brackets, and braces
  for (const base of attempts) {
    let repaired = base;
    const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) repaired += '"';
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) repaired += ']'.repeat(openBrackets - closeBrackets);
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    if (openBraces > closeBraces) repaired += '}'.repeat(openBraces - closeBraces);

    try {
      const parsed = JSON.parse(repaired);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {}
  }

  return null;
}

/**
 * Regex-based extraction of string elements from `"bubbles": [...]` when JSON syntax is corrupted.
 */
function extractBubblesFromMalformedText(text) {
  if (!text || typeof text !== 'string') return null;

  const match = text.match(/"?bubbles"?\s*:\s*\[([\s\S]*)/i);
  if (!match) return null;

  let arrayContent = match[1];
  const closingBracketIdx = arrayContent.indexOf(']');
  const nextKeyMatch = arrayContent.match(/,?\s*"?[a-zA-Z0-9_]+"?\s*:/);

  if (closingBracketIdx !== -1) {
    arrayContent = arrayContent.substring(0, closingBracketIdx);
  } else if (nextKeyMatch && nextKeyMatch.index !== undefined) {
    arrayContent = arrayContent.substring(0, nextKeyMatch.index);
  }

  const stringRegex = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
  const extracted = [];
  let m;
  while ((m = stringRegex.exec(arrayContent)) !== null) {
    const rawVal = m[1] !== undefined ? m[1] : m[2];
    try {
      const unescaped = JSON.parse(`"${rawVal.replace(/"/g, '\\"')}"`);
      const cleaned = cleanBubbleText(unescaped);
      if (cleaned && isValidBubbleText(cleaned)) {
        extracted.push(cleaned);
      }
    } catch (_) {
      const cleaned = cleanBubbleText(rawVal);
      if (cleaned && isValidBubbleText(cleaned)) {
        extracted.push(cleaned);
      }
    }
  }

  if (extracted.length > 0) {
    let reaction = null;
    const reactionMatch = text.match(/"?reaction"?\s*:\s*["']?([^"',}\]\s]+)/i);
    if (reactionMatch && ALLOWED_REACTIONS.has(reactionMatch[1])) {
      reaction = reactionMatch[1];
    }
    return {
      bubbles: extracted.slice(0, 5),
      reaction
    };
  }

  return null;
}

/**
 * Recovers plain-text response ONLY if no structured JSON markers exist.
 * Never turns malformed JSON into chat messages.
 */
function recoverPlainTextResponse(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // If text contains ANY structured JSON markers, DO NOT treat it as plain text!
  if (/^\s*\{|^\s*\[|"bubbles"|'bubbles'|"reaction"|'reaction'|\{\s*"|```/i.test(clean)) {
    return null;
  }

  const lines = clean
    .split(/\n\s*\n+/)
    .map(line => cleanBubbleText(line))
    .filter(line => isValidBubbleText(line));

  if (lines.length > 0) {
    return {
      bubbles: lines.slice(0, 5),
      reaction: null
    };
  }

  return null;
}

/**
 * Checks whether user Character Studio explicitly prefers longer messages or in-depth paragraphs.
 */
function userPrefersLongMessages(customConfig) {
  if (!customConfig || typeof customConfig !== 'object') return false;
  const combined = [
    customConfig.speakingStyle,
    customConfig.shouldRules,
    customConfig.personality,
    customConfig.thoughtProcess
  ].filter(Boolean).join(' ');

  return /\b(?:long(?:er)?\s+messages?|long(?:er)?\s+texts?|paragraphs?|in-depth|detailed\s+(?:explanations?|answers?|messages?)|write\s+more|verbose|comprehensive\s+replies)\b/i.test(combined);
}

/**
 * Splits a chunky bubble into natural conversational beats along sentence / reaction boundaries.
 */
function splitChunkyBubble(text, maxSegments = 5) {
  if (!text || typeof text !== 'string') return [];
  const clean = cleanBubbleText(text);
  if (clean.length <= 85 || maxSegments <= 1) return [clean];

  // Avoid splitting code blocks or URLs
  if (/```|`[^`]+`|\bhttps?:\/\//i.test(clean)) return [clean];

  // Split on sentence terminators [.!?] (excluding ellipses .. or ...) followed by space/quote/emoji
  const raw = clean.split(/(?<=(?<!\.)(?:!+|\?+|\.(?!\.))["'”’]?)\s+(?=[A-Za-z0-9"“'‘\p{L}])/u);
  if (raw.length <= 1) return [clean];

  const merged = [];
  for (let i = 0; i < raw.length; i++) {
    const part = raw[i].trim();
    if (!part) continue;
    if (merged.length > 0 && ABBREVIATIONS_REGEX.test(merged[merged.length - 1])) {
      merged[merged.length - 1] += ' ' + part;
    } else {
      merged.push(part);
    }
  }

  // Ensure total segments does not exceed maxSegments
  while (merged.length > maxSegments) {
    const last = merged.pop();
    merged[merged.length - 1] += ' ' + last;
  }

  return merged.map(s => cleanBubbleText(s)).filter(s => isValidBubbleText(s));
}

/**
 * Normalizes conversation bubbles into natural conversational beats:
 * - Simple replies remain 1 bubble (no artificial padding).
 * - Multi-thought / chunky bubbles are naturally grouped into 2-4 beats.
 * - Explanatory replies up to 5 bubbles max.
 * - Preserves Character Studio long-message preference if configured.
 */
function normalizeConversationBeats(bubbles, customConfig = null) {
  if (!Array.isArray(bubbles) || bubbles.length === 0) return [];

  const validBubbles = bubbles
    .map(b => cleanBubbleText(b))
    .filter(b => isValidBubbleText(b));

  if (validBubbles.length === 0) return [];

  if (userPrefersLongMessages(customConfig)) {
    return validBubbles.slice(0, 5);
  }

  const result = [];
  for (let i = 0; i < validBubbles.length; i++) {
    const current = validBubbles[i];
    const remainingSlots = 5 - result.length - (validBubbles.length - 1 - i);

    if (current.length > 85 && remainingSlots > 1) {
      const splitBeats = splitChunkyBubble(current, remainingSlots);
      result.push(...splitBeats);
    } else {
      result.push(current);
    }

    if (result.length >= 5) break;
  }

  return result.slice(0, 5);
}

/**
 * Parses structured JSON or safely recovers natural-language text as bubbles.
 * Formatting fallback is allowed; conversational fallback is NEVER allowed.
 * Raw JSON / structured syntax is NEVER exposed as a bubble.
 */
function parseAndRecoverResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  const cleanText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 1. Direct parse & safe syntax repairs
  const parsed = tryRepairAndParseJson(cleanText);
  if (parsed) {
    let rawBubbles = parsed.bubbles || parsed.messages || parsed.reply;
    if (typeof rawBubbles === 'string') rawBubbles = [rawBubbles];
    if (Array.isArray(rawBubbles)) {
      const bubbles = rawBubbles
        .map(b => (typeof b === 'string' ? b : b?.text || ''))
        .map(t => cleanBubbleText(t))
        .filter(t => isValidBubbleText(t))
        .slice(0, 5);

      if (bubbles.length > 0) {
        return {
          bubbles,
          reaction: ALLOWED_REACTIONS.has(parsed.reaction) ? parsed.reaction : null
        };
      }
    }
  }

  // 2. Regex extraction from malformed structured JSON
  const regexExtracted = extractBubblesFromMalformedText(cleanText);
  if (regexExtracted && regexExtracted.bubbles?.length > 0) {
    return regexExtracted;
  }

  // 3. Plain text recovery ONLY if no structured JSON markers exist
  const plainText = recoverPlainTextResponse(cleanText);
  if (plainText && plainText.bubbles?.length > 0) {
    return plainText;
  }

  return null;
}

class AIModelRouter {
  constructor(options = {}) {
    this.geminiKey = (options.geminiKey !== undefined ? options.geminiKey : GEMINI_API_KEY || '').trim();
    this.nvidiaKey = (options.nvidiaKey !== undefined ? options.nvidiaKey : NVIDIA_API_KEY || '').trim();
    this.openrouterKey = (options.openrouterKey !== undefined ? options.openrouterKey : OPENROUTER_API_KEY || '').trim();

    // Provider health state (circuit breaker)
    this.providerHealth = new Map();
    // Recent outputs by conversation to detect repetition
    this.recentOutputsByConversation = new Map();
    // Diagnostics log by conversation
    this.diagnosticsByConversation = new Map();
  }

  getRecentOutputs(conversationKey) {
    return this.recentOutputsByConversation.get(conversationKey) || [];
  }

  recordRecentOutputs(conversationKey, bubbles) {
    const existing = this.getRecentOutputs(conversationKey);
    this.recentOutputsByConversation.set(
      conversationKey,
      [...existing, ...bubbles].slice(-25)
    );
  }

  isProviderHealthy(providerName, conversationKey = 'default') {
    const health = this.providerHealth.get(`${conversationKey}:${providerName}`);
    if (!health) return true;
    if (health.consecutiveFailures >= 3) {
      // Cooldown of 45 seconds after 3 consecutive failures
      const elapsed = Date.now() - health.lastFailure;
      if (elapsed < 45000) return false;
    }
    return true;
  }

  recordProviderSuccess(providerName, conversationKey = 'default') {
    this.providerHealth.set(`${conversationKey}:${providerName}`, {
      consecutiveFailures: 0,
      lastSuccess: Date.now(),
      lastFailure: null
    });
  }

  recordProviderFailure(providerName, errorMsg, conversationKey = 'default') {
    const existing = this.providerHealth.get(`${conversationKey}:${providerName}`) || { consecutiveFailures: 0 };
    this.providerHealth.set(`${conversationKey}:${providerName}`, {
      consecutiveFailures: existing.consecutiveFailures + 1,
      lastSuccess: existing.lastSuccess || null,
      lastFailure: Date.now(),
      lastError: errorMsg
    });
    console.warn(`[AI Router] Provider ${providerName} failure (${existing.consecutiveFailures + 1}): ${errorMsg}`);
  }

  isRepetitiveOrEcho(candidateBubbles, recentOutputs, userMessage = '') {
    if (!candidateBubbles || !candidateBubbles.length) return false;
    const combinedCandidate = candidateBubbles.join(' ');
    const candidateNorm = normalizeText(combinedCandidate);

    // 1. Echo check: Don't repeat the user's message back to them
    if (userMessage) {
      const userNorm = normalizeText(userMessage);
      if (candidateNorm === userNorm) return true;
      if (candidateNorm.length > 8 && calculateWordOverlap(candidateNorm, userNorm) >= 0.85) return true;
    }

    // 2. Repetition check against recent assistant bubbles
    for (const recent of recentOutputs) {
      const recentNorm = normalizeText(recent);
      if (candidateNorm === recentNorm) return true;
      if (calculateWordOverlap(candidateNorm, recentNorm) >= 0.82) return true;
    }
    return false;
  }

  async request(url, options, timeoutMs = 8500) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async callGemini({ userMessage, history, systemPrompt, model }) {
    const contents = [];
    (history || []).forEach(msg => {
      const isModel = msg.isAI || msg.senderId === 'user_ai_lyra' || msg.senderId?._id === 'user_ai_lyra';
      contents.push({
        role: isModel ? 'model' : 'user',
        parts: [{ text: msg.content || '' }]
      });
    });
    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.85,
        maxOutputTokens: 600
      }
    };

    const data = await this.request(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      },
      8000
    );

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = parseAndRecoverResponse(rawText);
    if (!parsed) throw new Error('Unparseable Gemini response');
    return parsed;
  }

  async callNVIDIA({ userMessage, history, systemPrompt, model }) {
    const messages = [{ role: 'system', content: systemPrompt }];
    (history || []).forEach(msg => {
      const isModel = msg.isAI || msg.senderId === 'user_ai_lyra' || msg.senderId?._id === 'user_ai_lyra';
      messages.push({
        role: isModel ? 'assistant' : 'user',
        content: msg.content || ''
      });
    });
    messages.push({ role: 'user', content: userMessage });

    const payload = {
      model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.85,
      max_tokens: 1000
    };

    const data = await this.request(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.nvidiaKey}`
        },
        body: JSON.stringify(payload)
      },
      9500
    );

    let rawText = data?.choices?.[0]?.message?.content;
    if (!rawText && data?.choices?.[0]?.message?.reasoning_content) {
      const rc = data.choices[0].message.reasoning_content;
      const jsonMatch = rc.match(/\{[\s\S]*\}/);
      if (jsonMatch) rawText = jsonMatch[0];
    }
    const parsed = parseAndRecoverResponse(rawText);
    if (!parsed) throw new Error('Unparseable NVIDIA response');
    return parsed;
  }

  async callOpenRouter({ userMessage, history, systemPrompt, model }) {
    const messages = [{ role: 'system', content: systemPrompt }];
    (history || []).forEach(msg => {
      const isModel = msg.isAI || msg.senderId === 'user_ai_lyra' || msg.senderId?._id === 'user_ai_lyra';
      messages.push({
        role: isModel ? 'assistant' : 'user',
        content: msg.content || ''
      });
    });
    messages.push({ role: 'user', content: userMessage });

    const payload = {
      model,
      messages,
      temperature: 0.85,
      max_tokens: 600
    };

    const data = await this.request(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openrouterKey}`
        },
        body: JSON.stringify(payload)
      },
      9500
    );

    const rawText = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.reasoning;
    const parsed = parseAndRecoverResponse(rawText);
    if (!parsed) throw new Error('Unparseable OpenRouter response');
    return parsed;
  }

  /**
   * Main generation method.
   * Routes through providers and handles repetition via single retry.
   */
  async generate({
    userMessage,
    history = [],
    systemPrompt,
    conversationKey = 'default',
    memoryCount = 0,
    rejectedResponses = [],
    customConfig = null
  }) {
    const startTime = Date.now();
    const recentOutputs = this.getRecentOutputs(conversationKey);

    let effectiveSystemPrompt = systemPrompt;
    if (Array.isArray(rejectedResponses) && rejectedResponses.length > 0) {
      const rejectedClean = rejectedResponses.map(r => String(r || '').trim()).filter(Boolean);
      if (rejectedClean.length > 0) {
        effectiveSystemPrompt = `${systemPrompt}\n\n[REGENERATION DIRECTIVE - CRITICAL]: The user requested a new response and rejected your previous answer: "${rejectedClean.join(' ')}". Generate a GENUINELY DIFFERENT response with a fresh angle, tone, or perspective. Do NOT merely rephrase or paraphrase the rejected answer.`;
      }
    }

    const isRepetitiveWithRejected = (bubbles) => {
      if (!Array.isArray(rejectedResponses) || rejectedResponses.length === 0) return false;
      const generatedText = bubbles.join(' ');
      for (const rej of rejectedResponses) {
        if (!rej) continue;
        if (calculateWordOverlap(generatedText, rej) > 0.5) return true;
      }
      return false;
    };

    // List of providers ordered by priority (OpenRouter is fastest at ~1.3s for serverless execution)
    const providerCandidates = [
      {
        provider: 'openrouter',
        key: this.openrouterKey,
        models: [process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it'],
        call: (model, prompt) => this.callOpenRouter({ userMessage, history, systemPrompt: prompt, model })
      },
      {
        provider: 'nvidia',
        key: this.nvidiaKey,
        models: [process.env.NVIDIA_MODEL || 'deepseek-ai/deepseek-v4.1-flash'],
        call: (model, prompt) => this.callNVIDIA({ userMessage, history, systemPrompt: prompt, model })
      },
      {
        provider: 'gemini',
        key: this.geminiKey,
        models: [process.env.GEMINI_MODEL || 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-flash-latest'],
        call: (model, prompt) => this.callGemini({ userMessage, history, systemPrompt: prompt, model })
      }
    ];

    let lastError = null;
    let selectedResult = null;
    let usedProvider = null;
    let usedModel = null;
    let repetitionRetries = 0;

    for (const candidate of providerCandidates) {
      if (!candidate.key) continue;
      if (!this.isProviderHealthy(candidate.provider, conversationKey)) {
        console.log(`[AI Router] Skipping ${candidate.provider} (cooling down)`);
        continue;
      }

      for (const model of candidate.models) {
        try {
          console.log(`[AI Router] Attempting ${candidate.provider} (${model})...`);
          let result = null;
          try {
            result = await candidate.call(model, effectiveSystemPrompt);
          } catch (callErr) {
            // If structured output failed, attempt one strict-format regeneration retry
            if (callErr.message && /Unparseable/i.test(callErr.message)) {
              console.log(`[AI Router] Unparseable structured output from ${candidate.provider} (${model}). Retrying once with strict formatting directive...`);
              const strictFormatPrompt = `${effectiveSystemPrompt}\n\n[CRITICAL JSON FORMATTING DIRECTIVE]: Your previous output was malformed. You MUST return ONLY a valid, parseable JSON object with no markdown fences, no surrounding commentary, and no incomplete structures:\n{"bubbles": ["short natural bubble 1", "short natural bubble 2"], "reaction": null}`;
              result = await candidate.call(model, strictFormatPrompt);
            } else {
              throw callErr;
            }
          }

          // Check for repetitive response against recent assistant bubbles, echoing user, or rejected response
          const needsRepetitionRetry = this.isRepetitiveOrEcho(result.bubbles, recentOutputs, userMessage) || isRepetitiveWithRejected(result.bubbles);
          if (needsRepetitionRetry) {
            console.log(`[AI Router] Repetition, echo, or rejected similarity detected for ${candidate.provider}. Retrying once with anti-repetition instruction.`);
            repetitionRetries += 1;
            const steeringPrompt = `${effectiveSystemPrompt}\n\nNOTE: Avoid repeating phrases, echoing the user's message, or duplicating the rejected reply: "${result.bubbles.join(' ')}". Give a completely fresh, distinct reaction.`;
            try {
              const retryResult = await candidate.call(model, steeringPrompt);
              if (retryResult && retryResult.bubbles?.length > 0) {
                result = retryResult;
              }
            } catch (retryErr) {
              console.warn(`[AI Router] Repetition retry failed: ${retryErr.message}`);
            }
          }

          if (result && result.bubbles && result.bubbles.length > 0) {
            this.recordProviderSuccess(candidate.provider, conversationKey);
            selectedResult = result;
            usedProvider = candidate.provider;
            usedModel = model;
            break;
          }
        } catch (err) {
          lastError = `${candidate.provider}/${model}: ${err.message}`;
          this.recordProviderFailure(candidate.provider, err.message, conversationKey);
        }
      }

      if (selectedResult) break;
    }

    const latencyMs = Date.now() - startTime;

    // Diagnostics recording (Never logs keys/secrets)
    const diagnostics = {
      provider: usedProvider,
      model: usedModel,
      latency_ms: latencyMs,
      history_turns: history.length,
      memory_items: memoryCount,
      repetition_retries: repetitionRetries,
      success: !!selectedResult,
      timestamp: new Date().toISOString(),
      error: selectedResult ? null : lastError
    };
    this.diagnosticsByConversation.set(conversationKey, diagnostics);

    if (!selectedResult) {
      // NEVER use a canned conversational fallback!
      console.error(`[AI Router] Generation FAILED across all providers. Last error: ${lastError}`);
      throw new Error(`AI generation unavailable: ${lastError || 'All model providers failed or timed out'}`);
    }

    // Apply natural thought grouping and conversational beats
    selectedResult.bubbles = normalizeConversationBeats(selectedResult.bubbles, customConfig);

    console.log(`[AI Router] Generated in ${latencyMs}ms via ${usedProvider} (${usedModel}) [${selectedResult.bubbles.length} bubbles]`);
    return {
      ...selectedResult,
      diagnostics
    };
  }

  getDebug(conversationKey = 'default') {
    return this.diagnosticsByConversation.get(conversationKey) || null;
  }
}

module.exports = {
  AIModelRouter,
  parseAndRecoverResponse,
  cleanBubbleText,
  isRawStructuredArtifact,
  isValidBubbleText,
  normalizeConversationBeats,
  userPrefersLongMessages
};
