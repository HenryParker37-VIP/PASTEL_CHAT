const {
  findUserById,
  updateUser,
  getOnlineUsers,
  getFriends,
  findGroup,
  createMessage,
  flushMessageWrites,
  allocateAITurnSequence,
  registerAITurn,
  findMessage,
  markMessageDelivered,
  markMessageRead,
  populateMessage,
  findFriendship
} = require('../db/store');
const { authenticateToken } = require('../services/sessionAuth');
const {
  sendMessagePush,
  sendPushToUser,
  setActiveChat,
  clearActiveChat
} = require('../services/pushService');
const { notifyInApp } = require('../services/inAppNotifications');
const { invalidateConversation } = require('../ai/conversationDirector');
const { joinAuthenticatedRooms, emitToUser: emitUser, emitToUsers } = require('../services/userSocket');
const storeDb = require('../db/store');

const setupSocket = (io) => {
  const relayMode = process.env.REALTIME_RELAY === 'true';
  const emitToUser = (userId, event, payload) => emitUser(io, userId, event, payload);
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Auth: no token'));
      // A relay must validate against the authoritative Atlas session, not
      // manufacture an in-memory session from claims in a signed token.
      if (relayMode && process.env.MONGODB_URI) await storeDb.hydrateFromDurableStore();
      const result = authenticateToken(token, { requireStoredSession: relayMode });
      if (!result) return next(new Error('Auth: invalid session'));
      socket.user = result.user;
      next();
    } catch {
      next(new Error('Auth: invalid token'));
    }
  });

  const canContact = (fromId, toId) => fromId !== toId && Boolean(findFriendship(fromId, toId) || findFriendship(toId, fromId));

  // Send each connected user only the online status of their own friends
  const broadcastOnlineFriends = () => {
    const allOnline = relayMode
      ? [...new Map([...io.sockets.sockets.values()].filter(s => s.user).map(s => [String(s.user._id), s.user])).values()]
      : getOnlineUsers();
    const onlineIds = new Set(allOnline.map(u => u._id));
    io.sockets.sockets.forEach((s) => {
      if (!s.user) return;
      const friendIds = new Set(getFriends(s.user._id).map(f => f.friendId));
      const visible = allOnline.filter(u => friendIds.has(u._id));
      s.emit('online_users', visible);
    });
  };

  io.on('connection', (socket) => {
    const { user } = socket;
    joinAuthenticatedRooms(socket, user._id);
    console.log(`[Socket] Connected: ${user.name}`);

    if (!relayMode && process.env.WRITE_MODE === 'read-only') return;
    if (!relayMode) updateUser(user._id, { isOnline: true, lastSeen: new Date().toISOString() });
    broadcastOnlineFriends();

    // Active chat tracking for suppressing unnecessary push notifications
    socket.on('chat:active', ({ friendId }) => {
      if (!relayMode && friendId && canContact(user._id, friendId)) setActiveChat(user._id, friendId);
    });

    socket.on('chat:inactive', ({ friendId }) => {
      if (!relayMode) clearActiveChat(user._id, friendId);
    });

    // Typing: targeted to a specific peer
    let typingTimeouts = {};
    socket.on('user_typing', ({ to, isTyping }) => {
      if (!to || !canContact(user._id, to)) return;
      if (findUserById(to)?.isAI) return;
      clearTimeout(typingTimeouts[to]);
      const payload = {
        from: { _id: user._id, name: user.name, avatar: user.avatar },
        to,
        isTyping
      };
      emitToUser(to, `typing:${to}`, payload);
      if (isTyping) {
        typingTimeouts[to] = setTimeout(() => {
          emitToUser(to, `typing:${to}`, { ...payload, isTyping: false });
        }, 3000);
      }
    });

    const acknowledgeMessage = (messageId, markReceipt, status) => {
      if (relayMode) return; // The browser sends receipts to Vercel REST.
      const message = findMessage(messageId);
      if (!message || String(message.senderId) === String(user._id)) return;
      if (message.groupId) {
        const group = findGroup(message.groupId);
        if (!group?.members.includes(user._id)) return;
      } else if (String(message.receiverId) !== String(user._id)) {
        return;
      }
      const updated = markReceipt(message._id, user._id);
      if (!updated) return;
      const groupReceipt = updated.deliveryReceipts?.[user._id] || {};
      emitToUser(updated.senderId, 'message_status', {
        messageId: updated._id,
        clientMessageId: updated.clientMessageId,
        status,
        deliveredAt: updated.deliveredAt || groupReceipt.deliveredAt || null,
        readAt: updated.readAt || groupReceipt.readAt || null
      });
    };

    socket.on('message:delivered', ({ messageId }) => {
      acknowledgeMessage(messageId, markMessageDelivered, 'delivered');
    });
    socket.on('message:read', ({ messageId }) => {
      acknowledgeMessage(messageId, markMessageRead, 'read');
    });

    // Send private message via socket
    socket.on('send_private_message', async ({ to, content, replyTo, media }) => {
      if (relayMode || process.env.WRITE_MODE === 'read-only') return socket.emit('message_error', { message: 'Send messages through the primary API' });
      if (!to || !canContact(user._id, to) || ((!content || !content.trim()) && !media)) return;
      if (replyTo) {
        const original = require('../db/store').findMessage(replyTo);
        if (!original || ![original.senderId, original.receiverId].includes(user._id) || ![original.senderId, original.receiverId].includes(to)) return;
      }
      let validMedia = null;
      if (media?.type === 'sticker' && media?.imageUrl) {
        validMedia = { type: 'sticker', stickerId: media.stickerId ? String(media.stickerId).slice(0, 100) : null, imageUrl: String(media.imageUrl).slice(0, 2000), name: media.name ? String(media.name).slice(0, 200) : 'Sticker' };
      } else if (media && media.dataUrl && media.name) {
        const sizeBytes = Math.round((media.dataUrl.length * 3) / 4);
        if (sizeBytes <= 8 * 1024 * 1024) {
          validMedia = { type: media.type === 'image' ? 'image' : 'file', dataUrl: media.dataUrl, name: String(media.name).slice(0, 200), size: sizeBytes };
        }
      }
      const target = findUserById(to);
      const targetAI = target?.isAI ? target : null;
      let aiTurnSequence = null;
      if (targetAI) {
        try { aiTurnSequence = await allocateAITurnSequence(user._id, targetAI.aiCharacterId || 'char_lyra'); }
        catch (error) {
          socket.emit('message_error', { message: 'Message storage is temporarily unavailable' });
          return;
        }
      }
      const msg = createMessage({
        senderId: user._id,
        receiverId: to,
        content: (content || '').trim().slice(0, 2000),
        replyTo: replyTo || null,
        media: validMedia,
        ...(aiTurnSequence ? { aiTurnSequence } : {})
      });
      try {
        await flushMessageWrites();
        if (targetAI) await registerAITurn(user._id, targetAI.aiCharacterId || 'char_lyra', msg);
      } catch (error) {
        console.error('[Socket] Message storage failed:', error.message);
        socket.emit('message_error', { message: 'Message storage is temporarily unavailable' });
        return;
      }
      if (targetAI) invalidateConversation(user._id, targetAI.aiCharacterId || 'char_lyra', msg._id);
      const populated = populateMessage(msg);
      if (targetAI) {
        emitToUser(user._id, `msg:${user._id}:${to}`, populated);
        emitToUser(user._id, `msg:${to}:${user._id}`, populated);
      } else {
        emitToUsers(io, [user._id, to], `msg:${user._id}:${to}`, populated);
        emitToUsers(io, [user._id, to], `msg:${to}:${user._id}`, populated);
      }
      if (!targetAI) notifyInApp(io, to, {
        type: 'new_message',
        from: { _id: user._id, name: user.name, avatar: user.avatar },
        preview: populated.content.slice(0, 80),
        messageId: populated._id
      }, {
        title: `Tin nhắn mới từ ${user.name}`,
        body: populated.content.slice(0, 160) || 'Bạn nhận được một tệp đính kèm.',
        data: { route: `/chat/${user._id}`, friendId: user._id, messageId: populated._id }
      });
      // Push notification for when recipient's app is closed/backgrounded
      if (!targetAI) sendMessagePush(to, user, validMedia || populated.content).catch(e =>
        console.error('[Push] Failed to send socket message push:', e.message)
      );
    });

    // ── WebRTC call signaling ─────────────────────────────────────────────
    // All events are forwarded to the target user; server never inspects SDP/ICE.

    socket.on('call:invite', ({ to, callType }) => {
      if (!to || !canContact(user._id, to)) return;
      const type = callType === 'video' ? 'video' : 'voice';
      emitToUser(to, `call:incoming:${to}`, {
        from: { _id: user._id, name: user.name, avatar: user.avatar },
        callType: type
      });
      // Send push notification
      if (!relayMode) sendPushToUser(to, {
        type:        'incoming_call',
        callType:    type,
        callerId:    user._id,
        callerName:  user.name,
        callerAvatar: user.avatar,
      }, { senderId: user._id }).catch(() => {});
    });

    socket.on('call:accept', ({ to }) => {
      if (!to || !canContact(user._id, to)) return;
      emitToUser(to, `call:accepted:${to}`, {
        from: { _id: user._id, name: user.name, avatar: user.avatar }
      });
    });

    socket.on('call:reject', ({ to }) => {
      if (!to || !canContact(user._id, to)) return;
      emitToUser(to, `call:rejected:${to}`, { from: user._id });
    });

    socket.on('call:end', ({ to }) => {
      if (!to || !canContact(user._id, to)) return;
      emitToUser(to, `call:ended:${to}`, { from: user._id });
    });

    // WebRTC handshake relay
    socket.on('call:offer', ({ to, offer, iceRestart }) => {
      if (!to || !canContact(user._id, to) || !offer) return;
      emitToUser(to, `call:offer:${to}`, { from: user._id, offer, iceRestart: Boolean(iceRestart) });
    });

    socket.on('call:answer', ({ to, answer, iceRestart }) => {
      if (!to || !canContact(user._id, to) || !answer) return;
      emitToUser(to, `call:answer:${to}`, { from: user._id, answer, iceRestart: Boolean(iceRestart) });
    });

    socket.on('call:ice', ({ to, candidate }) => {
      if (!to || !canContact(user._id, to) || !candidate) return;
      emitToUser(to, `call:ice:${to}`, { from: user._id, candidate });
    });

    // Group message via socket
    socket.on('send_group_message', async ({ groupId, content, media }) => {
      if (relayMode || process.env.WRITE_MODE === 'read-only') return socket.emit('message_error', { message: 'Send messages through the primary API' });
      const group = findGroup(groupId);
      if (!group || !group.members.includes(user._id)) return;
      if ((!content || !content.trim()) && !media) return;
      let validMedia = null;
      if (media?.type === 'sticker' && media?.imageUrl) {
        validMedia = { type: 'sticker', stickerId: media.stickerId ? String(media.stickerId).slice(0, 100) : null, imageUrl: String(media.imageUrl).slice(0, 2000), name: media.name ? String(media.name).slice(0, 200) : 'Sticker' };
      } else if (media?.dataUrl && media?.name) {
        const sz = Math.round((media.dataUrl.length * 3) / 4);
        if (sz <= 8 * 1024 * 1024) validMedia = { type: media.type === 'image' ? 'image' : 'file', dataUrl: media.dataUrl, name: String(media.name).slice(0, 200), size: sz };
      }
      const msg = createMessage({
        senderId: user._id,
        receiverId: null,
        groupId,
        content: (content || '').trim().slice(0, 2000),
        media: validMedia
      });
      try { await flushMessageWrites(); }
      catch (error) {
        console.error('[Socket] Group message storage failed:', error.message);
        socket.emit('message_error', { message: 'Message storage is temporarily unavailable' });
        return;
      }
      const populated = populateMessage(msg);
      group.members.forEach(memberId => {
        emitToUser(memberId, `msg:group:${groupId}:${memberId}`, populated);
        if (memberId !== user._id) {
          notifyInApp(io, memberId, {
            type: 'group_message',
            groupId,
            groupName: group.name,
            from: { _id: user._id, name: user.name, avatar: user.avatar },
            preview: (populated.content || '📎 Media').slice(0, 80)
          }, {
            title: group.name,
            body: `${user.name}: ${(populated.content || 'Có tệp đính kèm').slice(0, 80)}`,
            data: { route: `/group/${groupId}` }
          });
        }
      });
    });

    // Shared media mutations are authoritative REST writes on Vercel.
    socket.on('share_photo', (_payload, acknowledge = () => {}) => {
      const respond = typeof acknowledge === 'function' ? acknowledge : () => {};
      respond({ ok: false, error: 'Use the primary API for media' });
    });

    // Birthday wish — relay to the friend so they see the Happy Birthday overlay
    socket.on('wish_birthday', ({ targetUserId, age }) => {
      if (!targetUserId || !canContact(user._id, targetUserId)) return;
      emitToUser(targetUserId, `notify:${targetUserId}`, {
        type: 'happy_birthday',
        from: { _id: user._id, name: user.name, avatar: user.avatar },
        age: age || null
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${user.name}`);
      if (!relayMode) clearActiveChat(user._id);
      Object.values(typingTimeouts).forEach(clearTimeout);
      if (!relayMode) updateUser(user._id, { isOnline: false, lastSeen: new Date().toISOString() });
      broadcastOnlineFriends();
    });
  });
};

module.exports = setupSocket;
