import { Capacitor, registerPlugin } from '@capacitor/core';

const webImplementation = {
  async startOutgoingCall() {},
  async reportIncomingCall() { return { reported: false }; },
  async reportConnected() {},
  async reportEnded() {},
  async setMuted() {},
  async setSpeaker() {},
  async activateAudio() {},
  async deactivateAudio() {},
  async addListener() { return { remove() {} }; },
};

// The native implementation is registered by the root Capacitor iOS target.
// The web implementation keeps the normal browser/PWA call path unchanged.
export const PastelCallKit = registerPlugin('PastelCallKit', {
  web: () => webImplementation,
});

export const isIOSCallKitAvailable = () => {
  try {
    return Capacitor.getPlatform?.() === 'ios' && Capacitor.isPluginAvailable?.('PastelCallKit') === true;
  } catch {
    return false;
  }
};

export async function callKitInvoke(method, options = {}) {
  if (!isIOSCallKitAvailable() || typeof PastelCallKit[method] !== 'function') return null;
  try {
    return await PastelCallKit[method](options);
  } catch (err) {
    console.warn(`[CallKit] ${method} unavailable:`, err?.message || err);
    return null;
  }
}

export function addCallKitListener(eventName, listener) {
  if (!isIOSCallKitAvailable()) return () => {};
  let subscription;
  PastelCallKit.addListener(eventName, listener)
    .then((result) => { subscription = result; })
    .catch((err) => console.warn(`[CallKit] listener unavailable:`, err?.message || err));
  return () => subscription?.remove?.();
}
