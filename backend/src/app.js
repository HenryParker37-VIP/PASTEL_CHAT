require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

require('./db/store');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const friendRoutes = require('./routes/friends');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');
const privateSpaceRoutes = require('./routes/private-space');
const feedbackRoutes = require('./routes/feedback');
const adminRoutes = require('./routes/admin');
const pushRoutes = require('./routes/push');
const stickerRoutes = require('./routes/stickers');
const telegramRoutes = require('./routes/telegram');
const setupSocket = require('./socket');
const { findUserByVerificationCode, updateUser } = require('./db/store');

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsOrigin(origin, callback) {
  // Allow all origins to prevent CORS errors across hosting platforms
  callback(null, origin || '*');
}

const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: true }
});

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.set('io', io);

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/friends', friendRoutes);
app.use('/messages', messageRoutes);
app.use('/groups', groupRoutes);
app.use('/private-space', privateSpaceRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/admin', adminRoutes);
app.use('/push', pushRoutes);
app.use('/stickers', stickerRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/telegram', telegramRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }));

setupSocket(io);

// Telegram bot polling
const startTelegramPolling = () => {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TOKEN) {
    console.warn('[Telegram] ❌ No bot token — polling disabled');
    return;
  }

  const API = `https://api.telegram.org/bot${TOKEN}`;
  let offset = 0;
  let running = true;

  const sendMessage = async (chatId, text) => {
    const r = await fetch(`${API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    const body = await r.json();
    if (!body.ok) {
      console.error('[Telegram] sendMessage failed:', JSON.stringify(body));
    } else {
      console.log(`[Telegram] ✉️  Replied to chatId ${chatId}`);
    }
    return body;
  };

  const poll = async () => {
    if (!running) return;
    try {
      // timeout=0 returns immediately — avoids nodemon restart killing long-poll
      const r = await fetch(`${API}/getUpdates?offset=${offset}&timeout=0`);
      if (!r.ok) {
        console.error('[Telegram] getUpdates HTTP error:', r.status);
        setTimeout(poll, 3000);
        return;
      }
      const data = await r.json();
      if (!data.ok) {
        console.error('[Telegram] getUpdates error:', JSON.stringify(data));
        setTimeout(poll, 3000);
        return;
      }

      const updates = data.result || [];
      if (updates.length > 0) {
        console.log(`[Telegram] 📬 ${updates.length} update(s) received`);
      }

      for (const update of updates) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg) continue;

        const { text, from, chat } = msg;
        const chatId = chat.id;
        console.log(`[Telegram] 📩 Message from @${from.username || from.first_name}: "${text}"`);

        if (text === '/start') {
          console.log('[Telegram] /start received — sending welcome');
          await sendMessage(chatId,
            '🌸 Welcome to Pastel Chat Notifications!\n\n' +
            "I'll send you notifications for:\n" +
            '✅ Incoming calls\n✅ Messages & stickers\n✅ Friend requests\n\n' +
            'To connect your account:\n' +
            '1. Open Pastel Chat\n' +
            '2. Tap the Telegram button\n' +
            '3. Enter your Telegram username\n' +
            '4. Send me: /verify CODE\n\n' +
            "That's it! 🎉"
          );
        } else if (text && text.startsWith('/verify ')) {
          const code = text.slice(8).trim().toUpperCase();
          console.log(`[Telegram] /verify received — code: ${code}, chatId: ${chatId}`);

          // Find user with this verification code and complete verification
          const user = findUserByVerificationCode(code);
          if (user) {
            const expired = user.telegramVerificationExpires && new Date() > new Date(user.telegramVerificationExpires);
            if (expired) {
              await sendMessage(chatId, '⏰ Verification code expired. Please restart the setup in Pastel Chat.');
            } else {
              updateUser(user._id, {
                telegramChatId: String(chatId),
                telegramConnected: true,
                telegramVerified: true,
                telegramVerificationCode: null,
                telegramVerificationExpires: null
              });
              console.log(`[Telegram] ✅ Verified user ${user.name} (chatId: ${chatId})`);
              await sendMessage(chatId, '🎉 Connected to Pastel Chat! You\'ll now receive notifications here.');
              // Notify the frontend via Socket.IO so it auto-completes
              io.emit('telegram:verified', { userId: String(user._id), chatId });
            }
          } else {
            await sendMessage(chatId, '❌ Invalid or expired code. Please restart the setup in Pastel Chat.');
          }
        }
      }
    } catch (e) {
      console.error('[Telegram] Poll error:', e.message);
    }
    // Poll every 2 seconds
    if (running) setTimeout(poll, 2000);
  };

  // Clean up on process exit so nodemon restarts don't leave zombies
  process.once('SIGTERM', () => { running = false; });
  process.once('SIGINT',  () => { running = false; });

  console.log('[Telegram] ✅ Bot polling started (@PastelChat_Notification_bot)');
  poll();
};

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`[PastelChat] Running on port ${PORT} — created by Nguyen Manh Tuan Hung (Henry Parker)`);
  // Start Telegram polling immediately
  startTelegramPolling();
});

module.exports = { app, server };
