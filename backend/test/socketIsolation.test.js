process.env.MONGODB_URI = '';
process.env.VERCEL = '1';
process.env.NODE_ENV = 'test';
process.env.TELEGRAM_POLLING = 'false';
process.env.PASTELCHAT_DISABLE_PERSIST = '1';

const assert = require('node:assert/strict');
const { io: connectClient } = require('../../frontend/node_modules/socket.io-client');
const { app, server } = require('../src/app');
const db = require('../src/db/store');
const { createUserToken } = require('../src/services/sessionAuth');
const { modelRouter } = require('../src/ai/conversationDirector');
const { emitToAuthenticatedUsers, userRoom } = require('../src/services/userSocket');

const clients = [];
const events = new Map();
const pause = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms));
const seen = (label, event, predicate = () => true) => (events.get(label) || []).filter(row => row.event === event && predicate(row.payload));
const none = (label, event) => assert.equal(seen(label, event).length, 0, `${label} received ${event}`);

async function connect(url, label, token, extraAuth = {}) {
  const socket = connectClient(url, { transports: ['websocket'], reconnection: false, auth: { token, ...extraAuth } });
  clients.push(socket);
  events.set(label, []);
  socket.onAny((event, payload) => events.get(label).push({ event, payload }));
  await Promise.race([
    new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); }),
    pause(3000).then(() => { throw new Error(`${label} connection timed out`); })
  ]);
  return socket;
}

async function request(url, path, token, method = 'GET', body) {
  const response = await fetch(url + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await response.json(); } catch {}
  return { status: response.status, data };
}

