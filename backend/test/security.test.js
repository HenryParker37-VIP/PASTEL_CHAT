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
const jwt = require('jsonwebtoken');
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
  const demoCode = db.createAccessCode({ code: 'DEMO-TEST-1', label: 'Security demo', createdBy: admin._id });
  const adminToken = createUserToken(admin);
  const userToken = createUserToken(userA);
  const note = db.createNote(userB._id, { title: 'Private', content: 'Do not expose' });
  const report = (await request(base, '/feedback/report', { method: 'POST', token: userToken, body: { reportedUserId: userB._id, category: 'spam', description: '<img src=x onerror=alert(1)>' } })).body;
  const tests = [];
  const check = async (name, fn) => { await fn(); tests.push(name); };

  const ownerLogin = await request(base, '/auth/login', { method: 'POST', body: { loginCode: 'TEST-ADMIN-9' } });
  const demoLogin = await request(base, '/auth/login', { method: 'POST', body: { loginCode: 'DEMO-TEST-1' } });
  const ownerToken = ownerLogin.body.token;
  const demoToken = demoLogin.body.token;

  await check('owner code creates an OWNER session with privileged access', async () => {
    assert.strictEqual(ownerLogin.response.status, 200);
    assert.strictEqual(ownerLogin.body.user.adminRole, 'OWNER');
    const { response } = await request(base, '/admin/access-codes', { token: ownerToken });
    assert.strictEqual(response.status, 200);
  });
  await check('demo code creates a DEMO session with safe dashboard access', async () => {
    assert.strictEqual(demoLogin.response.status, 200);
    assert.strictEqual(demoLogin.body.user.adminRole, 'DEMO');
    const { response, body } = await request(base, '/admin/dashboard', { token: demoToken });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(body.adminRole, 'DEMO');
    assert.strictEqual(body.readOnly, true);
  });
  await check('demo session cannot suspend a user', async () => {
    const { response } = await request(base, `/admin/users/${userB._id}/suspend`, { method: 'POST', token: demoToken, body: {} });
    assert.strictEqual(response.status, 403);
  });
  await check('demo session cannot publish a release', async () => {
    const { response } = await request(base, '/admin/releases', { method: 'POST', token: demoToken, body: { version: '99.99.3-test', title: 'Denied' } });
    assert.strictEqual(response.status, 403);
  });
  await check('demo session cannot send an announcement or push', async () => {
    const { response } = await request(base, '/admin/announcements', { method: 'POST', token: demoToken, body: { title: 'Denied', body: 'Denied', scope: 'test' } });
    assert.strictEqual(response.status, 403);
  });
  await check('client role changes cannot upgrade a DEMO session', async () => {
    const { response } = await request(base, '/admin/access-codes', { method: 'POST', token: demoToken, body: { role: 'OWNER', expiration: '7d' } });
    assert.strictEqual(response.status, 403);
  });
  await check('tampered DEMO JWT claiming OWNER remains unauthorized', async () => {
    const decoded = jwt.decode(demoToken);
    const tamperedRoleToken = jwt.sign({ userId: decoded.userId, sid: decoded.sid, ver: decoded.ver, adminRole: 'OWNER' }, process.env.JWT_SECRET, { issuer: 'pastelchat', audience: 'pastelchat-web', algorithm: 'HS256' });
    const { response } = await request(base, '/admin/access-codes', { token: tamperedRoleToken });
    assert.strictEqual(response.status, 403);
  });
  await check('revoked demo code denies new login', async () => {
    const revoked = await request(base, `/admin/access-codes/${demoCode._id}/revoke`, { method: 'POST', token: ownerToken });
    assert.strictEqual(revoked.response.status, 200);
    const denied = await request(base, '/auth/login', { method: 'POST', body: { loginCode: 'DEMO-TEST-1' } });
    assert.strictEqual(denied.response.status, 401);
  });
  await check('expired demo code denies login', async () => {
    db.createAccessCode({ code: 'DEMO-TEST-EXP', expiresAt: new Date(Date.now() - 1000).toISOString(), createdBy: admin._id });
    const denied = await request(base, '/auth/login', { method: 'POST', body: { loginCode: 'DEMO-TEST-EXP' } });
    assert.strictEqual(denied.response.status, 401);
  });
  await check('revoking a demo code invalidates its active session', async () => {
    const activeCode = db.createAccessCode({ code: 'DEMO-TEST-2', createdBy: admin._id });
    const activeLogin = await request(base, '/auth/login', { method: 'POST', body: { loginCode: 'DEMO-TEST-2' } });
    assert.strictEqual(activeLogin.response.status, 200);
    const revoked = await request(base, `/admin/access-codes/${activeCode._id}/revoke`, { method: 'POST', token: ownerToken });
    assert.strictEqual(revoked.response.status, 200);
    const after = await request(base, '/admin/dashboard', { token: activeLogin.body.token });
    assert.strictEqual(after.response.status, 401);
  });

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
