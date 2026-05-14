const CACHE_VERSION = 'v2';
const STATIC_CACHE  = `pastel-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `pastel-dynamic-${CACHE_VERSION}`;

const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/offline.html'];
const NEVER_CACHE   = ['/api/', '/socket.io/', 'chrome-extension'];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Message handling (for skip-waiting) ───────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING, activating immediately');
    self.skipWaiting();
  }
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ── Non-GET requests: always fetch from network ──
  if (request.method !== 'GET') return;

  // ── Never cache: API calls, socket.io, extensions ──
  if (NEVER_CACHE.some((p) => request.url.includes(p))) {
    event.respondWith(fetch(request).catch(err => {
      console.error('[SW] Fetch failed for:', request.url, err);
      throw err;
    }));
    return;
  }

  // ── External API requests (different domain) ──
  // For requests to https://pastel-chat.onrender.com, always fetch from network
  if (url.hostname !== self.location.hostname && url.hostname !== 'localhost' && !url.hostname.startsWith('127.')) {
    event.respondWith(fetch(request).catch(err => {
      console.error('[SW] External fetch failed for:', request.url, err);
      // Don't return offline.html for API errors - let the app handle it
      throw err;
    }));
    return;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  // ── Fonts: stale-while-revalidate ──
  if (request.url.includes('fonts.googleapis.com') || request.url.includes('fonts.gstatic.com')) {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
    return;
  }

  // ── Static assets: cache-first ──
  if (['script','style','image','font'].includes(request.destination)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── Default: network-first for navigation ──
  event.respondWith(networkFirstWithFallback(request));
});

// ── Push notifications ─────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};

  // ── Incoming call push ──
  if (data.type === 'incoming_call') {
    const callType = data.callType === 'video' ? '📹 Video' : '📞 Voice';
    const options = {
      body: `${data.callerName} is calling you`,
      icon:    '/icons/icon-192x192.png',
      badge:   '/icons/icon-72x72.png',
      tag:     'incoming-call',
      renotify: true,
      requireInteraction: true,            // stays on screen until user acts
      vibrate: [300, 100, 300, 100, 300],
      data: {
        url:          '/',
        callType:     data.callType,
        callerId:     data.callerId,
        callerName:   data.callerName,
        callerAvatar: data.callerAvatar,
      },
      actions: [
        { action: 'decline', title: '📵 Decline' },
        { action: 'answer',  title: `${callType} Answer` },
      ],
    };
    event.waitUntil(
      self.registration.showNotification(`Incoming ${callType} Call`, options)
    );
    return;
  }

  // ── Regular message / friend notification ──
  const title   = data.title || 'Pastel Chat';
  const options = {
    body:     data.body || 'You have a new notification',
    icon:     '/icons/icon-192x192.png',
    badge:    '/icons/icon-72x72.png',
    tag:      data.tag || 'message',
    data:     { url: data.url || '/' },
    vibrate:  [200, 100, 200],
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ─────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { action } = event;
  const notifData  = event.notification.data || {};

  // ── Call action buttons ──
  if (notifData.callerId) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        const existing = list.find(c => 'focus' in c);

        const postCallAction = (client) => {
          if (action === 'decline') {
            client.postMessage({ type: 'CALL_DECLINE_FROM_NOTIFICATION', callerId: notifData.callerId });
          } else {
            // 'answer' or tapping the notification body
            client.postMessage({
              type:         'CALL_ANSWER_FROM_NOTIFICATION',
              callerInfo:   notifData,
            });
          }
        };

        if (existing) {
          existing.focus();
          postCallAction(existing);
          return;
        }
        // App was closed — open it, then post message once ready
        return clients.openWindow('/').then((newClient) => {
          if (newClient) {
            // Give app 2 s to boot before posting the message
            setTimeout(() => postCallAction(newClient), 2000);
          }
        });
      })
    );
    return;
  }

  // ── Regular notification click — open/focus app ──
  const target = notifData.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find(c => c.url === target && 'focus' in c);
      if (existing) return existing.focus();
      return clients.openWindow(target);
    })
  );
});

// ── Strategy helpers ──────────────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(cacheName)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fresh  = fetch(request).then(r => { if (r.ok) cache.put(request, r.clone()); return r; });
  return cached || fresh;
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    // Cache successful responses
    if (response.ok) {
      (await caches.open(DYNAMIC_CACHE)).put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.log('[SW] Network request failed, checking cache:', request.url, err.message);

    // Try cached version first
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Returning cached response for:', request.url);
      return cached;
    }

    // Only show offline page for navigation requests (document requests)
    // Don't show it for API calls or other fetch failures
    if (request.mode === 'navigate' || request.destination === 'document') {
      console.log('[SW] Showing offline page for:', request.url);
      const offline = await caches.match('/offline.html');
      return offline || new Response('You are offline', { status: 503 });
    }

    // For non-navigation requests (API calls, etc), re-throw the error
    // so the app can handle it properly
    console.error('[SW] Re-throwing error for non-navigation request:', request.url);
    throw err;
  }
}
