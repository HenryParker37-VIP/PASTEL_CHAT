import { ACTIVE_STICKER_PACK_IDS, ARCHIVED_STICKER_PACKS, LOCAL_STICKER_PACKS, LOCAL_STICKERS, STICKER_CATEGORIES, stickerMatchesSearch } from './stickerLibrary';

describe('active PastelChat sticker library', () => {
  test('contains first-party characters and the full category vocabulary', () => {
    expect(LOCAL_STICKER_PACKS).toHaveLength(5);
    expect(LOCAL_STICKER_PACKS.every(pack => pack.stickers.length === 16)).toBe(true);
    expect(LOCAL_STICKER_PACKS.map(pack => pack.id)).toEqual(ACTIVE_STICKER_PACK_IDS);
    expect(LOCAL_STICKERS).toHaveLength(80);
    expect(LOCAL_STICKER_PACKS.every(pack => pack.cover.endsWith('/cover.png'))).toBe(true);
    expect(ARCHIVED_STICKER_PACKS).toHaveLength(10);
    expect(ARCHIVED_STICKER_PACKS.every(pack => pack.active === false && pack.deprecated === true)).toBe(true);
    expect(STICKER_CATEGORIES.length).toBeGreaterThanOrEqual(60);
    expect(LOCAL_STICKER_PACKS.find(pack => pack.id === 'bunny-english-vibes')?.featured).toBe(true);
    expect(LOCAL_STICKERS.every(sticker => sticker.isLegacy === false && sticker.isActive === true && !String(sticker.asset).startsWith('vector:'))).toBe(true);
  });

  test('uses accentless English/Vietnamese search aliases', () => {
    expect(stickerMatchesSearch(LOCAL_STICKERS.find(sticker => sticker.id === 'bunny-english-vibes-01'), 'haha')).toBe(true);
    expect(stickerMatchesSearch(LOCAL_STICKERS.find(sticker => sticker.id === 'cloud-bear-care-new-01'), 'feel better')).toBe(true);
    expect(stickerMatchesSearch(LOCAL_STICKERS.find(sticker => sticker.id === 'tiny-duck-chaos-16'), 'shocked')).toBe(true);
  });
});
