const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const outputRoot = path.join(root, 'public', 'stickers', 'source-packs');
const packs = [
  { id: 'mini-bean-crew', x: 8, y: 61, width: 484, height: 392 },
  { id: 'pastel-bunny-final', x: 8, y: 61, width: 489, height: 392 },
  { id: 'mocha-kitty', x: 8, y: 61, width: 484, height: 392 },
  { id: 'dino-and-friends', x: 9, y: 59, width: 497, height: 380 },
  { id: 'cloud-pals', x: 7, y: 59, width: 521, height: 380 },
  { id: 'peach-fox-feelings', x: 28, y: 143, width: 1198, height: 1088 },
  { id: 'cotton-lamb-socials', x: 28, y: 143, width: 1198, height: 1088 },
  { id: 'jelly-blob-reactions', x: 28, y: 143, width: 1198, height: 1088 },
  { id: 'pudding-puppy-daily-life', x: 28, y: 143, width: 1198, height: 1088 },
  { id: 'cloud-bear-care', x: 28, y: 143, width: 1198, height: 1088 }
];

async function extractPack(pack) {
  const source = path.join(outputRoot, pack.id, 'cover.webp');
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
