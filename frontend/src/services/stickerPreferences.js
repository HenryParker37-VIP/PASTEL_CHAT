const RECENT_KEY = 'pastelchat.stickers.recent';
const FAVORITES_KEY = 'pastelchat.stickers.favorites';
const INSTALLED_KEY = 'pastelchat.stickers.installed-packs';

const read = (key) => {
  try { return JSON.parse(window.localStorage.getItem(key) || '[]'); } catch { return []; }
};
const write = (key, value) => {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
};

export const getRecentStickerIds = () => read(RECENT_KEY);
export const getFavoriteStickerIds = () => read(FAVORITES_KEY);
export const getInstalledPackIds = () => read(INSTALLED_KEY);
export const toggleInstalledPack = (id) => {
  const current = getInstalledPackIds();
  const next = current.includes(id) ? current.filter(item => item !== id) : [id, ...current];
  write(INSTALLED_KEY, next);
  return next;
};
export const recordRecentSticker = (id) => {
  const next = [id, ...getRecentStickerIds().filter(item => item !== id)].slice(0, 24);
  write(RECENT_KEY, next);
  return next;
};
export const toggleFavoriteSticker = (id) => {
  const current = getFavoriteStickerIds();
  const next = current.includes(id) ? current.filter(item => item !== id) : [id, ...current].slice(0, 60);
  write(FAVORITES_KEY, next);
  return next;
};
