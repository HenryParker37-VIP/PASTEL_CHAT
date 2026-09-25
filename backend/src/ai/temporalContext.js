/**
 * Authoritative Runtime Temporal Context Engine
 * 
 * Provides dynamic, authoritative date, time, year, and timezone grounding
 * for every Lyra generation. Prevents model hallucinations of past years (e.g. 2023)
 * or invented locations, while ensuring temporal context never enters durable memory.
 */

function validTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return null;
  const trimmed = timeZone.trim();
  if (trimmed.length > 64) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: trimmed }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

function resolveAuthoritativeTemporalContext({
  now = new Date(),
  userTimeZone = null,
  customConfig = null,
  relationship = null
} = {}) {
  const resolvedNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();

  // 1. Authoritative User Timezone
  const resolvedUserTz = validTimeZone(userTimeZone) ||
    validTimeZone(relationship?.time_zone) ||
    validTimeZone(process.env.DEFAULT_TIMEZONE) ||
    'UTC';

  const userDateFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: resolvedUserTz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const userTimeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: resolvedUserTz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const userYearFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: resolvedUserTz,
    year: 'numeric'
  });

  const oneDayMs = 24 * 60 * 60 * 1000;
  const yesterday = new Date(resolvedNow.getTime() - oneDayMs);
  const tomorrow = new Date(resolvedNow.getTime() + oneDayMs);

  const userYear = userYearFmt.format(resolvedNow);
  const userDateString = userDateFmt.format(resolvedNow);
  const userTimeString = userTimeFmt.format(resolvedNow);
  const userYesterdayString = userDateFmt.format(yesterday);
  const userTomorrowString = userDateFmt.format(tomorrow);

  // 2. Lyra Timezone & Location (Explicit Character Studio Customization)
  let lyraContext = null;
  const configuredLyraTz = validTimeZone(customConfig?.timezone);
  if (configuredLyraTz) {
    const lyraLocation = customConfig?.location && typeof customConfig.location === 'string'
      ? customConfig.location.trim().slice(0, 100)
      : null;

    const lyraDateFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: configuredLyraTz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const lyraTimeFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: configuredLyraTz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const lyraYearFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: configuredLyraTz,
      year: 'numeric'
    });

    lyraContext = {
      hasConfiguredLocation: true,
      location: lyraLocation || configuredLyraTz,
      timeZone: configuredLyraTz,
      year: lyraYearFmt.format(resolvedNow),
      dateString: lyraDateFmt.format(resolvedNow),
      timeString: lyraTimeFmt.format(resolvedNow)
    };
  }

  const temporal = {
    now: resolvedNow,
    user: {
      timeZone: resolvedUserTz,
      year: userYear,
      dateString: userDateString,
      timeString: userTimeString,
      yesterdayString: userYesterdayString,
      tomorrowString: userTomorrowString
    },
    lyra: lyraContext
  };

  temporal.promptBlock = generateTemporalPromptBlock(temporal);
  return temporal;
}

function generateTemporalPromptBlock(temporal) {
  const u = temporal.user;
  const l = temporal.lyra;

  const lines = [
    '==================================================',
    'AUTHORITATIVE RUNTIME TEMPORAL CONTEXT:',
    '==================================================',
    `- Current Real-World Year: ${u.year}`,
    `- Current Real-World Date: ${u.dateString}`,
    `- User's Authoritative Timezone: ${u.timeZone}`,
    `- User's Current Local Time: ${u.timeString}`,
    `- Relative Day Mapping for User:`,
    `  * "yesterday" refers strictly to: ${u.yesterdayString}`,
    `  * "today" / "tonight" refers strictly to: ${u.dateString}`,
    `  * "tomorrow" refers strictly to: ${u.tomorrowString}`
  ];

  if (l) {
    lines.push(
      `- Lyra's Configured Remote Location: ${l.location || l.timeZone}`,
      `- Lyra's Configured Timezone: ${l.timeZone}`,
      `- Lyra's Current Local Date & Time: ${l.timeString}, ${l.dateString} (${l.timeZone})`,
      `- Timezone Rule: When the user asks "what time is it there?", "what time is it for you?", or asks about your local weather/city, answer naturally using your configured location (${l.location || l.timeZone}) and local time (${l.timeString}).`
    );
  } else {
    lines.push(
      `- Lyra's Location & Timezone: None configured. DO NOT invent a separate remote city or timezone for Lyra.`,
      `- Timezone Rule: You and the user share this conversation. When the user asks "what time is it?", answer naturally using their local time (${u.timeString}). If asked where you are, speak as a close friend chatting on Pastel Chat without fabricating an unconfigured remote city or timezone.`
    );
  }

  lines.push(
    '',
    'CRITICAL TEMPORAL RULES:',
    `1. The current year is strictly ${u.year}. NEVER infer the year from model pre-training data or guess 2023 or any past year.`,
    `2. All relative temporal expressions (today, tonight, tomorrow, yesterday, this morning, this evening) must align with the user's date (${u.dateString}).`,
    `3. Handle midnight rollover accurately: if it is late night or early morning, follow the date mapping above.`,
    `4. Keep temporal awareness natural and conversational. Never say "according to my runtime temporal context" or quote system clocks unless the user asked.`,
    `5. If the user asks a simple question like "what time is it?", answer warmly and directly (e.g. "It's around ${u.timeString} for you!").`,
    '=================================================='
  );

  return lines.join('\n');
}

/**
 * Checks whether text contains transient date/time assertions that must NEVER
 * become durable memories.
 */
function isTransientTemporalStatement(text, key = null) {
  if (!text || typeof text !== 'string') return false;
  if (key === 'birthday' || (typeof text === 'string' && text.startsWith('birthday'))) return false;
  const t = text.toLowerCase().replace(/_/g, ' ').trim();
  if (/\b(?:today is|tonight is|tomorrow is|yesterday was)\b/i.test(t)) return true;
  if (/\b(?:current year|the year is \d{4}|it is \d{4}|it's \d{4})\b/i.test(t)) return true;
  if (/\b(?:current time|current date|current year|clock time|today is)\b/i.test(t)) return true;
  if (/\b(?:it is|it's|the time is|currently)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|o'clock)?\b/i.test(t)) return true;
  if (/\b(?:what time is it|what is the date|what year is it)\b/i.test(t)) return true;
  return false;
}

module.exports = {
  validTimeZone,
  resolveAuthoritativeTemporalContext,
  isTransientTemporalStatement
};
