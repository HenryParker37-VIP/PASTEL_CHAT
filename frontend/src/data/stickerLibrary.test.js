import { LOCAL_STICKER_PACKS, LOCAL_STICKERS, STICKER_CATEGORIES, stickerMatchesSearch } from './stickerLibrary';

describe('active PastelChat sticker library', () => {
  test('contains first-party characters and the full category vocabulary', () => {
    expect(LOCAL_STICKER_PACKS).toHaveLength(10);
    expect(LOCAL_STICKER_PACKS.every(pack => pack.stickers.length === 16)).toBe(true);
    expect(LOCAL_STICKER_PACKS.every(pack => pack.cover.endsWith('/cover.webp'))).toBe(true);
    expect(LOCAL_STICKERS).toHaveLength(160);
    expect(STICKER_CATEGORIES.length).toBeGreaterThanOrEqual(60);
    expect(LOCAL_STICKER_PACKS.find(pack => pack.id === 'pastel-bunny-final')?.featured).toBe(true);
    expect(LOCAL_STICKERS.every(sticker => sticker.isLegacy === false && sticker.isActive === true && !String(sticker.asset).startsWith('vector:'))).toBe(true);
  });

  test('uses accentless English/Vietnamese search aliases', () => {
    expect(stickerMatchesSearch(LOCAL_STICKERS.find(sticker => sticker.id === 'mini-bean-crew-13'), 'doi')).toBe(true);
    expect(stickerMatchesSearch(LOCAL_STICKERS.find(sticker => sticker.id === 'pastel-bunny-final-01'), 'xin chao')).toBe(true);
    expect(stickerMatchesSearch(LOCAL_STICKERS.find(sticker => sticker.id === 'mini-bean-crew-16'), 'OMG')).toBe(true);
  });
});
