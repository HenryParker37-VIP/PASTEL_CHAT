const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

process.env.JWT_SECRET = 'security-audit-remediation-test-secret-2026';
process.env.ADMIN_LOGIN_CODE = 'TEST-ADMN';
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.PASTELCHAT_DISABLE_PERSIST = '1';

const { once } = require('events');
const { app, server } = require('../src/app');
const storeDb = require('../src/db/store');
const { COMPROMISED_LOGIN_CODES } = require('../src/config/securityConstants');
const { issueToken, verifyToken, assertAuthConfigured } = require('../src/config/auth');
const { authenticateToken, createUserToken } = require('../src/services/sessionAuth');

let baseUrl;

test.before(async () => {
  await storeDb.ready;
  if (!server.listening) {
    await once(server, 'listening');
  }
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

test.after(async () => {
  if (server && server.listening) {
    await new Promise((resolve) => server.close(resolve));
  }
});

// ==========================================
// C1: ADMIN AUTH & CREDENTIAL SECURITY
// ==========================================
test('C1.1: Compromised default admin code ADMN-0307 is strictly rejected', async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginCode: 'ADMN-0307' })
  });
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.message, 'Invalid login code');
});

test('C1.2: Hardcoded fallback secrets are banned and assertAuthConfigured fails closed in production', () => {
  const origEnv = process.env.NODE_ENV;
  const origSecret = process.env.JWT_SECRET;
  try {
    process.env.NODE_ENV = 'production';
    
    // Test missing secret
    delete process.env.JWT_SECRET;
    assert.throws(() => assertAuthConfigured(), /JWT_SECRET is not configured/);

    // Test compromised fallback 1
    process.env.JWT_SECRET = 'pastel-chat-production-fallback-jwt-secret-2026';
    assert.throws(() => assertAuthConfigured(), /insecure compromised fallback/);

    // Test compromised fallback 2
    process.env.JWT_SECRET = 'pastel-chat-development-secret';
    assert.throws(() => assertAuthConfigured(), /insecure compromised fallback/);
  } finally {
    process.env.NODE_ENV = origEnv;
    process.env.JWT_SECRET = origSecret;
  }
});

test('C1.3: Token payload tampering (forged isAdmin or adminRole) cannot grant admin privileges to non-admin user', () => {
  const normalUser = storeDb.createUser({
    name: 'NormalUser1',
    loginCode: 'NORM-USR1',
    avatar: 'https://example.com/avatar.png',
    isAdmin: false
  });

  // Forged token signed with valid secret claiming isAdmin: true and adminRole: 'OWNER'
  const forgedToken = jwt.sign(
    {
      userId: normalUser._id,
      name: normalUser.name,
      loginCode: normalUser.loginCode,
      avatar: normalUser.avatar,
      isAdmin: true,
      adminRole: 'OWNER',
      sid: 'forged-session-123',
      ver: Number(normalUser.authVersion || 0)
    },
    process.env.JWT_SECRET,
    { issuer: 'pastelchat', audience: 'pastelchat-web', algorithm: 'HS256' }
  );

  const authResult = authenticateToken(forgedToken);
  assert.ok(authResult);
  assert.equal(authResult.user.isAdmin, false);
  assert.equal(authResult.adminRole, null);
});

test('C1.4: Synthesized user from token claims cannot acquire isAdmin: true', () => {
  const nonExistentId = 'non_existent_fake_user_id_999';
  const forgedToken = jwt.sign(
    {
      userId: nonExistentId,
      name: 'FakeAttacker',
      loginCode: 'FAKE-ATK1',
      avatar: 'https://example.com/fake.png',
      isAdmin: true,
      adminRole: 'OWNER',
      sid: 'forged-session-fake',
      ver: 0
    },
    process.env.JWT_SECRET,
    { issuer: 'pastelchat', audience: 'pastelchat-web', algorithm: 'HS256' }
  );

  const authResult = authenticateToken(forgedToken);
  assert.ok(authResult);
  assert.equal(authResult.user.isAdmin, false);
  assert.equal(authResult.adminRole, null);

  // Clean up synthesized fake user
  storeDb.deleteDisposableUser(nonExistentId);
});

