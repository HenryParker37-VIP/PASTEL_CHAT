const assert = require('assert');

// Mock browser window and localStorage for Node test environment
global.window = {
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; },
    get length() { return Object.keys(this._data).length; },
    key(i) { return Object.keys(this._data)[i] || null; }
  }
};

async function runTests() {
  console.log('🧪 Starting Conversation Cache & Message Reconciliation Test Suite...\n');

  const {
    getCachedConversation,
    setCachedConversation,
    getCachedFriend,
    getCachedAvatar,
    mergeMessages
  } = await import('../../frontend/src/utils/conversationCache.js');

  const { resolveCharacterAvatar } = await import('../../frontend/src/utils/characterAvatar.js');

  const userId = 'user_henry_123';
  const friendId = 'user_ai_lyra';
  const customAvatar = 'data:image/png;base64,CUSTOM_LYRA_AVATAR_TEST';

  // ── Test 1: In-memory & localStorage write/read ────────────────────────────
  console.log('Test 1: In-memory & localStorage conversation caching');
  const initialMessages = [
    { _id: 'm1', content: 'hello Lyra', timestamp: '2026-09-24T00:00:00.000Z' },
    { _id: 'm2', content: 'hey Henry! :)', timestamp: '2026-09-24T00:00:01.000Z' }
  ];
  const initialFriend = {
    _id: friendId,
    name: 'Lyra',
    avatar: customAvatar,
    isAI: true
  };

  setCachedConversation(userId, friendId, {
    messages: initialMessages,
    friend: initialFriend,
    resolvedAvatar: customAvatar
  });

  const cached = getCachedConversation(userId, friendId);
  assert.ok(cached, 'Cached conversation should exist');
  assert.strictEqual(cached.messages.length, 2, 'Should have 2 cached messages');
  assert.strictEqual(cached.friend.name, 'Lyra', 'Should have Lyra as cached friend');
  assert.strictEqual(cached.resolvedAvatar, customAvatar, 'Should have stored resolved avatar');
  assert.strictEqual(getCachedFriend(userId, friendId).avatar, customAvatar, 'getCachedFriend should return avatar');
  assert.strictEqual(getCachedAvatar(userId, friendId), customAvatar, 'getCachedAvatar should return custom avatar');
  console.log('  ✅ In-memory & localStorage conversation caching verified\n');

  // ── Test 2: Instant avatar resolution across unmount ──────────────────────
  console.log('Test 2: Synchronous avatar resolution when friend is null and messages is empty');
  // Simulate fresh component mount after navigation: friend=null, messages=[]
  const resolvedOnMount = resolveCharacterAvatar({
    friend: null,
    sender: null,
    messages: [],
    friendId,
    userId
  });
  assert.strictEqual(resolvedOnMount, customAvatar, 'Should synchronously resolve cached custom avatar at t=0ms');
  console.log('  ✅ Synchronously resolves cached custom avatar without default flash\n');

  // ── Test 3: Message reconciliation: deduplication by _id ──────────────────
  console.log('Test 3: Reconciliation deduplicates messages by _id');
  const cachedBatch = [
    { _id: 'm1', content: 'first', timestamp: '2026-09-24T00:00:00.000Z' },
    { _id: 'm2', content: 'second', timestamp: '2026-09-24T00:00:01.000Z' }
  ];
  const serverBatch = [
    { _id: 'm1', content: 'first', timestamp: '2026-09-24T00:00:00.000Z' },
    { _id: 'm2', content: 'second updated', timestamp: '2026-09-24T00:00:01.000Z', deliveryStatus: 'read' },
    { _id: 'm3', content: 'third (new from server)', timestamp: '2026-09-24T00:00:02.000Z' }
  ];

  const merged = mergeMessages(cachedBatch, serverBatch, []);
  assert.strictEqual(merged.length, 3, 'Should have exactly 3 unique messages');
  assert.strictEqual(merged[1].deliveryStatus, 'read', 'Server update should merge into existing message');
  assert.strictEqual(merged[2]._id, 'm3', 'New server message should append');
  console.log('  ✅ Deduplication by _id verified\n');

  // ── Test 4: Message reconciliation: pending message replacement ───────────
  console.log('Test 4: Replaces pending sending message with server confirmed message');
  const clientMsgId = 'client-pending-abc123';
  const pendingMsg = {
    _id: clientMsgId,
    clientMessageId: clientMsgId,
    content: 'i love coffee',
    deliveryStatus: 'sending',
    timestamp: '2026-09-24T00:00:05.000Z'
  };

  const cachedWithPending = [...cachedBatch, pendingMsg];
  // Server confirms the message with actual DB _id 'db-msg-999' but matching clientMessageId
  const serverConfirmed = [
    { _id: 'm1', content: 'first', timestamp: '2026-09-24T00:00:00.000Z' },
    { _id: 'm2', content: 'second', timestamp: '2026-09-24T00:00:01.000Z' },
    {
      _id: 'db-msg-999',
      clientMessageId: clientMsgId,
      content: 'i love coffee',
      deliveryStatus: 'sent',
      timestamp: '2026-09-24T00:00:05.000Z'
    }
  ];

  const reconciled = mergeMessages(cachedWithPending, serverConfirmed, []);
  assert.strictEqual(reconciled.length, 3, 'Should replace pending placeholder with confirmed server message (no duplicate)');
  assert.strictEqual(reconciled[2].deliveryStatus, 'sent', 'Status should update from sending to sent');
  console.log('  ✅ Pending placeholder replaced without duplication\n');

  // ── Test 5: Unconfirmed pending messages preserved during background sync ──
  console.log('Test 5: Preserves unconfirmed pending messages during background sync');
  const newPendingMsg = {
    _id: 'client-pending-xyz789',
    clientMessageId: 'client-pending-xyz789',
    content: 'brand new text just sent',
    deliveryStatus: 'sending',
    timestamp: '2026-09-24T00:00:10.000Z'
  };

  // Server response has not seen newPendingMsg yet (e.g. background sync request was already in-flight)
  const staleServerBatch = [
    { _id: 'm1', content: 'first', timestamp: '2026-09-24T00:00:00.000Z' },
    { _id: 'm2', content: 'second', timestamp: '2026-09-24T00:00:01.000Z' }
  ];

  const preservedResult = mergeMessages(
    [...cachedBatch, newPendingMsg],
    staleServerBatch,
    [newPendingMsg]
  );
  assert.strictEqual(preservedResult.length, 3, 'Unconfirmed pending message must NOT be discarded');
  assert.strictEqual(preservedResult[2].clientMessageId, 'client-pending-xyz789', 'Pending message preserved');
  console.log('  ✅ Unconfirmed newly-sent messages preserved\n');

  // ── Test 6: Strict chronological sorting ──────────────────────────────────
  console.log('Test 6: Strict chronological timestamp sorting');
  const unsorted = [
    { _id: 'm3', content: 'c', timestamp: '2026-09-24T00:00:03.000Z' },
    { _id: 'm1', content: 'a', timestamp: '2026-09-24T00:00:01.000Z' },
    { _id: 'm2', content: 'b', timestamp: '2026-09-24T00:00:02.000Z' }
  ];
  const sorted = mergeMessages([], unsorted, []);
  assert.deepStrictEqual(
    sorted.map(m => m._id),
    ['m1', 'm2', 'm3'],
    'Messages must be sorted in ascending chronological order'
  );
  console.log('  ✅ Chronological ordering verified\n');

  console.log('🎉 All Conversation Cache & Message Reconciliation tests passed successfully!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
