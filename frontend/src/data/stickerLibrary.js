import { PASTEL_BUNNY_PACK } from './pastelBunnyStickers';
import { PASTEL_BUNNY_EXPANSION_STICKERS } from './pastelBunnyExpansionStickers';

// Stable taxonomy and metadata slots remain independent from artwork, so
// better character art can be added later without another Store/Picker rewrite.
export const STICKER_CATEGORIES = [
  'Love', 'Happy', 'Laugh', 'Cute', 'Sad', 'Cry', 'Angry', 'Annoyed', 'Shocked', 'Confused', 'Shy', 'Embarrassed', 'Sorry', 'Thank You', 'Hug', 'Miss You', 'Sleep', 'Tired', 'Good Morning', 'Good Night', 'Study', 'Work', 'Celebrate', 'Clap', 'Wow', 'OMG', 'LOL', 'Support', 'Comfort', 'Motivation', 'Food', 'Busy', 'Waiting', 'Okay', 'No', 'Yes', 'Hello', 'Bye', 'Thinking', 'Bored', 'Sick', 'Gaming', 'Music', 'Heartbreak', 'Friendship', 'Birthday', 'Special Moments', 'Jealous', 'Nervous', 'Proud', 'Excited', 'Awkward', 'Facepalm', 'Please', 'Begging', 'Hungry', 'Coffee', 'Rainy Day', 'Cozy', 'Working Late', 'Finished', 'Panic', 'Chill', 'Flirty', 'Good Luck'
].map(label => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label, labelVi: label }));

export const createStickerMetadata = (item, { packId = item.pack, characterId = item.pack, sortOrder = 0 } = {}) => ({
  ...item, packId, characterId, name: item.name || item.label, previewAsset: item.previewAsset || item.asset,
  secondaryCategories: item.secondaryCategories || item.intent || [],
  triggers: item.triggers || [...(item.tags?.en || []), ...(item.tags?.vi || [])],
  isLegacy: item.isLegacy ?? false, isActive: item.isActive ?? true, sortOrder
});

const bunnyStickers = [...PASTEL_BUNNY_PACK.stickers, ...PASTEL_BUNNY_EXPANSION_STICKERS]
  .map((item, index) => createStickerMetadata(item, { packId: 'pastel-bunny', characterId: 'pastel-bunny', sortOrder: index }));

export const ACTIVE_STICKER_PACKS = [{
  ...PASTEL_BUNNY_PACK, packId: 'pastel-bunny', characterId: 'pastel-bunny', featured: true, active: true,
  isLegacy: false, description: 'Pastel Bunny brings a gentle reaction for every chat moment.', stickers: bunnyStickers
}];

export const LOCAL_STICKER_PACKS = ACTIVE_STICKER_PACKS;
export const LOCAL_STICKERS = ACTIVE_STICKER_PACKS.flatMap(pack => pack.stickers);
export const STICKER_BY_ID = Object.fromEntries(LOCAL_STICKERS.map(item => [item.id, item]));
export const STICKER_PACK_BY_ID = Object.fromEntries(LOCAL_STICKER_PACKS.map(pack => [pack.id, pack]));

export const normalizeStickerSearch = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/(.)\1{2,}/g, '$1$1').trim();
export const stickerMatchesSearch = (item, query) => {
  const term = normalizeStickerSearch(query);
  if (!term || !item) return !term;
  const haystack = normalizeStickerSearch([item.name, item.label, item.labelVi, item.pack, item.characterId, ...(item.tags?.en || []), ...(item.tags?.vi || []), ...(item.triggers || [])].join(' '));
  return haystack.includes(term) || term.split(/\s+/).every(token => haystack.includes(token));
};
