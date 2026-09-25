process.env.NODE_ENV = 'test';
process.env.VERCEL = '1';
process.env.MONGODB_URI = '';
process.env.PASTELCHAT_DISABLE_PERSIST = '1';
process.env.TELEGRAM_POLLING = 'false';

const assert = require('assert');
const http = require('http');
const { app } = require('../src/app');
const storeDb = require('../src/db/store');
const { createUserToken } = require('../src/services/sessionAuth');

async function runTests() {
  console.log('🧪 Starting Lyra Conversation Controls Test Suite (Regenerate & Refresh Chat)...\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Setup test user
    const testUser = storeDb.createUser({
      name: 'Controls Tester',
      email: `tester-${Date.now()}@example.com`,
      password: 'password123'
    });
    const token = createUserToken(testUser);
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // Ensure Lyra exists
    let lyra = storeDb.findUser(u => u._id === 'user_ai_lyra' || u.isAI);
    if (!lyra) {
      lyra = storeDb.createUser({
        _id: 'user_ai_lyra',
        name: 'Lyra',
        isAI: true,
        aiCharacterId: 'char_lyra'
      });
    }

    console.log('1. Testing active AI session generation and retrieval...');
    const sessionRes = await fetch(`${baseUrl}/ai/conversation/session`, {
      method: 'GET',
      headers: authHeaders
    });
    const sessionData = await sessionRes.json();
    assert.strictEqual(sessionRes.status, 200);
    assert(sessionData.sessionId, 'Must return an active sessionId');
    const initialSessionId = sessionData.sessionId;
    console.log('  ✅ Active AI session successfully retrieved:', initialSessionId);

    console.log('\n2. Testing message submission stamped with active session...');
    const userMsg1Res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        receiverId: 'user_ai_lyra',
        content: 'Hello Lyra, what are your thoughts today?',
        clientMessageId: `ctrl-msg-1-${Date.now()}`,
        generateAiReply: false,
        conversationSessionId: initialSessionId
      })
    });
    const userMsg1 = await userMsg1Res.json();
    assert.strictEqual(userMsg1Res.status, 201);
    assert.strictEqual(userMsg1.conversationSessionId, initialSessionId);
    console.log('  ✅ Message persisted with conversationSessionId');

    console.log('\n3. Testing AI reply generation for user message...');
    const replyRes = await fetch(`${baseUrl}/messages/ai-reply`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        receiverId: 'user_ai_lyra',
        messageId: userMsg1._id
      })
    });
    const replyData = await replyRes.json();
    assert.strictEqual(replyRes.status, 200);
    assert(Array.isArray(replyData.aiReplies), 'aiReplies must be an array');
    assert(replyData.aiReplies.length > 0, 'Must return at least 1 AI bubble');
    const firstReplies = replyData.aiReplies;
    console.log(`  ✅ Lyra replied with ${firstReplies.length} bubbles`);

    // Verify bubbles have triggerMessageId and conversationSessionId
    for (const bubble of firstReplies) {
      assert.strictEqual(String(bubble.triggerMessageId), String(userMsg1._id));
      assert.strictEqual(bubble.conversationSessionId, initialSessionId);
    }
    console.log('  ✅ AI bubbles correctly stamped with triggerMessageId and conversationSessionId');

    console.log('\n4. Testing Regenerate Reply for latest user message...');
    const regenRes = await fetch(`${baseUrl}/messages/regenerate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        receiverId: 'user_ai_lyra',
        messageId: userMsg1._id
      })
    });
    const regenData = await regenRes.json();
    assert.strictEqual(regenRes.status, 200);
    assert.strictEqual(regenData.success, true);
    assert(Array.isArray(regenData.supersededIds), 'Must return supersededIds');
    assert.strictEqual(regenData.supersededIds.length, firstReplies.length);
    console.log(`  ✅ Successfully superseded ${regenData.supersededIds.length} previous bubbles`);

    // Verify superseded bubbles are marked isSuperseded in store and filtered out from getConversation
    const conv = storeDb.getConversation(testUser._id, 'user_ai_lyra');
    const supersededInConv = conv.filter(m => regenData.supersededIds.includes(m._id));
    assert.strictEqual(supersededInConv.length, 0, 'Superseded bubbles must not appear in conversation view');
    console.log('  ✅ Superseded bubbles excluded from getConversation query');

    console.log('\n5. Testing generation revision and 2-device race prevention...');
    const currentRev = await storeDb.getCurrentAITurnRevision(testUser._id, 'char_lyra');
    assert(currentRev > 0, 'Turn revision must be incremented after regenerate');

    // Simulate stale worker trying to commit a bubble with an older revision
    const staleBubbleResult = await storeDb.commitAIBubble(
      testUser._id,
      'char_lyra',
      userMsg1._id,
      {
        senderId: 'user_ai_lyra',
        receiverId: testUser._id,
        content: 'This is a stale completion that should be rejected'
      },
      currentRev - 1
    );
    assert.strictEqual(staleBubbleResult, null, 'Stale bubble commit with older revision must return null');
    console.log('  ✅ Stale generation with older revision successfully aborted and prevented from committing');

    console.log('\n6. Testing Refresh Chat (New Conversation session boundary)...');
    const refreshRes = await fetch(`${baseUrl}/ai/conversation/refresh`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        characterId: 'char_lyra'
      })
    });
    const refreshData = await refreshRes.json();
    assert.strictEqual(refreshRes.status, 200);
    assert.strictEqual(refreshData.success, true);
    assert(refreshData.sessionId, 'Must return new sessionId');
    assert.notStrictEqual(refreshData.sessionId, initialSessionId, 'New session must differ from initial');
    const newSessionId = refreshData.sessionId;

    assert(refreshData.boundaryMessage, 'Must return boundaryMessage');
    assert.strictEqual(refreshData.boundaryMessage.isSessionBoundary, true);
    assert.strictEqual(refreshData.boundaryMessage.conversationSessionId, newSessionId);
    console.log('  ✅ Session boundary created with new sessionId:', newSessionId);

    console.log('\n7. Testing session mismatch (409 SESSION_MISMATCH) for obsolete session writes...');
    const staleSessionMsgRes = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        receiverId: 'user_ai_lyra',
        content: 'This message uses an obsolete session ID',
        clientMessageId: `stale-sess-${Date.now()}`,
        generateAiReply: false,
        conversationSessionId: initialSessionId
      })
    });
    assert.strictEqual(staleSessionMsgRes.status, 409);
    const staleData = await staleSessionMsgRes.json();
    assert.strictEqual(staleData.code, 'SESSION_MISMATCH');
    assert.strictEqual(staleData.activeSessionId, newSessionId);
    console.log('  ✅ Server rejected stale session message with 409 SESSION_MISMATCH and returned activeSessionId');

    console.log('\n8. Testing session isolation in resolveAITurn (recent history context)...');
    // Send message under new session
    const newMsgRes = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        receiverId: 'user_ai_lyra',
        content: 'Fresh start: what is your favorite color?',
        clientMessageId: `fresh-msg-${Date.now()}`,
        generateAiReply: false,
        conversationSessionId: newSessionId
      })
    });
    const newMsg = await newMsgRes.json();
    assert.strictEqual(newMsgRes.status, 201);

    const { resolveAITurn } = require('../src/ai/resolveAITurn');
    const resolvedTurn = await resolveAITurn(storeDb, {
      userId: testUser._id,
      characterUser: lyra,
      messageId: newMsg._id
    });

    assert(resolvedTurn, 'Turn must resolve');
    const historyInTurn = resolvedTurn.recentHistory || [];
    // Verify none of the messages in history belong to the old session
    const oldSessionMsgsInTurn = historyInTurn.filter(m => m.conversationSessionId === initialSessionId);
    assert.strictEqual(oldSessionMsgsInTurn.length, 0, 'Messages from previous session must be excluded from recentHistory');
    // Verify session boundaries are not fed as dialogue history
    const boundaryInTurn = historyInTurn.filter(m => m.isSessionBoundary);
    assert.strictEqual(boundaryInTurn.length, 0, 'Session boundary markers must not be fed to model as dialogue');
    console.log('  ✅ Recent conversation context strictly isolated to current active session');

    console.log('\n9. Testing "Clear & Start New" Refresh Chat mode...');
    // Seed durable memory and character config to verify preservation
    storeDb.addAIMemory({
      userId: testUser._id,
      characterId: 'char_lyra',
      key: 'favorite_tea',
      value: 'Jasmine green tea with honey',
      category: 'preference'
    });
    storeDb.setUserCharacterConfig(testUser._id, 'char_lyra', {
      about: 'My custom Lyra',
      shouldRules: 'Be poetic and concise',
      shouldNotRules: 'Do not use emojis'
    });

    // Pin the newMsg
    const pinRes = await fetch(`${baseUrl}/messages/${newMsg._id}/pin`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(pinRes.status, 200);

    // Call Refresh Chat with mode: 'clear'
    const refreshClearRes = await fetch(`${baseUrl}/ai/conversation/refresh`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        characterId: 'char_lyra',
        mode: 'clear'
      })
    });
    const refreshClearData = await refreshClearRes.json();
    assert.strictEqual(refreshClearRes.status, 200);
    assert.strictEqual(refreshClearData.success, true);
    assert.strictEqual(refreshClearData.mode, 'clear');
    assert.strictEqual(refreshClearData.boundaryMessage, null, 'Clear mode must not create a boundary divider message');
    assert(refreshClearData.sessionId, 'Must generate new activeSessionId');
    assert.notStrictEqual(refreshClearData.sessionId, newSessionId, 'SessionId must be refreshed');
    const clearedSessionId = refreshClearData.sessionId;

    // Verify getConversation returns an empty list for the active view
    const convAfterClear = storeDb.getConversation(testUser._id, 'user_ai_lyra');
    assert.strictEqual(convAfterClear.length, 0, 'Active conversation must be empty after Clear & Start New');
    console.log('  ✅ getConversation query returns 0 messages after clear');

    // Verify pinned messages query returns empty list
    const pinnedAfterClear = storeDb.getPinnedMessages(testUser._id, 'user_ai_lyra');
    assert.strictEqual(pinnedAfterClear.length, 0, 'Pinned messages must exclude archived messages');
    console.log('  ✅ getPinnedMessages excludes archived messages');

    // Verify searchMessages returns empty list
    const searchAfterClear = storeDb.searchMessages(testUser._id, 'user_ai_lyra', 'favorite');
    assert.strictEqual(searchAfterClear.length, 0, 'Search must exclude archived messages');
    console.log('  ✅ searchMessages excludes archived messages');

    // Verify durable personal memories are preserved
    const memories = storeDb.getAIMemories(testUser._id, 'char_lyra');
    assert(memories.length > 0, 'Personal memories must be preserved');
    assert(memories.some(m => m.key === 'favorite_tea'), 'Specific personal memory must remain intact');
    console.log('  ✅ Personal memories preserved completely');

    // Verify Character Studio configuration is preserved
    const charConfig = storeDb.getUserCharacterConfig(testUser._id, 'char_lyra');
    assert(charConfig, 'Character config must be preserved');
    assert.strictEqual(charConfig.about, 'My custom Lyra');
    assert.strictEqual(charConfig.shouldRules, 'Be poetic and concise');
    console.log('  ✅ Character Studio config (Should / Should Not) preserved completely');

    // Verify subsequent prompt context in new session
    const postClearMsgRes = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        receiverId: 'user_ai_lyra',
        content: 'Brand new start after clear!',
        clientMessageId: `post-clear-${Date.now()}`,
        generateAiReply: false,
        conversationSessionId: clearedSessionId
      })
    });
    const postClearMsg = await postClearMsgRes.json();
    assert.strictEqual(postClearMsgRes.status, 201);

    const postClearResolvedTurn = await resolveAITurn(storeDb, {
      userId: testUser._id,
      characterUser: lyra,
      messageId: postClearMsg._id
    });
    assert(postClearResolvedTurn, 'Turn must resolve');
    const postClearHistory = postClearResolvedTurn.recentHistory || [];
    assert.strictEqual(postClearHistory.length, 1, 'Only the new message must exist in recentHistory after clear');
    assert.strictEqual(String(postClearHistory[0]._id), String(postClearMsg._id));
    console.log('  ✅ Subsequent prompt context contains only new session message with zero archived messages');

    console.log('\n🎉 ALL LYRA CONVERSATION CONTROLS TESTS PASSED!\n');
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
