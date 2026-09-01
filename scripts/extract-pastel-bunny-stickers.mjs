import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from '../frontend/node_modules/sharp/lib/index.js';

const source = '/var/folders/91/mp6k4txj2gl_64yrb3fjh6sm0000gn/T/codex-clipboard-74a3a6e2-314d-4f88-adb2-a258dba8e829.png';
const outputDir = path.resolve('frontend/public/stickers/pastel-bunny');
const manifestPath = path.join(outputDir, 'manifest.json');

const stickers = [
  ['bunny_hello', 52, 24, 312, 286], ['bunny_xinchao', 426, 38, 270, 259],
  ['bunny_byebye', 727, 25, 287, 282], ['bunny_seeyou', 1080, 25, 330, 285],
  ['bunny_sorry', 45, 316, 335, 244], ['bunny_imissyou', 397, 301, 320, 259],
  ['bunny_nhoyou', 731, 302, 293, 260], ['bunny_goodnight', 1044, 302, 373, 260],
  ['bunny_laugh', 40, 565, 335, 240], ['bunny_cry', 398, 565, 326, 240],
  ['bunny_angry', 728, 560, 292, 247], ['bunny_shocked', 1075, 562, 340, 244],
  ['bunny_sleepy', 39, 805, 334, 273], ['bunny_love', 402, 805, 318, 278],
  ['bunny_thumbsup', 732, 805, 292, 278], ['bunny_celebrate', 1050, 805, 370, 281],
];

await fs.mkdir(outputDir, { recursive: true });
const input = sharp(source);

for (const [id, left, top, width, height] of stickers) {
  await input.clone()
    .extract({ left, top, width, height })
    .webp({ quality: 94, alphaQuality: 100, effort: 6 })
    .toFile(path.join(outputDir, `${id}.webp`));
}

await fs.writeFile(manifestPath, `${JSON.stringify({
  id: 'pastel-bunny', name: 'Pastel Bunny', source: 'kawaii pink bunny pastel sticker sheet',
  assetType: 'webp', stickers: stickers.map(([id]) => ({ id, asset: `/stickers/pastel-bunny/${id}.webp` }))
}, null, 2)}\n`);
console.log(`Extracted ${stickers.length} stickers to ${outputDir}`);