async function run() {
  await db.ready;
  const tag = `isolation-${Date.now()}`;
  const [a, b, c] = ['A', 'B', 'C'].map(letter => db.createUser({ name: `${tag}-${letter}`, loginCode: `${letter}AAA-BBBB` }));
  db.addFriend(a._id, b._id, b.name);
  db.addFriend(b._id, a._id, a.name);
  const tokens = [a, b, c].map(user => createUserToken(user));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const [a1, a2, b1, c1] = await Promise.all([
      connect(url, 'a1', tokens[0], { userId: b._id }),
      connect(url, 'a2', tokens[0]),
      connect(url, 'b1', tokens[1]),
      connect(url, 'c1', tokens[2])
    ]);
    assert.equal(server.listening, true);
    assert.equal(app.get('io').sockets.adapter.rooms.get(userRoom(a._id)).size, 2);
    assert.equal(app.get('io').sockets.adapter.rooms.get(userRoom(b._id)).has(a1.id), false, 'client supplied identity entered another room');
    const unauthenticated = connectClient(url, { transports: ['websocket'], reconnection: false, auth: {} });
    clients.push(unauthenticated);
    const authError = await Promise.race([
      new Promise(resolve => unauthenticated.once('connect_error', resolve)),
      pause(3000).then(() => { throw new Error('missing auth was not rejected'); })
    ]);
    assert.match(authError.message, /Auth:/);

    const friendEvent = `msg:${a._id}:${b._id}`;
    const sent = await request(url, '/messages', tokens[0], 'POST', { receiverId: b._id, content: `${tag}-friend` });
    assert.equal(sent.status, 201);
    await pause();
    for (const label of ['a1', 'a2', 'b1']) assert.equal(seen(label, friendEvent).length, 1, `${label} missed friend message`);
    none('c1', friendEvent);
    assert.equal(seen('b1', `notify:${b._id}`).length, 1);
    none('c1', `notify:${b._id}`);
    const polled = await request(url, `/messages/with/${a._id}`, tokens[1]);
    assert.equal(polled.status, 200);
    assert(polled.data.some(message => message._id === sent.data._id), 'REST polling fallback missed friend message');
    assert.equal((await request(url, `/messages/with/${b._id}`, tokens[2])).status, 403);
    a1.emit('send_private_message', { to: b._id, content: `${tag}-socket-friend` });
    await pause();
    for (const label of ['a1', 'a2', 'b1']) assert.equal(seen(label, friendEvent, message => message.content === `${tag}-socket-friend`).length, 1);
    none('c1', friendEvent);
    c1.emit('send_private_message', { to: b._id, content: `${tag}-forged-friend` });
    await pause();
    assert.equal(seen('b1', friendEvent, message => message.content === `${tag}-forged-friend`).length, 0);

    a1.emit('user_typing', { to: b._id, isTyping: true });
    await pause();
    assert.equal(seen('b1', `typing:${b._id}`).length, 1);
    none('c1', `typing:${b._id}`);
    a1.emit('call:invite', { to: b._id, callType: 'voice' });
    a1.emit('call:offer', { to: b._id, offer: { sdp: tag } });
    a1.emit('call:ice', { to: b._id, candidate: { candidate: tag } });
    a1.emit('call:end', { to: c._id });
    await pause();
    for (const event of [`call:incoming:${b._id}`, `call:offer:${b._id}`, `call:ice:${b._id}`]) {
      assert.equal(seen('b1', event).length, 1);
      none('c1', event);
      none('a2', event);
    }
    none('c1', `call:ended:${c._id}`);
    b1.emit('call:accept', { to: a._id });
    b1.emit('call:answer', { to: a._id, answer: { sdp: tag } });
    b1.emit('call:reject', { to: a._id });
    await pause();
    for (const event of [`call:accepted:${a._id}`, `call:answer:${a._id}`, `call:rejected:${a._id}`]) {
      for (const label of ['a1', 'a2']) assert.equal(seen(label, event).length, 1);
      none('c1', event);
    }
    a1.emit('wish_birthday', { targetUserId: b._id, age: 30 });
    await pause();
    assert.equal(seen('b1', `notify:${b._id}`, payload => payload.type === 'happy_birthday').length, 1);
    none('c1', `notify:${b._id}`);

    const reaction = await request(url, `/messages/${sent.data._id}/react`, tokens[1], 'POST', { emoji: '👍' });
    assert.equal(reaction.status, 200);
    const reactionEvent = `msg_reaction:${a._id}:${b._id}`;
    await pause();
    for (const label of ['a1', 'a2', 'b1']) assert.equal(seen(label, reactionEvent).length, 1);
    none('c1', reactionEvent);
    const read = await request(url, `/messages/${sent.data._id}/read`, tokens[1], 'POST');
    assert.equal(read.status, 200);
    await pause();
    for (const label of ['a1', 'a2']) assert(seen(label, 'message_status', row => row.messageId === sent.data._id).length);
    none('c1', 'message_status');

    const group = db.createGroup({ name: `${tag}-group`, creatorId: a._id, memberIds: [b._id] });
    const groupEvent = `msg:group:${group._id}:${b._id}`;
    const groupMessage = await request(url, `/groups/${group._id}/messages`, tokens[0], 'POST', { content: `${tag}-group-message` });
    assert.equal(groupMessage.status, 201);
    await pause();
    assert.equal(seen('b1', groupEvent).length, 1);
    none('c1', groupEvent);
    assert.equal((await request(url, `/groups/${group._id}/messages`, tokens[2])).status, 403);
    a1.emit('send_group_message', { groupId: group._id, content: `${tag}-socket-group` });
    c1.emit('send_group_message', { groupId: group._id, content: `${tag}-forged-group` });
    await pause();
    assert.equal(seen('b1', groupEvent, message => message.content === `${tag}-socket-group`).length, 1);
    assert.equal(seen('b1', groupEvent, message => message.content === `${tag}-forged-group`).length, 0);
    none('c1', groupEvent);
    const groupReaction = await request(url, `/groups/${group._id}/messages/${groupMessage.data._id}/react`, tokens[1], 'POST', { emoji: '❤️' });
    assert.equal(groupReaction.status, 200);
    const groupRecall = await request(url, `/groups/${group._id}/messages/${groupMessage.data._id}`, tokens[0], 'DELETE');
    assert.equal(groupRecall.status, 200);
    await pause();
    for (const event of [`msg_reaction:group:${group._id}:${b._id}`, `msg_recall:group:${group._id}:${b._id}`]) {
      assert.equal(seen('b1', event).length, 1);
      none('c1', event);
    }
    const invited = await request(url, `/groups/${group._id}/invite`, tokens[0], 'POST', { userId: c._id });
    assert.equal(invited.status, 200);
    await pause();
    assert.equal(seen('c1', `group:updated:${group._id}`).length, 1);
    const left = await request(url, `/groups/${group._id}/leave`, tokens[2], 'DELETE');
    assert.equal(left.status, 200);
    const afterLeave = await request(url, `/groups/${group._id}/messages`, tokens[0], 'POST', { content: `${tag}-after-leave` });
    assert.equal(afterLeave.status, 201);
    await pause();
    none('c1', `msg:group:${group._id}:${c._id}`);

    const sharedMedia = await new Promise(resolve => a1.emit('share_photo', { dataUrl: 'data:image/png;base64,iVBORw0KGgo=', caption: tag }, resolve));
    assert.equal(sharedMedia.ok, false);
    assert.match(sharedMedia.error, /primary API/);
    await pause();
    none('b1', `new_photo_shared:${b._id}`);
    none('a2', `new_photo_shared:${a._id}`);
    none('c1', `new_photo_shared:${b._id}`);

    let releaseOld;
    let oldStarted;
    const enteredOld = new Promise(resolve => { oldStarted = resolve; });
    const heldOld = new Promise(resolve => { releaseOld = resolve; });
    modelRouter.generate = async ({ userMessage }) => {
      if (userMessage.includes('old-turn')) { oldStarted(); await heldOld; }
      return { bubbles: userMessage.includes('three-bubbles') ? ['one', 'two', 'three'] : [`reply ${userMessage}`], reaction: null };
    };
    const lyraEvent = `msg:user_ai_lyra:${a._id}`;
    const multi = await request(url, '/messages', tokens[0], 'POST', { receiverId: 'user_ai_lyra', content: `${tag}-three-bubbles` });
    assert.equal(multi.status, 201);
    assert.equal(multi.data.aiReplies.length, 3);
    await pause();
    for (const label of ['a1', 'a2']) assert.equal(seen(label, lyraEvent, row => row.senderId?._id === 'user_ai_lyra').length, 3);
    none('b1', lyraEvent);
    none('c1', lyraEvent);
    assert(seen('a1', `typing:${a._id}`).length >= 1);
    none('c1', `typing:${a._id}`);

    const aiConcurrent = await Promise.all([b, c].map((user, i) => request(url, '/messages', tokens[i + 1], 'POST', { receiverId: 'user_ai_lyra', content: `${tag}-${user._id}` })));
    assert(aiConcurrent.every(result => result.status === 201 && result.data.aiReplies.length === 1));
    await pause();
    assert.equal(seen('b1', `msg:user_ai_lyra:${b._id}`, row => row.senderId?._id === 'user_ai_lyra').length, 1);
    assert.equal(seen('c1', `msg:user_ai_lyra:${c._id}`, row => row.senderId?._id === 'user_ai_lyra').length, 1);
    none('a1', `msg:user_ai_lyra:${b._id}`);
    none('b1', `msg:user_ai_lyra:${c._id}`);

    const old = request(url, '/messages', tokens[0], 'POST', { receiverId: 'user_ai_lyra', content: `${tag}-old-turn` });
    await enteredOld;
    const newer = await request(url, '/messages', tokens[0], 'POST', { receiverId: 'user_ai_lyra', content: `${tag}-new-turn`, generateAiReply: false });
    assert.equal(newer.status, 201);
    releaseOld();
    const stale = await old;
    assert.equal(stale.status, 201);
    assert.deepEqual(stale.data.aiReplies, []);
    assert.equal(seen('a1', lyraEvent, row => row.senderId?._id === 'user_ai_lyra').length, 3, 'stale Lyra bubble leaked');

    emitToAuthenticatedUsers(app.get('io'), 'user_updated', { userId: 'user_ai_lyra', avatar: '/ai/avatar/media/example' });
    await pause();
    for (const label of ['a1', 'a2', 'b1', 'c1']) assert.equal(seen(label, 'user_updated').length, 1);
    assert.equal(events.has('unauthenticated'), false);
    console.log('socketIsolation.test.js: 3 users, 2 devices, friend/group/Lyra, typing, reaction, receipt, call, shared media, avatar, polling, supersession PASS');
  } finally {
    clients.forEach(client => client.disconnect());
    await new Promise(resolve => app.get('io').close(resolve));
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
