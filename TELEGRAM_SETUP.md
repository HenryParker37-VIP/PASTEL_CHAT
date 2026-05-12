# Telegram Bot Setup Guide

This guide walks you through setting up Telegram Bot integration for Pastel Chat notifications.

## Overview

Telegram notifications provide a reliable fallback notification system, especially valuable for iOS users where PWA notifications can be unreliable. Users can optionally connect their Telegram account to receive:

- 📱 Incoming call alerts
- 💬 Message notifications
- ✨ Sticker & GIF alerts
- 👤 Friend request notifications

## Prerequisites

- A Telegram account
- Access to BotFather to create a bot
- Backend .env file access

## Step 1: Create a Telegram Bot via BotFather

1. Open Telegram and search for **BotFather** (verified bot with blue checkmark)
2. Start the chat and send `/newbot`
3. Follow BotFather's instructions:
   - Choose a bot name (e.g., "Pastel Chat Bot")
   - Choose a username (e.g., "pastel_chat_bot") — must end with `_bot`
4. BotFather will respond with:
   ```
   Done! Congratulations on your new bot. You will find it at t.me/your_bot_username.
   Use this token to access the HTTP API:
   XXXXXXXXXXXX:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```
5. **Copy the token** — this is your `TELEGRAM_BOT_TOKEN`

## Step 2: Get Bot Username

From BotFather's response or by searching your bot in Telegram:
- The bot username will be the `username` you chose (e.g., `pastel_chat_bot`)
- Full reference: `@pastel_chat_bot`

## Step 3: Configure Environment Variables

Update your backend `.env` file:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=<your_token_from_botfather>
TELEGRAM_BOT_USERNAME=@pastel_chat_bot
TELEGRAM_WEBHOOK_SECRET=<choose_any_random_string>
```

**Important Security Notes:**
- ✅ Token stored ONLY in backend .env
- ✅ Token NOT in git (verify .gitignore)
- ✅ Token NEVER sent to frontend
- ✅ All API calls use backend routes

## Step 4: Restart Backend

```bash
# Kill any running backend process
npm run dev  # Restart with new environment variables
```

## Step 5: User Onboarding Flow

When a user enables Telegram notifications in the app:

1. User clicks "Enable Telegram Notifications"
2. User enters their Telegram username
3. App generates a verification code
4. User opens Telegram and sends `/verify CODE` to your bot
5. User confirms in the app
6. Connection is verified ✅

### What Users See

**In Pastel Chat:**
```
[Modal Title] 📱 Telegram Notifications
"Get reliable notifications for incoming calls and messages"
[Input] @your_telegram_username
[Button] Continue
```

**In Telegram (after /verify CODE):**
```
✅ Successfully connected to Pastel Chat!
You will now receive notifications here.
```

## Step 6: Test the Connection

Once a user connects their Telegram:

1. Open Pastel Chat
2. Go to Settings (if Telegram section exists) or chat settings
3. Look for "Send Test Notification" button
4. Should receive a test message in Telegram within seconds

## Notification Types

### Incoming Calls
```
📱 Incoming call from John
Tap to answer in Pastel Chat
```

### Missed Calls
```
📵 Missed call from John
Tap to call back
```

### Messages
```
💬 John: Hey! How are you?…
```

### Stickers
```
✨ John sent a sticker
```

### GIFs
```
🎬 John sent a GIF
```

### Friend Requests
```
👤 Friend request from Jane
Tap to view in Pastel Chat
```

## User Preference Settings

Users can customize notifications via the Telegram setup modal:

- ☑️ All notifications (master switch)
- ☑️ Incoming calls
- ☑️ Messages & stickers

When users disconnect:
- All Telegram data is cleared
- No notifications sent to Telegram anymore
- User can reconnect anytime

## Security & Privacy

### What Telegram Stores
- User's Telegram chat ID (encrypted by Telegram)
- User's username (for identification)
- Notification preferences (stored in Pastel Chat database)

### What Telegram Does NOT Store
- Pastel Chat messages (not transmitted to Telegram)
- User passwords or credentials
- Personal data beyond Telegram ID/username

### Backend Safety
- Token validated on server startup
- Token never exposed in logs or errors
- Token never returned in API responses
- All Telegram API calls authenticated with bot token only

## Troubleshooting

### "Verification code expired"
- Codes expire after 10 minutes
- User needs to generate a new code and try again

### "Invalid verification code"
- Make sure the code was sent exactly as shown
- Check for typos (uppercase letters)
- Generate a new code if unsure

### User doesn't receive notifications
- Check notification preferences in Telegram setup modal
- Verify Telegram chat is not muted
- Test with "Send Test Notification" button
- Check user has telegramConnected: true in database

### Bot not responding to /verify
- Make sure bot token is correct in .env
- Verify bot username matches TELEGRAM_BOT_USERNAME
- Restart backend after changing .env
- Check bot privacy settings (should be disabled)

## Implementation Details

### Database Schema (User model)

```javascript
{
  // ... existing fields
  
  // Telegram connection
  telegramChatId: String,           // Unique Telegram chat ID
  telegramUsername: String,         // Display username
  telegramConnected: Boolean,       // Connection status
  telegramVerified: Boolean,        // Verification status
  telegramVerificationCode: String, // Temp code (10 min expiry)
  telegramVerificationExpires: Date,
  
  // Preferences
  notificationPreferences: {
    enableTelegramNotifications: Boolean,
    enableTelegramCalls: Boolean,
    enableTelegramMessages: Boolean
  }
}
```

### API Routes

Protected routes (require authentication):
- `POST /api/telegram/connect` - Start connection
- `POST /api/telegram/verify` - Complete verification
- `POST /api/telegram/disconnect` - Remove connection
- `GET /api/telegram/status` - Check connection status
- `PUT /api/telegram/preferences` - Update settings
- `POST /api/telegram/send-test-notification` - Test message

Public webhook:
- `POST /telegram/webhook` - Telegram bot updates

### Integration Points

**Message Sending:**
When a message is sent, system checks if receiver has Telegram connected and sends notification based on preferences.

**Notification Manager:**
Centralized notification logic handles:
- User preference filtering
- Telegram connection validation
- Graceful error handling

## Future Enhancements

- [ ] Telegram group chat support
- [ ] Rich media in notifications (sticker preview images)
- [ ] Deep linking (tapping notification opens specific chat)
- [ ] Notification scheduling (quiet hours)
- [ ] Web app for Telegram inline access
- [ ] Telegram commands for chat actions

## Support

If you encounter issues:

1. Check backend logs for `[Telegram]` entries
2. Verify `TELEGRAM_BOT_TOKEN` is set correctly
3. Test with BotFather's `/mybots` command
4. Review this guide's troubleshooting section

---

**Last Updated:** May 12, 2026
**Version:** 1.0
