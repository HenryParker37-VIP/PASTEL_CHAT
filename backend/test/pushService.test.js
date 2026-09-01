const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const {
  storePushSubscription,
  removePushSubscription,
  getPushSubscriptions,
  findUserById
} = require('../src/db/store');

const pushService = require('../src/services/pushService');
const webpush = require('web-push');

async function runTests() {
  console.log('🧪 Starting Push Notification Backend Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ ${name}:`, err.message);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ ${name}:`, err.message);
      failed++;
    }
  }

  // 1. VAPID Key configuration
  test('VAPID public key should be accessible', () => {
    const key = pushService.getVapidPublicKey();
    assert.ok(key, 'VAPID public key should be loaded');
    assert.strictEqual(typeof key, 'string');
    assert.ok(key.length > 20, 'VAPID key should have valid length');
  });

  // 2. Active Chat Tracking and Suppression Logic
  test('Active chat tracking and suppression logic', () => {
    const userA = 'user_test_a';
    const userB = 'user_test_b';
    const userC = 'user_test_c';

    assert.strictEqual(pushService.isUserInActiveChat(userA, userB), false);

    pushService.setActiveChat(userA, userB);
    assert.strictEqual(pushService.isUserInActiveChat(userA, userB), true);
    assert.strictEqual(pushService.isUserInActiveChat(userA, userC), false);

    pushService.clearActiveChat(userA, userB);
    assert.strictEqual(pushService.isUserInActiveChat(userA, userB), false);

    // Multi-chat support
    pushService.setActiveChat(userA, userB);
    pushService.setActiveChat(userA, userC);
    assert.strictEqual(pushService.isUserInActiveChat(userA, userB), true);
    assert.strictEqual(pushService.isUserInActiveChat(userA, userC), true);

    pushService.clearActiveChat(userA);
    assert.strictEqual(pushService.isUserInActiveChat(userA, userB), false);
    assert.strictEqual(pushService.isUserInActiveChat(userA, userC), false);
  });

  // 3. Multi-device Push Subscription Storage in DB Store
  test('Multi-device push subscription store and remove', () => {
    const testUserId = 'test_user_multidevice_' + Date.now();
    const sub1 = { endpoint: 'https://push.apple.com/sub1', keys: { p256dh: 'key1', auth: 'auth1' } };
    const sub2 = { endpoint: 'https://fcm.googleapis.com/sub2', keys: { p256dh: 'key2', auth: 'auth2' } };

    // Initially empty
    assert.deepStrictEqual(getPushSubscriptions(testUserId), []);

    // Store first device
    storePushSubscription(testUserId, sub1);
    let subs = getPushSubscriptions(testUserId);
    assert.strictEqual(subs.length, 1);
    assert.strictEqual(subs[0].endpoint, sub1.endpoint);

    // Store duplicate endpoint (should not duplicate)
    storePushSubscription(testUserId, sub1);
    subs = getPushSubscriptions(testUserId);
    assert.strictEqual(subs.length, 1);

    // Store second device
    storePushSubscription(testUserId, sub2);
    subs = getPushSubscriptions(testUserId);
    assert.strictEqual(subs.length, 2);

    // Remove first device endpoint
    removePushSubscription(testUserId, sub1.endpoint);
    subs = getPushSubscriptions(testUserId);
    assert.strictEqual(subs.length, 1);
    assert.strictEqual(subs[0].endpoint, sub2.endpoint);

    // Remove second device endpoint
    removePushSubscription(testUserId, sub2.endpoint);
    subs = getPushSubscriptions(testUserId);
    assert.strictEqual(subs.length, 0);
  });

  // 4. Message Push Payload Formatting
  await asyncTest('sendMessagePush formats title, body, deep-link, and tag correctly', async () => {
    const testReceiver = 'receiver_' + Date.now();
    const testSender = { _id: 'sender_123', name: 'Henry' };

    let capturedPayload = null;
    let capturedTo = null;
    const origSendNotification = webpush.sendNotification;

    // Mock webpush.sendNotification to verify payload
    webpush.sendNotification = async (sub, payloadStr) => {
      capturedPayload = JSON.parse(payloadStr);
      return { statusCode: 201 };
    };

    try {
      const mockSub = { endpoint: 'https://push.example.com/mock1', keys: { p256dh: 'k', auth: 'a' } };
      storePushSubscription(testReceiver, mockSub);

      await pushService.sendMessagePush(testReceiver, testSender, 'bro đang đâu đó');

      assert.ok(capturedPayload, 'Payload should be captured');
      assert.strictEqual(capturedPayload.title, 'PastelChat');
      assert.strictEqual(capturedPayload.body, 'Henry: bro đang đâu đó');
      assert.strictEqual(capturedPayload.url, '/chat/sender_123');
      assert.strictEqual(capturedPayload.tag, 'msg-sender_123');
      assert.strictEqual(capturedPayload.data.url, '/chat/sender_123');
      assert.strictEqual(capturedPayload.data.type, 'new_message');

      // Test with media/photo
      capturedPayload = null;
      await pushService.sendMessagePush(testReceiver, testSender, { media: { type: 'image' } });
      assert.strictEqual(capturedPayload.body, 'Henry: Sent a photo 📷');

      // Clean up test sub
      removePushSubscription(testReceiver, mockSub.endpoint);
    } finally {
      webpush.sendNotification = origSendNotification;
    }
  });

  // 5. Friend Request Push Payload Formatting
  await asyncTest('sendFriendRequestPush formats title, body, and deep-link correctly', async () => {
    const testReceiver = 'receiver_fr_' + Date.now();
    const testSender = { _id: 'sender_456', name: 'Minh' };

    let capturedPayload = null;
    const origSendNotification = webpush.sendNotification;

    webpush.sendNotification = async (sub, payloadStr) => {
      capturedPayload = JSON.parse(payloadStr);
      return { statusCode: 201 };
    };

    try {
      const mockSub = { endpoint: 'https://push.example.com/mock2', keys: { p256dh: 'k', auth: 'a' } };
      storePushSubscription(testReceiver, mockSub);

      await pushService.sendFriendRequestPush(testReceiver, testSender);

      assert.ok(capturedPayload, 'Payload should be captured');
      assert.strictEqual(capturedPayload.title, 'PastelChat');
      assert.strictEqual(capturedPayload.body, 'Minh sent you a friend request');
      assert.strictEqual(capturedPayload.url, '/friends');
      assert.strictEqual(capturedPayload.tag, 'friend-req-sender_456');
      assert.strictEqual(capturedPayload.data.url, '/friends');
      assert.strictEqual(capturedPayload.data.type, 'friend_request');

      removePushSubscription(testReceiver, mockSub.endpoint);
    } finally {
      webpush.sendNotification = origSendNotification;
    }
  });

  // 6. Suppression when Receiver is in Active Chat
  await asyncTest('Push is suppressed when receiver is actively viewing sender conversation', async () => {
    const testReceiver = 'receiver_active_' + Date.now();
    const testSender = { _id: 'sender_active_789', name: 'Alice' };

    let sendCalled = false;
    const origSendNotification = webpush.sendNotification;
    webpush.sendNotification = async () => {
      sendCalled = true;
      return { statusCode: 201 };
    };

    try {
      const mockSub = { endpoint: 'https://push.example.com/mock3', keys: { p256dh: 'k', auth: 'a' } };
      storePushSubscription(testReceiver, mockSub);

      // Set active chat
      pushService.setActiveChat(testReceiver, testSender._id);

      const result = await pushService.sendMessagePush(testReceiver, testSender, 'Hello!');
      assert.strictEqual(sendCalled, false, 'webpush.sendNotification should NOT be called when in active chat');
      assert.strictEqual(result.suppressed, true);
      assert.strictEqual(result.reason, 'active_chat');

      // Clear active chat -> now it should send
      pushService.clearActiveChat(testReceiver, testSender._id);
      const result2 = await pushService.sendMessagePush(testReceiver, testSender, 'Hello again!');
      assert.strictEqual(sendCalled, true, 'webpush.sendNotification SHOULD be called when active chat is cleared');
      assert.strictEqual(result2.sent, 1);

      removePushSubscription(testReceiver, mockSub.endpoint);
    } finally {
      webpush.sendNotification = origSendNotification;
    }
  });

  // 7. Suppression when Sender === Receiver (self message)
  await asyncTest('Push is never sent to self', async () => {
    const user = { _id: 'same_user_123', name: 'Self' };
    const result = await pushService.sendMessagePush(user._id, user, 'Self note');
    assert.strictEqual(result.suppressed, true);
    assert.strictEqual(result.reason, 'self');
  });

  // 8. Auto-cleanup of Expired Subscriptions (410 / 404)
  await asyncTest('Expired subscriptions (HTTP 410/404) are automatically removed', async () => {
    const testUser = 'user_expired_' + Date.now();
    const staleSub = { endpoint: 'https://push.example.com/stale', keys: { p256dh: 'k', auth: 'a' } };
    const validSub = { endpoint: 'https://push.example.com/valid', keys: { p256dh: 'k', auth: 'a' } };

    storePushSubscription(testUser, staleSub);
    storePushSubscription(testUser, validSub);
    assert.strictEqual(getPushSubscriptions(testUser).length, 2);

    const origSendNotification = webpush.sendNotification;
    webpush.sendNotification = async (sub) => {
      if (sub.endpoint === staleSub.endpoint) {
        const error = new Error('Subscription expired');
        error.statusCode = 410;
        throw error;
      }
      return { statusCode: 201 };
    };

    try {
      await pushService.sendTestPush(testUser);

      const remainingSubs = getPushSubscriptions(testUser);
      assert.strictEqual(remainingSubs.length, 1);
      assert.strictEqual(remainingSubs[0].endpoint, validSub.endpoint, 'Only valid subscription should remain');

      removePushSubscription(testUser, validSub.endpoint);
    } finally {
      webpush.sendNotification = origSendNotification;
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
