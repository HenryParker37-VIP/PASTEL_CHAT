const SW_URL = `${process.env.PUBLIC_URL}/sw.js`;

export function register(config) {
  if (process.env.NODE_ENV !== 'production') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    isValidSW(SW_URL)
      .then((valid) => {
        if (!valid) return;
        navigator.serviceWorker
          .register(SW_URL)
          .then((registration) => {
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
    const ct = res.headers.get('content-type') ?? '';
    return res.status === 200 && ct.includes('javascript');
  } catch {
    return false;
  }
}
