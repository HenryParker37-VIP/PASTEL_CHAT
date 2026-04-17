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

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${user.name}`);
      Object.values(typingTimeouts).forEach(clearTimeout);
      updateUser(user._id, { isOnline: false, lastSeen: new Date().toISOString() });
      io.emit('online_users', getOnlineUsers());
    });
  });
};

module.exports = setupSocket;
