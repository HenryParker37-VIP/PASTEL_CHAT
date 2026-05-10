import api from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// Subscribe to push notifications and register the subscription with the backend.
// Returns true on success, false if push is unsupported or permission denied.
export async function subscribeToPush(swRegistration) {
  try {
    if (!('PushManager' in window)) return false;

    const vapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.warn('[Push] REACT_APP_VAPID_PUBLIC_KEY not set — push notifications disabled.');
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    // Check for existing subscription first
    let sub = await swRegistration.pushManager.getSubscription();
    if (!sub) {
      sub = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    await api.post('/push/subscribe', { subscription: sub.toJSON() });
    return true;
  } catch (err) {
    console.warn('[Push] subscription failed:', err.message);
    return false;
  }
}

// Unsubscribe and tell the backend to remove the subscription.
export async function unsubscribeFromPush(swRegistration) {
  try {
    const sub = await swRegistration.pushManager.getSubscription();
    if (!sub) return;
    await api.post('/push/unsubscribe', { endpoint: sub.endpoint });
    await sub.unsubscribe();
  } catch (err) {
    console.warn('[Push] unsubscribe failed:', err.message);
  }
}
