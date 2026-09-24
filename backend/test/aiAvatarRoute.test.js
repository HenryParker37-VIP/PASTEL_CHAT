process.env.VERCEL = '1';
process.env.MONGODB_URI = '';
process.env.PASTELCHAT_DISABLE_PERSIST = '1';

const assert = require('node:assert/strict');
const express = require('express');
const storeDb = require('../src/db/store');
const authPath = require.resolve('../src/middleware/auth');
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: (req, _res, next) => { req.user = { _id: 'test-user' }; next(); }
};

const savedMedia = new Map();
const emitted = [];
let stateAvatar = null;
let flushCount = 0;
storeDb.store.users = [{ _id: 'test-user', isAI: false }];
storeDb.storeAIAvatarMedia = async (media) => { savedMedia.set(media.version, media); };
storeDb.getAIAvatarMedia = async (version) => {
  const item = savedMedia.get(version);
  return item ? { buffer: item.buffer, contentType: item.contentType } : null;
};
storeDb.updateAIAvatar = (avatar) => { stateAvatar = avatar; return { success: true, avatar }; };
storeDb.flushPersist = async () => { flushCount += 1; };

const app = express();
app.use(express.json({ limit: '10mb' }));
const authenticatedSocket = {
  user: { _id: 'test-user' },
  emit: (event, payload) => emitted.push({ userId: 'test-user', event, payload })
};
const unauthenticatedSocket = {
  emit: (event, payload) => emitted.push({ userId: 'unauthenticated', event, payload })
};
app.set('io', { sockets: { sockets: new Map([['auth', authenticatedSocket], ['anonymous', unauthenticatedSocket]]) } });
app.use('/ai', require('../src/routes/ai'));

async function run() {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const sourceBytes = Buffer.alloc(60 * 1024, 19);
    const upload = await fetch(`http://127.0.0.1:${server.address().port}/ai/avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
      body: JSON.stringify({ avatar: `data:image/jpeg;base64,${sourceBytes.toString('base64')}` })
    });
    assert.equal(upload.status, 200, 'phone-sized image should pass the old 50 KB limit');
    const result = await upload.json();
    assert.equal(result.success, true);
    assert.match(result.avatar, /^\/ai\/avatar\/media\/[a-f0-9]{64}$/);
    assert.equal(stateAvatar, result.avatar, 'only the compact path enters application state');
    assert.ok(!stateAvatar.startsWith('data:'));
    assert.equal(flushCount, 1, 'state persistence is flushed before success');
    assert.deepEqual(emitted, [{
      userId: 'test-user',
      event: 'user_updated',
      payload: { userId: 'user_ai_lyra', avatar: result.avatar }
    }], 'avatar update is delivered only to authenticated sockets');

    const mediaResponse = await fetch(`http://127.0.0.1:${server.address().port}${result.avatar}`);
    assert.equal(mediaResponse.status, 200);
    assert.equal(mediaResponse.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(Buffer.from(await mediaResponse.arrayBuffer()), sourceBytes);
    console.log('aiAvatarRoute.test.js: authenticated upload, separate media storage, compact durable URL, user event, and image hydration passed');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
