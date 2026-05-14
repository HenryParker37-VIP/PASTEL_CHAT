# PastelChat 💬

A vibe chatting app with your friends. Supports web, desktop, and mobile.

## Quick Start

### 📥 Download Desktop App
**[Get PastelChat v1.0.0 for Windows](https://github.com/HenryParker37-VIP/PASTEL_CHAT/releases/tag/v1.0.0)**

| File | Size | Description |
|------|------|-------------|
| PastelChat Setup 1.0.0.exe | 115 MB | Installer (recommended) |
| PastelChat 1.0.0.exe | 105 MB | Portable — no install needed |

### 🌐 Use Web App
**[https://pastel-chat.onrender.com/home](https://pastel-chat.onrender.com/home)**

---

## Features
- Real-time messaging
- Message reply & recall
- Multi-device sync via QR code
- Encrypted messages (premium)
- Premium chat rooms
- Pastel UI theme

## System Requirements (Desktop)
- Windows 7 or later (64-bit)
- 200 MB free disk space
- Internet connection required

## Development

```bash
# Install dependencies
cd frontend && npm install

# Run web app
npm start

# Run Electron desktop app in dev mode
npm run electron-dev

# Build Windows .exe
npm run electron-build:win
```

## Project Structure
```
├── frontend/          # React web app + Electron main process
│   ├── public/
│   │   ├── electron.js    # Electron main process
│   │   └── preload.js     # Security bridge
│   └── src/           # React components
├── backend/           # Node.js / Express API
└── ios/               # iOS app (Capacitor)
```

## Releases
See [Releases](https://github.com/HenryParker37-VIP/PASTEL_CHAT/releases) for all download links and changelogs.
