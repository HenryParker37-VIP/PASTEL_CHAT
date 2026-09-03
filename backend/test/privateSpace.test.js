process.env.PASTELCHAT_DISABLE_PERSIST = '1';

const assert = require('assert');
const privateSpaceRouter = require('../src/routes/private-space');
const {
  store, createUser, addFriend, addSharedPhoto, getSharedPhotos, findNote
} = require('../src/db/store');

const resetStore = () => Object.keys(store).forEach((key) => { if (Array.isArray(store[key])) store[key] = []; });
const routeHandler = (method, path) => {
  const route = privateSpaceRouter.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
  assert.ok(route, `Missing ${method.toUpperCase()} ${path}`);
  return route.route.stack.at(-1).handle;
};
const mockResponse = () => {
  let statusCode = 200;
  let body;
  return {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; },
    get statusCode() { return statusCode; },
    get body() { return body; }
  };
};
const runHandler = (handler, { user, body = {}, params = {}, io } = {}) => {
  const res = mockResponse();
  handler({ user, body, params, app: { get: () => io || { emit() {} } } }, res);
  return res;
};

const postNote = routeHandler('post', '/notes');
const getNotes = routeHandler('get', '/notes');
const deleteNote = routeHandler('delete', '/notes/:id');
const getMedia = routeHandler('get', '/shared-photos');
const deleteMedia = routeHandler('delete', '/shared-photos/:id');

let passed = 0;
let failed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`✓ ${name}`); }
  catch (error) { failed += 1; console.error(`✗ ${name}\n  ${error.stack}`); }
};

resetStore();
const accountA = createUser({ name: 'Account A', loginCode: 'AAAA-BBBB' });
const accountB = createUser({ name: 'Account B', loginCode: 'CCCC-DDDD' });
const accountC = createUser({ name: 'Account C', loginCode: 'EEEE-FFFF' });
addFriend(accountA._id, accountB._id, 'Account B');
addFriend(accountB._id, accountA._id, 'Account A');

test('Account A can create a note for Account B', () => {
  const response = runHandler(postNote, { user: accountA, body: { title: 'A private share', content: 'Only B should see this.', sharedWith: [accountB._id] } });
  assert.strictEqual(response.statusCode, 200);
  assert.deepStrictEqual(response.body.sharedWith, [accountB._id]);
});

const sharedNote = store.notes[0];
test('Account B sees a shared note after a fresh notes query', () => {
  const response = runHandler(getNotes, { user: accountB });
  assert.strictEqual(response.statusCode, 200);
  assert.strictEqual(response.body.length, 1);
  assert.strictEqual(response.body[0]._id, sharedNote._id);
});

test('Account A continues to see its own shared note', () => {
  const response = runHandler(getNotes, { user: accountA });
  assert.strictEqual(response.body.length, 1);
  assert.strictEqual(response.body[0]._id, sharedNote._id);
});

test('An unselected account cannot see or delete the shared note', () => {
  const feed = runHandler(getNotes, { user: accountC });
  assert.deepStrictEqual(feed.body, []);
  const deletion = runHandler(deleteNote, { user: accountC, params: { id: sharedNote._id } });
  assert.strictEqual(deletion.statusCode, 403);
  assert.ok(findNote(sharedNote._id));
});

test('Legacy valid sharedWith data remains visible to its recipient', () => {
  store.notes.push({ _id: 'legacy-shared-note', userId: accountA._id, title: 'Legacy', content: 'Still visible', sharedWith: [{ _id: accountB._id }], images: [], createdAt: new Date().toISOString() });
  const response = runHandler(getNotes, { user: accountB });
  assert.ok(response.body.some((note) => note._id === 'legacy-shared-note'));
});

const media = addSharedPhoto({
  _id: 'media-active', dataUrl: 'data:image/jpeg;base64,AA==', caption: 'expires later',
  uploadedBy: { _id: accountA._id, name: accountA.name, avatar: '' }, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString()
});

test('Only the owner and a friend can retrieve active shared media', () => {
  assert.ok(getSharedPhotos(accountA._id).some((item) => item._id === media._id));
  assert.ok(getSharedPhotos(accountB._id).some((item) => item._id === media._id));
  assert.ok(!getSharedPhotos(accountC._id).some((item) => item._id === media._id));
});

test('Expired media is removed from the feed and embedded storage', () => {
  addSharedPhoto({
    _id: 'media-expired', dataUrl: 'data:image/jpeg;base64,AA==', caption: 'expired',
    uploadedBy: { _id: accountA._id, name: accountA.name, avatar: '' }, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() - 1_000).toISOString()
  });
  const response = runHandler(getMedia, { user: accountB });
  assert.ok(!response.body.some((item) => item._id === 'media-expired'));
  assert.ok(!store.sharedPhotos.some((item) => item._id === 'media-expired'));
});

test('Only the owner can delete shared media and recipients receive the deletion event', () => {
  const denied = runHandler(deleteMedia, { user: accountB, params: { id: media._id } });
  assert.strictEqual(denied.statusCode, 403);
  const events = [];
  const deleted = runHandler(deleteMedia, { user: accountA, params: { id: media._id }, io: { emit: (event, payload) => events.push({ event, payload }) } });
  assert.strictEqual(deleted.statusCode, 200);
  assert.ok(!store.sharedPhotos.some((item) => item._id === media._id));
  assert.ok(events.some(({ event }) => event === `shared_media_deleted:${accountA._id}`));
  assert.ok(events.some(({ event }) => event === `shared_media_deleted:${accountB._id}`));
});

console.log(`\nPrivate Space Results: ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
