const assert = require('assert');
process.env.MONGODB_URI = '';
process.env.VERCEL = '1';
process.env.NODE_ENV = 'test';
const storeDb = require('../src/db/store');
const { issueToken } = require('../src/config/auth');
const { app, server } = require('../src/app');

async function run() {
  await storeDb.ready;
  const id = Date.now().toString(36);
  const a = { _id: `friend-reg-a-${id}`, name: 'Regression A' };
  const b = { _id: `friend-reg-b-${id}`, name: 'Regression B' };
  const friendId = `friend-reg-${id}`;
  const initialMessages = storeDb.store.messages.length;
  const initialNotifications = storeDb.store.notifications.length;
  storeDb.store.users.push(a, b);
  storeDb.store.friendships.push({ _id: friendId, userId: a._id, friendId: b._id });
  const tokenA = issueToken(a, session => storeDb.store.sessions.push(session));
  const tokenB = issueToken(b, session => storeDb.store.sessions.push(session));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const sent = await fetch(`${base}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId: b._id, content: 'Friend chat still works', generateAiReply: false })
    });
    assert.strictEqual(sent.status, 201);
    const message = await sent.json();
    assert.strictEqual(message.content, 'Friend chat still works');
    const history = await fetch(`${base}/messages/with/${a._id}`, { headers: { Authorization: `Bearer ${tokenB}` } });
    assert.strictEqual(history.status, 200);
    assert((await history.json()).some(item => item._id === message._id));
  } finally {
    await new Promise(resolve => app.get('io').close(resolve));
    storeDb.store.messages.splice(initialMessages);
    storeDb.store.notifications.splice(initialNotifications);
    storeDb.store.friendships = storeDb.store.friendships.filter(item => item._id !== friendId);
    storeDb.store.users = storeDb.store.users.filter(item => item._id !== a._id && item._id !== b._id);
    storeDb.store.sessions = storeDb.store.sessions.filter(item => item.userId !== a._id && item.userId !== b._id);
    storeDb.persist();
  }
  console.log('Friend message POST and authenticated history retrieval PASS');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
