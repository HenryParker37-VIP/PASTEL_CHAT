process.env.NODE_ENV = 'test';
process.env.VERCEL = '1';
process.env.MONGODB_URI = '';
process.env.PASTELCHAT_DISABLE_PERSIST = '1';
process.env.TELEGRAM_POLLING = 'false';
delete process.env.REALTIME_RELAY;
delete process.env.WRITE_MODE;

const assert = require('node:assert/strict');
const { app, server } = require('../src/app');
const db = require('../src/db/store');
const { createUserToken } = require('../src/services/sessionAuth');
const { modelRouter } = require('../src/ai/conversationDirector');

async function request(base, path, token, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, data: await response.json() };
}

async function run() {
  await db.ready;
  const a = db.createUser({ name: `hybrid-writer-a-${Date.now()}`, loginCode: 'AAAA-BBBB' });
  const b = db.createUser({ name: `hybrid-writer-b-${Date.now()}`, loginCode: 'CCCC-DDDD' });
  const c = db.createUser({ name: `hybrid-writer-c-${Date.now()}`, loginCode: 'EEEE-FFFF' });
  db.addFriend(a._id, b._id);
  db.addFriend(b._id, a._id);
  const [ta, tb, tc] = [a, b, c].map(user => createUserToken(user));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const originalGenerate = modelRouter.generate;
  try {
    // No Socket.IO client connects: this is the Render-asleep path.
    const sent = await request(base, '/messages', ta, 'POST', { receiverId: b._id, content: 'friend while relay sleeps', clientMessageId: 'hybrid-friend-1' });
    assert.equal(sent.status, 201);
    assert.equal((await request(base, `/messages/with/${a._id}`, tb)).data.filter(m => m._id === sent.data._id).length, 1);
    const retry = await request(base, '/messages', ta, 'POST', { receiverId: b._id, content: 'friend while relay sleeps', clientMessageId: 'hybrid-friend-1' });
    assert.equal(retry.data._id, sent.data._id, 'REST retry duplicated a message');
    assert.equal((await request(base, `/messages/with/${a._id}`, tc)).status, 403);

    const delivered = await request(base, `/messages/${sent.data._id}/delivered`, tb, 'POST');
    const read = await request(base, `/messages/${sent.data._id}/read`, tb, 'POST');
    assert.equal(delivered.status, 200);
    assert.equal(read.status, 200);

    const group = db.createGroup({ name: 'relay-offline-group', creatorId: a._id, memberIds: [b._id] });
    const groupSent = await request(base, `/groups/${group._id}/messages`, ta, 'POST', { content: 'group while offline', clientMessageId: 'hybrid-group-1' });
    assert.equal(groupSent.status, 201);
    assert.equal((await request(base, `/messages/${groupSent.data._id}/read`, tb, 'POST')).status, 200);
    assert.equal((await request(base, `/messages/${groupSent.data._id}/read`, tc, 'POST')).status, 404);

    modelRouter.generate = async () => ({ bubbles: ['one', 'two', 'three'], reaction: null });
    const lyra = await request(base, '/messages', ta, 'POST', { receiverId: db.AI_USER_ID, content: 'Lyra while relay sleeps' });
    assert.equal(lyra.status, 201);
    assert.equal(lyra.data.aiReplies.length, 3);
    assert.equal((await request(base, `/messages/with/${db.AI_USER_ID}`, ta)).data.filter(m => lyra.data.aiReplies.some(reply => reply._id === m._id)).length, 3);

    console.log('hybridWriterFallback.test.js: no relay client, friend/group/Lyra writes, polling, receipts and retry dedup PASS');
  } finally {
    modelRouter.generate = originalGenerate;
    await new Promise(resolve => app.get('io').close(resolve));
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
