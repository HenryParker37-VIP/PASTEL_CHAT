# Telegram Bot Integration - Security Guidelines

## 🔒 Token Security (CRITICAL)

### Never Expose Token
- ❌ NEVER send token to frontend/client code
- ❌ NEVER log token in console
- ❌ NEVER commit token to git
- ❌ NEVER include in error messages

### Secure Storage
- ✅ Store ONLY in backend `.env` file
- ✅ Access via `process.env.TELEGRAM_BOT_TOKEN`
- ✅ Validate token exists on server startup
- ✅ Use environment variables for all deployments

### Implementation Rules
- ✅ All Telegram API calls happen on backend only
- ✅ Frontend makes requests to `/api/telegram/*` routes
- ✅ Backend validates user authentication before processing
- ✅ Never return raw token in API responses

## 🛡️ Backend Architecture

### Routes (Protected)
```
POST /api/telegram/connect
  - body: { telegramUsername or telegramChatId }
  - requires auth
  - returns: { connected: true }

POST /api/telegram/disconnect
  - requires auth
  - returns: { connected: false }

GET /api/telegram/status
  - requires auth
  - returns: { connected: bool, telegramId: string }

POST /api/telegram/send-test-notification
  - requires auth
  - sends test notification via Telegram
```

### Webhook Handling
```
POST /telegram/webhook
  - public endpoint for Telegram API callbacks
  - validates webhook token (secondary validation)
  - processes user connections and interactions
  - NO user auth needed (Telegram verifies itself)
```

## 🔑 Environment Variables

### Backend .env
```
TELEGRAM_BOT_TOKEN=YOUR_NEW_TOKEN_HERE
TELEGRAM_BOT_USERNAME=@your_bot_username
TELEGRAM_WEBHOOK_SECRET=random_secret_for_validation
```

### Never in Frontend
Frontend NEVER has access to:
- TELEGRAM_BOT_TOKEN
- TELEGRAM_WEBHOOK_SECRET
- Any Telegram credentials

## 🚨 Incident Response

### If Token is Exposed:
1. ✅ Revoke immediately via BotFather
2. ✅ Generate new token
3. ✅ Update backend .env
4. ✅ Redeploy backend
5. ✅ Check git history (should be clean)
6. ✅ Document in TELEGRAM_SECURITY.md

### Current Status (May 12, 2026)
- ⚠️ OLD TOKEN REVOKED
- ✅ NEW TOKEN: [USER HAS NEW TOKEN READY]
- ⏳ Awaiting implementation

## 📋 Deployment Checklist

Before going live:
- [ ] Token stored in Vercel backend env variables
- [ ] Token NOT in git history
- [ ] Token NOT in frontend .env
- [ ] Test webhook connectivity
- [ ] Test notification delivery
- [ ] Verify no logs expose token
- [ ] Document bot setup in README

## 🧪 Testing Securely

### Test Token Validation
```javascript
// ✅ OK - validate on startup
if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN not configured');
}

// ✅ OK - use in backend
const token = process.env.TELEGRAM_BOT_TOKEN;
const telegramAPI = `https://api.telegram.org/bot${token}`;

// ❌ NEVER - expose in response
res.json({ token: process.env.TELEGRAM_BOT_TOKEN }); // WRONG

// ✅ OK - return only what user needs
res.json({ connected: true, telegramUsername: user.telegramUsername });
```

### Test without Real Token
- Create `.env.test` for testing
- Use mock token for unit tests
- Mock Telegram API responses
- Never make real API calls in tests

## 📚 References

- Telegram Bot API: https://core.telegram.org/bots/api
- Telegram Webhooks: https://core.telegram.org/bots/webhooks
- Environment Variables: Never expose secrets client-side
