# Telegram Integration Guide - Add to Your UI

The Telegram Bot is now **fully configured and running**. You just need to add the `TelegramSetup` component to your app's UI.

---

## Where to Add It?

Choose one of these options:

### Option 1: Settings/Preferences (Recommended)
Add to your user settings page or preferences modal.

### Option 2: Onboarding Modal
Show on first app load (optional flow, not required).

### Option 3: Profile/Account Page
Add next to other account settings.

### Option 4: Chat Settings
Add as a chat enhancement feature.

---

## Implementation

Pick your location and add this code:

### Option 1A: Settings Page Component

```javascript
// components/UserSettings.js (or your settings component)
import React, { useState } from 'react';
import TelegramSetup from './TelegramSetup';

const UserSettings = () => {
  const [showTelegramSetup, setShowTelegramSetup] = useState(false);

  return (
    <div className="settings-container">
      {/* ... other settings ... */}

      {/* Telegram Notifications Section */}
      <div className="settings-section">
        <h3>Notifications</h3>
        <button 
          className="settings-btn"
          onClick={() => setShowTelegramSetup(true)}
        >
          📱 Telegram Notifications
        </button>
        <p style={{ fontSize: 12, color: '#666' }}>
          Get reliable notifications for calls and messages
        </p>
      </div>

      {/* Modal */}
      {showTelegramSetup && (
        <TelegramSetup
          onClose={() => setShowTelegramSetup(false)}
          onConnected={() => {
            setShowTelegramSetup(false);
            // Optional: show success toast
          }}
        />
      )}
    </div>
  );
};

export default UserSettings;
```

### Option 1B: Settings Icon/Menu

```javascript
// In your Settings modal or menu
<button 
  onClick={() => setShowTelegramSetup(true)}
  title="Enable Telegram notifications"
>
  📱 Telegram
</button>

{showTelegramSetup && (
  <TelegramSetup
    onClose={() => setShowTelegramSetup(false)}
    onConnected={() => setShowTelegramSetup(false)}
  />
)}
```

### Option 2: Onboarding (New User Flow)

```javascript
// In your onboarding or first-time setup
import TelegramSetup from './TelegramSetup';

const OnboardingFlow = () => {
  const [showTelegramSetup, setShowTelegramSetup] = useState(false);

  return (
    <>
      {/* ... other onboarding steps ... */}

      <div className="onboarding-step">
        <h2>📱 Get Notifications</h2>
        <p>Connect to Telegram for reliable notifications</p>
        <button onClick={() => setShowTelegramSetup(true)}>
          Set up Telegram
        </button>
        <button onClick={skipTelegramSetup}>
          Skip (for now)
        </button>
      </div>

      {showTelegramSetup && (
        <TelegramSetup
          onClose={() => setShowTelegramSetup(false)}
          onConnected={() => {
            // Move to next onboarding step
            goToNextStep();
          }}
        />
      )}
    </>
  );
};
```

### Option 3: Simple Settings Button

```javascript
// In your main App.js or Dashboard
const [showTelegramSetup, setShowTelegramSetup] = useState(false);

return (
  <>
    {/* Your main app content */}

    {/* Floating button in corner or settings bar */}
    <button 
      onClick={() => setShowTelegramSetup(true)}
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        padding: '12px 16px',
        borderRadius: '8px',
        background: '#6366f1',
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 500
      }}
    >
      📱
    </button>

    {showTelegramSetup && (
      <TelegramSetup
        onClose={() => setShowTelegramSetup(false)}
        onConnected={() => setShowTelegramSetup(false)}
      />
    )}
  </>
);
```

---

## Complete Example: Settings Page

Here's a full example integrating Telegram into a settings page:

```javascript
// components/Settings.js
import React, { useState, useEffect } from 'react';
import TelegramSetup from './TelegramSetup';
import { telegramApi } from '../services/api';

const Settings = ({ user, onClose }) => {
  const [showTelegramSetup, setShowTelegramSetup] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState(null);

  useEffect(() => {
    checkTelegramStatus();
  }, []);

  const checkTelegramStatus = async () => {
    try {
      const { data } = await telegramApi.getStatus();
      setTelegramStatus(data);
    } catch (e) {
      console.error('Failed to check Telegram status:', e);
    }
  };

  return (
    <div className="settings-modal">
      <div className="settings-header">
        <h2>⚙️ Settings</h2>
        <button onClick={onClose}>✕</button>
      </div>

      <div className="settings-content">
        {/* User Info */}
        <div className="settings-section">
          <h3>Account</h3>
          <p>Name: {user.name}</p>
          <p>Email: {user.email}</p>
        </div>

        {/* Telegram Notifications */}
        <div className="settings-section">
          <h3>Notifications</h3>
          {telegramStatus?.connected ? (
            <div className="telegram-status">
              <span style={{ color: '#4caf50', fontSize: 14 }}>
                ✅ Telegram Connected
              </span>
              <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                Receiving notifications via Telegram
              </p>
              <button 
                onClick={() => setShowTelegramSetup(true)}
                style={{ marginTop: 8, fontSize: 12 }}
              >
                Manage Preferences
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowTelegramSetup(true)}
              className="settings-btn"
            >
              📱 Enable Telegram Notifications
            </button>
          )}
        </div>

        {/* Other settings */}
        <div className="settings-section">
          <h3>Appearance</h3>
          {/* ... other settings ... */}
        </div>
      </div>

      {/* Telegram Setup Modal */}
      {showTelegramSetup && (
        <TelegramSetup
          onClose={() => {
            setShowTelegramSetup(false);
            checkTelegramStatus(); // Refresh status
          }}
          onConnected={() => {
            setShowTelegramSetup(false);
            checkTelegramStatus(); // Refresh status
          }}
        />
      )}
    </div>
  );
};

export default Settings;
```

