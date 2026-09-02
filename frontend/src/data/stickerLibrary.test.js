import { LOCAL_STICKER_PACKS, LOCAL_STICKERS, STICKER_CATEGORIES, stickerMatchesSearch } from './stickerLibrary';

describe('active PastelChat sticker library', () => {
  test('contains first-party characters and the full category vocabulary', () => {
    expect(LOCAL_STICKER_PACKS.length).toBeGreaterThanOrEqual(31);
    expect(LOCAL_STICKERS.length).toBeGreaterThan(400);
    expect(STICKER_CATEGORIES.length).toBeGreaterThanOrEqual(60);
    expect(LOCAL_STICKER_PACKS.find(pack => pack.id === 'pastel-bunny')?.featured).toBe(true);
    expect(LOCAL_STICKERS.every(sticker => sticker.isLegacy === false && sticker.isActive === true)).toBe(true);
  });

  test('uses accentless English/Vietnamese search aliases', () => {
    expect(stickerMatchesSearch(LOCAL_STICKERS.find(sticker => sticker.id === 'mochi-bear-thanks'), 'cam on')).toBe(true);
    expect(stickerMatchesSearch(LOCAL_STICKERS.find(sticker => sticker.id === 'bunny_hello'), 'xin chao')).toBe(true);
    expect(stickerMatchesSearch(LOCAL_STICKERS.find(sticker => sticker.id === 'cloud-cat-shock'), 'OMG')).toBe(true);
  });
});
