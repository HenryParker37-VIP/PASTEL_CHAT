import api from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/**
 * Check if the current browser / environment supports Web Push.
 */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Check if running on iOS (iPhone/iPad/iPod).
 */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Check if the app is currently launched in Standalone PWA mode.
 */
export function isStandalonePWA() {
  if (typeof window === 'undefined') return false;
  return (
    window.navigator?.standalone === true ||
    (typeof window.matchMedia === 'function' && Boolean(window.matchMedia('(display-mode: standalone)').matches))
  );
}

/**
 * Get current notification permission state ('default', 'granted', 'denied', or 'unsupported').
 */
export function getNotificationPermission() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Get existing push subscription if any.
 */
export async function getExistingSubscription(swRegistration) {
  try {
    if (!swRegistration?.pushManager) {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        return await reg.pushManager.getSubscription();
      }
      return null;
    }
    return await swRegistration.pushManager.getSubscription();
  } catch (err) {
    console.warn('[Push] Error getting subscription:', err.message);
    return null;
  }
}

/**
 * Fetch VAPID public key from backend or fallback to environment variable.
 */
async function fetchVapidKey() {
  try {
    const { data } = await api.get('/push/vapid-public-key');
    if (data?.publicKey) return data.publicKey;
  } catch (err) {
    console.warn('[Push] Failed to fetch VAPID key from backend, using env fallback:', err.message);
  }
  return process.env.REACT_APP_VAPID_PUBLIC_KEY || '';
}

/**
 * Subscribe to push notifications with a user gesture (e.g., clicking 'Enable Notifications').
 * Returns { success: boolean, permission: string, error?: string }
 */
export async function subscribeToPush(swRegistration) {
  try {
    if (!isPushSupported()) {
      return { success: false, error: 'Push notifications are not supported in this browser' };
    }

    const reg = swRegistration || (await navigator.serviceWorker.ready);
    if (!reg || !reg.pushManager) {
      return { success: false, error: 'Service worker is not ready' };
    }

    const vapidKey = await fetchVapidKey();
    if (!vapidKey) {
      console.warn('[Push] VAPID public key not found.');
      return { success: false, error: 'Push notification server is not configured (missing VAPID key)' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, permission, error: 'Notification permission was not granted' };
    }

    // Check for existing subscription first
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    await api.post('/push/subscribe', { subscription: sub.toJSON() });
    localStorage.setItem('pastelchat.notify', '1');
    return { success: true, permission: 'granted', subscription: sub };
  } catch (err) {
    console.error('[Push] Subscription failed:', err);
    return { success: false, error: err.message || 'Failed to subscribe to push notifications' };
  }
}

/**
 * Silently sync existing granted subscription without prompting user permission.
 */
export async function syncExistingSubscription(swRegistration) {
  try {
    if (!isPushSupported() || Notification.permission !== 'granted') return false;

    const reg = swRegistration || (await navigator.serviceWorker.ready);
    if (!reg?.pushManager) return false;

    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.post('/push/subscribe', { subscription: sub.toJSON() });
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[Push] Sync existing subscription failed:', err.message);
    return false;
  }
}

/**
 * Unsubscribe from push notifications and notify backend.
 */
export async function unsubscribeFromPush(swRegistration) {
  try {
    if (!isPushSupported()) return;

    const reg = swRegistration || (await navigator.serviceWorker.ready);
    if (!reg?.pushManager) return;

    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      try {
        await api.post('/push/unsubscribe', { endpoint: sub.endpoint });
      } catch (e) {
        console.warn('[Push] Backend unsubscribe call failed:', e.message);
      }
      await sub.unsubscribe();
    }
    localStorage.setItem('pastelchat.notify', '0');
    return true;
  } catch (err) {
    console.warn('[Push] Unsubscribe failed:', err.message);
    return false;
  }
}

/**
 * Trigger a test notification from backend to verify receipt.
 */
export async function sendTestNotification() {
  const { data } = await api.post('/push/send-test');
  return data;
}
