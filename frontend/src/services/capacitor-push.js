import api from './api';

let isNative = false;

export const isCapacitorApp = () => isNative;

export async function initializeCapacitorPush() {
  try {
    if (!window.Capacitor) {
      console.log('[Push] Not running in Capacitor');
      return false;
    }

    console.log('[Push] Initializing Capacitor push notifications');

    // Dynamically import Capacitor modules
    let PushNotifications, App;
    try {
      ({ PushNotifications } = await import('@capacitor/push-notifications'));
      ({ App } = await import('@capacitor/app'));
    } catch (importErr) {
      console.error('[Push] Failed to import Capacitor modules:', importErr);
      return false;
    }

    // Request permission and register for push
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      console.warn('[Push] Notifications permission denied');
      return false;
    }

    // Register the device
    await PushNotifications.register();

    // Listeners
    PushNotifications.addListener('registration', (token) => onRegistration(token, api));
    PushNotifications.addListener('registrationError', onRegistrationError);
    PushNotifications.addListener('pushNotificationReceived', onPushReceived);
    PushNotifications.addListener('pushNotificationActionPerformed', onPushAction);

    // Handle app resume for call notifications
    App.addListener('appStateChange', onAppStateChange);

    isNative = true;
    return true;
  } catch (err) {
    console.error('[Push] Capacitor initialization failed:', err);
    return false;
  }
}

function onRegistration(token, api) {
  console.log('[Push] Device token:', token.value);
  sendTokenToBackend(token.value, api);
}

function onRegistrationError(error) {
  console.error('[Push] Registration error:', error.error);
}

function onPushReceived(notification) {
  console.log('[Push] Notification received:', notification);

  const data = notification.data || {};
  const { type, title, body, callerId, callType } = data;

  if (type === 'incoming_call') {
    handleIncomingCallNotification({ callerId, callType, title, body });
  } else {
    if (title || body) {
      showLocalNotification(title, body, data);
    }
  }
}

function onPushAction(action) {
  const notification = action.notification;
  const data = notification.data || {};
  const { type } = data;

  console.log('[Push] Action performed:', action.actionId);

  if (type === 'incoming_call') {
    if (action.actionId === 'answer') {
      window.dispatchEvent(new CustomEvent('capacitor:call-answer'));
    } else if (action.actionId === 'decline') {
      window.dispatchEvent(new CustomEvent('capacitor:call-decline'));
    }
  }
}

function onAppStateChange(state) {
  if (state.isActive) {
    console.log('[Push] App resumed from background');
    window.dispatchEvent(new CustomEvent('capacitor:app-resumed'));
  }
}

async function sendTokenToBackend(token, api) {
  try {
    await api.post('/push/register-native', {
      token,
      platform: 'ios',
    });
  } catch (err) {
    console.warn('[Push] Failed to register token with backend:', err.message);
  }
}

function showLocalNotification(title, body, data) {
  console.log('[LocalNotification]', title, body);
}

function handleIncomingCallNotification({ callerId, callType, title, body }) {
  const event = new CustomEvent('capacitor:incoming-call', {
    detail: { callerId, callType, title, body },
  });
  window.dispatchEvent(event);
}

export async function unregisterCapacitorPush() {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.unregister();
    console.log('[Push] Unregistered from push notifications');
  } catch (err) {
    console.warn('[Push] Unregister failed:', err.message);
  }
}
