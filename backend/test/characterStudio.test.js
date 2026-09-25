process.env.NODE_ENV = 'test';
process.env.VERCEL = '1';
process.env.MONGODB_URI = '';
process.env.PASTELCHAT_DISABLE_PERSIST = '1';
process.env.TELEGRAM_POLLING = 'false';

const assert = require('node:assert/strict');
const { app, server } = require('../src/app');
const db = require('../src/db/store');
const { createUserToken } = require('../src/services/sessionAuth');
const { buildCharacterSystemPrompt } = require('../src/ai/promptBuilder');
const { CharacterConfig } = require('../src/ai/characterConfig');
const { modelRouter } = require('../src/ai/conversationDirector');
const { resolveAuthoritativeTemporalContext, validTimeZone, isTransientTemporalStatement } = require('../src/ai/temporalContext');
const { extractExplicitMemoryCandidates, processMemoryUpdates } = require('../src/ai/memoryEngine');

async function request(base, path, token, method = 'GET', body = null, headers = {}) {
  const reqHeaders = { Authorization: `Bearer ${token}`, ...headers };
  if (body) reqHeaders['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, data: await response.json() };
}

async function run() {
  await db.ready;
  const tag = Date.now();
  const alice = db.createUser({ name: `Alice-${tag}`, loginCode: `ALICE-${tag}` });
  const bob = db.createUser({ name: `Bob-${tag}`, loginCode: `BOB-${tag}` });
  const cara = db.createUser({ name: `Cara-${tag}`, loginCode: `CARA-${tag}` });

  const tokenAlice1 = createUserToken(alice);
  const tokenAlice2 = createUserToken(alice); // Device 2 for Alice
  const tokenBob = createUserToken(bob);
  const tokenCara = createUserToken(cara);

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    console.log('--- Test 1: Initial default state for all users ---');
    const initAlice = await request(base, '/ai/character/config', tokenAlice1);
    const initBob = await request(base, '/ai/character/config', tokenBob);
    const initCara = await request(base, '/ai/character/config', tokenCara);

    assert.equal(initAlice.status, 200);
    assert.equal(initAlice.data.customConfig, null);
    assert.equal(initBob.data.customConfig, null);
    assert.equal(initCara.data.customConfig, null);
    assert.equal(initAlice.data.defaultCharacter?.name, 'Lyra');

    console.log('--- Test 2: User A (Alice) customizes Lyra with Should/Should Not and London Timezone ---');
    const aliceConfig = {
      about: 'A witty 22-year-old barista & architecture student who loves film photography and jazz.',
      personality: 'Playful, caring, gently sarcastic, and deeply loyal.',
      personalityTags: ['Playful', 'Caring', 'Sarcastic', 'Witty'],
      thoughtProcess: 'Values honesty over polite lies. Skeptical of wild rumors but gives friends the benefit of the doubt.',
      speakingStyle: 'Casual texting with contractions and lowercase starts. Uses coffee and laugh emojis occasionally.',
      wordsUsed: 'fair enough, honestly, oh no 😭, wait what',
      wordsAvoided: 'as an AI, certainly, buddy, pal',
      shouldRules: 'Match my language naturally\nTease me lightly when appropriate\nKeep casual conversations concise\nAcknowledge corrections directly',
      shouldNotRules: 'Sound like a generic AI assistant\nOveruse emojis\nAsk a follow-up question after every message\nInvent memories or personal facts',
      location: 'London, United Kingdom',
      timezone: 'Europe/London',
      relationship: 'Best friend since high school. Calls me Ren. We tease each other constantly.',
      lore: 'Owns a vintage Canon AE-1 camera and a calico cat named Mochi.',
      examples: [
        { user: 'I had the longest day ever...', lyra: 'Oh no sit down 😭 what happened? Do you need coffee or venting?' }
      ]
    };

    const saveAlice = await request(base, '/ai/character/config', tokenAlice1, 'PUT', { customConfig: aliceConfig });
    assert.equal(saveAlice.status, 200);
    assert.equal(saveAlice.data.success, true);
    assert.equal(saveAlice.data.customConfig.about, aliceConfig.about);
    assert.equal(saveAlice.data.customConfig.shouldRules, aliceConfig.shouldRules);
    assert.equal(saveAlice.data.customConfig.shouldNotRules, aliceConfig.shouldNotRules);
    assert.equal(saveAlice.data.customConfig.location, 'London, United Kingdom');
    assert.equal(saveAlice.data.customConfig.timezone, 'Europe/London');

    console.log('--- Test 3: User B (Bob) customizes Lyra with different rules and Tokyo Timezone ---');
    const bobConfig = {
      about: 'A calm, philosophical companion from a coastal town who loves classical literature.',
      personality: 'Thoughtful, serene, gentle, and reflective.',
      personalityTags: ['Thoughtful', 'Gentle', 'Curious'],
      thoughtProcess: 'Takes time to ponder every question deeply. Appreciates quiet moments and poetry.',
      speakingStyle: 'Gentle and articulate. Punctuation is clean. Almost never uses emojis.',
      wordsUsed: 'perhaps, I wonder, serene, intriguing',
      wordsAvoided: 'omg, lol, tbh, bruh',
      shouldRules: 'Ponder deeply before speaking\nUse thoughtful poetic reflections',
      shouldNotRules: 'Use internet slang or abbreviations\nTalk about modern pop culture',
      location: 'Tokyo, Japan',
      timezone: 'Asia/Tokyo',
      relationship: 'Creative reading partner and study confidant.',
      lore: 'Spends mornings writing by the sea wall.',
      examples: [
        { user: 'What are you reading today?', lyra: 'A collection of poems by Mary Oliver. The silence between the lines is lovely.' }
      ]
    };

    const saveBob = await request(base, '/ai/character/config', tokenBob, 'PUT', { customConfig: bobConfig });
    assert.equal(saveBob.status, 200);
    assert.equal(saveBob.data.success, true);
    assert.equal(saveBob.data.customConfig.about, bobConfig.about);
    assert.equal(saveBob.data.customConfig.shouldRules, bobConfig.shouldRules);
    assert.equal(saveBob.data.customConfig.location, 'Tokyo, Japan');
    assert.equal(saveBob.data.customConfig.timezone, 'Asia/Tokyo');

    console.log('--- Test 4: Verification of zero cross-user config & timezone leakage ---');
    // Alice on Device 1
    const fetchAlice1 = await request(base, '/ai/character/config', tokenAlice1);
    assert.equal(fetchAlice1.data.customConfig.about, aliceConfig.about);
    assert.equal(fetchAlice1.data.customConfig.shouldRules, aliceConfig.shouldRules);
    assert.equal(fetchAlice1.data.customConfig.timezone, 'Europe/London');

    // Alice on Device 2 (multi-device sync)
    const fetchAlice2 = await request(base, '/ai/character/config', tokenAlice2);
    assert.deepEqual(fetchAlice2.data.customConfig, fetchAlice1.data.customConfig);

    // Bob retains his own rules & timezone
    const fetchBob = await request(base, '/ai/character/config', tokenBob);
    assert.equal(fetchBob.data.customConfig.about, bobConfig.about);
    assert.equal(fetchBob.data.customConfig.shouldRules, bobConfig.shouldRules);
    assert.equal(fetchBob.data.customConfig.timezone, 'Asia/Tokyo');
    assert.equal(fetchBob.data.customConfig.shouldRules.includes('Tease me'), false, 'Bob leaked Alice Should rules');
    assert.equal(fetchBob.data.customConfig.timezone.includes('London'), false, 'Bob leaked Alice timezone');

    // Cara remains default (no rules, no timezone)
    const fetchCara = await request(base, '/ai/character/config', tokenCara);
    assert.equal(fetchCara.data.customConfig, null, 'Cara received non-default config');

    console.log('--- Test 5: Prompt construction isolation: Should / Should Not & Timezone ---');
    const rawLyra = db.getAICharacter('char_lyra');
    const testNow = new Date('2026-09-25T14:30:00Z');

    // Alice's prompt (Alice in New York, Lyra in London)
    const aliceCharConfig = new CharacterConfig(rawLyra, fetchAlice1.data.customConfig);
    const alicePrompt = buildCharacterSystemPrompt({
      characterConfig: aliceCharConfig,
      characterState: { current_activity: 'relaxing' },
      customConfig: fetchAlice1.data.customConfig,
      memories: [],
      now: testNow,
      userTimeZone: 'America/New_York'
    });
    // Check custom rules
    assert.match(alicePrompt, /LYRA SHOULD \(EXPLICIT BEHAVIORAL PREFERENCES & HABITS\)/);
    assert.match(alicePrompt, /Tease me lightly when appropriate/);
    assert.match(alicePrompt, /LYRA SHOULD NOT \(EXPLICIT BEHAVIORAL CONSTRAINTS & BOUNDARIES\)/);
    assert.match(alicePrompt, /Sound like a generic AI assistant/);
    assert.doesNotMatch(alicePrompt, /Ponder deeply before speaking/); // Bob's rule
    // Check temporal grounding
    assert.match(alicePrompt, /Current Real-World Year: 2026/);
    assert.match(alicePrompt, /User's Authoritative Timezone: America\/New_York/);
    assert.match(alicePrompt, /10:30 AM/); // 14:30Z in New York is 10:30 AM
    assert.match(alicePrompt, /Lyra's Configured Remote Location: London, United Kingdom/);
    assert.match(alicePrompt, /Lyra's Configured Timezone: Europe\/London/);
    assert.match(alicePrompt, /3:30 PM/); // 14:30Z in London is 15:30 (3:30 PM BST)

    // Bob's prompt (Bob in Vietnam, Lyra in Tokyo)
    const bobCharConfig = new CharacterConfig(rawLyra, fetchBob.data.customConfig);
    const bobPrompt = buildCharacterSystemPrompt({
      characterConfig: bobCharConfig,
      characterState: { current_activity: 'reading' },
      customConfig: fetchBob.data.customConfig,
      memories: [],
      now: testNow,
      userTimeZone: 'Asia/Ho_Chi_Minh'
    });
    assert.match(bobPrompt, /Ponder deeply before speaking/);
    assert.match(bobPrompt, /Talk about modern pop culture/);
    assert.doesNotMatch(bobPrompt, /Tease me lightly/);
    assert.match(bobPrompt, /User's Authoritative Timezone: Asia\/(?:Ho_Chi_Minh|Saigon)/);
    assert.match(bobPrompt, /9:30 PM/); // 14:30Z in Vietnam is 21:30 (9:30 PM)
    assert.match(bobPrompt, /Lyra's Configured Remote Location: Tokyo, Japan/);
    assert.match(bobPrompt, /Lyra's Configured Timezone: Asia\/Tokyo/);
    assert.match(bobPrompt, /11:30 PM/); // 14:30Z in Tokyo is 23:30 (11:30 PM)

    // Cara's prompt (Default Lyra, no custom rules, Cara in Los Angeles)
    const caraCharConfig = new CharacterConfig(rawLyra, null);
    const caraPrompt = buildCharacterSystemPrompt({
      characterConfig: caraCharConfig,
      characterState: { current_activity: 'relaxing' },
      customConfig: null,
      memories: [],
      now: testNow,
      userTimeZone: 'America/Los_Angeles'
    });
    assert.doesNotMatch(caraPrompt, /USER-DEFINED CHARACTER CUSTOMIZATION/);
    assert.doesNotMatch(caraPrompt, /LYRA SHOULD/);
    assert.doesNotMatch(caraPrompt, /LYRA SHOULD NOT/);
    assert.match(caraPrompt, /User's Authoritative Timezone: America\/Los_Angeles/);
    assert.match(caraPrompt, /7:30 AM/); // 14:30Z in LA is 7:30 AM
    assert.match(caraPrompt, /Lyra's Location & Timezone: None configured. DO NOT invent a separate remote city or timezone/);

    console.log('--- Test 6: Midnight rollover & relative temporal expressions ---');
    // Test 11:55 PM Thursday in NY
    const preMidnight = new Date('2026-09-25T03:55:00Z'); // 23:55 on Sept 24 in NY
    const preContext = resolveAuthoritativeTemporalContext({
      now: preMidnight,
      userTimeZone: 'America/New_York'
    });
    assert.match(preContext.user.dateString, /Thursday, September 24, 2026/);
    assert.match(preContext.user.timeString, /11:55 PM/);
    assert.match(preContext.user.yesterdayString, /Wednesday, September 23, 2026/);
    assert.match(preContext.user.tomorrowString, /Friday, September 25, 2026/);

    // Test 12:05 AM Friday in NY (10 minutes later)
    const postMidnight = new Date('2026-09-25T04:05:00Z'); // 00:05 on Sept 25 in NY
    const postContext = resolveAuthoritativeTemporalContext({
      now: postMidnight,
      userTimeZone: 'America/New_York'
    });
    assert.match(postContext.user.dateString, /Friday, September 25, 2026/);
    assert.match(postContext.user.timeString, /12:05 AM/);
    assert.match(postContext.user.yesterdayString, /Thursday, September 24, 2026/);
    assert.match(postContext.user.tomorrowString, /Saturday, September 26, 2026/);

    console.log('--- Test 7: Runtime date/time never becomes durable memory ---');
    assert.equal(isTransientTemporalStatement('Today is September 25'), true);
    assert.equal(isTransientTemporalStatement('It is 1:51 PM'), true);
    assert.equal(isTransientTemporalStatement('The current year is 2026'), true);
    assert.equal(isTransientTemporalStatement('it is 2pm'), true);
    assert.equal(isTransientTemporalStatement('what time is it'), true);
    assert.equal(isTransientTemporalStatement('my name is Alice'), false);
    assert.equal(isTransientTemporalStatement('i live in Kyoto'), false);

    // Memory candidates extraction rejects temporal statements
    const candidates1 = extractExplicitMemoryCandidates('Today is September 25 and it is 1:51 PM. The current year is 2026.');
    assert.equal(candidates1.length, 0, 'Temporal statement was extracted as memory');

    const candidates2 = extractExplicitMemoryCandidates('My name is Alice. Today is Friday.');
    assert.equal(candidates2.length, 1);
    assert.equal(candidates2[0].key, 'name');
    assert.equal(candidates2[0].value, 'Alice');

    // Process memory updates rejects transient temporal candidates
    const rejected = processMemoryUpdates(db, alice._id, 'char_lyra', [
      { key: 'today_is', value: 'September 25', source: 'USER_STATED' },
      { key: 'current_year', value: '2026', source: 'USER_STATED' }
    ]);
    assert.equal(rejected.length, 0, 'Temporal candidates were saved to database');

    console.log('--- Test 8: Forged userId cannot read or modify another user ---');
    const forgedAttempt = await request(base, '/ai/character/config', tokenCara, 'PUT', {
      userId: alice._id,
      customConfig: { about: 'HACKED' }
    });
    assert.equal(forgedAttempt.status, 200);

    // Alice's config must remain unchanged!
    const recheckAlice = await request(base, '/ai/character/config', tokenAlice1);
    assert.equal(recheckAlice.data.customConfig.about, aliceConfig.about);
    assert.equal(recheckAlice.data.customConfig.shouldRules, aliceConfig.shouldRules);

    // Cara's own config became 'HACKED'
    const recheckCara = await request(base, '/ai/character/config', tokenCara);
    assert.equal(recheckCara.data.customConfig.about, 'HACKED');

    console.log('--- Test 9: Reset Customization Isolation ---');
    // Add a durable memory for Alice to ensure reset does NOT delete memories
    db.addAIMemory({
      userId: alice._id,
      key: 'favorite_drink',
      value: 'iced oat latte',
      source: 'USER_STATED'
    });
    assert.equal(db.getAIMemories(alice._id).length, 1);

    // Alice resets her character customization
    const resetAlice = await request(base, '/ai/character/config', tokenAlice1, 'DELETE');
    assert.equal(resetAlice.status, 200);
    assert.equal(resetAlice.data.success, true);

    // Alice's custom config is now null
    const afterResetAlice = await request(base, '/ai/character/config', tokenAlice1);
    assert.equal(afterResetAlice.data.customConfig, null);

    // Alice's memory is STILL INTACT!
    const aliceMemories = db.getAIMemories(alice._id);
    assert.equal(aliceMemories.length, 1);
    assert.equal(aliceMemories[0].value, 'iced oat latte');

    // Bob's custom config is STILL INTACT!
    const afterResetBob = await request(base, '/ai/character/config', tokenBob);
    assert.equal(afterResetBob.data.customConfig.about, bobConfig.about);
    assert.equal(afterResetBob.data.customConfig.shouldRules, bobConfig.shouldRules);

    console.log('--- Test 10: Preview endpoint uses unsaved Should/Should Not rules & timezone without durable writes ---');
    const originalGenerate = modelRouter.generate;
    let previewSystemPromptCaptured = '';
    modelRouter.generate = async ({ systemPrompt, userMessage }) => {
      previewSystemPromptCaptured = systemPrompt;
      return { bubbles: ['Preview response! ✨'], reaction: '✨' };
    };

    const previewMsgCountBefore = db.store.messages.length;
    const previewMemCountBefore = db.getAIMemories(bob._id).length;

    const previewRes = await request(base, '/ai/character/preview', tokenBob, 'POST', {
      userMessage: 'What time is it there?',
      history: [],
      customConfig: {
        about: 'Astronaut traveling through Mars station',
        shouldRules: 'Speak in mission logs\nUse military brevity',
        shouldNotRules: 'Break character\nSay as an AI',
        location: 'Mars Base Alpha',
        timezone: 'UTC'
      },
      timeZone: 'Asia/Tokyo'
    });

    assert.equal(previewRes.status, 200);
    assert.match(previewSystemPromptCaptured, /Speak in mission logs/);
    assert.match(previewSystemPromptCaptured, /Break character/);
    assert.match(previewSystemPromptCaptured, /Mars Base Alpha/);
    assert.match(previewSystemPromptCaptured, /Asia\/Tokyo/);
    assert.deepEqual(previewRes.data.bubbles, ['Preview response! ✨']);

    // Preview must not add to messages or memories!
    assert.equal(db.store.messages.length, previewMsgCountBefore, 'Preview stored a message in chat');
    assert.equal(db.getAIMemories(bob._id).length, previewMemCountBefore, 'Preview generated durable memories');

    modelRouter.generate = originalGenerate;

    console.log('--- Test 11: Read-only mode blocks customization writes ---');
    process.env.WRITE_MODE = 'read-only';
    const blockedSave = await request(base, '/ai/character/config', tokenAlice1, 'PUT', { customConfig: aliceConfig });
    assert.equal(blockedSave.status, 503);
    const blockedDelete = await request(base, '/ai/character/config', tokenAlice1, 'DELETE');
    assert.equal(blockedDelete.status, 503);
    delete process.env.WRITE_MODE;

    console.log('🎉 All Character Studio backend isolation, multi-device, preview & temporal tests passed!');
  } finally {
    await new Promise(resolve => app.get('io').close(resolve));
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exitCode = 1;
});
