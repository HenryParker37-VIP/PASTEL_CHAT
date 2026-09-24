export function realtimeEndpoint({ relayUrl = '', signalingUrl = '', backendUrl = '', origin = '' } = {}) {
  const relay = relayUrl.trim();
  if (relay) return relay;
  const legacy = (signalingUrl || backendUrl).trim();
  return legacy.includes('onrender.com') ? origin : legacy || origin;
}

export function reconciliationDelay({ relayMode, connected, visible }) {
  if (!visible) return 15000;
  return relayMode && connected ? 15000 : 1500;
}
