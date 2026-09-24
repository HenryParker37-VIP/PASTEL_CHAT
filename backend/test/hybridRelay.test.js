process.env.NODE_ENV = 'test';
process.env.VERCEL = '1';
process.env.MONGODB_URI = '';
process.env.PASTELCHAT_DISABLE_PERSIST = '1';
process.env.WRITE_MODE = 'read-only';
process.env.REALTIME_RELAY = 'true';
process.env.TELEGRAM_POLLING = 'false';

const assert = require('node:assert/strict');
const { io: client } = require('../../frontend/node_modules/socket.io-client');
const { app, server } = require('../src/app');
const db = require('../src/db/store');
const { createUserToken } = require('../src/services/sessionAuth');
const { deliverMessageChange, deliverSnapshotChange } = require('../src/services/realtimeRelay');

const pause = () => new Promise(resolve => setTimeout(resolve, 50));
async function connect(url, token) {
  const socket = client(url, { transports: ['websocket'], reconnection: false, auth: { token } });
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  const events = [];
  socket.onAny((event, payload) => events.push({ event, payload }));
  return { socket, events };
}
const count = (device, event) => device.events.filter(row => row.event === event).length;

async function run() {
  await db.ready;
  const [a, b, c] = ['A', 'B', 'C'].map(name => db.createUser({ name: `relay-${name}-${Date.now()}`, loginCode: `${name}AAA-BBBB` }));
  db.addFriend(a._id, b._id);
  db.addFriend(b._id, a._id);
  const tokens = [a, b, c].map(createUserToken);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const devices = [];
  try {
    const [a1, a2, b1, c1] = await Promise.all([
      connect(url, tokens[0]), connect(url, tokens[0]), connect(url, tokens[1]), connect(url, tokens[2])
    ]);
    devices.push(a1, a2, b1, c1);
    const io = app.get('io');
    assert.equal(io.sockets.adapter.rooms.get(`user:${a._id}`).size, 2);
    const foreignRoom = client(url, { transports: ['websocket'], reconnection: false, auth: { token: tokens[2], userId: a._id } });
    await new Promise((resolve, reject) => { foreignRoom.once('connect', resolve); foreignRoom.once('connect_error', reject); });
    assert.equal(io.sockets.adapter.rooms.get(`user:${a._id}`).has(foreignRoom.id), false);
    foreignRoom.close();
    const rejected = client(url, { transports: ['websocket'], reconnection: false, auth: {} });
    assert.match((await new Promise(resolve => rejected.once('connect_error', resolve))).message, /Auth:/);
    rejected.close();
    const wrongOrigin = client(url, { transports: ['websocket'], reconnection: false, auth: { token: tokens[0] }, extraHeaders: { Origin: 'https://unrelated.vercel.app' } });
    await new Promise(resolve => wrongOrigin.once('connect_error', resolve));
    assert.equal(wrongOrigin.connected, false);
    wrongOrigin.close();

    a1.socket.emit('user_typing', { to: b._id, isTyping: true });
    a1.socket.emit('call:offer', { to: b._id, offer: { sdp: 'offer' } });
    c1.socket.emit('call:offer', { to: b._id, offer: { sdp: 'forged' } });
    await pause();
    assert.equal(count(b1, `typing:${b._id}`), 1);
    assert.equal(count(b1, `call:offer:${b._id}`), 1);
    assert.equal(count(c1, `typing:${b._id}`), 0);
    assert.equal(count(a2, `call:offer:${b._id}`), 0);

    const message = { _id: 'relay-friend-1', senderId: a._id, receiverId: b._id, content: 'from Vercel', timestamp: new Date().toISOString() };
    deliverMessageChange(io, { operationType: 'insert', fullDocument: { data: message } });
    await pause();
    const event = `msg:${a._id}:${b._id}`;
    assert.equal(count(a1, event), 1);
    assert.equal(count(a2, event), 1);
    assert.equal(count(b1, event), 1);
    assert.equal(count(c1, event), 0);
    deliverMessageChange(io, { operationType: 'update', fullDocument: { data: message }, updateDescription: { updatedFields: { 'data.content': 'from Vercel' } } });
    await pause();
    assert.equal(count(b1, event), 1, 'message update replayed as a new message');

    deliverMessageChange(io, { operationType: 'update', fullDocument: { data: { ...message, reactions: { '👍': [b._id] }, readAt: new Date().toISOString() } }, updateDescription: { updatedFields: { 'data.reactions': {}, 'data.readAt': new Date().toISOString() } } });
    await pause();
    assert.equal(count(a1, `msg_reaction:${a._id}:${b._id}`), 1);
    assert.equal(count(b1, `msg_reaction:${a._id}:${b._id}`), 1);
    assert.equal(count(c1, `msg_reaction:${a._id}:${b._id}`), 0);
    assert.equal(count(a1, 'message_status'), 1);
    assert.equal(count(c1, 'message_status'), 0);

    const lyra = { _id: 'relay-lyra-1', senderId: db.AI_USER_ID, receiverId: a._id, content: 'Lyra reply' };
    deliverMessageChange(io, { operationType: 'insert', fullDocument: { data: lyra } });
    await pause();
    assert.equal(count(a1, `msg:${db.AI_USER_ID}:${a._id}`), 1);
    assert.equal(count(a2, `msg:${db.AI_USER_ID}:${a._id}`), 1);
    assert.equal(count(b1, `msg:${db.AI_USER_ID}:${a._id}`), 0);
    assert.equal(count(c1, `msg:${db.AI_USER_ID}:${a._id}`), 0);
    for (let i = 2; i <= 5; i++) {
      deliverMessageChange(io, { operationType: 'insert', fullDocument: { data: { ...lyra, _id: `relay-lyra-${i}`, content: `bubble ${i}` } } });
    }
    await pause();
    assert.equal(count(a1, `msg:${db.AI_USER_ID}:${a._id}`), 5);
    assert.equal(count(b1, `msg:${db.AI_USER_ID}:${a._id}`), 0);

    const group = db.createGroup({ name: 'relay-group', creatorId: a._id, memberIds: [b._id] });
    deliverMessageChange(io, { operationType: 'insert', fullDocument: { data: { _id: 'relay-group-1', groupId: group._id, senderId: a._id, content: 'group' } } });
    await pause();
    assert.equal(count(b1, `msg:group:${group._id}:${b._id}`), 1);
    assert.equal(count(c1, `msg:group:${group._id}:${c._id}`), 0);

    deliverSnapshotChange(io, { notifications: [], users: [], groups: [] }, { notifications: [{ _id: 'n1', userId: b._id, type: 'new_message' }], users: [], groups: [] });
    await pause();
    assert.equal(count(b1, `notify:${b._id}`), 1);
    assert.equal(count(c1, `notify:${b._id}`), 0);
    deliverSnapshotChange(io, { notifications: [{ _id: 'n1', userId: b._id }], users: [], groups: [] }, { notifications: [{ _id: 'n1', userId: b._id }], users: [], groups: [] });
    await pause();
    assert.equal(count(b1, `notify:${b._id}`), 1, 'unchanged notice was replayed');

    a1.socket.emit('send_private_message', { to: b._id, content: 'forbidden' });
    await pause();
    assert.equal(count(b1, event), 1, 'relay accepted a direct write');
    assert.equal(count(a1, 'message_error'), 1);
    const blocked = await fetch(`${url}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${tokens[0]}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ receiverId: b._id, content: 'forbidden' }) });
    assert.equal(blocked.status, 503);
    assert.equal((await blocked.json()).status, 'relay_only');
    const originBlocked = await fetch(`${url}/health`, { headers: { Origin: 'https://unrelated.vercel.app' } });
    assert.equal(originBlocked.status, 403);
    const originAllowed = await fetch(`${url}/health`, { headers: { Origin: 'https://pastel-chat.vercel.app' } });
    assert.equal(originAllowed.headers.get('access-control-allow-origin'), 'https://pastel-chat.vercel.app');
    console.log('hybridRelay.test.js: 3 users, two devices, friend/Lyra delivery, typing, WebRTC, reactions, receipts, notifications, write denial PASS');
  } finally {
    devices.forEach(device => device.socket.close());
    await new Promise(resolve => app.get('io').close(resolve));
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