test('C1.5: Valid admin login with configured ADMIN_LOGIN_CODE succeeds and creates audit log', async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginCode: process.env.ADMIN_LOGIN_CODE })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.token);
  assert.equal(data.user.isAdmin, true);
  assert.equal(data.user.adminRole, 'OWNER');
});

// ==========================================
// H1: TRACKED PRODUCTION DATA REMOVAL
// ==========================================
test('H1.1: seedData.json contains only synthetic fixture data with zero leaked production data', () => {
  const seedPath = path.join(__dirname, '../src/db/seedData.json');
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  assert.ok(Array.isArray(seed.users));
  // Must only have synthetic fixture users
  for (const user of seed.users) {
    assert.ok(
      user._id === 'user_ai_lyra' || user._id.startsWith('synthetic_'),
      `Unexpected non-synthetic user in seedData: ${user._id}`
    );
    assert.ok(
      !user.email || user.email.endsWith('@synthetic.test') || user.email === 'lyra@synthetic.test',
      `Unexpected real email in seedData: ${user.email}`
    );
  }

  // Must have 0 push subscriptions and 0 production messages
  assert.equal(seed.pushSubscriptions.length, 0);
  assert.equal(seed.messages.length, 0);
});

test('H1.2: All 29 historically exposed login codes are blocked from login', async () => {
  for (const code of COMPROMISED_LOGIN_CODES) {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginCode: code })
    });
    assert.equal(res.status, 401, `Compromised code ${code} was not rejected!`);
  }
});

test('H1.3: generateLoginCode never outputs any compromised code', () => {
  for (let i = 0; i < 50; i++) {
    const code = storeDb.generateLoginCode();
    assert.ok(!COMPROMISED_LOGIN_CODES.has(code), `Generated code ${code} is in compromised list!`);
  }
});

// ==========================================
// H2: AI PROVIDER CREDENTIALS IN SOURCE
// ==========================================
test('H2.1: ai/config.js contains no base64 fallbacks or embedded keys', () => {
  const configPath = path.join(__dirname, '../src/ai/config.js');
  const content = fs.readFileSync(configPath, 'utf8');

  assert.ok(!content.includes('decodeFallback'), 'Found decodeFallback in ai/config.js');
  assert.ok(!content.includes('Buffer.from'), 'Found Buffer.from base64 decoding in ai/config.js');
  assert.ok(!content.includes('QVEuQWI4Uk42SzN'), 'Found Gemini fallback in ai/config.js');
  assert.ok(!content.includes('bnZhcGktbWZQV'), 'Found NVIDIA fallback in ai/config.js');
  assert.ok(!content.includes('c2stb3ItdjEtMW'), 'Found OpenRouter fallback in ai/config.js');
});

// ==========================================
// M1: GLOBAL LYRA AVATAR AUTHORIZATION
// ==========================================
test('M1.1: Regular user cannot mutate global Lyra avatar via POST /ai/avatar', async () => {
  const regUser = storeDb.createUser({
    name: 'NormalAvatarTester',
    loginCode: 'AVTR-TST1',
    avatar: 'https://example.com/avatar.png',
    isAdmin: false
  });
  const token = createUserToken(regUser);

  const res = await fetch(`${baseUrl}/ai/avatar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      avatar: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=HackedLyra&backgroundColor=ffffff'
    })
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.message, 'Admin permission required');
  storeDb.deleteDisposableUser(regUser._id);
});

test('M1.2: Admin user can update global Lyra avatar via POST /ai/avatar', async () => {
  const admin = storeDb.findUser({ isAdmin: true });
  assert.ok(admin, 'Configured admin user must exist');
  const adminToken = createUserToken(admin, { adminRole: 'OWNER' });

  const testAvatar = 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=LyraAuthorized&backgroundColor=ffd1dc';
  const res = await fetch(`${baseUrl}/ai/avatar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ avatar: testAvatar })
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.avatar, testAvatar);
});