---

## Testing Your Integration

1. **Start the app**
   ```bash
   npm start  # frontend runs on port 3000
   ```

2. **Navigate to your integration location**
   - Settings page, or
   - Onboarding flow, or
   - wherever you added the button

3. **Click the Telegram button**
   - Modal should appear
   - Enter your Telegram username (@username)
   - Click "Continue"

4. **Complete verification**
   - Copy the verification code shown
   - Open Telegram, find your bot
   - Send: `/verify CODE`
   - Click "I sent the code" in the app

5. **Success!** ✅
   - Should see "Connected ✅"
   - Set preferences
   - Send test notification

---

## Styling the Button/Component

The `TelegramSetup` component comes with default styling. To customize:

```javascript
// Add your own CSS classes
<button 
  className="custom-telegram-btn"
  onClick={() => setShowTelegramSetup(true)}
>
  📱 Notifications
</button>

{showTelegramSetup && (
  <TelegramSetup
    onClose={() => setShowTelegramSetup(false)}
    onConnected={() => setShowTelegramSetup(false)}
  />
)}
```

CSS:
```css
.custom-telegram-btn {
  padding: 10px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.custom-telegram-btn:hover {
  background: #f5f5f5;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
```

---

## Common Patterns

### Show in Settings Tab
```javascript
const [settingsTab, setSettingsTab] = useState('general'); // 'general', 'notifications', etc.

<div className="settings-tabs">
  <button onClick={() => setSettingsTab('general')}>General</button>
  <button onClick={() => setSettingsTab('notifications')}>Notifications</button>
</div>

{settingsTab === 'notifications' && (
  <div>
    <button onClick={() => setShowTelegramSetup(true)}>
      📱 Telegram Notifications
    </button>
  </div>
)}
```

### Show in User Menu
```javascript
<menu className="user-menu">
  <button onClick={openSettings}>⚙️ Settings</button>
  <button onClick={() => setShowTelegramSetup(true)}>📱 Telegram</button>
  <button onClick={logout}>Logout</button>
</menu>
```

### Show as Card in Dashboard
```javascript
<div className="dashboard-cards">
  <div className="card">
    <h3>📱 Notifications</h3>
    <p>Stay connected via Telegram</p>
    <button onClick={() => setShowTelegramSetup(true)}>
      {telegramConnected ? 'Manage' : 'Set up'}
    </button>
  </div>
</div>
```

---

## Troubleshooting Integration

**Button doesn't appear?**
- Check you imported `TelegramSetup` correctly
- Verify the file path matches your directory structure
- Check browser console for errors

**Modal doesn't open?**
- Verify `showTelegramSetup` state updates on button click
- Check `onClick={() => setShowTelegramSetup(true)}` is correct

**API errors in modal?**
- Check backend is running on port 5002
- Check `.env` has `REACT_APP_BACKEND_URL=http://localhost:5002`
- Check token is set in `backend/.env`

---

## What Happens Behind the Scenes

1. User clicks button → TelegramSetup modal opens
2. User enters username → POST `/api/telegram/connect`
3. Backend generates code → Returns to modal
4. User sends code to bot via Telegram
5. User clicks "I sent the code" → POST `/api/telegram/verify`
6. Verification succeeds → Database updated
7. User sees "Connected ✅" → Sets preferences
8. Preferences saved → Backend configured

From then on, all messages/calls trigger Telegram notifications automatically! 🎉

---

## Next: Test on iPhone

Once integration is done, test on iPhone Safari to verify:
- ✅ Modal displays correctly
- ✅ Notifications arrive in Telegram
- ✅ Preferences persist

See [TELEGRAM_SETUP.md](./TELEGRAM_SETUP.md) for iPhone-specific testing.

---

**Ready?** Pick your location, add the code, and test! 🚀
