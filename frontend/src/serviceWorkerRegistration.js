import { subscribeToPush } from './services/push';

const SW_URL = `${process.env.PUBLIC_URL}/sw.js`;

export function register(config) {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    isValidSW(SW_URL).then((valid) => {
      if (!valid) return;
      navigator.serviceWorker
        .register(SW_URL)
        .then((registration) => {
          // Only re-subscribe on SW activate if user is already logged in
          // (first-time subscribe happens in AuthContext after login)
          const subscribe = () => {
            if (localStorage.getItem('token')) subscribeToPush(registration);
          };
          if (registration.active) {
            subscribe();
          } else {
            registration.addEventListener('updatefound', () => {
              const worker = registration.installing;
              if (!worker) return;
              worker.addEventListener('statechange', () => {
                if (worker.state === 'activated') subscribe();
              });
            });
          }

          registration.onupdatefound = () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.onstatechange = () => {
              if (installing.state !== 'installed') return;
              if (navigator.serviceWorker.controller) {
                config?.onUpdate?.(registration);
              } else {
                config?.onSuccess?.(registration);
              }
            };
          };
        })
        .catch((err) => console.error('SW registration failed:', err));
    });
  });
}

export function unregister() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then((r) => r.unregister())
    .catch((err) => console.error(err.message));
}

async function isValidSW(url) {
  try {
    const res = await fetch(url, { headers: { 'Service-Worker': 'script' } });
    const ct  = res.headers.get('content-type') ?? '';
    return res.status === 200 && ct.includes('javascript');
  } catch {
    return false;
  }
}
