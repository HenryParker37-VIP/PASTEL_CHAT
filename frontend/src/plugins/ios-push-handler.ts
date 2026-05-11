/**
 * iOS Native Push Handler
 * Manages interaction between web app and native Capacitor push notification plugin
 * Provides reliable background notification delivery and call handling
 */

import { PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';

interface CallNotificationData {
  callerId: string;
  callerName: string;
  callType: 'voice' | 'video';
  timestamp: number;
}

interface NotificationHandler {
  onIncomingCall?: (data: CallNotificationData) => void;
  onNotificationReceived?: (notification: PushNotificationSchema) => void;
  onNotificationAction?: (actionId: string, notification: PushNotificationSchema) => void;
}

class iOSPushHandler {
  private handlers: NotificationHandler = {};
  private currentToken: string | null = null;
  private isInitialized = false;

  async initialize(handlers: NotificationHandler) {
    if (this.isInitialized) return;

    this.handlers = handlers;

    try {
      // Request permissions and register
      const permission = await PushNotifications.requestPermissions();

      if (permission.receive === 'granted') {
        await PushNotifications.register();
        this.setupListeners();
        this.isInitialized = true;
        console.log('[iOS Push] Initialized');
      } else {
        console.warn('[iOS Push] Permission denied');
      }
    } catch (error) {
      console.error('[iOS Push] Initialization failed:', error);
    }
  }

  private setupListeners() {
    // Device token registration
    PushNotifications.addListener('registration', this.handleRegistration.bind(this));

    // Registration errors
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[iOS Push] Registration error:', error);
    });

    // Notification received in foreground
    PushNotifications.addListener(
      'pushNotificationReceived',
      this.handleNotificationReceived.bind(this)
    );

    // User interacted with notification
    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      this.handleNotificationAction.bind(this)
    );

    // App state changes
    App.addListener('appStateChange', this.handleAppStateChange.bind(this));

    // App resume from pause
    App.addListener('appResume', this.handleAppResume.bind(this));
  }

  private handleRegistration(token: Token) {
    this.currentToken = token.value;
    console.log('[iOS Push] Token registered:', token.value);

    // Dispatch event for app to handle token registration
    window.dispatchEvent(
      new CustomEvent('native:push-token', {
        detail: { token: token.value, platform: 'ios' },
      })
    );
  }

  private handleNotificationReceived(notification: PushNotificationSchema) {
    console.log('[iOS Push] Notification received:', notification);

    const data = notification.data || {};

    // Handle incoming call notifications
    if (data.type === 'incoming_call') {
      this.handleIncomingCall(data);
    } else {
      // Generic notification
      this.handlers.onNotificationReceived?.(notification);
    }
  }

  private handleNotificationAction(action: any) {
    console.log('[iOS Push] Action performed:', action);

    const notification = action.notification;
    const data = notification.data || {};

    // Call-specific actions
    if (data.type === 'incoming_call') {
      if (action.actionId === 'answer') {
        window.dispatchEvent(new CustomEvent('native:call-answer', { detail: { callerId: data.callerId } }));
      } else if (action.actionId === 'decline') {
        window.dispatchEvent(new CustomEvent('native:call-decline', { detail: { callerId: data.callerId } }));
      }
    }

    this.handlers.onNotificationAction?.(action.actionId, notification);
  }

  private handleAppStateChange(state: any) {
    if (state.isActive) {
      console.log('[iOS Push] App became active');
      this.handleAppResume();
    } else {
      console.log('[iOS Push] App backgrounded');
    }
  }

  private handleAppResume() {
    window.dispatchEvent(new CustomEvent('native:app-resumed'));
  }

  private handleIncomingCall(data: any) {
    const callData: CallNotificationData = {
      callerId: data.callerId,
      callerName: data.callerName || 'Unknown',
      callType: data.callType || 'voice',
      timestamp: Date.now(),
    };

    this.handlers.onIncomingCall?.(callData);
    window.dispatchEvent(
      new CustomEvent('native:incoming-call', { detail: callData })
    );
  }

  getToken(): string | null {
    return this.currentToken;
  }

  isActive(): boolean {
    return this.isInitialized;
  }
}

export const iosPushHandler = new iOSPushHandler();
