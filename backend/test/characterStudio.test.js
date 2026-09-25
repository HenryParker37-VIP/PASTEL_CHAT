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

async function request(base, path, token, method = 'GET', body = null) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
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

    console.log('--- Test 2: User A (Alice) customizes Lyra ---');
    const aliceConfig = {
      about: 'A witty 22-year-old barista & architecture student who loves film photography and jazz.',
      personality: 'Playful, caring, gently sarcastic, and deeply loyal.',
      personalityTags: ['Playful', 'Caring', 'Sarcastic', 'Witty'],
      thoughtProcess: 'Values honesty over polite lies. Skeptical of wild rumors but gives friends the benefit of the doubt.',
      speakingStyle: 'Casual texting with contractions and lowercase starts. Uses coffee and laugh emojis occasionally.',
      wordsUsed: 'fair enough, honestly, oh no 😭, wait what',
      wordsAvoided: 'as an AI, certainly, buddy, pal',
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
    assert.deepEqual(saveAlice.data.customConfig.personalityTags, aliceConfig.personalityTags);

    console.log('--- Test 3: User B (Bob) customizes Lyra differently ---');
    const bobConfig = {
      about: 'A calm, philosophical companion from a coastal town who loves classical literature.',
      personality: 'Thoughtful, serene, gentle, and reflective.',
      personalityTags: ['Thoughtful', 'Gentle', 'Curious'],
      thoughtProcess: 'Takes time to ponder every question deeply. Appreciates quiet moments and poetry.',
      speakingStyle: 'Gentle and articulate. Punctuation is clean. Almost never uses emojis.',
      wordsUsed: 'perhaps, I wonder, serene, intriguing',
      wordsAvoided: 'omg, lol, tbh, bruh',
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

    console.log('--- Test 4: Verification of zero cross-user config leakage ---');
    // Alice on Device 1
    const fetchAlice1 = await request(base, '/ai/character/config', tokenAlice1);
    assert.equal(fetchAlice1.data.customConfig.about, aliceConfig.about);
    assert.equal(fetchAlice1.data.customConfig.wordsUsed, aliceConfig.wordsUsed);

    // Alice on Device 2 (same account across devices)
    const fetchAlice2 = await request(base, '/ai/character/config', tokenAlice2);
    assert.deepEqual(fetchAlice2.data.customConfig, fetchAlice1.data.customConfig);

    // Bob retains his own config
    const fetchBob = await request(base, '/ai/character/config', tokenBob);
    assert.equal(fetchBob.data.customConfig.about, bobConfig.about);
    assert.equal(fetchBob.data.customConfig.wordsUsed, bobConfig.wordsUsed);
    assert.equal(fetchBob.data.customConfig.about.includes('Mochi'), false, 'Bob leaked Alice lore');

    // Cara remains default
    const fetchCara = await request(base, '/ai/character/config', tokenCara);
    assert.equal(fetchCara.data.customConfig, null, 'Cara received non-default config');

    console.log('--- Test 5: Prompt construction isolation ---');
    const rawLyra = db.getAICharacter('char_lyra');

    // Alice's prompt
    const aliceCharConfig = new CharacterConfig(rawLyra, fetchAlice1.data.customConfig);
    const alicePrompt = buildCharacterSystemPrompt({
      characterConfig: aliceCharConfig,
      characterState: { current_activity: 'relaxing' },
      customConfig: fetchAlice1.data.customConfig,
      memories: []
    });
    assert.match(alicePrompt, /Canon AE-1 camera/);
    assert.match(alicePrompt, /Calls me Ren/);
    assert.doesNotMatch(alicePrompt, /Mary Oliver/);

    // Bob's prompt
    const bobCharConfig = new CharacterConfig(rawLyra, fetchBob.data.customConfig);
    const bobPrompt = buildCharacterSystemPrompt({
      characterConfig: bobCharConfig,
      characterState: { current_activity: 'reading' },
      customConfig: fetchBob.data.customConfig,
      memories: []
    });
    assert.match(bobPrompt, /Mary Oliver/);
    assert.match(bobPrompt, /coastal town/);
    assert.doesNotMatch(bobPrompt, /Canon AE-1 camera/);

    // Cara's prompt (default)
    const caraCharConfig = new CharacterConfig(rawLyra, null);
    const caraPrompt = buildCharacterSystemPrompt({
      characterConfig: caraCharConfig,
      characterState: { current_activity: 'relaxing' },
      customConfig: null,
      memories: []
    });
    assert.doesNotMatch(caraPrompt, /USER-DEFINED CHARACTER CUSTOMIZATION/);
    assert.doesNotMatch(caraPrompt, /Canon AE-1 camera/);
    assert.doesNotMatch(caraPrompt, /Mary Oliver/);

    console.log('--- Test 6: Forged userId cannot read or modify another user ---');
    // Cara tries to forge Alice's userId in payload
    const forgedAttempt = await request(base, '/ai/character/config', tokenCara, 'PUT', {
      userId: alice._id,
      customConfig: { about: 'HACKED' }
    });
    assert.equal(forgedAttempt.status, 200);

    // Alice's config must remain unchanged!
    const recheckAlice = await request(base, '/ai/character/config', tokenAlice1);
    assert.equal(recheckAlice.data.customConfig.about, aliceConfig.about);

    // Cara's own config became 'HACKED'
    const recheckCara = await request(base, '/ai/character/config', tokenCara);
    assert.equal(recheckCara.data.customConfig.about, 'HACKED');

    console.log('--- Test 7: Reset Customization Isolation ---');
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

    console.log('--- Test 8: Preview endpoint isolation ---');
    const originalGenerate = modelRouter.generate;
    let previewGeneratedWithCustom = false;
    modelRouter.generate = async ({ systemPrompt, userMessage }) => {
      if (systemPrompt.includes('Astronaut traveling through Mars')) {
        previewGeneratedWithCustom = true;
      }
      return { bubbles: ['Greetings from Mars!', 'How is Earth today?'], reaction: '🚀' };
    };

    const previewMsgCountBefore = db.store.messages.length;
    const previewMemCountBefore = db.getAIMemories(bob._id).length;

    const previewRes = await request(base, '/ai/character/preview', tokenBob, 'POST', {
      userMessage: 'Hello Lyra!',
      history: [],
      customConfig: {
        about: 'Astronaut traveling through Mars',
        personality: 'Adventurous and curious',
        speakingStyle: 'Space radio style'
      }
    });

    assert.equal(previewRes.status, 200);
    assert.equal(previewGeneratedWithCustom, true);
    assert.deepEqual(previewRes.data.bubbles, ['Greetings from Mars!', 'How is Earth today?']);
    assert.equal(previewRes.data.reaction, '🚀');

    // Preview must not add to messages or memories!
    assert.equal(db.store.messages.length, previewMsgCountBefore, 'Preview stored a message in chat');
    assert.equal(db.getAIMemories(bob._id).length, previewMemCountBefore, 'Preview generated durable memories');

    modelRouter.generate = originalGenerate;

    console.log('--- Test 9: Read-only mode blocks customization writes ---');
    process.env.WRITE_MODE = 'read-only';
    const blockedSave = await request(base, '/ai/character/config', tokenAlice1, 'PUT', { customConfig: aliceConfig });
    assert.equal(blockedSave.status, 503);
    const blockedDelete = await request(base, '/ai/character/config', tokenAlice1, 'DELETE');
    assert.equal(blockedDelete.status, 503);
    delete process.env.WRITE_MODE;

    console.log('🎉 All Character Studio backend isolation, multi-device, preview & security tests passed!');
  } finally {
    await new Promise(resolve => app.get('io').close(resolve));
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exitCode = 1;
});
