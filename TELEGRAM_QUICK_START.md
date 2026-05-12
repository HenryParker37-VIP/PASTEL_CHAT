# Telegram Bot - Quick Start (2 Minutes)

## 🚀 Get It Running Now

### 1️⃣ Create Telegram Bot (2 min)
**In Telegram app:**
1. Search for **BotFather**
2. Send `/newbot`
3. Choose a name: "Pastel Chat Bot"
4. Choose username: "pastel_chat_bot" (must end with _bot)
5. **Copy the token you get back**
   ```
   XXXXXXXXXXXX:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

### 2️⃣ Add Token to Backend (30 sec)
**Edit `backend/.env`:**
```
TELEGRAM_BOT_TOKEN=<paste_your_token_here>
TELEGRAM_BOT_USERNAME=@pastel_chat_bot
TELEGRAM_WEBHOOK_SECRET=telegram-webhook-secret
```

Save file.

### 3️⃣ Restart Backend (1 min)
```bash
# In backend directory
npm run dev
```

### 4️⃣ Add Button to Frontend (1 min)

**In your Settings/Profile component, add:**
```javascript
import TelegramSetup from '../components/TelegramSetup';

const [showTelegramSetup, setShowTelegramSetup] = useState(false);

// Add to JSX:
<button onClick={() => setShowTelegramSetup(true)}>
  📱 Enable Telegram Notifications
</button>

{showTelegramSetup && (
  <TelegramSetup
    onClose={() => setShowTelegramSetup(false)}
    onConnected={() => setShowTelegramSetup(false)}
  />
)}
```

### 5️⃣ Test It! 🎉
1. Open app, click the button
2. Enter your Telegram username
3. Open Telegram, find your bot
4. Send it the verification code shown
5. Click "I sent the code" in the app
6. Should say "Connected ✅"

---

## 🎯 What Users Get

When you connect Telegram, you'll receive notifications for:
- 📱 Incoming calls
- 💬 Messages
- ✨ Stickers & GIFs
- 👤 Friend requests

All in Telegram, even when the Pastel Chat app is closed! Especially great on iOS.

---

## 🔐 Security (Don't Worry!)

✅ Token stays in backend only
✅ No passwords or personal data in Telegram
✅ Users can disconnect anytime
✅ All code follows security best practices

See [TELEGRAM_SECURITY.md](./TELEGRAM_SECURITY.md) for details.

---

## ❓ Stuck?

- Token not working? → Double-check it's copied correctly from BotFather
- Button not showing? → Make sure you added the import and JSX
- No notifications? → Check Telegram is not muted, enable in app settings
- More help? → See [TELEGRAM_SETUP.md](./TELEGRAM_SETUP.md)

---

## 📝 That's It!

Implementation is complete. You just need the token and to add the button. 5 minutes total. 🚀
