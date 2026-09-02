// Controlled local security regression suite. It uses isolated in-memory
// records and never targets MongoDB, Render, push providers, or real users.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'local-security-test-secret';
process.env.ADMIN_LOGIN_CODE = 'TEST-ADMIN-9';
process.env.MONGODB_URI = '';
process.env.CLIENT_URL = 'http://127.0.0.1:0';
process.env.PORT = '0';
process.env.PASTELCHAT_DISABLE_PERSIST = '1';

const assert = require('assert');
const { once } = require('events');
const { app, server } = require('../src/app');
const db = require('../src/db/store');
const { createUserToken } = require('../src/services/sessionAuth');

async function request(base, endpoint, options = {}) {
  const response = await fetch(`${base}${endpoint}`, { headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) }, ...options, body: options.body ? JSON.stringify(options.body) : undefined });
  let body = null;
  try { body = await response.json(); } catch { /* empty response */ }
  return { response, body };
}

async function run() {
  await db.ready;
  if (!server.listening) await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const snapshot = {};
  Object.keys(db.store).forEach((key) => { snapshot[key] = db.store[key]; });
  const admin = db.createUser({ _id: 'security-admin', name: 'Security Admin', loginCode: 'TEST-ADMIN-9', isAdmin: true, isTestAccount: true });
  const userA = db.createUser({ _id: 'security-user-a', name: 'Security A', loginCode: 'TEST-USER-A', isTestAccount: true });
  const userB = db.createUser({ _id: 'security-user-b', name: 'Security B', loginCode: 'TEST-USER-B', isTestAccount: true });
  const adminToken = createUserToken(admin);
  const userToken = createUserToken(userA);
  const note = db.createNote(userB._id, { title: 'Private', content: 'Do not expose' });
  const report = (await request(base, '/feedback/report', { method: 'POST', token: userToken, body: { reportedUserId: userB._id, category: 'spam', description: '<img src=x onerror=alert(1)>' } })).body;
  const tests = [];
  const check = async (name, fn) => { await fn(); tests.push(name); };

  await check('normal user cannot access admin dashboard', async () => {
    const { response } = await request(base, '/admin/dashboard', { token: userToken });
    assert.strictEqual(response.status, 403);
  });
  await check('normal user cannot publish release', async () => {
    const { response } = await request(base, '/admin/releases', { method: 'POST', token: userToken, body: { version: '99.99.1', title: 'Denied' } });
    assert.strictEqual(response.status, 403);
  });
  await check('admin dashboard is metadata-only and has security headers', async () => {
    const { response, body } = await request(base, '/admin/dashboard', { token: adminToken });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(body.metrics && body.health && body.analytics);
    assert.ok(!JSON.stringify(body.users).includes('TEST-ADMIN-9'));
  });
  await check('tampered JWT is denied', async () => {
    const { response } = await request(base, '/auth/me', { token: `${userToken}tampered` });
    assert.strictEqual(response.status, 401);
  });
  await check('private note ownership is enforced', async () => {
    const { response } = await request(base, `/private-space/notes/${note._id}`, { method: 'DELETE', token: userToken });
    assert.strictEqual(response.status, 403);
    assert.ok(db.findNote(note._id));
  });
  await check('conversation access requires a friendship', async () => {
    const { response } = await request(base, `/messages/with/${userB._id}`, { token: userToken });
    assert.strictEqual(response.status, 403);
  });
  await check('admin can moderate a report and ordinary users cannot', async () => {
    assert.strictEqual(report.success, true);
    const denied = await request(base, `/admin/reports/${report.id}`, { method: 'PATCH', token: userToken, body: { status: 'Resolved' } });
    assert.strictEqual(denied.response.status, 403);
    const allowed = await request(base, `/admin/reports/${report.id}`, { method: 'PATCH', token: adminToken, body: { status: 'Resolved', resolution: 'Reviewed in test' } });
    assert.strictEqual(allowed.response.status, 200);
    assert.strictEqual(allowed.body.report.status, 'Resolved');
  });
  await check('release publication is idempotent', async () => {
    const payload = { version: '99.99.2-test', title: 'Security test release', summary: 'Test only', features: ['Controlled test'] };
    const first = await request(base, '/admin/releases', { method: 'POST', token: adminToken, body: payload });
    const second = await request(base, '/admin/releases', { method: 'POST', token: adminToken, body: payload });
    assert.strictEqual(first.response.status, 201);
    assert.strictEqual(second.response.status, 200);
    assert.strictEqual(second.body.duplicate, true);
  });
  await check('force logout invalidates an existing session', async () => {
    const forced = await request(base, `/admin/users/${userA._id}/force-logout`, { method: 'POST', token: adminToken, body: {} });
    assert.strictEqual(forced.response.status, 200);
    const after = await request(base, '/auth/me', { token: userToken });
    assert.strictEqual(after.response.status, 401);
  });

  Object.keys(snapshot).forEach((key) => { db.store[key] = snapshot[key]; });
  db.persist();
  server.close();
  console.log(`Security regression tests: ${tests.length} passed, 0 failed`);
}

run().catch((error) => {
  console.error('Security regression tests failed:', error.message);
  server.close();
  process.exitCode = 1;
});
