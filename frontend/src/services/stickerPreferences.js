import { ACTIVE_STICKER_PACK_IDS, LOCAL_STICKERS } from '../data/stickerLibrary';

const RECENT_KEY = 'pastelchat.stickers.recent';
const FAVORITES_KEY = 'pastelchat.stickers.favorites';
const INSTALLED_KEY = 'pastelchat.stickers.installed-packs';

const ACTIVE_PACK_IDS = new Set(ACTIVE_STICKER_PACK_IDS);
const ACTIVE_STICKER_IDS = new Set(LOCAL_STICKERS.map(sticker => sticker.id));

const read = (key) => {
  try { return JSON.parse(window.localStorage.getItem(key) || '[]'); } catch { return []; }
};
const write = (key, value) => {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
};

const activeStickerIds = ids => ids.filter(id => ACTIVE_STICKER_IDS.has(id));
const activePackIds = ids => ids.filter(id => ACTIVE_PACK_IDS.has(id));

const migrateStoredStickerState = () => {
  const recent = activeStickerIds(read(RECENT_KEY));
  const favorites = activeStickerIds(read(FAVORITES_KEY));
  const installed = activePackIds(read(INSTALLED_KEY));
  write(RECENT_KEY, recent);
  write(FAVORITES_KEY, favorites);
  write(INSTALLED_KEY, installed);
  return { recent, favorites, installed };
};

export const getRecentStickerIds = () => migrateStoredStickerState().recent;
export const getFavoriteStickerIds = () => migrateStoredStickerState().favorites;
export const getInstalledPackIds = () => migrateStoredStickerState().installed;
export const toggleInstalledPack = (id) => {
  if (!ACTIVE_PACK_IDS.has(id)) return getInstalledPackIds();
  const current = getInstalledPackIds();
  const next = current.includes(id) ? current.filter(item => item !== id) : [id, ...current];
  write(INSTALLED_KEY, next);
  return next;
};
export const recordRecentSticker = (id) => {
  if (!ACTIVE_STICKER_IDS.has(id)) return getRecentStickerIds();
  const next = [id, ...getRecentStickerIds().filter(item => item !== id)].slice(0, 24);
  write(RECENT_KEY, next);
  return next;
};
export const toggleFavoriteSticker = (id) => {
  if (!ACTIVE_STICKER_IDS.has(id)) return getFavoriteStickerIds();
  const current = getFavoriteStickerIds();
  const next = current.includes(id) ? current.filter(item => item !== id) : [id, ...current].slice(0, 60);
  write(FAVORITES_KEY, next);
  return next;
};
