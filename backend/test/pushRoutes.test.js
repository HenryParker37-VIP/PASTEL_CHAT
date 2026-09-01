const assert = require('assert');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pushRouter = require('../src/routes/push');
const {
  storePushSubscription,
  removePushSubscription,
  getPushSubscriptions
} = require('../src/db/store');
const webpush = require('web-push');
const authMiddleware = require('../src/middleware/auth');

function createMockReqRes({ method = 'GET', body = {}, query = {}, headers = {}, user = null }) {
  const req = {
    method,
    body,
    query,
    headers,
    user
  };

  let resData = null;
  let resStatus = 200;

  const res = {
    status(code) {
      resStatus = code;
      return this;
    },
    json(data) {
      resData = data;
      return this;
    },
    send(data) {
      resData = data;
      return this;
    },
    getData: () => resData,
    getStatus: () => resStatus
  };

  return { req, res };
}

async function runRouteTests() {
  console.log('🧪 Starting Push Route Unit/Integration Test Suite...\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ ${name}:`, err.message);
      failed++;
    }
  }

  const mockUser = { _id: 'test_route_user_' + Date.now(), name: 'TestUser' };

  // 1. GET /push/vapid-public-key
  await test('GET /push/vapid-public-key returns public key', async () => {
    const { req, res } = createMockReqRes({ method: 'GET' });
    const handler = pushRouter.stack.find(r => r.route?.path === '/vapid-public-key')?.route?.stack[0]?.handle;
    assert.ok(handler, 'Handler for /vapid-public-key should exist');
    handler(req, res);
    assert.strictEqual(res.getStatus(), 200);
    assert.ok(res.getData().publicKey);
    assert.strictEqual(typeof res.getData().publicKey, 'string');
  });

  // 2. Auth Middleware rejection
  await test('auth middleware rejects unauthenticated requests', async () => {
    const { req, res } = createMockReqRes({ method: 'POST', headers: {} });
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.getStatus(), 401);
  });

  // 3. POST /push/subscribe stores subscription
  await test('POST /push/subscribe stores subscription for authenticated user', async () => {
    const mockSub = {
      endpoint: 'https://push.services.mozilla.com/v1/sub_route_test_' + Date.now(),
      keys: { p256dh: 'mock_p256dh', auth: 'mock_auth' }
    };

    const { req, res } = createMockReqRes({
      method: 'POST',
      body: { subscription: mockSub },
      user: mockUser
    });

    const routeLayer = pushRouter.stack.find(r => r.route?.path === '/subscribe')?.route;
    assert.ok(routeLayer, 'Route for /subscribe should exist');
    const handler = routeLayer.stack[routeLayer.stack.length - 1].handle;
    handler(req, res);

    assert.strictEqual(res.getStatus(), 200);
    assert.strictEqual(res.getData().ok, true);

    const saved = getPushSubscriptions(mockUser._id);
    assert.strictEqual(saved.length, 1);
    assert.strictEqual(saved[0].endpoint, mockSub.endpoint);
  });

  // 4. POST /push/send-test delivers test push
  await test('POST /push/send-test sends test push to registered user devices', async () => {
    let sentNotification = false;
    const origSendNotification = webpush.sendNotification;
    webpush.sendNotification = async () => {
      sentNotification = true;
      return { statusCode: 201 };
    };

    try {
      const { req, res } = createMockReqRes({
        method: 'POST',
        user: mockUser
      });

      const routeLayer = pushRouter.stack.find(r => r.route?.path === '/send-test')?.route;
      assert.ok(routeLayer, 'Route for /send-test should exist');
      const handler = routeLayer.stack[routeLayer.stack.length - 1].handle;
      await handler(req, res);

      assert.strictEqual(res.getStatus(), 200);
      assert.strictEqual(res.getData().ok, true);
      assert.strictEqual(sentNotification, true);
    } finally {
      webpush.sendNotification = origSendNotification;
    }
  });

  // 5. POST /push/unsubscribe removes subscription
  await test('POST /push/unsubscribe removes device subscription', async () => {
    const saved = getPushSubscriptions(mockUser._id);
    assert.ok(saved.length > 0);
    const endpoint = saved[0].endpoint;

    const { req, res } = createMockReqRes({
      method: 'POST',
      body: { endpoint },
      user: mockUser
    });

    const routeLayer = pushRouter.stack.find(r => r.route?.path === '/unsubscribe')?.route;
    assert.ok(routeLayer, 'Route for /unsubscribe should exist');
    const handler = routeLayer.stack[routeLayer.stack.length - 1].handle;
    handler(req, res);

    assert.strictEqual(res.getStatus(), 200);
    assert.strictEqual(res.getData().ok, true);
    assert.strictEqual(getPushSubscriptions(mockUser._id).length, 0);
  });

  console.log(`\nRoute Results: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runRouteTests().catch(err => {
  console.error('Fatal route test error:', err);
  process.exit(1);
});
