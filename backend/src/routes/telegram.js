const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');
const { findUserById, updateUser } = require('../db/store');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'secret';

if (!TELEGRAM_BOT_TOKEN) {
  console.warn('[Telegram] Bot token not configured in .env');
}

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Helper: Generate verification code
function generateVerificationCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Helper: Validate webhook signature
function validateWebhookSignature(body, signature) {
  if (!TELEGRAM_WEBHOOK_SECRET) return true; // Skip if not configured
  const hash = crypto
    .createHmac('sha256', TELEGRAM_WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');
  return hash === signature;
}

// POST /api/telegram/connect
// User initiates Telegram connection by providing their Telegram username
router.post('/connect', authMiddleware, async (req, res) => {
  try {
    const { telegramUsername } = req.body;
    if (!telegramUsername) {
      return res.status(400).json({ message: 'Telegram username required' });
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresIn = 10 * 60 * 1000; // 10 minutes
    const expiresAt = new Date(Date.now() + expiresIn);

    // Store verification code on user
    const user = findUserById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    updateUser(req.user._id, {
      telegramUsername,
      telegramVerificationCode: code,
      telegramVerificationExpires: expiresAt,
      telegramConnected: false,
      telegramVerified: false
    });

    // In production, send code via Telegram bot direct message
    // For now, return code for frontend to display (user will send /verify CODE to bot)
    res.json({
      message: 'Verification code generated',
      verificationCode: code,
      expiresIn: expiresIn / 1000,
      instructions: `Send this message to @${TELEGRAM_BOT_TOKEN.split(':')[0]}Bot:\n/verify ${code}`
    });
  } catch (e) {
    console.error('[Telegram/connect] Error:', e.message);
    res.status(500).json({ message: 'Failed to initiate Telegram connection' });
  }
});

// POST /api/telegram/disconnect
// Remove Telegram connection
router.post('/disconnect', authMiddleware, async (req, res) => {
  try {
    updateUser(req.user._id, {
      telegramChatId: null,
      telegramUsername: null,
      telegramConnected: false,
      telegramVerified: false,
      telegramVerificationCode: null,
      telegramVerificationExpires: null
    });
    res.json({ message: 'Telegram disconnected', connected: false });
  } catch (e) {
    console.error('[Telegram/disconnect] Error:', e.message);
    res.status(500).json({ message: 'Failed to disconnect Telegram' });
  }
});

// GET /api/telegram/status
// Check Telegram connection status
router.get('/status', authMiddleware, (req, res) => {
  try {
    const user = findUserById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      connected: !!user.telegramConnected,
      verified: !!user.telegramVerified,
      telegramUsername: user.telegramUsername || null,
      telegramChatId: user.telegramChatId || null,
      preferences: user.notificationPreferences || {}
    });
  } catch (e) {
    console.error('[Telegram/status] Error:', e.message);
    res.status(500).json({ message: 'Failed to get Telegram status' });
  }
});

// PUT /api/telegram/preferences
// Update notification preferences
router.put('/preferences', authMiddleware, (req, res) => {
  try {
    const { enableTelegramNotifications, enableTelegramCalls, enableTelegramMessages } = req.body;
    const user = findUserById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    updateUser(req.user._id, {
      notificationPreferences: {
        enableTelegramNotifications: enableTelegramNotifications ?? true,
        enableTelegramCalls: enableTelegramCalls ?? true,
        enableTelegramMessages: enableTelegramMessages ?? true
      }
    });

    res.json({ message: 'Preferences updated', preferences: user.notificationPreferences });
  } catch (e) {
    console.error('[Telegram/preferences] Error:', e.message);
    res.status(500).json({ message: 'Failed to update preferences' });
  }
});

// POST /api/telegram/send-test-notification
// Send a test notification to verify Telegram connection
router.post('/send-test-notification', authMiddleware, async (req, res) => {
  try {
    const user = findUserById(req.user._id);
    if (!user || !user.telegramChatId) {
      return res.status(400).json({ message: 'Telegram not connected' });
    }

    const message = `✨ Pastel Chat Test Notification\n\nIf you see this, your Telegram connection is working!`;

    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegramChatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(400).json({ message: 'Failed to send message', error });
    }

    res.json({ message: 'Test notification sent' });
  } catch (e) {
    console.error('[Telegram/test-notification] Error:', e.message);
    res.status(500).json({ message: 'Failed to send test notification' });
  }
});

// POST /telegram/webhook
// Public webhook endpoint for Telegram bot callbacks
// Telegram sends updates when user interacts with bot
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-telegram-webhook-signature'];
    if (!validateWebhookSignature(req.body, signature)) {
      return res.status(403).json({ message: 'Invalid signature' });
    }

    const { message, update_id } = req.body;
    if (!message) {
      return res.json({ ok: true });
    }

    const { text, from, chat } = message;
    const chatId = chat.id;
    const telegramUserId = from.id;
    const username = from.username;

    // Handle /start command
    if (text === '/start') {
      const welcomeMessage = `🌸 Welcome to Pastel Chat Notifications!\n\nI'm here to send you reliable notifications for:\n✅ Incoming calls\n✅ Messages & stickers\n✅ Friend requests\n\nTo connect your Pastel Chat account:\n1. Open the Pastel Chat app\n2. Go to Home → Telegram button\n3. Enter your Telegram username\n4. I'll give you a verification code\n5. Send me: /verify CODE\n\nThat's it! 🎉`;

      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: welcomeMessage,
          parse_mode: 'Markdown'
        })
      }).catch(e => console.error('[Telegram] Failed to send /start response:', e.message));

      return res.json({ ok: true });
    }

    // Parse /verify CODE command
    if (text && text.startsWith('/verify ')) {
      const code = text.slice(8).trim().toUpperCase();

      // Find user with this verification code
      // Note: In production, query MongoDB directly
      // For now, this is a placeholder - actual implementation depends on DB access in webhook context

      // We need to find the user by verification code and Telegram username
      // This would require a database query that's out of scope for this webhook
      // In a real implementation, store in Redis cache or similar

      const apiResponse = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '✅ Verification code received! Please return to Pastel Chat to complete setup.',
          parse_mode: 'Markdown'
        })
      });

      // Store pending verification in cache/temp store (to be matched in /api/telegram/verify endpoint)
      // For now, emit event via Socket.IO if user is connected
      const io = req.app.get('io');
      if (io) {
        io.emit('telegram:verification', { code, chatId, username, telegramUserId });
      }

      return res.json({ ok: true });
    }

    // Handle other bot commands/messages as needed
    res.json({ ok: true });
  } catch (e) {
    console.error('[Telegram/webhook] Error:', e.message);
    res.json({ ok: true }); // Always return 200 to Telegram
  }
});

// POST /api/telegram/verify
// Frontend polls this to check if bot verification has completed.
// The actual verification happens automatically in the polling loop (app.js)
// when the user sends /verify CODE to the bot.
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const user = findUserById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.telegramVerified && user.telegramChatId) {
      return res.json({
        verified: true,
        connected: true,
        preferences: user.notificationPreferences || {}
      });
    }

    // Not yet verified — check if code is expired
    if (user.telegramVerificationExpires && new Date() > new Date(user.telegramVerificationExpires)) {
      return res.status(400).json({ message: 'Verification code expired. Please start again.' });
    }

    res.json({ verified: false, connected: false });
  } catch (e) {
    console.error('[Telegram/verify] Error:', e.message);
    res.status(500).json({ message: 'Failed to check verification status' });
  }
});

module.exports = router;
