const assert = require('node:assert/strict');
const { MAX_AVATAR_BYTES, parseAvatarDataUrl, avatarMediaPath } = require('../src/services/aiAvatarMedia');

const sixtyKbImage = Buffer.alloc(60 * 1024, 7);
const parsed = parseAvatarDataUrl(`data:image/jpeg;base64,${sixtyKbImage.toString('base64')}`);
assert.deepEqual(parsed.buffer, sixtyKbImage);
assert.equal(parsed.contentType, 'image/jpeg');
assert.match(parsed.version, /^[a-f0-9]{64}$/);
assert.ok(avatarMediaPath(parsed.version).length < 100, 'snapshot stores a compact path instead of image bytes');
assert.throws(() => parseAvatarDataUrl('data:image/svg+xml;base64,PHN2Zz4='), /JPEG, PNG, or WEBP/);
assert.throws(
  () => parseAvatarDataUrl(`data:image/png;base64,${Buffer.alloc(MAX_AVATAR_BYTES + 1).toString('base64')}`),
  /2 MB/
);
assert.throws(() => avatarMediaPath('../invalid'), /version is invalid/);

process.env.VERCEL = '1';
process.env.MONGODB_URI = '';
process.env.PASTELCHAT_DISABLE_PERSIST = '1';
const store = require('../src/db/store');
assert.equal(store.updateAIAvatar('data:image/jpeg;base64,AAAA'), null, 'store API must reject base64 avatar state');

console.log('aiAvatarMedia.test.js: large phone-sized uploads are accepted for separate media storage; state remains URL-only');
