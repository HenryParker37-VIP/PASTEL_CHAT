import { resolveBackendEndpoints } from './backendConfig';
import { bindReconnectResync, getMessagePollingDelay } from './messageSyncPolicy';

describe('realtime backend routing', () => {
  test('REST and sockets resolve to the same backend when both endpoints are configured', () => {
    const config = resolveBackendEndpoints({
      backendUrl: 'https://chat-api.koyeb.app/',
      signalingUrl: 'https://chat-api.koyeb.app',
      pageOrigin: 'https://pastel-chat.vercel.app'
    });
    expect(config.valid).toBe(true);
    expect(config.restBaseURL).toBe('https://chat-api.koyeb.app');
    expect(config.socketURL).toBe('https://chat-api.koyeb.app');
  });

  test('split REST and Socket.IO hosts fail closed', () => {
    const config = resolveBackendEndpoints({
      backendUrl: 'https://chat-api.koyeb.app',
      signalingUrl: 'https://pastel-chat.vercel.app',
      pageOrigin: 'https://pastel-chat.vercel.app'
    });
    expect(config.valid).toBe(false);
    expect(config.restBaseURL).toBe('');
    expect(config.socketURL).toBe('');
  });

  test('a socket-only Koyeb override is rejected instead of leaving REST on Vercel', () => {
    expect(resolveBackendEndpoints({
      signalingUrl: 'https://chat-api.koyeb.app',
      pageOrigin: 'https://pastel-chat.vercel.app'
    }).valid).toBe(false);
  });

  test('backend paths are rejected because API and Socket.IO require a shared origin', () => {
    expect(resolveBackendEndpoints({
      backendUrl: 'https://chat-api.koyeb.app/api',
      signalingUrl: 'https://chat-api.koyeb.app',
      pageOrigin: 'https://pastel-chat.vercel.app'
    }).valid).toBe(false);
  });

  test('one backend setting safely supplies the socket target', () => {
    const config = resolveBackendEndpoints({
      backendUrl: 'https://chat-api.koyeb.app',
      pageOrigin: 'https://pastel-chat.vercel.app'
    });
    expect(config.valid).toBe(true);
    expect(config.socketURL).toBe(config.restBaseURL);
  });
});

describe('message delivery recovery', () => {
  test('polling only runs while the socket is unavailable', () => {
    expect(getMessagePollingDelay(true, true)).toBeNull();
    expect(getMessagePollingDelay(false, true)).toBe(1500);
    expect(getMessagePollingDelay(false, false)).toBe(15000);
  });

  test('socket reconnect triggers conversation history reconciliation', () => {
    const listeners = new Map();
    const socket = {
      on: (event, handler) => listeners.set(event, handler),
      off: (event, handler) => { if (listeners.get(event) === handler) listeners.delete(event); }
    };
    const reconcile = jest.fn();
    const unbind = bindReconnectResync(socket, reconcile);
    listeners.get('connect')();
    expect(reconcile).toHaveBeenCalledTimes(1);
    unbind();
    expect(listeners.has('connect')).toBe(false);
  });
});
