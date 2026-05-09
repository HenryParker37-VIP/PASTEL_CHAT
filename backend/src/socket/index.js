const jwt = require('jsonwebtoken');
const {
  findUserById,
  updateUser,
  getOnlineUsers,
  createMessage,
  populateMessage
} = require('../db/store');

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

  io.on('connection', (socket) => {
    const { user } = socket;
    console.log(`[Socket] Connected: ${user.name}`);

    updateUser(user._id, { isOnline: true, lastSeen: new Date().toISOString() });
    io.emit('online_users', getOnlineUsers());

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
    socket.on('send_private_message', ({ to, content, replyTo }) => {
      if (!to || !content || !content.trim()) return;
      const msg = createMessage({
        senderId: user._id,
        receiverId: to,
        content: content.trim().slice(0, 2000),
        replyTo: replyTo || null
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
    });

    // ── WebRTC call signaling ─────────────────────────────────────────────
    // All events are forwarded to the target user; server never inspects SDP/ICE.

    socket.on('call:invite', ({ to, callType }) => {
      if (!to) return;
      io.emit(`call:incoming:${to}`, {
        from: { _id: user._id, name: user.name, avatar: user.avatar },
        callType: callType === 'video' ? 'video' : 'voice'
      });
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

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${user.name}`);
      Object.values(typingTimeouts).forEach(clearTimeout);
      updateUser(user._id, { isOnline: false, lastSeen: new Date().toISOString() });
      io.emit('online_users', getOnlineUsers());
    });
  });
};

module.exports = setupSocket;
