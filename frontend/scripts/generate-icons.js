#!/usr/bin/env node
// Generates all PWA icon PNGs from public/icons/icon.svg
// Run: node scripts/generate-icons.js
// Requires: npm install --save-dev sharp

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SVG = path.join(__dirname, '../public/icons/icon.svg');
const OUT = path.join(__dirname, '../public/icons');

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Splash screens: [width, height, filename]
const SPLASHES = [
  [1170, 2532, 'splash-1170x2532.png'],
  [1125, 2436, 'splash-1125x2436.png'],
  [828, 1792, 'splash-828x1792.png'],
];

async function generateIcons() {
  const svgBuffer = fs.readFileSync(SVG);

  for (const size of ICON_SIZES) {
    const out = path.join(OUT, `icon-${size}x${size}.png`);
    await sharp(svgBuffer).resize(size, size).png().toFile(out);
    console.log(`✓ icon-${size}x${size}.png`);
  }
}

async function generateSplashes() {
  const svgBuffer = fs.readFileSync(SVG);
  const ICON_SIZE = 192;

  for (const [w, h, name] of SPLASHES) {
    // Pink gradient background with centered icon
    const icon = await sharp(svgBuffer).resize(ICON_SIZE, ICON_SIZE).png().toBuffer();
    const bg = {
      create: {
        width: w,
        height: h,
        channels: 4,
        background: { r: 255, g: 240, b: 245, alpha: 1 },
      },
    };
    const left = Math.round((w - ICON_SIZE) / 2);
    const top = Math.round((h - ICON_SIZE) / 2);
    const out = path.join(OUT, name);
    await sharp(bg)
      .composite([{ input: icon, left, top }])
      .png()
      .toFile(out);
    console.log(`✓ ${name}`);
  }
}

(async () => {
  try {
    await generateIcons();
    await generateSplashes();
    console.log('\nAll PWA icons generated successfully.');
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Make sure sharp is installed: npm install --save-dev sharp');
    process.exit(1);
  }
})();
