const jwt = require('jsonwebtoken');
const webpush = require('web-push');
const {
  findUserById,
  updateUser,
  getOnlineUsers,
  getFriends,
  findGroup,
  createMessage,
  populateMessage,
  addSharedPhoto,
  genId,
  getPushSubscriptions,
  removePushSubscription
} = require('../db/store');
const { notifyIncomingCall } = require('../integrations/notificationManager');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'admin@pastelchat.app'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function sendPush(toUserId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  const subs = getPushSubscriptions(toUserId);
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        removePushSubscription(toUserId, sub.endpoint);
      } else {
        console.warn('[Push] sendNotification error:', err.message);
      }
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'pastel-chat-secret';

const setupSocket = (io) => {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Auth: no token'));
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = findUserById(decoded.userId);
      if (!user) return next(new Error('Auth: user not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Auth: invalid token'));
    }
  });

  // Send each connected user only the online status of their own friends
  const broadcastOnlineFriends = () => {
    const allOnline = getOnlineUsers();
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
    console.log(`[Socket] Connected: ${user.name}`);

    updateUser(user._id, { isOnline: true, lastSeen: new Date().toISOString() });
    broadcastOnlineFriends();

    // Typing: targeted to a specific peer
    let typingTimeouts = {};
    socket.on('user_typing', ({ to, isTyping }) => {
      if (!to) return;
      clearTimeout(typingTimeouts[to]);
      const payload = {
        from: { _id: user._id, name: user.name, avatar: user.avatar },
        to,
        isTyping
      };
      io.emit(`typing:${to}`, payload);
      if (isTyping) {
        typingTimeouts[to] = setTimeout(() => {
          io.emit(`typing:${to}`, { ...payload, isTyping: false });
        }, 3000);
      }
    });

    // Send private message via socket
    socket.on('send_private_message', ({ to, content, replyTo, media }) => {
      if (!to || ((!content || !content.trim()) && !media)) return;
      let validMedia = null;
      if (media && media.dataUrl && media.name) {
        const sizeBytes = Math.round((media.dataUrl.length * 3) / 4);
        if (sizeBytes <= 8 * 1024 * 1024) {
          validMedia = { type: media.type === 'image' ? 'image' : 'file', dataUrl: media.dataUrl, name: String(media.name).slice(0, 200), size: sizeBytes };
        }
      }
      const msg = createMessage({
        senderId: user._id,
        receiverId: to,
        content: (content || '').trim().slice(0, 2000),
        replyTo: replyTo || null,
        media: validMedia
      });
      const populated = populateMessage(msg);
      io.emit(`msg:${user._id}:${to}`, populated);
      io.emit(`msg:${to}:${user._id}`, populated);
      io.emit(`notify:${to}`, {
        type: 'new_message',
        from: { _id: user._id, name: user.name, avatar: user.avatar },
        preview: populated.content.slice(0, 80),
        messageId: populated._id
      });
      // Push notification for when recipient's app is closed/backgrounded
      const preview = populated.content
        ? populated.content.slice(0, 80)
        : validMedia ? `Sent ${validMedia.type === 'image' ? 'a photo' : 'a file'}` : '📎 Attachment';
      sendPush(to, {
        type:  'new_message',
        title: user.name,
        body:  preview,
        tag:   `msg-${user._id}`,
        url:   '/',
      });
    });

    // ── WebRTC call signaling ─────────────────────────────────────────────
    // All events are forwarded to the target user; server never inspects SDP/ICE.

    socket.on('call:invite', ({ to, callType }) => {
      if (!to) return;
      const type = callType === 'video' ? 'video' : 'voice';
      io.emit(`call:incoming:${to}`, {
        from: { _id: user._id, name: user.name, avatar: user.avatar },
        callType: type
      });
      // Send push notification
      sendPush(to, {
        type:        'incoming_call',
        callType:    type,
        callerId:    user._id,
        callerName:  user.name,
        callerAvatar: user.avatar,
      });
      // Send Telegram notification (async, non-blocking)
      notifyIncomingCall(to, { name: user.name, avatar: user.avatar }, type).catch(() => {});
    });

    socket.on('call:accept', ({ to }) => {
      if (!to) return;
      io.emit(`call:accepted:${to}`, {
        from: { _id: user._id, name: user.name, avatar: user.avatar }
      });
    });

    socket.on('call:reject', ({ to }) => {
      if (!to) return;
      io.emit(`call:rejected:${to}`, { from: user._id });
    });

    socket.on('call:end', ({ to }) => {
      if (!to) return;
      io.emit(`call:ended:${to}`, { from: user._id });
    });

    // WebRTC handshake relay
    socket.on('call:offer', ({ to, offer }) => {
      if (!to || !offer) return;
      io.emit(`call:offer:${to}`, { from: user._id, offer });
    });

    socket.on('call:answer', ({ to, answer }) => {
      if (!to || !answer) return;
      io.emit(`call:answer:${to}`, { from: user._id, answer });
    });

    socket.on('call:ice', ({ to, candidate }) => {
      if (!to || !candidate) return;
      io.emit(`call:ice:${to}`, { from: user._id, candidate });
    });

    // Group message via socket
    socket.on('send_group_message', ({ groupId, content, media }) => {
      const group = findGroup(groupId);
      if (!group || !group.members.includes(user._id)) return;
      if ((!content || !content.trim()) && !media) return;
      let validMedia = null;
      if (media?.dataUrl && media?.name) {
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
      const populated = populateMessage(msg);
      group.members.forEach(memberId => {
        io.emit(`msg:group:${groupId}:${memberId}`, populated);
        if (memberId !== user._id) {
          io.emit(`notify:${memberId}`, {
            type: 'group_message',
            groupId,
            groupName: group.name,
            from: { _id: user._id, name: user.name, avatar: user.avatar },
            preview: (populated.content || '📎 Media').slice(0, 80)
          });
        }
      });
    });

    // Share a photo — persist to store then broadcast to all friends
    socket.on('share_photo', ({ dataUrl, caption }) => {
      if (!dataUrl || !dataUrl.startsWith('data:image/')) return;
      const sizeBytes = Math.round((dataUrl.length * 3) / 4);
      if (sizeBytes > 5 * 1024 * 1024) return; // 5 MB cap
      const friends = getFriends(user._id);
      const payload = {
        _id: genId(),
        dataUrl,
        caption: caption ? String(caption).slice(0, 200) : '',
        uploadedBy: { _id: user._id, name: user.name, avatar: user.avatar, loginMethod: user.loginMethod || 'code' },
        createdAt: new Date().toISOString(),
        isHidden: false
      };
      addSharedPhoto(payload);
      // Deliver to every friend (online or offline — they'll see it on load)
      friends.forEach(f => {
        io.emit(`new_photo_shared:${f.friendId}`, payload);
      });
      // Echo back to sender so it appears in their own feed immediately
      socket.emit(`new_photo_shared:${user._id}`, payload);
    });

    // Birthday wish — relay to the friend so they see the Happy Birthday overlay
    socket.on('wish_birthday', ({ targetUserId, age }) => {
      if (!targetUserId) return;
      io.emit(`notify:${targetUserId}`, {
        type: 'happy_birthday',
        from: { _id: user._id, name: user.name, avatar: user.avatar },
        age: age || null
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${user.name}`);
      Object.values(typingTimeouts).forEach(clearTimeout);
      updateUser(user._id, { isOnline: false, lastSeen: new Date().toISOString() });
      broadcastOnlineFriends();
    });
  });
};

module.exports = setupSocket;
