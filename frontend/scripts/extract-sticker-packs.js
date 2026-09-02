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

const INSET = 8;
const BOTTOM_INSET = 3;
const PADDING = 8;

function backgroundLike(data, channels, pixel) {
  const offset = pixel * channels;
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  return Math.min(red, green, blue) >= 216 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 48;
}

function makeTransparentBackground(data, info) {
  const pixelCount = info.width * info.height;
  const alpha = new Uint8Array(pixelCount).fill(255);
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;
  const enqueue = (pixel) => {
    if (visited[pixel] || !backgroundLike(data, info.channels, pixel)) return;
    visited[pixel] = 1;
    alpha[pixel] = 0;
    queue[tail] = pixel;
    tail += 1;
  };
  for (let x = 0; x < info.width; x += 1) {
    enqueue(x);
    enqueue((info.height - 1) * info.width + x);
  }
  for (let y = 1; y < info.height - 1; y += 1) {
    enqueue(y * info.width);
    enqueue(y * info.width + info.width - 1);
  }
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % info.width;
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < info.width) enqueue(pixel + 1);
    if (pixel >= info.width) enqueue(pixel - info.width);
    if (pixel + info.width < pixelCount) enqueue(pixel + info.width);
  }
  return alpha;
}

function alphaBounds(alpha, width, height) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!alpha[y * width + x]) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { left, top, right, bottom };
}

async function extractSticker(source, bounds, output) {
  const crop = {
    left: bounds.left + INSET,
    top: bounds.top + INSET,
    width: bounds.right - bounds.left - INSET * 2,
    height: bounds.bottom - bounds.top - INSET - BOTTOM_INSET
  };
  const { data, info } = await sharp(source).extract(crop).raw().toBuffer({ resolveWithObject: true });
  const alpha = makeTransparentBackground(data, info);
  const content = alphaBounds(alpha, info.width, info.height);
  if (!content) throw new Error(`Empty crop for ${output}`);
  const cropLeft = Math.max(0, content.left - PADDING);
  const cropTop = Math.max(0, content.top - PADDING);
  const cropRight = Math.min(info.width - 1, content.right + PADDING);
  const cropBottom = Math.min(info.height - 1, content.bottom + PADDING);
  const outWidth = cropRight - cropLeft + 1;
  const outHeight = cropBottom - cropTop + 1;
  const rgba = Buffer.alloc(outWidth * outHeight * 4);
  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const sourcePixel = (cropTop + y) * info.width + cropLeft + x;
      const sourceOffset = sourcePixel * info.channels;
      const targetOffset = (y * outWidth + x) * 4;
      rgba[targetOffset] = data[sourceOffset];
      rgba[targetOffset + 1] = data[sourceOffset + 1];
      rgba[targetOffset + 2] = data[sourceOffset + 2];
      rgba[targetOffset + 3] = alpha[sourcePixel];
    }
  }
  await sharp(rgba, { raw: { width: outWidth, height: outHeight, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(output);
  return { width: outWidth, height: outHeight };
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
