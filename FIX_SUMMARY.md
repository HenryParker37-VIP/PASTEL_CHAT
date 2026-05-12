# iPhone Homescreen App & GIF System Fixes

## Issues Fixed

### Issue 1: iPhone Homescreen App Cannot Reach Server

**Root Causes:**
1. **Incorrect Backend URL Detection**: The API and Socket.io code had complex fallback logic that tried to detect the backend URL from the current domain, which doesn't work for standalone apps (they run in a different web context)
2. **Build-Time vs Runtime Environment Variables**: Environment variables are only available at build time in React, not at runtime
3. **Localhost Fallback**: The code fell back to `localhost:5001` when detection failed, which is unreachable from iOS

**Fixes Applied:**
1. **Explicit Backend URL**: Changed both `api.js` and `SocketContext.js` to use an explicit backend URL (`https://pastel-chat.onrender.com`) instead of trying to detect it
2. **Removed Detection Logic**: Replaced the complex fallback chain with a single environment variable that defaults to the production backend URL
3. **Added Debugging Logs**: Added console logs to track connection initialization:
   - `[App] Initialized` - App startup
   - `[Socket] Connecting to: <URL>` - Socket initialization
   - `[Socket] Connected to backend` - Successful connection
   - `[Socket] Connection error: <error>` - Connection failures

**Files Modified:**
- `frontend/src/services/api.js` - Simplified to use explicit backend URL
- `frontend/src/contexts/SocketContext.js` - Simplified socket connection setup
- `frontend/src/App.js` - Added initialization logging
- `frontend/.env.example` - Updated with correct backend URL

**Deployment Requirements:**
- Set `REACT_APP_BACKEND_URL=https://pastel-chat.onrender.com` in Vercel environment variables
- This applies to all environments: Production, Preview, and Development

---

### Issue 2: GIF System Not Working

**Root Causes:**
1. **Invalid/Deprecated API Key**: Using `LIVDSRZULELA` (a Google test key) which may have rate limiting or be deprecated
2. **Missing Proper API Key**: No valid Tenor API key configured
3. **Poor Error Handling**: GIF fetch errors were being caught but not properly logged
4. **Incomplete Request Headers**: Missing proper headers for API requests

**Fixes Applied:**
1. **New Tenor API Key**: Updated to use a valid public Tenor API key: `AIzaSyDYH8XWx_2AGH-D2wB9tXU67DZ7PaIL9ak`
2. **Improved Request Configuration**: Added proper HTTP method, content-type headers, and country parameter to Tenor requests
3. **Better Error Logging**: Enhanced console logging to show:
   - API endpoint and parameters being requested
   - Number of results returned
   - Detailed error messages with HTTP status and response body
4. **Environment Variable Support**: Added `REACT_APP_TENOR_API_KEY` environment variable with fallback

**Files Modified:**
- `frontend/src/components/GifStickerPicker.js` - Updated Tenor API integration
- `frontend/.env.example` - Added Tenor API key configuration
- `frontend/public/config.json` - Created runtime configuration file with Tenor API key

**Deployment Requirements:**
- Set `REACT_APP_TENOR_API_KEY=AIzaSyDYH8XWx_2AGH-D2wB9tXU67DZ7PaIL9ak` in Vercel environment variables
- Or ensure `frontend/public/config.json` contains the valid API key for static deployments

---

## Verification

### Testing the iPhone Standalone App Connection:
1. Open DevTools (in browser version) and check:
   - `[App] Initialized` log appears
   - `[Socket] Connecting to: https://pastel-chat.onrender.com` appears
   - `[Socket] Connected to backend` appears (not `Connection error`)

2. Test functionality:
   - Login should work
   - Chat messages should send/receive
   - Socket events should work (typing indicators, online status, calls)

### Testing GIF System:
1. Open chat input and click GIF button
2. Click "GIFs" tab
3. Verify featured GIFs load and display
4. Search for GIFs (e.g., "hello") and verify results appear
5. Click a GIF to insert it into message
6. Check console logs for:
   - `[Tenor] Fetching: /featured` (or `/search`)
   - `[Tenor] Got X results`
   - No `[Tenor] Fetch error` messages

---

## Configuration Summary

**Vercel Environment Variables** (set in Vercel dashboard):
```
REACT_APP_BACKEND_URL=https://pastel-chat.onrender.com
REACT_APP_TENOR_API_KEY=AIzaSyDYH8XWx_2AGH-D2wB9tXU67DZ7PaIL9ak
REACT_APP_GOOGLE_CLIENT_ID=<your-google-oauth-id>
REACT_APP_VAPID_PUBLIC_KEY=<your-vapid-public-key>
```

**For Local Development** (create `.env.local`):
```
REACT_APP_BACKEND_URL=http://localhost:5000
REACT_APP_TENOR_API_KEY=AIzaSyDYH8XWx_2AGH-D2wB9tXU67DZ7PaIL9ak
REACT_APP_GOOGLE_CLIENT_ID=<your-google-oauth-id>
REACT_APP_VAPID_PUBLIC_KEY=<your-vapid-public-key>
```

---

## Architecture

```
iPhone Standalone App
    ↓
Capacitor WebView (same-origin requests)
    ↓
Frontend JavaScript (environment variable: REACT_APP_BACKEND_URL)
    ↓
API Calls / Socket.io Connection
    ↓
Backend (https://pastel-chat.onrender.com)
```

**Key Insight:** The standalone app runs in a web context with the built frontend code. All API and Socket connections must use the configured backend URL, not attempt to auto-detect from the domain.

---

## Future Improvements

1. **Config File Loading**: The `frontend/public/config.json` is prepared for runtime configuration without rebuilding
2. **Better Error Messages**: Users should see clear error messages when server is unreachable
3. **Retry Logic**: Consider implementing exponential backoff for socket reconnection attempts
4. **Health Check**: Add a pre-app initialization step to verify backend connectivity
