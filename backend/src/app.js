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

// Serve frontend static files
const path = require('path');
const frontendBuildPath = path.join(__dirname, '../../frontend/build');
app.use(express.static(frontendBuildPath));

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

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../../frontend/build/index.html');
  console.log('[Server] Fallback route: serving index.html from', indexPath);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('[Server] Error serving index.html:', err.message);
      res.status(404).json({ error: 'Frontend build not found. Build directory may be missing.' });
    }
  });
});

setupSocket(io);

// Telegram bot polling
const startTelegramPolling = () => {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TOKEN) {
    console.warn('[Telegram] ❌ No bot token — polling disabled');
    return;
  }

  const BOT_USERNAME = (process.env.TELEGRAM_BOT_USERNAME || 'PastelChat_Notification_bot').replace('@', '');
  const API = `https://api.telegram.org/bot${TOKEN}`;
  let offset = 0;
  let running = true;
  const processedIds = new Set(); // Deduplicate update IDs within this process

  const sendMessage = async (chatId, text, extra = {}) => {
    const r = await fetch(`${API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, ...extra })
    });
    const body = await r.json();
    if (!body.ok) {
      console.error('[Telegram] sendMessage failed:', JSON.stringify(body));
    } else {
      console.log(`[Telegram] ✉️  Replied to chatId ${chatId}`);
    }
    return body;
  };

  const handleVerifyCode = async (code, chatId) => {
    const user = findUserByVerificationCode(code);
    if (!user) {
      await sendMessage(chatId, '❌ Invalid or expired code. Please restart setup in Pastel Chat.');
      return;
    }
    const expired = user.telegramVerificationExpires && new Date() > new Date(user.telegramVerificationExpires);
    if (expired) {
      await sendMessage(chatId, '⏰ Code expired. Please restart setup in Pastel Chat.');
      return;
    }
    updateUser(user._id, {
      telegramChatId: String(chatId),
      telegramConnected: true,
      telegramVerified: true,
      telegramVerificationCode: null,
      telegramVerificationExpires: null
    });
    console.log(`[Telegram] ✅ Verified user ${user.name} (chatId: ${chatId})`);
    await sendMessage(chatId,
      '🎉 Connected to Pastel Chat!\n\nYou\'ll now receive notifications for incoming calls, messages, and friend requests.',
      { parse_mode: 'Markdown' }
    );
    io.emit('telegram:verified', { userId: String(user._id), chatId });
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
        // Deduplicate: skip if already processed in this session
        if (processedIds.has(update.update_id)) continue;
        processedIds.add(update.update_id);
        // Keep set small
        if (processedIds.size > 500) {
          const oldest = [...processedIds].slice(0, 250);
          oldest.forEach(id => processedIds.delete(id));
        }

        const msg = update.message;
        if (!msg) continue;

        const { text, from, chat } = msg;
        const chatId = chat.id;
        console.log(`[Telegram] 📩 Message from @${from.username || from.first_name}: "${text}"`);

        // Deep link: /start CODE  (from t.me/bot?start=CODE)
        if (text && text.startsWith('/start ')) {
          const payload = text.slice(7).trim().toUpperCase();
          if (payload) {
            console.log(`[Telegram] Deep link /start with code: ${payload}`);
            await handleVerifyCode(payload, chatId);
            continue;
          }
        }

        if (text === '/start') {
          console.log('[Telegram] /start received — sending welcome');
          await sendMessage(chatId,
            '🌸 Welcome to Pastel Chat Notifications!\n\n' +
            "I'll notify you about:\n" +
            '📞 Incoming calls\n💬 Messages & stickers\n👥 Friend requests\n\n' +
            'To connect, open Pastel Chat and tap the Telegram button — it\'s automatic! 🎉'
          );
        } else if (text && text.startsWith('/verify ')) {
          const code = text.slice(8).trim().toUpperCase();
          console.log(`[Telegram] /verify received — code: ${code}, chatId: ${chatId}`);
          await handleVerifyCode(code, chatId);
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
