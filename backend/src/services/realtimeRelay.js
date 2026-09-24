// Optional Atlas-to-Socket.IO fanout. Atlas/Vercel remain authoritative; this
// process only reads change streams and emits to authenticated socket rooms.
const store = require('../db/store');
const { emitToUser, emitToUsers, emitToAuthenticatedUsers } = require('./userSocket');

const ATLAS_WRITE_ACTIONS = new Set([
  'anyAction', 'insert', 'update', 'remove', 'createCollection', 'dropCollection',
  'dropDatabase', 'createIndex', 'dropIndex', 'collMod', 'convertToCapped',
  'renameCollectionSameDB', 'applyOps', 'bypassDocumentValidation'
]);

function assertReadOnlyPrivileges(authInfo, allowUnauthenticatedTest = false) {
  const users = authInfo?.authenticatedUsers || [];
  const privileges = authInfo?.authenticatedUserPrivileges || [];
  if (!users.length && !allowUnauthenticatedTest) throw new Error('Relay Atlas credential is not authenticated');
  if (privileges.some(privilege => (privilege.actions || []).some(action => ATLAS_WRITE_ACTIONS.has(action)))) {
    throw new Error('Relay Atlas credential has write privileges');
  }
}

function deliverMessageChange(io, change) {
  const message = change?.fullDocument?.data;
  if (!message?._id || change.fullDocument?.deletedAt) return;
  const senderId = String(message.senderId || '');
  const receiverId = String(message.receiverId || '');
  const isInsert = change.operationType === 'insert';
  const fields = Object.keys(change.updateDescription?.updatedFields || {});
  const reactionChanged = fields.some(field => field === 'data.reactions' || field.startsWith('data.reactions.'));
  const receiptChanged = fields.some(field => ['data.deliveredAt', 'data.readAt', 'data.deliveryReceipts'].some(prefix => field === prefix || field.startsWith(`${prefix}.`)));
  const recallChanged = fields.some(field => field === 'data.isRecalled');

  if (message.groupId) {
    const group = store.findGroup(message.groupId);
    if (!group) return;
    const members = [...new Set(group.members.map(String))];
    for (const memberId of members) {
      if (isInsert) emitToUser(io, memberId, `msg:group:${message.groupId}:${memberId}`, store.populateMessage(message, memberId));
      if (reactionChanged) emitToUser(io, memberId, `msg_reaction:group:${message.groupId}:${memberId}`, { messageId: message._id, reactions: message.reactions });
      if (recallChanged) emitToUser(io, memberId, `msg_recall:group:${message.groupId}:${memberId}`, { messageId: message._id });
    }
  } else if (senderId && receiverId) {
    const target = store.findUserById(receiverId);
    const sender = store.findUserById(senderId);
    const participants = target?.isAI ? [senderId] : sender?.isAI ? [receiverId] : [senderId, receiverId];
    if (!target?.isAI && !sender?.isAI && !store.findFriendship(senderId, receiverId) && !store.findFriendship(receiverId, senderId)) return;
    const names = [`${senderId}:${receiverId}`, `${receiverId}:${senderId}`];
    if (isInsert) for (const name of names) emitToUsers(io, participants, `msg:${name}`, store.populateMessage(message));
    if (reactionChanged) for (const name of names) emitToUsers(io, participants, `msg_reaction:${name}`, { messageId: message._id, reactions: message.reactions });
    if (recallChanged) for (const name of names) emitToUsers(io, participants, `msg_recall:${name}`, { messageId: message._id });
  }
  if (receiptChanged && senderId) {
    const groupReceipts = Object.values(message.deliveryReceipts || {});
    emitToUser(io, senderId, 'message_status', {
      messageId: message._id,
      clientMessageId: message.clientMessageId,
      status: message.readAt || groupReceipts.some(receipt => receipt.readAt) ? 'read' : 'delivered',
      deliveredAt: message.deliveredAt || groupReceipts.find(receipt => receipt.deliveredAt)?.deliveredAt || null,
      readAt: message.readAt || groupReceipts.find(receipt => receipt.readAt)?.readAt || null
    });
  }
}

