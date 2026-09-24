const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const EventEmitter = require('node:events');
const { Server } = require('socket.io');
const clientPath = require.resolve('socket.io-client', { paths: [path.join(__dirname, '../../frontend')] });
const { io: connectSocket } = require(clientPath);
const { createCorsOrigin, PRODUCTION_FRONTEND_ORIGIN } = require('../src/config/cors');
const { shouldStartTelegramPolling } = require('../src/config/telegram');
const { installGracefulShutdown } = require('../src/lifecycle/gracefulShutdown');
const { emitToUser } = require('../src/socket/emitToUser');
const { assertSingleWriterConfiguration } = require('../src/config/runtimeMode');

function onceEvent(socket, event, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (value) => { clearTimeout(timer); resolve(value); });
  });
}

test('authenticated user rooms isolate direct messages and deliver sender/recipient updates', async (t) => {
  const storePath = require.resolve('../src/db/store');
  const authPath = require.resolve('../src/services/sessionAuth');
  const pushPath = require.resolve('../src/services/pushService');
  const notifyPath = require.resolve('../src/services/inAppNotifications');
  const socketPath = require.resolve('../src/socket/index');
  const originals = new Map([storePath, authPath, pushPath, notifyPath, socketPath].map((key) => [key, require.cache[key]]));
  const userByToken = Object.fromEntries(['A', 'B', 'C'].map((id) => [`token-${id}`, { user: { _id: id, name: id, avatar: null } }]));
  const mockModules = {
    [storePath]: {
      findUserById: (id) => ({ _id: id, name: String(id), avatar: null }),
      updateUser() {}, getOnlineUsers: () => [], getFriends: () => [], findGroup: () => null,
      createMessage: (message) => ({ ...message, _id: `message-${message.senderId}-${message.receiverId}`, timestamp: new Date().toISOString() }),
      findMessage: () => null, markMessageDelivered: () => null, markMessageRead: () => null,
      populateMessage: (message) => message, addSharedPhoto() {}, resolveSharedMediaExpiry: () => null,
      genId: () => 'generated-id', findFriendship: () => ({ _id: 'friendship' })
    },
    [authPath]: { authenticateToken: (token) => userByToken[token] || null },
    [pushPath]: { sendMessagePush: async () => {}, sendPushToUser: async () => {}, setActiveChat() {}, clearActiveChat() {} },
    [notifyPath]: { notifyInApp() {} }
  };

  Object.entries(mockModules).forEach(([filename, exports]) => {
    const Module = require('node:module');
    const mocked = new Module(filename);
    mocked.filename = filename;
    mocked.loaded = true;
    mocked.exports = exports;
    require.cache[filename] = mocked;
  });
  delete require.cache[socketPath];

  const server = http.createServer();
  const ioServer = new Server(server, { cors: { origin: true } });
  require('../src/socket')(ioServer);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const clients = ['A', 'B', 'C'].map((id) => connectSocket(url, { auth: { token: `token-${id}` }, transports: ['websocket'] }));
  t.after(async () => {
    clients.forEach((client) => client.close());
    await new Promise((resolve) => ioServer.close(resolve));
    [storePath, authPath, pushPath, notifyPath, socketPath].forEach((key) => {
      delete require.cache[key];
      if (originals.get(key)) require.cache[key] = originals.get(key);
    });
  });
  await Promise.all(clients.map((client) => onceEvent(client, 'connect')));

  const [sender, recipient, unrelated] = clients;
  const senderDelivery = onceEvent(sender, 'msg:A:B');
  const recipientDelivery = onceEvent(recipient, 'msg:B:A');
  let unrelatedReceived = false;
  unrelated.on('msg:A:B', () => { unrelatedReceived = true; });
  unrelated.on('msg:B:A', () => { unrelatedReceived = true; });
  sender.emit('send_private_message', { to: 'B', content: 'private' });
  const [ownUpdate, incomingUpdate] = await Promise.all([senderDelivery, recipientDelivery]);
  assert.equal(ownUpdate.content, 'private');
  assert.equal(incomingUpdate.content, 'private');
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(unrelatedReceived, false, 'user C must not receive A↔B content');

  const lyraForB = onceEvent(recipient, 'msg:user_ai_lyra:B');
  let lyraForA = false;
  sender.on('msg:user_ai_lyra:B', () => { lyraForA = true; });
  emitToUser(ioServer, 'B', 'msg:user_ai_lyra:B', { content: 'Lyra reply' });
  assert.equal((await lyraForB).content, 'Lyra reply');
  assert.equal(lyraForA, false, 'Lyra reply must only reach the intended user room');
});

test('credentialed CORS accepts production and explicit project origins only', () => {
  const explicitPreview = 'https://pastel-chat-git-review-henry.vercel.app';
  const corsOrigin = createCorsOrigin({ persistentService: true, configuredOrigins: [explicitPreview] });
  const allowed = (origin) => new Promise((resolve, reject) => corsOrigin(origin, (error, value) => error ? reject(error) : resolve(value)));
  return Promise.all([
    allowed(PRODUCTION_FRONTEND_ORIGIN).then((value) => assert.equal(value, true)),
    allowed(explicitPreview).then((value) => assert.equal(value, true)),
    assert.rejects(allowed('https://unrelated-project.vercel.app'), /CORS origin not allowed/)
  ]);
});

test('Telegram polling is strictly opt-in', () => {
  assert.equal(shouldStartTelegramPolling({}), false);
  assert.equal(shouldStartTelegramPolling({ VERCEL: '1' }), false);
  assert.equal(shouldStartTelegramPolling({ TELEGRAM_POLLING: 'false' }), false);
  assert.equal(shouldStartTelegramPolling({ TELEGRAM_POLLING: 'true' }), true);
});

