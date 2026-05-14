# PastelChat Windows Installation Guide

## Option 1: Installer (Recommended)

1. Download `PastelChat Setup X.X.X.exe` from GitHub Releases
2. Double-click the installer
3. Click **Yes** if Windows SmartScreen appears (the app is not yet code-signed)
4. Choose installation directory (default: `C:\Program Files\PastelChat`)
5. Click **Install**
6. Launch PastelChat from the Desktop shortcut or Start Menu

## Option 2: Portable (No Installation)

1. Download `PastelChat X.X.X.exe` from GitHub Releases
2. Double-click to run — no installation required
3. You can place it anywhere (USB drive, Downloads folder, etc.)

## First Launch

- Sign in with your Google account
- Allow notifications when prompted for best experience

## Troubleshooting

### "Windows protected your PC" SmartScreen warning
Click **More info** → **Run anyway**. This appears because the app is not yet code-signed.

### App won't start
- Ensure you're on 64-bit Windows 7 or later
- Try running as Administrator

### Login not working
- Check your internet connection
- The backend is at https://pastel-chat.onrender.com (free tier may take 30s to wake up)

## Uninstall

**Installed version:** Control Panel → Programs → Uninstall a Program → PastelChat → Uninstall

**Portable version:** Simply delete the `.exe` file
