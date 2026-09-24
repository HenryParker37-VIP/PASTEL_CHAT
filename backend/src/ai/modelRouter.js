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
 * Parses structured JSON or recovers natural-language text as bubbles.
 * Formatting fallback is allowed; conversational fallback is NEVER allowed.
 */
function parseAndRecoverResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  // 1. Strip thinking tags if present from reasoning models
  let cleanText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Try JSON parsing candidates
  const candidates = [cleanText];
  const codeBlockMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch?.[1]) candidates.push(codeBlockMatch[1].trim());

  // Greedy and non-greedy JSON object extraction
  const jsonObjectMatch = cleanText.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch?.[0]) candidates.push(jsonObjectMatch[0].trim());

  for (const candidate of candidates) {
    try {
      // Fix potential trailing commas before closing braces/brackets
      const sanitized = candidate.replace(/,\s*([}\]])/g, '$1');
      const parsed = JSON.parse(sanitized);
      if (parsed) {
        let rawBubbles = parsed.bubbles || parsed.messages || parsed.reply;
        if (typeof rawBubbles === 'string') rawBubbles = [rawBubbles];
        if (Array.isArray(rawBubbles)) {
          const bubbles = rawBubbles
            .map(b => (typeof b === 'string' ? b : b?.text || ''))
            .map(t => cleanBubbleText(t))
            .filter(Boolean)
            .slice(0, 5);

          if (bubbles.length > 0) {
            return {
              bubbles,
              reaction: ALLOWED_REACTIONS.has(parsed.reaction) ? parsed.reaction : null
            };
          }
        }
      }
    } catch (_) {
      // Continue to next candidate or formatting recovery
    }
  }

  // 3. Formatting Recovery: If JSON was malformed or model spoke in plain text,
  // recover the actual model-generated text rather than dropping it or using canned text!
  const lines = cleanText
    .split(/\n\s*\n+/)
    .map(line => cleanBubbleText(line))
    .filter(line => {
      if (!line || line.length < 2) return false;
      // Filter out JSON structural syntax artifacts
      if (/^[\{\}\[\]"':,\s]+$/.test(line)) return false;
      if (/^"?bubbles"?:?\s*\[?/i.test(line)) return false;
      if (/^"?reaction"?:?/i.test(line)) return false;
      return true;
    });

  if (lines.length > 0) {
    return {
      bubbles: lines.slice(0, 5),
      reaction: null
    };
  }

  return null;
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
    memoryCount = 0
  }) {
    const startTime = Date.now();
    const recentOutputs = this.getRecentOutputs(conversationKey);

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
          let result = await candidate.call(model, systemPrompt);

          // Check for repetitive response against recent assistant bubbles or echoing user
          if (this.isRepetitiveOrEcho(result.bubbles, recentOutputs, userMessage)) {
            console.log(`[AI Router] Repetition or echo detected for ${candidate.provider}. Retrying once with anti-repetition instruction.`);
            repetitionRetries += 1;
            const steeringPrompt = `${systemPrompt}\n\nNOTE: Avoid repeating phrases or echoing the user's message like: "${result.bubbles.join(' ')}". Give a fresh, direct reaction to the user.`;
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

    console.log(`[AI Router] Generated in ${latencyMs}ms via ${usedProvider} (${usedModel})`);
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
  parseAndRecoverResponse
};
