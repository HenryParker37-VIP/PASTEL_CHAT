import { ACTIVE_STICKER_PACK_IDS, ARCHIVED_STICKER_PACKS, LOCAL_STICKER_PACKS, LOCAL_STICKERS, STICKER_CATEGORIES, stickerMatchesSearch } from './stickerLibrary';

describe('active PastelChat sticker library', () => {
  test('contains first-party characters and the full category vocabulary', () => {
    expect(LOCAL_STICKER_PACKS).toHaveLength(12);
    expect(LOCAL_STICKER_PACKS.every(pack => pack.stickers.length === 25)).toBe(true);
    expect(LOCAL_STICKER_PACKS.map(pack => pack.id)).toEqual(ACTIVE_STICKER_PACK_IDS);
    expect(LOCAL_STICKERS).toHaveLength(300);
    expect(LOCAL_STICKER_PACKS.every(pack => pack.cover.endsWith('/cover.png'))).toBe(true);
    expect(ARCHIVED_STICKER_PACKS).toHaveLength(15);
    expect(ARCHIVED_STICKER_PACKS.every(pack => pack.active === false && pack.deprecated === true)).toBe(true);
    expect(STICKER_CATEGORIES.length).toBeGreaterThanOrEqual(60);
    expect(LOCAL_STICKER_PACKS.find(pack => pack.id === 'pastel-daily-feelings')?.featured).toBe(true);
    expect(LOCAL_STICKERS.every(sticker => sticker.isLegacy === false && sticker.isActive === true && !String(sticker.asset).startsWith('vector:'))).toBe(true);
  });

  test('uses accentless English/Vietnamese search aliases', () => {
    expect(stickerMatchesSearch(LOCAL_STICKERS.find(sticker => sticker.id === 'pastel-daily-feelings-01'), 'huhu')).toBe(true);
    expect(stickerMatchesSearch(LOCAL_STICKERS.find(sticker => sticker.id === 'pastel-foodie-moments-11'), 'pizza')).toBe(true);
    expect(stickerMatchesSearch(LOCAL_STICKERS.find(sticker => sticker.id === 'pastel-cute-animals-20'), 'dino')).toBe(true);
    expect(stickerMatchesSearch(LOCAL_STICKERS.find(sticker => sticker.id === 'pastel-bro-daily-mood-04'), 'giận')).toBe(true);
    expect(stickerMatchesSearch(LOCAL_STICKERS.find(sticker => sticker.id === 'pastel-bro-chill-power-12'), 'work hard')).toBe(true);
    expect(stickerMatchesSearch(LOCAL_STICKERS.find(sticker => sticker.id === 'pastel-bro-reactions-11'), 'mind blown')).toBe(true);
  });
});
