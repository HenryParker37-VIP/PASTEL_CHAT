const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const path = require('node:path');
const { io: client } = require('../../frontend/node_modules/socket.io-client');

const base = process.env.PASTELCHAT_TEST_MONGO_URI;
if (!base || !/^mongodb:\/\/127\.0\.0\.1:27029\//.test(base)) {
  throw new Error('Set PASTELCHAT_TEST_MONGO_URI to a disposable local replica set on 127.0.0.1:27029');
}
const dbName = `pastelchat_hybrid_${Date.now()}`;
const uri = base.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
const workers = [];
const sockets = [];
const workerPath = path.join(__dirname, 'helpers/hybridServiceWorker.js');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function startWorker(writer, port) {
  const child = fork(workerPath, [], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env, MONGODB_URI: uri, PORT: String(port), NODE_ENV: 'test',
      VERCEL: writer ? '1' : '', WRITE_MODE: writer ? 'write' : 'read-only',
      HYBRID_TEST_WRITER: writer ? 'true' : 'false', REALTIME_RELAY: writer ? 'false' : 'true',
      PERSISTENT_SERVICE: 'true', PROACTIVE_LYRA: 'false', TELEGRAM_POLLING: 'false',
      PASTELCHAT_DISABLE_PERSIST: writer ? '0' : '1'
    },
    stdio: ['ignore', 'ignore', 'ignore', 'ipc']
  });
  workers.push(child);
  return Promise.race([
    new Promise((resolve, reject) => {
      child.on('message', message => {
        if (message.type === 'ready') resolve(message.fixture);
        if (message.type === 'error') reject(new Error(message.message));
      });
      child.once('exit', code => reject(new Error(`worker exited ${code}`)));
    }),
    wait(15000).then(() => { throw new Error('worker startup timed out'); })
  ]);
}

async function connect(port, token) {
  const socket = client(`http://127.0.0.1:${port}`, { transports: ['websocket'], reconnection: false, auth: { token } });
  sockets.push(socket);
  await Promise.race([
    new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); }),
    wait(6000).then(() => { throw new Error('socket connection timed out'); })
  ]);
  return socket;
}

async function request(pathname, token, method = 'GET', body) {
  const response = await fetch(`http://127.0.0.1:5051${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, data: await response.json() };
}

async function receive(socket, event, action) {
  const eventPromise = Promise.race([
    new Promise(resolve => socket.once(event, resolve)),
    wait(5000).then(() => { throw new Error(`missed ${event}`); })
  ]);
  const result = await action();
  return [await eventPromise, result];
}

async function run() {
  const fixture = await startWorker(true, 5051);
  const [a, b, c] = fixture.users;
  await startWorker(false, 5052);
  const [a1, a2, b1, c1] = await Promise.all([
    connect(5052, a.token), connect(5052, a.token), connect(5052, b.token), connect(5052, c.token)
  ]);
  const event = `msg:${a.id}:${b.id}`;
  let leaked = false;
  c1.onAny((name) => { if (name === event) leaked = true; });
  const a2Received = new Promise(resolve => a2.once(event, resolve));
  const [delivered, sent] = await receive(b1, event, () => request('/messages', a.token, 'POST', { receiverId: b.id, content: 'durable through change stream', clientMessageId: 'hybrid-e2e-1' }));
  assert.equal(sent.status, 201);
  assert.equal(delivered._id, sent.data._id);
  assert.equal((await a2Received)._id, sent.data._id);
  await wait(100);
  assert.equal(leaked, false);

  const reactionEvent = `msg_reaction:${a.id}:${b.id}`;
  const reacted = receive(a1, reactionEvent, () => request(`/messages/${sent.data._id}/react`, b.token, 'POST', { emoji: '👍' }));
  assert.equal((await reacted)[1].status, 200);
  const receipt = receive(a1, 'message_status', () => request(`/messages/${sent.data._id}/read`, b.token, 'POST'));
  assert.equal((await receipt)[1].status, 200);

  // Simulate the Free service sleeping. The writer and REST history remain up.
  for (const socket of sockets) socket.close();
  workers[1].kill('SIGTERM');
  await new Promise(resolve => workers[1].once('exit', resolve));
  const offline = await request('/messages', a.token, 'POST', { receiverId: b.id, content: 'while relay sleeps', clientMessageId: 'hybrid-e2e-2' });
  assert.equal(offline.status, 201);
  const history = await request(`/messages/with/${a.id}`, b.token);
  assert.equal(history.status, 200);
  assert.equal(history.data.filter(message => [sent.data._id, offline.data._id].includes(message._id)).length, 2);

  await startWorker(false, 5052);
  const reconnected = await connect(5052, b.token);
  assert.equal(reconnected.connected, true);
  const reconciled = await request(`/messages/with/${a.id}`, b.token);
  assert.equal(new Set(reconciled.data.filter(message => [sent.data._id, offline.data._id].includes(message._id)).map(message => message._id)).size, 2);
  console.log('hybridIntegration.test.js: separate Vercel writer + read-only relay, Atlas change stream, 3 users, two devices, outage, REST fallback and reconnect PASS');
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  sockets.forEach(socket => socket.close());
  workers.forEach(child => { if (child.exitCode === null) child.kill('SIGTERM'); });
});
