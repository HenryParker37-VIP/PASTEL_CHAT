require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const storeDb = require('./db/store');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const friendRoutes = require('./routes/friends');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');
const privateSpaceRoutes = require('./routes/private-space');
const feedbackRoutes = require('./routes/feedback');
const adminRoutes = require('./routes/admin');
const pushRoutes = require('./routes/push');
const notificationRoutes = require('./routes/notifications');
const releaseRoutes = require('./routes/releases');
const adminReleaseRoutes = require('./routes/admin-releases');
const stickerRoutes = require('./routes/stickers');
const gifRoutes = require('./routes/gifs');
const webrtcRoutes = require('./routes/webrtc');
const setupSocket = require('./socket');
const securityHeaders = require('./middleware/security');
const rateLimit = require('./middleware/rateLimit');
const { assertAuthConfigured } = require('./config/auth');
const { findUserByVerificationCode, updateUser } = require('./db/store');
const { appVersion, buildId, deployedAt } = require('./version');

const app = express();
const server = http.createServer(app);
app.set('trust proxy', 1);
if (process.env.NODE_ENV === 'production') assertAuthConfigured();

// The frontend is deployed both on Vercel and alongside this Render web service.
// Keep this an explicit production allowlist: OAuth POST requests carry an Origin
// header even when the frontend and API share the Render host.
const productionOrigins = [
  'https://pastel-chat.vercel.app',
  'https://pastel-chat.onrender.com',
  process.env.RENDER_EXTERNAL_URL,
];
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
for (const origin of productionOrigins) {
  if (origin && !allowedOrigins.includes(origin)) allowedOrigins.push(origin);
}

function corsOrigin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  callback(new Error('CORS origin not allowed'));
}

const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: true },
  // Shared media is transported through the existing authenticated socket flow.
  // Route-level limits still cap images at 5 MB and videos at 8 MB.
  maxHttpBufferSize: 12 * 1024 * 1024
});

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(securityHeaders);
app.use(express.json({ limit: '10mb', parameterLimit: 1000 }));
app.set('io', io);

// Serve frontend static files
const path = require('path');
const fs = require('fs');
// Try multiple possible paths for frontend build directory
const possiblePaths = [
  path.join(__dirname, '../../frontend/build'),           // From backend/src: ../../frontend/build
  path.join(process.cwd(), 'frontend/build'),             // From project root
  path.resolve(__dirname, '../../frontend/build'),        // Absolute resolve from backend/src
];
let frontendBuildPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    frontendBuildPath = p;
    console.log('[Server] Found frontend build at:', p);
    break;
  }
}
if (frontendBuildPath) {
  app.use(express.static(frontendBuildPath));
  console.log('[Server] Serving static files from:', frontendBuildPath);
} else {
  console.warn('[Server] Frontend build directory not found. Checked:', possiblePaths);
}

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/friends', rateLimit({ name: 'friends', windowMs: 60_000, max: 120 }), friendRoutes);
app.use('/messages', rateLimit({ name: 'messages', windowMs: 60_000, max: 180 }), messageRoutes);
app.use('/groups', rateLimit({ name: 'groups', windowMs: 60_000, max: 120 }), groupRoutes);
app.use('/private-space', rateLimit({ name: 'private-space', windowMs: 60_000, max: 120 }), privateSpaceRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/admin', adminRoutes);
app.use('/push', rateLimit({ name: 'push', windowMs: 60_000, max: 60 }), pushRoutes);
app.use('/notifications', notificationRoutes);
app.use('/releases', releaseRoutes);
app.use('/admin/releases', adminReleaseRoutes);
app.use('/stickers', stickerRoutes);
app.use('/api/gifs', rateLimit({ name: 'gifs', windowMs: 60_000, max: 60 }), gifRoutes);
app.use('/api/webrtc', webrtcRoutes);

app.get('/health', (_, res) => res.json({
  status: 'ok',
  storage: storeDb.isDurableStorageEnabled() ? 'mongodb' : 'local-ephemeral',
  timestamp: new Date()
}));

app.get('/api/version', (_, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.json({ version: appVersion, buildId, deployedAt });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid request body' });
  if (error.message === 'CORS origin not allowed') return res.status(403).json({ message: 'Origin not allowed' });
  console.error('[Server] Request error:', error.message);
  return res.status(500).json({ message: 'Request failed' });
});

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  if (frontendBuildPath) {
    const indexPath = path.join(frontendBuildPath, 'index.html');
    console.log('[Server] Fallback route: serving index.html from', indexPath);
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('[Server] Error serving index.html:', err.message);
        res.status(404).json({ error: 'Frontend file not found.' });
      }
    });
  } else {
    res.status(503).json({ error: 'Frontend build not found. Build directory may be missing.' });
  }
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
      // 409 = another instance is already polling (happens briefly during Render deploys)
      if (r.status === 409) {
        console.warn('[Telegram] 409 Conflict — another instance polling. Retrying in 15s...');
        setTimeout(poll, 15000);
        return;
      }
      if (!r.ok) {
        console.error('[Telegram] getUpdates HTTP error:', r.status);
        setTimeout(poll, 5000);
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
storeDb.ready.then(() => {
  server.listen(PORT, () => {
    console.log(`[PastelChat] Running on port ${PORT} — created by Nguyen Manh Tuan Hung (Henry Parker)`);
  });
}).catch((error) => {
  console.error('[PastelChat] Store initialization failed:', error.message);
  process.exitCode = 1;
});

module.exports = { app, server };
