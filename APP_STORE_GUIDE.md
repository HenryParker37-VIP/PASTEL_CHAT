# App Store Submission Guide

Complete guide for submitting Pastel Chat to the Apple App Store.

## Timeline

- **Preparation**: 2-3 days
- **Testing**: 3-7 days (TestFlight)
- **Review**: 24-48 hours (usually)
- **Total**: 1-2 weeks

## Pre-Submission Requirements

### 1. Developer Account

- Enroll in Apple Developer Program ($99/year)
- Accept latest agreements in App Store Connect
- Configure team and signing certificates

### 2. App Store Connect Setup

Sign in to [App Store Connect](https://appstoreconnect.apple.com):

1. **Create App**:
   - Click "My Apps" > "+"
   - Choose "New App"
   - Bundle ID: `com.pastelchat.app`
   - Name: `Pastel Chat`
   - Primary Language: English
   - Category: Social Networking (or Communication)

2. **Privacy & Legal**:
   - Privacy Policy URL (required)
   - Terms of Service (optional but recommended)
   - Contact Email
   - Rubric Category: Select appropriate one

3. **App Icon & Screenshots**:
   - App Icon: 1024x1024 PNG
   - Screenshots for each device:
     - iPhone (5.5") and iPhone (6.7") (landscape optional)
     - iPad (12.9") (landscape required)
   - 3-8 screenshots per device size

### 3. Build Preparation

```bash
# Update version numbers
# In capacitor.config.ts:
# "version": "1.0.0"

# In Xcode:
# - Select App target
# - General tab
# - Version: 1.0
# - Build: 1

# Build for release
npm run build

# Sync
npm run cap:sync:ios

# Open Xcode
npm run cap:open:ios
```

### 4. Code Signing & Certificates

In Xcode:

1. Select **App** target
2. Go to **Signing & Capabilities**
3. Check **"Automatically manage signing"**
4. Select Team from dropdown
5. Xcode creates signing certificate automatically

If manual signing needed:
- Create Certificate in Apple Developer
- Download provisioning profile
- Import in Xcode

### 5. Capabilities Configuration

Ensure these are enabled:

- **Push Notifications**: Required for incoming calls
- **Background Modes**:
  - ☑ Audio, AirPlay, and Picture in Picture
  - ☑ Background fetch
  - ☑ Remote notifications
- **Sign in with Apple**: If supporting SSO (optional)

### 6. Build Settings

In Xcode, verify:

| Setting | Value |
|---------|-------|
| Bundle Identifier | com.pastelchat.app |
| Version | 1.0 |
| Build | 1 |
| SDK | iOS 14.0 or higher |
| Minimum Deployment | iOS 14.0 |

### 7. App Description

In App Store Connect, provide:

**Subtitle** (30 chars):
```
Real-time messaging with style
```

**Description** (4000 chars):
```
Pastel Chat is a modern real-time messaging app with beautiful, 
pastel-colored UI. Features include:

• Real-time messaging with Socket.io
• Voice and video calling via WebRTC
• Secure Google OAuth authentication
• Gif and sticker support
• Dark mode support
• Picture-in-picture for video calls
• Push notifications

Perfect for staying connected with style.
```

**Keywords** (100 chars per keyword, up to 30):
- Real-time messaging
- Voice calling
- Video chat
- Secure messaging
- WebRTC calling
- Social communication

**Support URL**:
```
https://yoursite.com/support
```

**Privacy Policy URL**:
```
https://yoursite.com/privacy
```

### 8. App Review Information

Fill in:
- **Licensing Agreement**: Select from options
- **Export Compliance**: 
  - Encryption: Yes (for video calling)
  - ECCN: Usually 5A002 for standard crypto
- **Content Rights**: Confirm you own all content
- **Test Account**: 
  - Email: test@example.com
  - Password: [test account password]
- **Demo Account Information**: Instructions for testing

## Building Archive

### Step 1: Clean Build

```bash
npm run build

npm run cap:sync:ios

npm run cap:open:ios
```

### Step 2: Archive in Xcode

1. In Xcode, ensure simulator/device scheme is correct
2. Select "Generic iOS Device" as target (not simulator)
3. **Product** > **Archive**
4. Wait for build to complete

### Step 3: Validation

After archive:

1. In Xcode Organizer, select archive
2. Click **Validate App**
3. Choose signing method: "Automatically manage signing"
4. Wait for validation to complete

### Step 4: Upload

After validation passes:

1. In Organizer, click **Distribute App**
2. Choose **App Store Connect**
3. Select **Upload**
4. Choose signing certificate
5. Review and submit

## TestFlight Beta Testing

### 1. Create Test Build

After uploading, go to App Store Connect:

1. **TestFlight** > **iOS**
2. Build should appear in "Builds" section
3. Processing takes 5-10 minutes

### 2. Add Testers

**Internal Testing**:
1. Click **Internal Testing**
2. Add team members
3. They get email invite

**External Testing**:
1. Click **External Testing**
2. Create test group
3. Add up to 10,000 testers
4. Must go through review (24-48 hours)

### 3. Testing

Testers download TestFlight app on iPhone:
1. Accept invite
2. Install from TestFlight
3. Test all features
4. Provide feedback

### 4. Feedback Collection

Use TestFlight to gather:
- Crash reports
- Screenshots
- Text feedback
- Device/OS compatibility

## App Store Review Guidelines

Common rejection reasons and how to avoid:

### Push Notifications
- ✓ Must ask permission explicitly
- ✓ Provide way to disable
- ❌ Don't send marketing notifications without user setting
- ❌ Don't use notifications for ads

### Calls/VOIP
- ✓ Use CallKit for native call UI (recommended)
- ✓ Support CallKit integration
- ❌ Don't spam incoming call notifications

### Authentication
- ✓ Google OAuth is fine
- ✓ Email/password with secure storage
- ❌ Don't request unnecessary personal data

### Background Activity
- ✓ Background audio for calls
- ✓ Background fetch for updates
- ❌ Don't drain battery with unnecessary background work

### User Data
- ✓ Clearly explain what data is collected
- ✓ Provide privacy policy
- ✓ Honor user privacy preferences
- ❌ Don't share data with third parties without consent

### Safety
- ✓ Content filters for user-generated content
- ✓ Report abuse mechanism
- ❌ Don't allow harassment/spam
- ❌ Don't allow illegal content

## Submission Checklist

### Technical
- [ ] All required assets included (icon, screenshots)
- [ ] Code builds without warnings
- [ ] App runs on iPhone 13+ (all sizes)
- [ ] Crashes/freezes resolved
- [ ] Battery drain acceptable (<2% per hour idle)
- [ ] Push notifications work in background
- [ ] Calls work with screen locked
- [ ] VoIP audio continues when backgrounded

### Content
- [ ] Privacy policy URL works
- [ ] Support email is monitored
- [ ] No placeholder text remaining
- [ ] No debugging UI visible
- [ ] Permissions requested appropriately
- [ ] Age rating complete

### Testing
- [ ] Tested on physical device (required!)
- [ ] Tested on multiple iOS versions (14, 15, 16, 17)
- [ ] Tested landscape & portrait
- [ ] Tested with different network conditions
- [ ] TestFlight testers approved changes

### Metadata
- [ ] Description matches actual features
- [ ] Keywords are relevant
- [ ] Screenshots are app UI (not marketing)
- [ ] Keywords have no caps (only first word)
- [ ] No URL shorteners or tracking codes
- [ ] Contact info is current

## After Approval

### 1. Monitoring

- Watch crash logs in Xcode Organizer
- Monitor App Store ratings
- Enable analytics
- Track issue reports

### 2. Updates

For version 1.0.1:

```bash
# Update in capacitor.config.ts
# "version": "1.0.1"

# In Xcode
# Version: 1.0
# Build: 2

npm run build
npm run cap:sync:ios
npm run cap:open:ios
# Archive and upload again
```

### 3. Marketing

- Share App Store link
- Announce in social media
- Create launch post blog
- Gather initial reviews

## Troubleshooting

### App Rejected - Missing Icons

**Error**: "Invalid App Icon"

**Solution**:
- Icon must be 1024x1024 PNG
- No transparency, gradients, or effects
- No rounded corners (iOS adds them)
- Use image validator in App Store Connect

### App Rejected - Push Notifications

**Error**: "Spam-like behavior via push notifications"

**Solution**:
- Only send transactional notifications (calls, messages)
- Provide opt-out mechanism
- Don't send marketing notifications
- Limit notification frequency

### App Rejected - CallKit

**Error**: "Calls should use system UI"

**Solution**:
- Implement CallKit framework
- Let system handle incoming call UI
- Don't custom incoming call screen (for now)

### Build Upload Fails

**Error**: "Could not find bundle at path..."

**Solution**:
```bash
cd ios/App
pod install
cd ../..
npm run cap:sync:ios
# Re-archive in Xcode
```

### Provisioning Profile Expired

**Error**: "Provisioning profile error"

**Solution**:
- In Xcode: Settings > Accounts
- Click "Manage Certificates"
- Create new signing certificate
- In Build Settings: Re-select team

## Contact & Support

- **Apple Developer Support**: https://developer.apple.com/support/
- **App Store Review Guidelines**: https://developer.apple.com/app-store/review/guidelines/
- **TestFlight Help**: https://developer.apple.com/testflight/
- **Forum**: https://developer.apple.com/forums/

## Version History

Track versions submitted:

| Version | Build | Date | Status | Notes |
|---------|-------|------|--------|-------|
| 1.0 | 1 | 2024-01-15 | Approved | Initial release |
| 1.0.1 | 2 | - | Draft | Bug fixes |

---

Good luck with your App Store submission! 🚀
