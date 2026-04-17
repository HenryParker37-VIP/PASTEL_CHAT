# PastelChat — Vercel + Render Deployment Guide

Frontend → **Vercel** (React, from `/frontend`)
Backend  → **Render** (Express + Socket.io + MongoDB)

---

## 0. What was already changed for you

| File | Change |
|---|---|
| `frontend/.env.production` | Created with `REACT_APP_BACKEND_URL` + `REACT_APP_GOOGLE_CLIENT_ID` placeholders. |
| `frontend/vercel.json` | SPA rewrite rule so refreshing a client-side route (e.g. `/chat/abc`) returns `index.html`. Place inside `frontend/` because **Root Directory** in Vercel is set to `frontend`. |
| `.gitignore` | Added `.env.*` (with `!.env.example`) and `.vercel/`. |
| `frontend/src/services/api.js` | Uses `process.env.REACT_APP_BACKEND_URL` directly (no more `/api` hostname hack). |
| `frontend/src/contexts/SocketContext.js` | Same — socket URL now comes from env var only. |
| `backend/CORS_SNIPPET.js` | Ready-to-paste CORS config (Express + Socket.io) that allows `*.vercel.app`. |

---

## 1. Push the code to GitHub

> You need to create the empty repo on github.com first (don't init README / gitignore — you already have one).

```bash
cd /Users/henryparker37/Documents/PASTEL_CHAT

# If git isn't initialized yet:
git init
git branch -M main

# Stage + commit
git add .
git commit -m "Initial PastelChat deployment commit"

# Point at your new repo (replace YOUR_USERNAME):
git remote add origin https://github.com/YOUR_USERNAME/pastel-chat.git
# If remote already exists:
# git remote set-url origin https://github.com/YOUR_USERNAME/pastel-chat.git

git push -u origin main
```

Sanity check before pushing:

```bash
# Make sure no secrets snuck in
git ls-files | grep -E '\.env($|\.)' | grep -v example
# → should print NOTHING. If it prints anything, run:
#     git rm --cached <file> && git commit -m "remove secret"
```

---

## 2. Backend (Render) — update CORS + env vars

1. Open your Render service → **Environment** tab.
2. Add / update:
   - `CLIENT_URL` = `https://pastel-chat.vercel.app,https://pastel-chat-git-main-YOUR_USERNAME.vercel.app`
     (comma-separated; add every Vercel URL you want to allow, prod + preview)
   - `MONGODB_URI` = your Atlas connection string
   - `JWT_SECRET` = long random string
   - `GOOGLE_CLIENT_ID` = same value as the frontend
   - `PORT` = leave unset — Render injects it.
3. Open `backend/src/app.js` and replace the existing CORS / `new Server(...)` block with the contents of `backend/CORS_SNIPPET.js` (it already handles `*.vercel.app`).
4. Commit + push. Render auto-deploys on push to `main`.

Verify:

```bash
curl https://pastel-chat.onrender.com/health
# → {"status":"ok","timestamp":"..."}
```

---

## 3. Frontend (Vercel)

### Option A — Vercel dashboard (recommended first time)

1. Go to <https://vercel.com/new> → **Import Git Repository** → pick `pastel-chat`.
2. **Framework Preset:** Create React App (auto-detected once Root Directory is set).
3. **Root Directory:** `frontend` (click **Edit** → pick the `frontend` folder).
   This lets Vercel auto-detect CRA, and the SPA rewrite comes from `frontend/vercel.json`. No root-level `vercel.json` needed — delete it if it exists: `rm /Users/henryparker37/Documents/PASTEL_CHAT/vercel.json`.
4. Expand **Environment Variables** and add (for **Production**, **Preview**, **Development**):

   | Name | Value |
   |---|---|
   | `REACT_APP_BACKEND_URL` | `https://pastel-chat.onrender.com` |
   | `REACT_APP_GOOGLE_CLIENT_ID` | your real Google OAuth client ID |

5. Click **Deploy**. First build takes ~2 minutes.
6. When it's live, copy the final URL (e.g. `https://pastel-chat.vercel.app`) and add it to Render's `CLIENT_URL` (step 2.2 above). Redeploy backend.

### Option B — Vercel CLI

```bash
npm i -g vercel
cd /Users/henryparker37/Documents/PASTEL_CHAT
vercel login
vercel link                         # link to a new or existing project
vercel env add REACT_APP_BACKEND_URL production
vercel env add REACT_APP_GOOGLE_CLIENT_ID production
vercel --prod
```

---

## 4. Google OAuth — whitelist the new domain

In <https://console.cloud.google.com/apis/credentials>, edit your OAuth 2.0 client:

- **Authorized JavaScript origins:** add `https://pastel-chat.vercel.app`
- **Authorized redirect URIs:** add `https://pastel-chat.vercel.app` (and any preview URL you test with)

Skip this and Google login will fail with `origin_mismatch`.

---

## 5. Full go-live checklist

- [ ] `frontend/.env.production` exists locally (not committed).
- [ ] `vercel.json` at repo root.
- [ ] `.gitignore` excludes `.env.*`.
- [ ] No hardcoded `localhost` / `onrender.com` left in `frontend/src/`. Verify: `grep -rn "onrender\|localhost:500" frontend/src` → only prints env-var fallbacks.
- [ ] GitHub repo created, `main` pushed.
- [ ] Render service has `CLIENT_URL`, `MONGODB_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`.
- [ ] Render CORS block updated from `CORS_SNIPPET.js` (allows `*.vercel.app`).
- [ ] `curl https://pastel-chat.onrender.com/health` → 200.
- [ ] Vercel project imported, env vars set for **Production + Preview**.
- [ ] Vercel build succeeded, URL is live.
- [ ] Google OAuth JS origin + redirect URI include the Vercel URL.
- [ ] Open the Vercel URL → register → send a message → verify it reaches the DB.
- [ ] DevTools Network tab shows API calls going to `pastel-chat.onrender.com`, not `localhost`.
- [ ] DevTools Console shows `socket connected`, no CORS errors.

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `CORS blocked for origin: https://....vercel.app` in Render logs | `CLIENT_URL` missing that origin, and the snippet wasn't applied | Add URL to `CLIENT_URL`, confirm `origin.endsWith('.vercel.app')` branch is in `corsOrigin`. |
| Login works but socket stays `disconnected` | Socket.io CORS not updated, or wrong transport | Apply the Socket.io CORS block; keep `transports: ['websocket', 'polling']`. |
| `process.env.REACT_APP_BACKEND_URL is undefined` | Env var not set in Vercel, **or** named without `REACT_APP_` prefix | CRA only exposes vars prefixed `REACT_APP_`. Add it in Vercel → Settings → Environment Variables → **Redeploy**. |
| Vercel build fails: `Could not find package.json` | Wrong root directory | Either set Root Directory = `frontend` (and simplify `vercel.json`) or keep the provided `vercel.json`. |
| 404 on page refresh (e.g. `/chat/abc`) | SPA fallback missing | The provided `vercel.json` has a `rewrites` rule for that. Confirm it deployed. |
| Google login: `origin_mismatch` | Vercel URL not whitelisted | Add it in Google Cloud Console → OAuth client. |
| Render free tier: first request takes 50s | Service spun down | Expected. Add a cron / UptimeRobot ping to `/health` every 10 min. |
| Mongo connection fails from Render | Atlas IP allowlist | In Atlas → Network Access, add `0.0.0.0/0` (or Render's egress IPs). |

---

## 7. Monitoring & post-deploy

**Live health ping:**

```bash
watch -n 5 'curl -s -o /dev/null -w "%{http_code}  %{time_total}s\n" https://pastel-chat.onrender.com/health'
```

**Render logs:**

- Dashboard → your service → **Logs** tab (tail in real time).
- CLI: `npm i -g @render/cli && render login && render logs pastel-chat --tail`

**Vercel logs:**

- Dashboard → project → **Deployments** → click a deploy → **Runtime Logs** / **Build Logs**.
- CLI: `vercel logs <deployment-url> --follow`

**Rollback:**

- **Vercel:** Deployments → pick a previous green deploy → **⋯** → **Promote to Production**. Instant.
- **Render:** service → **Events** / **Manual Deploy** → pick an earlier commit → **Deploy**.
- **Git safety net:** `git revert <bad_sha> && git push` — both platforms redeploy on push.

---

## 8. Post-deployment smoke test (30 seconds)

1. Open Vercel URL in an incognito window.
2. Register a brand-new user → confirm login code returned.
3. Open a second incognito, register another user, add friend 1.
4. Send messages both ways → confirm real-time updates (socket working).
5. Refresh mid-chat → confirm history loads (DB + JWT working).
6. Check Render logs: no CORS / 500 errors in the last 2 minutes.

If all six pass — you're shipped.
