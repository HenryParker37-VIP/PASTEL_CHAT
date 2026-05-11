# Native Push Notifications API

Backend integration guide for sending push notifications to Capacitor iOS app via Firebase Cloud Messaging and APNs.

## Overview

The native app registers device tokens with the backend, which stores them and uses Firebase Admin SDK to send push notifications.

## Database Schema

### DeviceToken Collection

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  token: String,           // FCM token from device
  platform: String,        // 'ios' | 'android' | 'web'
  registered: Date,
  lastActivity: Date,
  isActive: Boolean
}
```

### Create Schema

```javascript
const deviceTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  token: { type: String, required: true, unique: true },
  platform: { type: String, enum: ['ios', 'android', 'web'], required: true },
  registered: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
```

## Backend Setup

### 1. Install Firebase Admin SDK

```bash
npm install firebase-admin
```

### 2. Initialize Firebase

Create `src/services/firebase.js`:

```javascript
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Download from Firebase Console > Project Settings > Service Account Key
const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(
    'Missing firebase-service-account.json. Download from Firebase Console.'
  );
}

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, 'utf-8')
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
```

### 3. Device Token Registration Endpoint

Add to `src/routes/push.js`:

```javascript
import express from 'express';
import DeviceToken from '../models/DeviceToken.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /push/register-native
 * Register a device token from native app
 * 
 * Body:
 * {
 *   token: string,      // FCM token from device
 *   platform: 'ios'     // always 'ios' for Capacitor iOS app
 * }
 */
router.post('/register-native', authMiddleware, async (req, res) => {
  try {
    const { token, platform } = req.body;
    const userId = req.user._id;

    if (!token || !platform) {
      return res.status(400).json({ error: 'Missing token or platform' });
    }

    if (!['ios', 'android', 'web'].includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    // Store or update device token
    const deviceToken = await DeviceToken.findOneAndUpdate(
      { userId, platform, token },
      {
        userId,
        token,
        platform,
        lastActivity: new Date(),
        isActive: true,
      },
      { upsert: true, new: true }
    );

    console.log(`[Push] Token registered: ${platform} for user ${userId}`);

    res.json({
      success: true,
      tokenId: deviceToken._id,
    });
  } catch (err) {
    console.error('[Push] Registration failed:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /push/unregister-native
 * Unregister a device token
 */
router.post('/unregister-native', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user._id;

    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }

    await DeviceToken.deleteMany({ userId, token });

    console.log(`[Push] Token unregistered: ${token}`);

    res.json({ success: true });
  } catch (err) {
    console.error('[Push] Unregister failed:', err);
    res.status(500).json({ error: 'Unregister failed' });
  }
});

export default router;
```

## Sending Push Notifications

### 1. Create Push Service

Create `src/services/pushNotification.js`:

```javascript
import admin from './firebase.js';
import DeviceToken from '../models/DeviceToken.js';

/**
 * Send push notification to a user
 * @param {string} userId - User to send to
 * @param {object} notification - Notification payload
 * @returns {Promise<object>} Send results
 */
export async function sendPushToUser(userId, notification) {
  try {
    const tokens = await DeviceToken.find({ userId, isActive: true });

    if (tokens.length === 0) {
      console.warn(`[Push] No tokens found for user ${userId}`);
      return { success: false, reason: 'No device tokens' };
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const doc of tokens) {
      try {
        const message = buildMessage(doc.platform, notification);
        await admin.messaging().send(message);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          token: doc.token,
          error: error.message,
        });

        // Remove invalid tokens
        if (
          error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered'
        ) {
          await DeviceToken.deleteOne({ _id: doc._id });
        }
      }
    }

    console.log(
      `[Push] Sent to ${results.success}/${tokens.length} devices for user ${userId}`
    );

    return { success: true, ...results };
  } catch (err) {
    console.error('[Push] Send failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send incoming call notification
 * @param {string} toUserId - Recipient
 * @param {object} caller - Caller info { _id, name, avatar }
 * @param {string} callType - 'voice' or 'video'
 */
export async function sendIncomingCallNotification(toUserId, caller, callType) {
  const notification = {
    title: `${caller.name} is calling...`,
    body: `${callType} call`,
    data: {
      type: 'incoming_call',
      callerId: caller._id.toString(),
      callerName: caller.name,
      callType: callType,
      timestamp: Date.now().toString(),
    },
  };

  return sendPushToUser(toUserId, notification);
}

/**
 * Send message notification
 * @param {string} toUserId - Recipient
 * @param {object} message - Message info { from, text }
 */
export async function sendMessageNotification(toUserId, message) {
  const notification = {
    title: message.from.name,
    body: message.text.substring(0, 100),
    data: {
      type: 'new_message',
      fromUserId: message.from._id.toString(),
      messageId: message._id.toString(),
    },
  };

  return sendPushToUser(toUserId, notification);
}

// ─────────────────────────────────────────────────────────────────────────

function buildMessage(platform, notification) {
  const baseMessage = {
    token: notification.deviceToken || '',
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: notification.data || {},
  };

  // Platform-specific configuration
  if (platform === 'ios') {
    return {
      ...baseMessage,
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body,
            },
            sound: 'default',
            badge: 1,
            'content-available': 1, // Background notification
            category: notification.data?.type === 'incoming_call' 
              ? 'CALL_NOTIFICATION' 
              : 'MESSAGE_NOTIFICATION',
            'mutable-content': 1,
          },
        },
      },
    };
  }

  return baseMessage;
}
```

### 2. Use in Socket.io Events

In `src/services/socket.js` or your call handler:

```javascript
import io from 'socket.io';
import { sendIncomingCallNotification } from './pushNotification.js';

