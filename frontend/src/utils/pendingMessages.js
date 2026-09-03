const MAX_PENDING_MESSAGES = 50;

const storageKey = (userId) => `pastelchat.pending-messages:${userId}`;

export function loadPendingMessages(userId) {
  if (!userId) return [];
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(userId)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function savePendingMessage(userId, message) {
  if (!userId || !message?.clientMessageId) return;
  const current = loadPendingMessages(userId).filter((item) => item.clientMessageId !== message.clientMessageId);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...current, message].slice(-MAX_PENDING_MESSAGES)));
  } catch {
    // A full/private storage area should not prevent the in-memory send.
  }
}

export function removePendingMessage(userId, clientMessageId) {
  if (!userId || !clientMessageId) return;
  const remaining = loadPendingMessages(userId).filter((item) => item.clientMessageId !== clientMessageId);
  try { localStorage.setItem(storageKey(userId), JSON.stringify(remaining)); } catch { /* best effort */ }
}
