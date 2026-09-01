import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from '../frontend/node_modules/sharp/lib/index.js';

const sources = [
  {
    file: '/var/folders/91/mp6k4txj2gl_64yrb3fjh6sm0000gn/T/codex-clipboard-a666c9ce-e649-4a5e-86e2-9658293334c9.png',
    ids: ['bunny_goodmorning', 'bunny_goodevening', 'bunny_camon', 'bunny_thankyou', 'bunny_please', 'bunny_welcome', 'bunny_onmyway', 'bunny_waitasec', 'bunny_okayyy', 'bunny_noproblem', 'bunny_letsgo', 'bunny_takecare', 'bunny_brb', 'bunny_welcomeback', 'bunny_havefun', 'bunny_seeyalater']
  },
  {
    file: '/var/folders/91/mp6k4txj2gl_64yrb3fjh6sm0000gn/T/codex-clipboard-471a9055-cd73-4d5c-b9bd-3d2734a8cc7e.png',
    ids: ['bunny_loveyou', 'bunny_iuyou', 'bunny_hughug', 'bunny_missyou lots', 'bunny_nhoyounhieu', 'bunny_proudofyou', 'bunny_cheerup', 'bunny_itsokay', 'bunny_yougotthis', 'bunny_socute', 'bunny_thinkingofyou', 'bunny_goodjob', 'bunny_xinloin hieu', 'bunny_forgiveme', 'bunny_takearest', 'bunny_sweetdreams']
  },
  {
    file: '/var/folders/91/mp6k4txj2gl_64yrb3fjh6sm0000gn/T/codex-clipboard-e2b21b6a-54f1-44f8-a0cf-35fad3a55859.png',
    ids: ['bunny_omg', 'bunny_troi oi', 'bunny_lol', 'bunny_lmao', 'bunny_what', 'bunny_xiu', 'bunny_wow', 'bunny_hmmmm', 'bunny_bruh', 'bunny_sobored', 'bunny_mad', 'bunny_jealous', 'bunny_cryinggg', 'bunny_quequa', 'bunny_mindblown', 'bunny_clapclap']
  }
];

const boxes = [
  [44, 25, 335, 270], [397, 25, 325, 270], [748, 25, 300, 270], [1080, 25, 335, 270],
  [44, 295, 335, 250], [397, 295, 325, 250], [748, 295, 300, 250], [1080, 295, 335, 250],
  [44, 560, 335, 240], [397, 560, 325, 240], [748, 560, 300, 240], [1080, 560, 335, 240],
  [44, 805, 335, 278], [397, 805, 325, 278], [748, 805, 300, 278], [1080, 805, 335, 278]
];

const outputDir = path.resolve('frontend/public/stickers/pastel-bunny');
await fs.mkdir(outputDir, { recursive: true });
const generated = [];

for (const source of sources) {
  const input = sharp(source.file);
  for (const [index, id] of source.ids.entries()) {
    const safeId = id.replace(/[^a-z0-9_]+/gi, '_').replace(/_+/g, '_');
    const [left, top, width, height] = boxes[index];
    await input.clone().extract({ left, top, width, height }).webp({ quality: 94, alphaQuality: 100, effort: 6 }).toFile(path.join(outputDir, `${safeId}.webp`));
    generated.push({ id: safeId, asset: `/stickers/pastel-bunny/${safeId}.webp` });
  }
}

const existingManifest = JSON.parse(await fs.readFile(path.join(outputDir, 'manifest.json'), 'utf8'));
const existingIds = new Set(existingManifest.stickers.map(item => item.id));
await fs.writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify({ ...existingManifest, stickers: [...existingManifest.stickers, ...generated.filter(item => !existingIds.has(item.id))] }, null, 2)}\n`);
console.log(`Extracted ${generated.length} new stickers; manifest now contains ${existingManifest.stickers.length + generated.length} entries.`);
