# iOS App - Quick Start

Get the iOS app running in 10 minutes.

## Prerequisites

- macOS with Xcode 15+
- Node.js 18+
- Apple Developer Account (for device testing)
- 30 minutes for first-time setup

## 5-Minute Setup

### Step 1: Install Dependencies (2 min)

```bash
cd frontend
npm install
```

### Step 2: Create iOS Project (3 min)

```bash
npm run cap:add:ios
```

Output should show:
```
✓ Installed dependencies
✓ Created ios folder
✓ Added App target
```

### Step 3: Build & Sync (5 min)

```bash
npm run build
npm run cap:sync:ios
```

### Step 4: Open in Xcode

```bash
npm run cap:open:ios
```

Xcode opens automatically. Select **iPhone simulator** and press **▶ Play**.

## What You'll See

1. Splash screen (3 seconds)
2. App launches with login screen
3. Click **"Register"** to create account
4. Use any name
5. You're in! 🎉

## Testing Features

### Messaging
- ✅ Send message to yourself (open 2 browsers)
- ✅ Receive real-time updates
- ✅ Avatar customization

### Calling
- ✅ Open 2 simulators/devices
- ✅ Start voice call
- ✅ Microphone/speaker working?
- ✅ Video call (if camera available)

### Background
- ✅ Start call, press home button
- ✅ Audio continues playing
- ✅ Resume app - call still active

## Environment Setup (Optional)

For connecting to real backend:

Create `frontend/.env`:

```bash
REACT_APP_BACKEND_URL=http://192.168.1.100:5000
REACT_APP_VAPID_PUBLIC_KEY=your-key-here
```

⚠️ Use your machine's IP, not `localhost`.

## Push Notifications (Next)

After basic testing:

1. Set up Firebase project
2. Download `GoogleService-Info.plist`
3. Add to Xcode: `ios/App/App/GoogleService-Info.plist`
4. Enable "Push Notifications" capability
5. Upload APNs certificate to Firebase

See: `CAPACITOR_SETUP.md` for detailed steps.

## Device Testing

To test on real iPhone:

1. Connect iPhone via USB
2. In Xcode, select your device (top-left)
3. Press ▶ Play
4. Wait ~30 seconds for build
5. App launches on device!

⚠️ First launch may take 2-3 minutes.

## Troubleshooting

### Build fails with "Pod"

```bash
cd ios/App
pod install
cd ../..
npm run cap:sync:ios
```

### App won't open

1. Check Console in Xcode (bottom panel)
2. Look for red errors
3. Try: `Product > Clean Build Folder` (Cmd+Shift+K)
4. Rebuild

### Network errors

1. Check REACT_APP_BACKEND_URL is correct
2. Verify backend is running
3. Try: `ping 192.168.1.100` (your IP)

## Next Steps

1. ✅ **Simulator**: Get it running locally
2. ⬜ **Device**: Test on real iPhone
3. ⬜ **Backend**: Connect to server
4. ⬜ **Push**: Set up notifications
5. ⬜ **Store**: Submit to App Store

## Time Breakdown

| Step | Time |
|------|------|
| npm install | 2 min |
| cap add ios | 3 min |
| First build | 5 min |
| Xcode compile | 5 min |
| **Total** | **15 min** |

## Useful Commands

```bash
# Rebuild after code changes
npm run build && npm run cap:sync:ios

# Open in Xcode
npm run cap:open:ios

# Just sync (no build)
npx cap sync ios

# Copy web build (no npm build)
npx cap copy ios
```

## File Structure

What you need to know:

```
.
├── frontend/           # React app (unchanged)
│   ├── src/
│   └── package.json
├── ios/                # Generated - don't edit directly
│   └── App/
│       └── App.xcworkspace ← OPEN THIS IN XCODE
└── CAPACITOR_SETUP.md  # Detailed guide
```

## Key Files

- **capacitor.config.ts**: App configuration
- **frontend/src/services/capacitor-push.js**: Push handling
- **ios/App/App/AppDelegate.swift**: iOS setup (reference)

## Support

Stuck? Read these:

| Issue | See |
|-------|-----|
| Setup issues | `CAPACITOR_SETUP.md` |
| Push notifications | `NATIVE_PUSH_API.md` |
| App Store | `APP_STORE_GUIDE.md` |
| Architecture | `CAPACITOR_MIGRATION.md` |

## One-Liner to Get Running

```bash
cd frontend && npm install && npm run cap:add:ios && npm run build && npm run cap:sync:ios && npm run cap:open:ios
```

Then in Xcode, press ▶ Play. Done! 🚀

---

**Estimated time to App Store**: 2-3 weeks (first submission can take longer)

**Need help?** Create an issue with:
- Your macOS/Xcode version
- Full error message
- Steps to reproduce