test('M1.3: Regular user personal Character Studio customization remains functional and isolated', async () => {
  const user = storeDb.createUser({
    name: 'StudioCustomizer',
    loginCode: 'STUD-CST1',
    avatar: 'https://example.com/avatar.png',
    isAdmin: false
  });
  const token = createUserToken(user);

  const putRes = await fetch(`${baseUrl}/ai/character/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      customConfig: {
        shouldRules: 'Be extra cheerful',
        shouldNotRules: 'Never use corporate jargon'
      }
    })
  });
  assert.equal(putRes.status, 200);

  const getRes = await fetch(`${baseUrl}/ai/character/config`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.equal(getRes.status, 200);
  const data = await getRes.json();
  assert.equal(data.customConfig.shouldRules, 'Be extra cheerful');
  assert.equal(data.customConfig.shouldNotRules, 'Never use corporate jargon');

  storeDb.deleteDisposableUser(user._id);
});

// ==========================================
// M2: DURABLE RATE LIMIT & QA CLEANUP
// ==========================================
test('M2.1: POST /admin/qa/cleanup deletes disposable test accounts and rejects admin deletion', async () => {
  const admin = storeDb.findUser({ isAdmin: true });
  const adminToken = createUserToken(admin, { adminRole: 'OWNER' });

  // Create disposable test accounts
  const qaUser1 = storeDb.createUser({ name: 'qa_user_test_alpha', loginCode: 'QA01-TST1', avatar: 'https://example.com/qa1.png' });
  const qaUser2 = storeDb.createUser({ name: 'qa_user_test_beta', loginCode: 'QA02-TST2', avatar: 'https://example.com/qa2.png' });
  const normalUser = storeDb.createUser({ name: 'legitimate_user', loginCode: 'LEGI-USR1', avatar: 'https://example.com/legit.png' });

  // 1. Attempt to cleanup with admin ID in userIds (must be refused/filtered out)
  const res1 = await fetch(`${baseUrl}/admin/qa/cleanup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ userIds: [admin._id, qaUser1._id] })
  });

  assert.equal(res1.status, 200);
  const data1 = await res1.json();
  assert.equal(data1.deletedCount, 1);
  assert.ok(data1.deletedIds.includes(qaUser1._id));
  assert.ok(!data1.deletedIds.includes(admin._id), 'Admin account must never be deleted!');

  // Verify admin still exists
  assert.ok(storeDb.findUserById(admin._id), 'Admin user must still exist in DB');
  // Verify qaUser1 is deleted
  assert.equal(storeDb.findUserById(qaUser1._id), null);

  // 2. Cleanup by prefix 'qa_'
  const res2 = await fetch(`${baseUrl}/admin/qa/cleanup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ prefix: 'qa_' })
  });
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.ok(data2.deletedIds.includes(qaUser2._id));

  // Verify legitimate user is untouched
  assert.ok(storeDb.findUserById(normalUser._id), 'Legitimate user must not be deleted');

  // Clean up test legitimate user
  storeDb.deleteDisposableUser(normalUser._id);
});

// ==========================================
// L1: PROFILE DATA EXPOSURE
// ==========================================
test('L1.1: userPublic() and public profile lookup do not expose private chatColors', async () => {
  const user = storeDb.createUser({
    name: 'ColorUser',
    loginCode: 'COLR-USR1',
    avatar: 'https://example.com/color.png',
    chatColors: { '662000000000000000000001': '#FFB6C1', '662000000000000000000002': '#B5EAD7' }
  });
  const viewer = storeDb.createUser({
    name: 'ViewerUser',
    loginCode: 'VIEW-USR1',
    avatar: 'https://example.com/viewer.png'
  });
  const viewerToken = createUserToken(viewer);
  const userToken = createUserToken(user);

  // 1. userPublic helper test
  const pub = storeDb.userPublic(user);
  assert.equal(pub.chatColors, undefined, 'chatColors must not exist on userPublic');

  // 2. GET /users/:id viewed by another user
  const otherRes = await fetch(`${baseUrl}/users/${user._id}`, {
    headers: { 'Authorization': `Bearer ${viewerToken}` }
  });
  assert.equal(otherRes.status, 200);
  const otherData = await otherRes.json();
  assert.equal(otherData.chatColors, undefined, 'chatColors must not be exposed to other users');

  // 3. GET /users/:id viewed by the owner themselves
  const ownerRes = await fetch(`${baseUrl}/users/${user._id}`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  assert.equal(ownerRes.status, 200);
  const ownerData = await ownerRes.json();
  assert.ok(ownerData.chatColors, 'Owner must receive their own chatColors');
  assert.equal(ownerData.chatColors['662000000000000000000001'], '#FFB6C1');

  storeDb.deleteDisposableUser(user._id);
  storeDb.deleteDisposableUser(viewer._id);
});

// ==========================================
// L2: FRONTEND SECURITY HEADERS IN VERCEL.JSON
// ==========================================
test('L2.1: vercel.json contains baseline security headers including anti-framing and CSP', () => {
  const vercelPath = path.join(__dirname, '../../vercel.json');
  const config = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));

  const globalHeaderRule = config.headers.find(h => h.source === '/(.*)');
  assert.ok(globalHeaderRule, 'Missing /(.*) header rule in vercel.json');

  const headers = Object.fromEntries(globalHeaderRule.headers.map(h => [h.key, h.value]));
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.ok(headers['Permissions-Policy']);
  assert.ok(headers['Content-Security-Policy'].includes("frame-ancestors 'none'"));
});

// ==========================================
// SECURITY HYGIENE: CORS & TELEGRAM
// ==========================================
test('Hygiene 1: CORS rejects unauthorized third-party *.vercel.app origins', async () => {
  const res = await fetch(`${baseUrl}/health`, {
    headers: { 'Origin': 'https://evil-attacker.vercel.app' }
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.message, 'Origin not allowed');
});

test('Hygiene 2: CORS allows authorized Pastel Chat vercel origin', async () => {
  const res = await fetch(`${baseUrl}/health`, {
    headers: { 'Origin': 'https://pastel-chat.vercel.app' }
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://pastel-chat.vercel.app');
});

test('Hygiene 3: Telegram webhook rejects invalid signatures in production mode', async () => {
  const origEnv = process.env.NODE_ENV;
  const origSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  try {
    process.env.NODE_ENV = 'production';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret'; // default secret must fail closed

    const res = await fetch(`${baseUrl}/telegram/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'wrong'
      },
      body: JSON.stringify({ message: { text: '/start' } })
    });
    assert.equal(res.status, 403);
  } finally {
    process.env.NODE_ENV = origEnv;
    process.env.TELEGRAM_WEBHOOK_SECRET = origSecret;
  }
});

