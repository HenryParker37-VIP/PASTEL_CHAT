const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const outputRoot = path.join(root, 'public', 'stickers', 'source-packs');

// Measured divider coordinates for the original 1254px 5x5 source sheets.
// Crops are made inward from each divider so lines never enter an export.
const packs = [
  { id: 'pastel-daily-feelings', x: [25, 265, 503, 744, 982, 1226], y: [204, 408, 612, 811, 1009, 1220] },
  { id: 'pastel-sleepy-chill', x: [30, 271, 505, 742, 978, 1224], y: [223, 442, 650, 849, 1048, 1230] },
  { id: 'pastel-love-affection', x: [25, 266, 505, 744, 982, 1227], y: [204, 415, 620, 825, 1025, 1228] },
  { id: 'pastel-study-work', x: [29, 267, 501, 739, 978, 1225], y: [217, 429, 638, 842, 1042, 1229] },
  { id: 'pastel-thanks-sorry', x: [29, 270, 505, 741, 977, 1225], y: [221, 437, 647, 846, 1034, 1225] },
  { id: 'pastel-foodie-moments', x: [24, 266, 504, 743, 980, 1226], y: [204, 413, 618, 822, 1023, 1227] },
  { id: 'pastel-fun-lifestyle', x: [24, 264, 504, 747, 989, 1227], y: [208, 421, 627, 832, 1027, 1230] },
  { id: 'pastel-cute-animals', x: [27, 270, 508, 746, 984, 1227], y: [216, 425, 635, 838, 1027, 1230] },
  { id: 'pastel-ultimate-reactions', x: [28, 268, 506, 744, 983, 1227], y: [218, 422, 624, 824, 1024, 1227] }
];

// Keep a narrow, fixed inset inside each measured cell. The source sheets use
// light pixels for sticker skin and for the sheet background, so any automatic
// background-removal pass can mistake white artwork for transparent pixels.
// Opaque cell crops are deliberate: they preserve every part of the supplied
// artwork and caption while excluding the measured grid dividers.
const CELL_INSET = 8;

async function extractSticker(source, bounds, output) {
  const crop = {
    left: bounds.left + CELL_INSET,
    top: bounds.top + CELL_INSET,
    width: bounds.right - bounds.left - CELL_INSET * 2,
    height: bounds.bottom - bounds.top - CELL_INSET * 2
  };
  await sharp(source)
    .extract(crop)
    .png({ compressionLevel: 9 })
    .toFile(output);
  return { width: crop.width, height: crop.height };
}

async function extractPack(pack) {
  const target = path.join(outputRoot, pack.id);
  const source = path.join(target, 'cover.png');
  fs.mkdirSync(target, { recursive: true });
  const sizes = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const number = String(row * 5 + col + 1).padStart(2, '0');
      sizes.push(await extractSticker(source, { left: pack.x[col], right: pack.x[col + 1], top: pack.y[row], bottom: pack.y[row + 1] }, path.join(target, `${number}.png`)));
    }
  }
  return { id: pack.id, count: sizes.length, sizes };
}

(async () => {
  const results = [];
  for (const pack of packs) results.push(await extractPack(pack));
  console.log(JSON.stringify(results, null, 2));
})();
