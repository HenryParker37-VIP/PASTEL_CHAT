# PWA Standalone App Fix - Comprehensive Diagnosis & Solution

## Problem
When users add Pastel Chat to their iPhone/iPad homescreen and open it in standalone mode, the app shows:
**"Cannot reach the server. Make sure you're connected and the app is properly configured."**

The web version works perfectly. The standalone version fails at the login screen, unable to register or log in.

---

## Root Causes

### 1. Service Worker Blocking External API Requests
**Issue:** The service worker's fetch handler was checking for `/api/` paths, but actual API requests go to `https://pastel-chat.onrender.com` (external domain with full paths like `/auth/register`).

**Original Code Problem:**
```javascript
// OLD - This only caught paths starting with /api/, 
// but actual requests are to external domain
if (url.pathname.startsWith('/api/')) { 
  event.respondWith(fetch(request)); 
  return; 
}
```

**Fix Applied:**
Added explicit detection for external API requests by hostname:
```javascript
// NEW - Detect external API requests (different domain)
if (url.hostname !== self.location.hostname && 
    url.hostname !== 'localhost' && 
    !url.hostname.startsWith('127.')) {
  event.respondWith(fetch(request).catch(err => {
    console.error('[SW] External fetch failed:', request.url);
    throw err; // Let app handle the error
  }));
  return;
}
```

### 2. Offline Page Incorrectly Triggered for API Errors
**Issue:** When API requests failed, the service worker would return `offline.html` instead of letting the error propagate to the app.

**Original Code Problem:**
```javascript
// OLD - Returns offline.html for ALL fetch failures
async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    // Falls through to offline.html for ANY error
    return offline || new Response('You are offline', { status: 503 });
  }
}
```

**Fix Applied:**
Only show offline page for navigation (document) requests, not API calls:
```javascript
// NEW - Only show offline page for actual navigation
async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      (await caches.open(DYNAMIC_CACHE)).put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Only show offline page for navigation/document requests
    if (request.mode === 'navigate' || request.destination === 'document') {
      const offline = await caches.match('/offline.html');
      return offline || new Response('You are offline', { status: 503 });
    }

    // For API calls, re-throw error so app can handle it
    throw err;
  }
}
```

### 3. POST/PUT Requests Not Configured for CORS in Standalone Mode
**Issue:** iOS standalone mode may have stricter CORS enforcement. The axios instance needs explicit CORS headers.

**Solution:** API service now sends proper CORS headers with every request.

### 4. Missing Socket.io CORS Configuration
**Issue:** Socket.io connections might fail in standalone mode without explicit CORS configuration.

**Solution:** Socket.io already configured with:
```javascript
const newSocket = io(BACKEND_URL, {
  auth: { token },
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});
```

The `polling` transport serves as fallback if WebSocket fails on restrictive networks.

---

## Files Modified

### 1. `frontend/public/sw.js`
**Changes:**
- Added explicit external domain detection (line 52-61)
- Improved error handling for external requests (lines 44-50)
- Fixed offline page detection (lines 172-192)
- Added message handler for skip-waiting (lines 27-33)
- Better logging for debugging

### 2. `frontend/src/services/api.js`
**Changes:**
- Explicit backend URL with env fallback (already done in previous fix)
- Ensured CORS headers are set in axios interceptors

### 3. `frontend/src/services/diagnostics.js` (NEW)
**Purpose:** Diagnostic utility to help debug connectivity issues
- Checks if app is running in standalone mode
- Tests backend health endpoint
- Tests CORS configuration
- Logs detailed diagnostics for troubleshooting

---

## Why Standalone Mode is Affected Differently

In standalone mode (homescreen app):
- The app runs in a WebView with different security context
- Service workers are still active but behave differently
- CORS might be stricter
- Network requests might have different timing
- Cache behavior might be different

In browser tab:
- Standard Web PWA behavior
- More forgiving CORS
- Can reload page easily
- Service worker caching less aggressive

---

## Testing the Fix

### For Developers:
```javascript
// Check app status in console
console.log('[App] Backend URL:', process.env.REACT_APP_BACKEND_URL);
console.log('[App] Standalone:', window.navigator.standalone);
```

### For Users:

**On iPhone/iPad:**
1. Add app to homescreen ("Share" → "Add to Home Screen")
2. Open from homescreen icon
3. Try to register/login
4. If still failing, check:
   - WiFi is connected and strong
   - App has internet permission in Settings
   - Try closing and reopening the app
   - Try clearing Safari cache (Settings → Safari → Clear History and Website Data)

**Service Worker Cache Clearing:**
If the app still shows cached error pages:
1. Delete the app from homescreen
2. Go to Safari Settings → Advanced → Website Data
3. Find and delete "pastel-chat.vercel.app"
4. Re-add app to homescreen

---

## How to Verify the Fix Works

### Check 1: Service Worker Logs
Open DevTools → Console and look for:
```
[SW] Activating service worker
[Socket] Connecting to: https://pastel-chat.onrender.com
[Socket] Connected to backend
```

### Check 2: API Request Success
In DevTools → Network tab, verify:
- `POST /auth/register` returns 200/201 ✓
- `POST /auth/login` returns 200 ✓
- WebSocket connection shows "101 Switching Protocols" ✓

### Check 3: Standalone App
1. Add app to homescreen
2. Open from homescreen
3. Login should work smoothly
4. Messages, GIFs, calls should function normally
5. No error messages about "Cannot reach server"

---

## Configuration Summary

**Required Environment Variables:**
```
REACT_APP_BACKEND_URL=https://pastel-chat.onrender.com
REACT_APP_TENOR_API_KEY=AIzaSyDYH8XWx_2AGH-D2wB9tXU67DZ7PaIL9ak
REACT_APP_GOOGLE_CLIENT_ID=<your-google-oauth-id>
REACT_APP_VAPID_PUBLIC_KEY=<your-vapid-public-key>
```

**Backend Requirements:**
- Must have CORS enabled for all origins (or specifically vercel.app domains)
- Must support Socket.io with CORS
- Must have `/health` endpoint for diagnostics

---

## Additional Notes

### Why `/api/` Path Doesn't Work
The original code checked for `/api/` paths because developers often use relative paths:
```javascript
// Would work with relative path
fetch('/api/auth/register')

// But actual implementation uses absolute URLs
fetch('https://pastel-chat.onrender.com/auth/register')
```

The standalone app must use absolute URLs because it runs in a different context than the Vercel-deployed frontend.

### Why Offline Detection Matters
When the service worker returns offline.html for ALL failures:
1. User sees "You are offline" even when online
2. They reload the app
3. App still can't reach backend (service worker cached offline.html)
4. Stuck in offline loop

The fix distinguishes between:
- **Actual offline**: Show offline.html
- **API errors**: Let app handle and show proper error message

---

## Future Improvements

1. **Progressive Error Handling**
   - Show connection status indicator
   - Retry failed requests with exponential backoff
   - Queue messages when offline

2. **Better Diagnostics**
   - Auto-detect and report CORS errors
   - Check backend health on app load
   - Log detailed error info for debugging

3. **Offline-First Capability**
   - Cache messages when offline
   - Sync when connection restored
   - Show sync status to user

4. **Service Worker Updates**
   - Better update prompts
   - Automatic cache invalidation
   - Graceful degradation
