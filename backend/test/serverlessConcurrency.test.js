const assert = require('assert');
const { fork } = require('child_process');
const path = require('path');
const { MongoClient } = require('mongoose').mongo;

const base = process.env.PASTELCHAT_TEST_MONGO_URI;
if (!base || !/^mongodb:\/\/127\.0\.0\.1:27029\//.test(base)) {
  throw new Error('Set PASTELCHAT_TEST_MONGO_URI to the disposable local MongoDB replica set on 127.0.0.1:27029');
}
const dbName = `pastelchat_concurrency_${Date.now()}`;
const uri = base.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
let nextId = 0;

function worker() {
  const child = fork(path.join(__dirname, 'helpers/personalizationWorker.js'), [], {
    env: { ...process.env, MONGODB_URI: uri, SERVERLESS: '1', VERCEL: '', NODE_ENV: 'test' },
    stdio: ['ignore', 'ignore', 'inherit', 'ipc']
  });
  const pending = new Map();
  const started = new Map();
  const signaled = new Set();
  child.on('message', message => {
    if (message.event === 'provider_started') { signaled.add(message.requestId); started.get(message.requestId)?.(); return; }
    const job = pending.get(message.requestId);
    if (!job) return;
    pending.delete(message.requestId);
    if (message.error) job.reject(Object.assign(new Error(message.error.message), { status: message.error.status }));
    else job.resolve(message.result);
  });
  child.on('exit', code => {
    for (const job of pending.values()) job.reject(new Error(`Worker exited ${code}`));
    pending.clear();
  });
  function call(command, args = {}) {
    const requestId = ++nextId;
    const promise = new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
    child.send({ requestId, command, args });
    return { requestId, promise };
  }
  return { child, call, waitForProvider(requestId) { return signaled.has(requestId) ? Promise.resolve() : new Promise(resolve => started.set(requestId, resolve)); } };
}

