# Capacitor iOS Setup Guide

This document covers converting the Pastel Chat PWA into a Capacitor-based iOS app with native push notification support.

## Overview

The conversion maintains all existing frontend code and UI while adding:
- Native iOS app wrapper via Capacitor
- Push notifications via Firebase Cloud Messaging (FCM) and Apple Push Notification (APNs)
- Background audio support for calls
- Picture-in-Picture (PiP) for video calls
- Native app lifecycle management

## Prerequisites

- **macOS** with Xcode 15+ installed
- **Node.js 18+**
- **npm 9+**
- **CocoaPods** (install: `sudo gem install cocoapods`)
- Apple Developer Account (for signing and App Store deployment)
- Firebase project with iOS app registered

## Installation

### 1. Install Dependencies

```bash
cd frontend
npm install
```

This installs:
- `@capacitor/core` - Core Capacitor framework
- `@capacitor/push-notifications` - Push notification support
- `@capacitor/app` - Native app lifecycle events
- `@capacitor/cli` - Capacitor CLI tools

### 2. Add iOS Platform

```bash
npm run cap:add:ios
```

This creates the `ios/` directory with the Xcode project. The Capacitor CLI automatically:
- Creates an iOS workspace
- Adds necessary Capacitor plugins
- Configures the app identifier

**Output:**
```
✔ Adding iOS...
✔ ios/App created
✔ Installed dependencies
```

### 3. Configure Firebase

#### A. Set Up Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or use existing one
3. Add iOS app:
   - Bundle ID: `com.pastelchat.app`
   - App Name: `Pastel Chat`
4. Download `GoogleService-Info.plist`

#### B. Add GoogleService-Info.plist to Xcode

1. Open Xcode: `npm run cap:open:ios`
2. In Xcode, drag `GoogleService-Info.plist` into the `App` target
3. Ensure it's added to the "App" target (check in File Inspector)

#### C. Enable Push Notifications Capability

1. In Xcode, select the `App` target
2. Go to **Signing & Capabilities**
3. Click **+ Capability**
4. Search and add **Push Notifications**
5. If needed, add **Background Modes** and enable:
   - Audio, AirPlay, and Picture in Picture
   - Background fetch
   - Remote notifications

#### D. Update App Delegate

The Capacitor plugin automatically handles push notification setup, but ensure the native code is configured:

Xcode path: `App/App/AppDelegate.swift`

Capacitor automatically registers the `PushNotificationsPlugin` which handles:
- Permission requests
- Device token registration
- Remote notification handling

### 4. Configure APNs (Apple Push Notification service)

#### A. Create APNs Certificate

