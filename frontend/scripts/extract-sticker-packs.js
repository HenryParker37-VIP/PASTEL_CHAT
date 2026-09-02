const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const outputRoot = path.join(root, 'public', 'stickers', 'source-packs');
const packs = [
  { id: 'mini-bean-crew', source: 'Mini_Bean_Crew_Sticker_Pack.png', x: 8, y: 61, width: 484, height: 392 },
  { id: 'pastel-bunny-final', source: 'Pastel_Bunny_Sticker_Pack.png', x: 8, y: 61, width: 489, height: 392 },
  { id: 'mocha-kitty', source: 'Mocha_Kitty_Sticker_Pack.png', x: 8, y: 61, width: 484, height: 392 },
  { id: 'dino-and-friends', source: 'Dino_and_Friends_Sticker_Pack.png', x: 9, y: 59, width: 497, height: 380 },
  { id: 'cloud-pals', source: 'Cloud_Pals_Sticker_Pack.png', x: 7, y: 59, width: 521, height: 380 }
];

async function extractPack(pack) {
  const source = path.join('/Users/henryparker37/Downloads', pack.source);
  const cellWidth = pack.width / 4;
  const cellHeight = pack.height / 4;
  const target = path.join(outputRoot, pack.id);
  fs.mkdirSync(target, { recursive: true });
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const left = Math.round(pack.x + col * cellWidth + 3);
      const top = Math.round(pack.y + row * cellHeight + 2);
      const right = Math.round(pack.x + (col + 1) * cellWidth - 3);
      const bottom = Math.round(pack.y + (row + 1) * cellHeight - 2);
      await sharp(source).extract({ left, top, width: right - left, height: bottom - top }).webp({ quality: 96, effort: 6 }).toFile(path.join(target, `${String(row * 4 + col + 1).padStart(2, '0')}.webp`));
    }
  }
  return { ...pack, cellWidth: Math.round(cellWidth), cellHeight: Math.round(cellHeight), output: target };
}

(async () => {
  const results = [];
  for (const pack of packs) results.push(await extractPack(pack));
  console.log(JSON.stringify(results, null, 2));
})();