async function run() {
  const client = new MongoClient(uri, { directConnection: true });
  await client.connect();
  const db = client.db();
  const users = ['alice', 'bob', 'cara'].map(_id => ({ _id, name: _id, isAI: false }));
  const lyra = { _id: 'user_ai_lyra', name: 'Lyra', isAI: true, aiCharacterId: 'char_lyra' };
  const old = { _id: 'legacy-alice', senderId: 'alice', receiverId: lyra._id, content: 'old turn', timestamp: '2026-09-01T00:00:00.000Z' };
  await db.collection('pastelchat_state').insertOne({ key: 'primary', data: { users: [lyra, ...users], messages: [old], friendships: [] }, updatedAt: new Date() });
  const workers = [worker(), worker(), worker()];
  try {
    const [alice, bob, cara] = await Promise.all(workers.map((entry, index) => entry.call('create', {
      userId: users[index]._id, content: `My name is ${users[index].name}.`
    }).promise));
    const initialIds = [alice.id, bob.id, cara.id];
    assert.strictEqual(await db.collection('pastelchat_messages').countDocuments({}), 3);
    await Promise.all(workers.map(entry => entry.call('snapshot').promise));
    assert.strictEqual(await db.collection('pastelchat_messages').countDocuments({}), 3, 'Stale whole-snapshot writes cannot remove individual messages');
    const resolvedOnWarmWorker = await workers[1].call('resolve', { userId: 'alice', messageId: alice.id }).promise;
    assert.strictEqual(resolvedOnWarmWorker.id, alice.id);
    await assert.rejects(workers[1].call('resolve', { userId: 'alice', messageId: bob.id }).promise, error => error.status === 409);
    await assert.rejects(workers[1].call('resolve', { userId: 'alice', messageId: old._id }).promise, error => error.status === 409);
    await assert.rejects(workers[1].call('resolve', { userId: 'alice' }).promise, error => error.status === 400);

    const held = workers[0].call('generate', { userId: 'alice', messageId: alice.id, hold: true, bubbles: ['obsolete bubble'] });
    await workers[0].waitForProvider(held.requestId);
    const newer = await workers[1].call('create', { userId: 'alice', content: 'Actually, my name is Alicia.' }).promise;
    await workers[0].call('release', { requestId: held.requestId }).promise;
    const obsolete = await held.promise;
    assert.deepStrictEqual(obsolete.replies, []);
    assert.strictEqual(await db.collection('pastelchat_messages').countDocuments({ 'data.content': 'obsolete bubble' }), 0);
    await assert.rejects(workers[2].call('resolve', { userId: 'alice', messageId: alice.id }).promise, error => error.status === 409);
    assert.strictEqual((await workers[2].call('resolve', { userId: 'alice', messageId: newer.id }).promise).id, newer.id);

    // The newer turn can also arrive after the final check but before the
    // transactional bubble insert. The transaction must reject the old bubble.
    const atCommit = workers[0].call('generate', { userId: 'alice', messageId: newer.id, holdCommit: true, bubbles: ['late obsolete bubble'] });
    await workers[0].waitForProvider(atCommit.requestId);
    const newest = await workers[1].call('create', { userId: 'alice', content: 'My name is Alice again.' }).promise;
    await workers[0].call('release', { requestId: atCommit.requestId }).promise;
    assert.deepStrictEqual((await atCommit.promise).replies, []);
    assert.strictEqual(await db.collection('pastelchat_messages').countDocuments({ 'data.content': 'late obsolete bubble' }), 0);
    assert.strictEqual((await workers[2].call('resolve', { userId: 'alice', messageId: newest.id }).promise).id, newest.id);

    const generation = await Promise.all([
      workers[0].call('generate', { userId: 'alice', messageId: newest.id, bubbles: ['A1', 'A2', 'A3'] }).promise,
      workers[1].call('generate', { userId: 'bob', messageId: bob.id, bubbles: ['B1'] }).promise,
      workers[2].call('generate', { userId: 'cara', messageId: cara.id, bubbles: ['C1'] }).promise
    ]);
    assert.deepStrictEqual(generation.map(item => item.replies), [['A1', 'A2', 'A3'], ['B1'], ['C1']]);
    generation.forEach((item, index) => {
      const userId = users[index]._id;
      assert(item.events.filter(event => event.content).every(event => event.recipient === userId));
    });
    assert.strictEqual((await workers[1].call('deleteMemory', { userId: 'alice', key: 'name' }).promise).deleted, true);
    const afterDelete = await workers[2].call('create', { userId: 'alice', content: 'How was your day?' }).promise;
    await workers[0].call('generate', { userId: 'alice', messageId: afterDelete.id, bubbles: ['pretty good'] }).promise;
    const aliceLayer = await db.collection('pastelchat_personal_layers').findOne({ _id: JSON.stringify(['alice', 'char_lyra']) });
    assert(!aliceLayer.memories.some(memory => memory.key === 'name'), 'Deleted memory must stay deleted despite old history');
    const friend = await workers[0].call('create', { userId: 'bob', receiverId: 'alice', content: 'friend chat still works' }).promise;
    assert((await workers[2].call('conversation', { userId: 'bob', receiverId: 'alice' }).promise).messages.includes(friend.id));
    const sameMillisecond = new Date(Date.now() + 1000).toISOString();
    const rapidFirst = await workers[0].call('create', { userId: 'alice', content: 'rapid first', timestamp: sameMillisecond }).promise;
    const rapidSecond = await workers[1].call('create', { userId: 'alice', content: 'rapid second', timestamp: sameMillisecond }).promise;
    await assert.rejects(workers[2].call('resolve', { userId: 'alice', messageId: rapidFirst.id }).promise, error => error.status === 409);
    assert.strictEqual((await workers[2].call('resolve', { userId: 'alice', messageId: rapidSecond.id }).promise).id, rapidSecond.id);
    const delayedSequence = (await workers[0].call('allocate', { userId: 'alice' }).promise).sequence;
    const trulyNewer = await workers[1].call('create', { userId: 'alice', content: 'newer allocation wins' }).promise;
    const delayedOlder = await workers[0].call('create', { userId: 'alice', content: 'older request arrived late', aiTurnSequence: delayedSequence }).promise;
    await assert.rejects(workers[2].call('resolve', { userId: 'alice', messageId: delayedOlder.id }).promise, error => error.status === 409);
    const resolvedLatest = await workers[2].call('resolve', { userId: 'alice', messageId: trulyNewer.id }).promise;
    assert.strictEqual(resolvedLatest.id, trulyNewer.id);
    assert.strictEqual(resolvedLatest.history.at(-1), trulyNewer.id);
    assert.strictEqual(await db.collection('pastelchat_messages').countDocuments({}), 17);
    assert.strictEqual((await workers[1].call('clear', { userId: 'bob', receiverId: 'alice' }).promise).count, 1);
    assert(!(await workers[2].call('conversation', { userId: 'bob', receiverId: 'alice' }).promise).messages.includes(friend.id), 'Tombstone must override snapshot fallback');
    assert.strictEqual((await db.collection('pastelchat_state').findOne({ key: 'primary' })).data.messages.length, 1, 'Legacy snapshot is a read fallback only');
    assert(initialIds.every(Boolean));
    console.log('Local MongoDB replica set: 3 separate workers, atomic message writes, exact AI turns, stale provider rejection, user isolation, multi-bubbles, friend chat PASS');
  } finally {
    workers.forEach(entry => entry.child.kill());
    await db.dropDatabase();
    await client.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