1. Go to [Apple Developer](https://developer.apple.com)
2. In **Certificates, Identifiers & Profiles**:
   - Select **Identifiers** > Your App ID
   - Enable **Push Notifications**
   - Click **Configure** next to "Push Notifications"
3. Create new certificate:
   - Choose **Apple Push Notification service SSL (Sandbox & Production)**
   - Follow the CSR process
4. Download the certificate and add to Keychain

#### B. Export as PKCS12

In Keychain Access:
1. Find the APNs certificate you just created
2. Right-click > **Export**
3. Save as `.p12` file with a password
4. Upload this to Firebase:
   - Firebase Console > Project Settings > Cloud Messaging tab
   - Upload APNs certificate

### 5. Update Backend for Native Push

Add this endpoint to your Express server (`backend/src/routes/push.js`):

```javascript
// Register native (FCM/APNs) device token
router.post('/register-native', async (req, res) => {
  try {
    const { token, platform } = req.body;
    const userId = req.user?._id;

    if (!userId || !token) {
      return res.status(400).json({ error: 'Missing token or user' });
    }

    // Store device token in database with platform
    await DeviceToken.updateOne(
      { userId, platform },
      { token, platform, updatedAt: new Date() },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

For sending push notifications from backend, use Firebase Admin SDK:

```javascript
const admin = require('firebase-admin');

async function sendPushNotification(userId, notification) {
  const tokens = await DeviceToken.find({ userId });
  
  for (const doc of tokens) {
    try {
      await admin.messaging().send({
        token: doc.token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        ...(doc.platform === 'ios' && {
          apns: {
            payload: {
              aps: {
                sound: 'default',
                'badge': 1,
                category: 'CALL_NOTIFICATION',
              },
            },
          },
        }),
      });
    } catch (err) {
      console.error('Push send failed:', err);
      // Remove invalid token
      await DeviceToken.deleteOne({ _id: doc._id });
    }
  }
}
```

### 6. Build and Run on Device

#### Development Testing

```bash
# Build web app
npm run build

# Sync to iOS
npm run cap:sync:ios

# Open Xcode (and build from there)
npm run cap:open:ios
```

In Xcode:
1. Select your physical iPhone as the build target
2. Press Play (or Cmd+R) to build and run

#### Production Build

```bash
# Build with production settings
npm run build -- --configuration production

# Sync
npm run cap:sync:ios

# Open Xcode for archiving
npm run cap:open:ios
```

In Xcode:
1. Go to **Product > Scheme > Edit Scheme**
2. Select **Release** configuration
3. **Product > Archive** to create an archive
4. Upload to App Store Connect via Organizer

## Background Audio and Calls

### Configuration

The app automatically configures background audio through:

1. **Capacitor Configuration** (`capacitor.config.ts`):
   - Enables background modes for audio

2. **iOS Plist** (auto-configured by Capacitor):
   ```xml
   <key>UIBackgroundModes</key>
   <array>
       <string>audio</string>
       <string>voip</string>
   </array>
   ```

3. **CallContext.js**:
   - Automatically resumes audio on app foreground
   - Keeps media streams alive during background
   - Handles visibility changes

### Testing Background Audio

1. Start a voice call in the app
2. Press home button to background
3. Audio should continue playing
4. Swipe up on incoming call notification to bring app to foreground
5. Call should continue without interruption

## Push Notification Handling

### Incoming Call Flow

1. Backend sends push notification with:
   ```json
   {
     "notification": {
       "title": "Incoming Call",
       "body": "Alice is calling..."
     },
     "data": {
       "type": "incoming_call",
       "callerId": "user123",
       "callType": "voice"
     }
   }
   ```

2. Capacitor plugin receives notification in background
3. If app is in background, user taps notification
4. App launches/resumes and dispatches `capacitor:incoming-call` event
5. CallContext responds by showing incoming call alert
6. User can answer/decline from notification actions

### Custom Events

The app dispatches these events for notification handling:

- `capacitor:incoming-call` - App receives incoming call notification
- `capacitor:call-answer` - User tapped "Answer" action
- `capacitor:call-decline` - User tapped "Decline" action
- `capacitor:app-resumed` - App returned to foreground (resume audio)

## Testing Checklist

### Local Testing

- [ ] App launches and runs on iPhone
- [ ] Web UI displays correctly
- [ ] Google OAuth login works
- [ ] Can send/receive messages
- [ ] Can initiate voice call
- [ ] Can initiate video call
- [ ] Camera and microphone work
- [ ] Speaker toggle works

### Push Notifications

- [ ] Notification permission request appears on first run
- [ ] Device token is generated
- [ ] Token is registered with backend
- [ ] Can send test push from Firebase Console
- [ ] Notification displays on device
- [ ] App opens when notification is tapped
- [ ] Call notification triggers incoming call screen

### Background/Resume

- [ ] Backgrounding during call keeps audio alive
- [ ] Resuming app resumes audio without stuttering
- [ ] PiP mode works on video calls
- [ ] Exiting PiP resumes full-screen video

### Edge Cases

- [ ] Call during lock screen
- [ ] Incoming call while backgrounded
- [ ] Permission denied for notifications
- [ ] Token refresh/rotation handled
- [ ] App crashes and restarts during call

## Environment Variables

Add to `.env` in `frontend/`:

```
# Firebase config (from GoogleService-Info.plist)
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_PROJECT_ID=...

# Backend URL (important for native app)
REACT_APP_BACKEND_URL=https://api.pastelchat.com

# Or for local testing:
REACT_APP_BACKEND_URL=http://192.168.1.100:5000
```

**Note:** For local testing, use your machine's local IP (not `localhost`).

## Troubleshooting

### Build Failures

**CocoaPods issues:**
```bash
cd ios/App
pod repo update
pod install
cd ../..
```

**Xcode cache issues:**
```bash
npm run cap:open:ios
# In Xcode: Product > Clean Build Folder (Cmd+Shift+K)
# Then rebuild
```

### Push Notifications Not Received

1. Check Firebase Console > Cloud Messaging > APNs certificate is uploaded
2. Verify device token in Firebase:
   ```bash
   # Check backend database
   db.devicetokens.find({ userId: "..." })
   ```
3. Check Xcode console for errors when app launches
4. Ensure notification permission is granted (Settings > Pastel Chat > Notifications)

### Audio Not Playing

1. Check device is not in silent mode (check mute switch on side)
2. Verify microphone/speaker permissions granted in Settings
3. Check that speaker toggle is ON
4. Try disconnecting and reconnecting the call

### App Crashes on Startup

1. Check Xcode console for error messages
2. Verify GoogleService-Info.plist is correctly added to App target
3. Run `npm run cap:sync:ios` to update iOS files
4. Clean and rebuild: `Product > Clean Build Folder`

## App Store Submission

### Pre-Submission Checklist

- [ ] Version number updated in `capacitor.config.ts`
- [ ] Build number incremented in Xcode
- [ ] Privacy Policy URL set in App Store Connect
- [ ] Screenshots added (6-8 per device size)
- [ ] Description and keywords entered
- [ ] Support email provided
- [ ] All categories selected
- [ ] Content rating completed

### Build Archive

```bash
# Clean build
npm run build

# Sync
npm run cap:sync:ios

# Open for archiving
npm run cap:open:ios
```

In Xcode:
1. Select "Generic iOS Device" as target
2. Product > Archive
3. Wait for archive to complete
4. Organizer will open
5. Click "Distribute App" and follow App Store Connect steps

### TestFlight

Before submitting to App Store, test with TestFlight:

1. Upload archive from Xcode Organizer
2. Check automated tests in App Store Connect
3. Add internal testers and send beta build
4. Test on multiple devices
5. Gather feedback before production release

## Continuous Integration

For automated builds, set up GitHub Actions:

```yaml
name: iOS Build

on: [push]

jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm install
      - run: npm run build
      - run: npm run cap:sync:ios
      - run: |
          cd ios/App
          xcodebuild -workspace App.xcworkspace \
            -scheme App \
            -configuration Release \
            -derivedDataPath build \
            clean build
```

## Next Steps

1. **Monetization**: Add in-app purchases or subscriptions
2. **Analytics**: Integrate Firebase Analytics
3. **Crash Reporting**: Enable Firebase Crashlytics
4. **Remote Config**: Use Firebase Remote Config for feature flags
5. **Messaging**: Implement rich notifications with images/actions

## Support

For issues:
- Check Capacitor docs: https://capacitorjs.com
- Firebase docs: https://firebase.google.com/docs
- GitHub Issues: Create an issue with logs and reproduction steps