test('persistent service refuses to start without a one-instance configuration', () => {
  const previousPersistent = process.env.PERSISTENT_SERVICE;
  const previousCount = process.env.KOYEB_INSTANCE_COUNT;
  const previousWriteMode = process.env.WRITE_MODE;
  const previousStrategy = process.env.KOYEB_DEPLOYMENT_STRATEGY;
  process.env.PERSISTENT_SERVICE = 'true';
  process.env.WRITE_MODE = 'read-only';
  delete process.env.KOYEB_INSTANCE_COUNT;
  assert.throws(assertSingleWriterConfiguration, /KOYEB_INSTANCE_COUNT=1/);
  process.env.KOYEB_INSTANCE_COUNT = '1';
  assert.doesNotThrow(assertSingleWriterConfiguration);
  process.env.WRITE_MODE = 'enabled';
  delete process.env.KOYEB_DEPLOYMENT_STRATEGY;
  assert.throws(assertSingleWriterConfiguration, /KOYEB_DEPLOYMENT_STRATEGY=immediate/);
  process.env.KOYEB_DEPLOYMENT_STRATEGY = 'immediate';
  assert.doesNotThrow(assertSingleWriterConfiguration);
  if (previousPersistent === undefined) delete process.env.PERSISTENT_SERVICE;
  else process.env.PERSISTENT_SERVICE = previousPersistent;
  if (previousCount === undefined) delete process.env.KOYEB_INSTANCE_COUNT;
  else process.env.KOYEB_INSTANCE_COUNT = previousCount;
  if (previousWriteMode === undefined) delete process.env.WRITE_MODE;
  else process.env.WRITE_MODE = previousWriteMode;
  if (previousStrategy === undefined) delete process.env.KOYEB_DEPLOYMENT_STRATEGY;
  else process.env.KOYEB_DEPLOYMENT_STRATEGY = previousStrategy;
});

test('Vercel cutover freeze bypasses snapshot hydrate and flush logic', async () => {
  const appPath = require.resolve('../../backend/src/app');
  const storePath = require.resolve('../../backend/src/db/store');
  const apiPath = require.resolve('../../api/index');
  const previousApp = require.cache[appPath];
  const previousStore = require.cache[storePath];
  const previousApi = require.cache[apiPath];
  const previousFreeze = process.env.APPLICATION_WRITES_DISABLED;
  const calls = { app: 0, hydrate: 0, flush: 0 };
  const Module = require('node:module');
  const appModule = new Module(appPath);
  appModule.filename = appPath;
  appModule.loaded = true;
  appModule.exports = { app: () => { calls.app += 1; } };
  require.cache[appPath] = appModule;
  const storeModule = new Module(storePath);
  storeModule.filename = storePath;
  storeModule.loaded = true;
  storeModule.exports = {
    ready: Promise.resolve(),
    isDurableStorageRequired: () => true,
    isDurableStorageEnabled: () => true,
    hydrateFromDurableStore: async () => { calls.hydrate += 1; },
    isDirty: () => true,
    flushPersist: async () => { calls.flush += 1; }
  };
  require.cache[storePath] = storeModule;
  delete require.cache[apiPath];
  process.env.APPLICATION_WRITES_DISABLED = 'true';
  try {
    const handler = require('../../api/index');
    const response = { end() {}, status() { return this; }, json() {} };
    const originalEnd = response.end;
    await handler({ url: '/messages', path: '/messages' }, response);
    assert.equal(calls.app, 1);
    assert.equal(calls.hydrate, 0);
    assert.equal(calls.flush, 0);
    assert.equal(response.end, originalEnd);
  } finally {
    if (previousFreeze === undefined) delete process.env.APPLICATION_WRITES_DISABLED;
    else process.env.APPLICATION_WRITES_DISABLED = previousFreeze;
    [appPath, storePath, apiPath].forEach((key) => {
      delete require.cache[key];
      const previous = key === appPath ? previousApp : key === storePath ? previousStore : previousApi;
      if (previous) require.cache[key] = previous;
    });
  }
});

test('graceful shutdown closes sockets and flushes durable state before completion', async () => {
  const processRef = new EventEmitter();
  processRef.exit = (code) => { processRef.exitCalls = (processRef.exitCalls || []).concat(code); };
  const order = [];
  const shutdown = installGracefulShutdown({
    server: { listening: false },
    io: { close: (callback) => { order.push('sockets'); callback(); } },
    storeDb: { closeDurableStore: async () => { order.push('flush-and-close-mongo'); } },
    processRef,
    timeoutMs: 500,
    logger: { info() {}, error() {} }
  });
  await shutdown('SIGTERM');
  assert.deepEqual(order, ['sockets', 'flush-and-close-mongo']);
  assert.equal(processRef.exitCode, 0);
  assert.deepEqual(processRef.exitCalls || [], []);
});

test('graceful shutdown exits with failure when the bounded deadline expires', async () => {
  const processRef = new EventEmitter();
  processRef.exit = (code) => { processRef.exitCalls = (processRef.exitCalls || []).concat(code); };
  const shutdown = installGracefulShutdown({
    server: { listening: false },
    io: { close() {} },
    storeDb: { closeDurableStore: async () => {} },
    processRef,
    timeoutMs: 30,
    logger: { info() {}, error() {} }
  });
  await shutdown('SIGTERM');
  assert.deepEqual(processRef.exitCalls, [1]);
});

test('private backend sources contain no global Socket.IO broadcast calls', () => {
  const sourceRoot = path.join(__dirname, '../src');
  const files = [];
  const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.name.endsWith('.js')) files.push(target);
  });
  walk(sourceRoot);
  for (const file of files) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /\bio\.emit\s*\(/, `${path.relative(sourceRoot, file)} must not globally broadcast private data`);
});
