const assert = require('assert');
const http = require('http');
const { app } = require('../src/app');
const storeDb = require('../src/db/store');
const { createUserToken } = require('../src/services/sessionAuth');

async function runIntegration() {
  console.log('🧪 Starting End-to-End Turn-Taking Server Integration Test...\n');

  // Create an ephemeral HTTP server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Get test user
    let testUser = storeDb.findUser(u => !u.isAI && u._id !== 'user_ai_lyra');
    if (!testUser) {
      testUser = storeDb.createUser({ name: 'Henry Tester', email: 'henry.tester@example.com', password: 'password123' });
    }

    const token = createUserToken(testUser);
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 1. Send first message in a burst with generateAiReply: false
    console.log('1. Testing POST /messages with generateAiReply: false (rapid burst message 1)...');
    const msg1Res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        receiverId: 'user_ai_lyra',
        content: "I think I'm gonna quit",
        clientMessageId: `test-burst-${Date.now()}-1`,
        generateAiReply: false
      })
    });
    const msg1Data = await msg1Res.json();
    assert.strictEqual(msg1Res.status, 201, 'Message 1 must be created with 201');
    assert.strictEqual(msg1Data.content, "I think I'm gonna quit");
    assert(Array.isArray(msg1Data.aiReplies), 'aiReplies must be an array');
    assert.strictEqual(msg1Data.aiReplies.length, 0, 'aiReplies must be empty when generateAiReply is false');
    console.log('  ✅ Rapid message 1 persisted immediately without triggering unneeded generation');

    // 2. Send second message in burst with generateAiReply: false
    console.log('2. Testing POST /messages with generateAiReply: false (rapid burst message 2)...');
    const msg2Res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        receiverId: 'user_ai_lyra',
        content: 'the game lol',
        clientMessageId: `test-burst-${Date.now()}-2`,
        generateAiReply: false
      })
    });
    const msg2Data = await msg2Res.json();
    assert.strictEqual(msg2Res.status, 201, 'Message 2 must be created with 201');
    assert.strictEqual(msg2Data.content, 'the game lol');
    assert.strictEqual(msg2Data.aiReplies.length, 0, 'aiReplies must be empty for burst message 2');
    console.log('  ✅ Rapid message 2 persisted immediately');

    // 3. User finishes typing -> micro-turn commits -> POST /messages/ai-reply
    console.log('3. Testing POST /messages/ai-reply (turn commit after burst)...');
    const replyRes = await fetch(`${baseUrl}/messages/ai-reply`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        receiverId: 'user_ai_lyra'
      })
    });
    const replyData = await replyRes.json();
    assert.strictEqual(replyRes.status, 200, 'POST /messages/ai-reply must return 200');
    assert(Array.isArray(replyData.aiReplies), 'aiReplies must be returned');
    assert(replyData.aiReplies.length > 0, 'Lyra must produce response bubbles');
    console.log(`  ✅ Lyra responded with ${replyData.aiReplies.length} bubble(s):`);
    replyData.aiReplies.forEach((b, idx) => {
      console.log(`     Bubble ${idx + 1}: "${b.content}"`);
    });

    console.log('\n🎉 End-to-End Server Turn-Taking test passed successfully!\n');
  } finally {
    server.close();
  }
}

runIntegration().catch(err => {
  console.error('❌ Server Integration Test failed:', err);
  process.exit(1);
});