function deliverSnapshotChange(io, previous, current) {
  if (!current) return;
  const priorNotifications = new Set((previous?.notifications || []).map(item => String(item._id)));
  for (const notice of current.notifications || []) {
    if (notice?.userId && !priorNotifications.has(String(notice._id))) {
      emitToUser(io, notice.userId, `notify:${notice.userId}`, { ...notice, notificationId: notice._id });
    }
  }
  const priorGroups = new Map((previous?.groups || []).map(group => [String(group._id), JSON.stringify(group)]));
  for (const group of current.groups || []) {
    if (priorGroups.get(String(group._id)) !== JSON.stringify(group)) {
      emitToUsers(io, group.members || [], `group:updated:${group._id}`, store.groupPublic(group));
    }
  }
  const oldAvatar = (previous?.users || []).find(user => user._id === store.AI_USER_ID)?.avatar;
  const lyra = (current.users || []).find(user => user._id === store.AI_USER_ID);
  if (lyra?.avatar && oldAvatar && lyra.avatar !== oldAvatar) {
    emitToAuthenticatedUsers(io, 'user_updated', { userId: store.AI_USER_ID, avatar: lyra.avatar });
  }
  const priorUsers = new Map((previous?.users || []).map(user => [String(user._id), user]));
  for (const user of current.users || []) {
    if (!user?._id || user._id === store.AI_USER_ID) continue;
    if (priorUsers.get(String(user._id))?.avatar === user.avatar) continue;
    const recipients = [String(user._id), ...store.getFriends(user._id).map(friend => String(friend.friendId))];
    for (const recipientId of new Set(recipients)) emitToUser(io, recipientId, 'user_updated', { userId: user._id, avatar: user.avatar });
  }
}

async function startRealtimeRelay(io) {
  if (process.env.REALTIME_RELAY !== 'true') return () => {};
  if (process.env.WRITE_MODE !== 'read-only' || !process.env.MONGODB_URI) {
    throw new Error('Realtime relay requires read-only mode and Atlas');
  }
  await store.ready;
  console.log('[Relay] Store ready; opening Atlas change streams');
  const db = await store.getDurableDatabase();
  const credentialStatus = await db.command({ connectionStatus: 1, showPrivileges: true });
  assertReadOnlyPrivileges(credentialStatus.authInfo, process.env.NODE_ENV === 'test');
  console.log('[Relay] Atlas credential has no application write actions');
  let stopped = false;
  const streams = [];
  const timers = new Set();
  let previous = {
    notifications: [...store.store.notifications],
    groups: structuredClone(store.store.groups),
    users: structuredClone(store.store.users)
  };

  const watch = (collectionName, handler) => {
    if (stopped) return;
    const stream = db.collection(collectionName).watch([], { fullDocument: 'updateLookup' });
    streams.push(stream);
    stream.on('change', change => {
      Promise.resolve(handler(change)).catch(error => console.warn(`[Relay] ${collectionName} event skipped:`, error.message));
    });
    const retry = error => {
      if (stopped || stream.__retrying) return;
      stream.__retrying = true;
      console.warn(`[Relay] ${collectionName} stream interrupted:`, error.message);
      const timer = setTimeout(() => { timers.delete(timer); watch(collectionName, handler); }, 2000);
      timers.add(timer);
    };
    stream.on('error', retry);
    stream.on('close', () => retry(new Error('stream closed')));
  };

  watch('pastelchat_messages', async change => {
    // Membership and session data are in the snapshot, which may change on a
    // different Vercel worker just before this message insert.
    await store.hydrateFromDurableStore();
    deliverMessageChange(io, change);
  });
  watch('pastelchat_state', async change => {
    if (change.fullDocument?.key !== 'primary') return;
    const current = change.fullDocument.data;
    await store.hydrateFromDurableStore();
    deliverSnapshotChange(io, previous, current);
    previous = {
      notifications: [...(current.notifications || [])],
      groups: structuredClone(current.groups || []),
      users: structuredClone(current.users || [])
    };
  });
  console.log('[Relay] Change streams attached');
  return () => {
    stopped = true;
    for (const timer of timers) clearTimeout(timer);
    for (const stream of streams) stream.close().catch(() => {});
  };
}

module.exports = { startRealtimeRelay, deliverMessageChange, deliverSnapshotChange, assertReadOnlyPrivileges };