export function setupCallHandlers(socket) {
  socket.on('call:invite', async (data) => {
    const { to: toUserId, callType } = data;
    const caller = socket.user;

    // Send to Socket.io user if online
    io.to(toUserId).emit(`call:incoming:${toUserId}`, {
      from: caller,
      callType,
    });

    // Send push notification (for offline users)
    await sendIncomingCallNotification(toUserId, caller, callType);
  });

  socket.on('call:end', (data) => {
    const { to: toUserId } = data;
    io.to(toUserId).emit(`call:ended:${toUserId}`);
  });
}
```

## Notification Payloads

### Incoming Call

```javascript
{
  title: "Alice is calling...",
  body: "Voice call",
  data: {
    type: "incoming_call",
    callerId: "user123",
    callerName: "Alice",
    callType: "voice",
    timestamp: "1705339200000"
  }
}
```

### New Message

```javascript
{
  title: "Alice",
  body: "Hey, how are you?",
  data: {
    type: "new_message",
    fromUserId: "user123",
    messageId: "msg456"
  }
}
```

### Custom Notification

```javascript
{
  title: "Pastel Chat",
  body: "Custom notification",
  data: {
    type: "custom",
    action: "open_profile",
    targetId: "user123"
  }
}
```

## Frontend Handling

The frontend automatically handles these notifications through the Capacitor push plugin:

```javascript
// In capacitor-push.js
function onPushReceived(notification) {
  const data = notification.data || {};
  const { type, title, body } = data;

  if (type === 'incoming_call') {
    handleIncomingCallNotification(data);
  } else if (type === 'new_message') {
    showLocalNotification(title, body);
  }
}
```

## Testing

### Test with Firebase Console

1. Go to Firebase Console > Cloud Messaging
2. Create new campaign
3. Select your iOS app
4. Compose notification
5. Send to a device or topic

### Test with curl

```bash
curl -X POST https://fcm.googleapis.com/v1/projects/YOUR_PROJECT/messages:send \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "token": "DEVICE_TOKEN_HERE",
      "notification": {
        "title": "Test Call",
        "body": "Alice is calling..."
      },
      "data": {
        "type": "incoming_call",
        "callerId": "user123"
      }
    }
  }'
```

### Test with Backend Endpoint

```javascript
// Add temporary test endpoint
router.post('/test-push/:userId', async (req, res) => {
  const result = await sendIncomingCallNotification(
    req.params.userId,
    { _id: '123', name: 'Test Caller', avatar: null },
    'voice'
  );
  res.json(result);
});

// Call with:
// POST /push/test-push/USER_ID
```

## Monitoring & Debugging

### Enable Logging

In `firebase.js`:

```javascript
import * as logging from 'firebase-admin/logger';

logging.setLogLevel('debug');
```

### Monitor Token Cleanup

```javascript
// Clean up inactive tokens every 24 hours
setInterval(async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await DeviceToken.deleteMany({
    lastActivity: { $lt: thirtyDaysAgo },
  });
  console.log(`[Push] Cleaned up ${result.deletedCount} inactive tokens`);
}, 24 * 60 * 60 * 1000);
```

### Check Device Token Status

```javascript
// Endpoint to check tokens
router.get('/tokens/:userId', authMiddleware, async (req, res) => {
  const tokens = await DeviceToken.find({
    userId: req.params.userId,
  });
  res.json(tokens);
});
```

## Production Considerations

### Rate Limiting

Don't send more than 1 notification per user per 10 seconds:

```javascript
const recentTokens = new Map();

export async function sendPushToUser(userId, notification) {
  const lastSent = recentTokens.get(userId);
  if (lastSent && Date.now() - lastSent < 10000) {
    return { success: false, reason: 'Rate limited' };
  }
  recentTokens.set(userId, Date.now());
  // ... send notification
}
```

### Error Handling

Always handle these errors:

```javascript
if (error.code === 'messaging/invalid-registration-token') {
  // Token is invalid, remove it
  await DeviceToken.deleteOne({ token });
}

if (error.code === 'messaging/authentication-error') {
  // Firebase credentials invalid
  console.error('Firebase auth failed');
}

if (error.code === 'messaging/third-party-auth-error') {
  // APNs certificate expired
  console.error('APNs authentication failed');
}
```

### APNs Certificate Expiration

Monitor and renew APNs certificates before expiration:

```javascript
// Add reminder 30 days before expiration
function checkAPNsCertificate() {
  const certificateExpiry = new Date('2025-06-15'); // Set to your cert expiry
  const thirtyDaysFrom = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  if (certificateExpiry < thirtyDaysFrom) {
    console.warn('⚠️  APNs certificate expires soon!');
    // Send alert to developers
  }
}
```

## Security

### Token Validation

- Tokens are unique per device
- Tokens expire and are refreshed by iOS
- Invalid tokens are automatically removed
- Tokens are tied to specific users

### Data Privacy

- Never log full tokens in production
- Tokens are stored securely in database
- Use encryption for token storage if needed
- Follow Firebase data residency requirements

### Compliance

- GDPR: Provide way to delete tokens
- CCPA: Allow users to opt out
- HIPAA: Use end-to-end encryption if handling sensitive data

```javascript
// Token deletion endpoint
router.post('/delete-tokens', authMiddleware, async (req, res) => {
  await DeviceToken.deleteMany({ userId: req.user._id });
  res.json({ success: true });
});
```

## References

- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [APNs Overview](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server)
- [FCM Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Capacitor Push Plugin](https://capacitorjs.com/docs/apis/push-notifications)