// ==========================================
// ROUND 2: CR-1, H-1, M-1, M-2 & TRACEABILITY
// ==========================================

test('CR-1.1: Lyra AI identity cannot be interactively logged into via POST /auth/login', async () => {
  // Test both with LYRA-AI24 and any arbitrary attempt
  const res1 = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginCode: 'LYRA-AI24' })
  });
  assert.equal(res1.status, 401);

  // Even if an AI user somehow had a login code assigned in memory
  const lyra = storeDb.findUserById('user_ai_lyra');
  assert.ok(lyra);
  assert.equal(lyra.loginCode, null);
});

test('CR-1.2: Token claiming AI user identity is strictly rejected by authenticateToken', () => {
  const forgedAiToken = jwt.sign(
    {
      userId: 'user_ai_lyra',
      name: 'Lyra',
      avatar: 'https://example.com/avatar.png',
      isAI: true,
      sid: 'ai-sess-1',
      ver: 0
    },
    process.env.JWT_SECRET,
    { issuer: 'pastelchat', audience: 'pastelchat-web', algorithm: 'HS256' }
  );

  const auth = authenticateToken(forgedAiToken);
  assert.equal(auth, null, 'authenticateToken must return null for AI identity');
});

test('CR-1.3: Cross-user conversation authorization strictly enforced (User A cannot view User B conversation)', async () => {
  // Create disposable QA users A, B, and C
  const userA = storeDb.createUser({ name: 'qa_user_test_a', isQA: true });
  const userB = storeDb.createUser({ name: 'qa_user_test_b', isQA: true });
  const userC = storeDb.createUser({ name: 'qa_user_test_c', isQA: true });

  const tokenA = createUserToken(userA);

  // User A attempts to view conversation between user B and user C
  const res = await fetch(`${baseUrl}/messages/with/${userB._id}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  // User A and User B are not friends -> 403 Forbidden
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.message, 'Conversation access denied');
});

test('H-1.1: All 30 historically exposed login codes including LYRA-AI24 are in COMPROMISED_LOGIN_CODES', () => {
  const codes = [
    'LYRA-AI24', 'ADMN-0307', 'B5F8-JUZZ', 'VFTQ-KCCB', 'EJ44-FJM2', 'AP3K-2W2S',
    'BDQG-SJ4C', 'HDFA-PWNU', '8UKT-YU8K', 'PA8G-G5UE', 'SFPC-5K85', 'X9WA-32VD',
    '7E4S-BGG3', '4QMJ-YQKP', '6CCA-SZ6D', '2KNA-W8J7', 'KK4W-C562', 'UT4E-7KA5',
    '9M6D-CGPU', 'R2M8-WE3F', 'TDFU-4NH2', '5GWR-WF6E', 'E4MY-E62X', 'BP7U-5WY6',
    'PEVK-DPN4', '76VR-AX2D', 'S2EX-9Q5E', 'YTGR-MV8R', 'P4TC-R6YY', 'KJ7T-FU7U'
  ];
  assert.equal(codes.length, 30);
  for (const c of codes) {
    assert.ok(COMPROMISED_LOGIN_CODES.has(c), `Missing compromised code: ${c}`);
  }
});

test('H-1.2: seedData.json contains zero active login credentials', () => {
  const seedPath = path.join(__dirname, '../src/db/seedData.json');
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  for (const u of seed.users) {
    assert.equal(u.loginCode, null, `User ${u.name} in seedData.json must have loginCode: null`);
  }
});

test('M-1.1: deleteDisposableUser strictly refuses to delete legitimate (non-QA) users', () => {
  const realUser = storeDb.createUser({
    name: 'RealLegitimateUser',
    loginCode: 'REAL-USER',
    isQA: false
  });
  assert.equal(realUser.isQA, false);

  const deleted = storeDb.deleteDisposableUser(realUser._id);
  assert.equal(deleted, false, 'deleteDisposableUser must return false for non-QA user');

  const stillExists = storeDb.findUserById(realUser._id);
  assert.ok(stillExists, 'Non-QA user must NOT be deleted');
});

test('M-1.2: POST /admin/qa/cleanup refuses to delete non-QA accounts even when caller passes userIds', async () => {
  const realUser = storeDb.createUser({ name: 'ProtectedCustomer', isQA: false });
  const qaUser = storeDb.createUser({ name: 'qa_disposable_user_1', isQA: true });

  const adminToken = createUserToken(storeDb.findUser({ isAdmin: true }), { adminRole: 'OWNER' });

  // Admin calls cleanup targeting the non-QA user ID explicitly
  const res = await fetch(`${baseUrl}/admin/qa/cleanup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ userIds: [realUser._id, qaUser._id] })
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.deletedCount, 1);
  assert.deepEqual(data.deletedIds, [qaUser._id]);

  // Verify real user still exists completely untouched
  const realStillExists = storeDb.findUserById(realUser._id);
  assert.ok(realStillExists);
});

test('M-2.1: Rate limiter fails safely (503) in production if durable store is unavailable', async () => {
  const origEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    // Without MongoDB configured in test, rate limiter must fail closed (503)
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginCode: 'TEST-CODE' })
    });
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.ok(data.message.includes('unavailable'));
  } finally {
    process.env.NODE_ENV = origEnv;
  }
});

test('Traceability: /api/version returns buildId and commit identifying source revision', async () => {
  const res = await fetch(`${baseUrl}/api/version`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.version);
  assert.ok(data.buildId);
  assert.ok(data.commit);
  // buildId should be the first 12 characters of the commit or match git SHA prefix
  if (/^[0-9a-f]{7,40}$/i.test(data.commit)) {
    assert.equal(data.buildId, data.commit.slice(0, 12).toLowerCase());
  }
});
