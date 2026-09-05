# PastelChat — Vercel Full-Stack Deployment Guide

Unified Full-Stack Deployment on **Vercel** (`https://pastel-chat.vercel.app`)

---

## Architecture Overview

* **Frontend**: React Single-Page Application (CRA) served from `frontend/build` with Service Worker / PWA support.
* **Backend**: Express Serverless APIs (`/auth`, `/users`, `/friends`, `/messages`, `/groups`, `/private-space`, `/feedback`, `/admin`, `/push`, `/notifications`, `/releases`, `/stickers`, `/api/gifs`, `/api/webrtc`, `/api/telegram`) running on Vercel Node.js Serverless Functions via `/api/index.js`.
* **Database**: MongoDB Atlas durable snapshot persistence (`PastelChatState` collection).
* **Telegram Bot**: Instant webhook delivery via `POST /api/telegram/webhook`.
* **WebRTC Calling**: ICE / TURN credentials via Cloudflare TURN (`/api/webrtc/ice-servers`).

---

## 1. Vercel Environment Variables

In your Vercel Project Settings (**Settings → Environment Variables**), configure the following for **Production**, **Preview**, and **Development**:

| Variable | Description / Value |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Long random secret string for JWT auth |
| `ADMIN_LOGIN_CODE` | Admin login code |
| `REACT_APP_GOOGLE_CLIENT_ID` | `803433790062-2dmhg2du471q65q2biheuli604b31vgv.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_ID` | Same as `REACT_APP_GOOGLE_CLIENT_ID` |
| `REACT_APP_MICROSOFT_CLIENT_ID` | Microsoft Azure App Client ID |
| `GIPHY_API_KEY` | Server-side GIPHY API key |
| `VAPID_PUBLIC_KEY` | Web Push VAPID Public Key |
| `VAPID_PRIVATE_KEY` | Web Push VAPID Private Key |
| `VAPID_SUBJECT` | `mailto:your-email@example.com` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather |
| `TELEGRAM_BOT_USERNAME` | `PastelChat_Notification_bot` |
| `TELEGRAM_WEBHOOK_SECRET` | Random secret token for Telegram webhook validation |
| `CLOUDFLARE_TURN_TOKEN_ID` | Cloudflare Calls / TURN Token ID |
| `CLOUDFLARE_TURN_API_TOKEN` | Cloudflare Calls / TURN API Token |

---

## 2. OAuth Configuration

### Google Cloud Console (APIs & Services → Credentials)
* **Authorized JavaScript Origins**:
  * `https://pastel-chat.vercel.app`
  * `http://localhost:3000` (for local development)
* **Authorized Redirect URIs**:
  * `https://pastel-chat.vercel.app`

### Microsoft Azure Portal (Entra ID → App Registrations)
* **Authentication Platform**: Single-page application (SPA)
* **Redirect URIs**:
  * `https://pastel-chat.vercel.app`
  * `http://localhost:3000`

---

## 3. Telegram Webhook Registration

To link your Telegram bot to the Vercel serverless webhook, send a single request:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://pastel-chat.vercel.app/api/telegram/webhook",
       "secret_token": "<YOUR_TELEGRAM_WEBHOOK_SECRET>"
     }'
```

---

## 4. Verification

After deployment, verify the endpoints:

```bash
# Backend Health
curl https://pastel-chat.vercel.app/health

# Version Endpoint
curl https://pastel-chat.vercel.app/api/version

# WebRTC ICE Servers (Authenticated)
curl -H "Authorization: Bearer <TOKEN>" https://pastel-chat.vercel.app/api/webrtc/ice-servers
```
