const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const outputRoot = path.join(root, 'public', 'stickers', 'source-packs');

// The three supplied sheets share the same 1254px canvas and visible 5x5 grid.
// Coordinates stop at the inside edge of each dashed divider; they are only
// used to locate cells. extractSticker then trims each cell to its artwork.
const packs = [
  {
    id: 'pastel-bro-daily-mood',
    source: path.join(outputRoot, 'pastel-bro-daily-mood', 'cover.png'),
    x: [17, 268, 507, 746, 986, 1237],
    y: [201, 417, 625, 834, 1036, 1234]
  },
  {
    id: 'pastel-bro-chill-power',
    source: path.join(outputRoot, 'pastel-bro-chill-power', 'cover.png'),
    x: [17, 268, 507, 746, 986, 1237],
    y: [201, 417, 625, 834, 1036, 1234]
  },
  {
    id: 'pastel-bro-reactions',
    source: path.join(outputRoot, 'pastel-bro-reactions', 'cover.png'),
    x: [17, 268, 507, 746, 986, 1237],
    y: [201, 417, 625, 834, 1036, 1234]
  }
];

const CELL_INSET_X = 10;
const CELL_INSET_TOP = 8;
const CELL_INSET_BOTTOM = 5;
const ARTWORK_PADDING = 6;
const MASK_EDGE_GUARD = 6;

async function getArtworkBounds(input) {
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const darkest = Math.min(red, green, blue);
      const spread = Math.max(red, green, blue) - darkest;

      // The sheet is a warm near-white background. Dark outlines/captions and
      // sufficiently saturated artwork pixels form a stable foreground mask.
      const awayFromCellEdge = x >= MASK_EDGE_GUARD && x < info.width - MASK_EDGE_GUARD
        && y >= MASK_EDGE_GUARD && y < info.height - MASK_EDGE_GUARD;
      if (awayFromCellEdge && (darkest < 215 || spread > 18)) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (right < 0) return { left: 0, top: 0, width: info.width, height: info.height };
  const cropLeft = Math.max(0, left - ARTWORK_PADDING);
  const cropTop = Math.max(0, top - ARTWORK_PADDING);
  const cropRight = Math.min(info.width - 1, right + ARTWORK_PADDING);
  const cropBottom = Math.min(info.height - 1, bottom + ARTWORK_PADDING);
  return {
    left: cropLeft,
    top: cropTop,
    width: cropRight - cropLeft + 1,
    height: cropBottom - cropTop + 1
  };
}

async function extractSticker(source, bounds, output) {
  const cell = {
    left: bounds.left + CELL_INSET_X,
    top: bounds.top + CELL_INSET_TOP,
    width: bounds.right - bounds.left - CELL_INSET_X * 2,
    height: bounds.bottom - bounds.top - CELL_INSET_TOP - CELL_INSET_BOTTOM
  };
  const cellBuffer = await sharp(source).extract(cell).png().toBuffer();
  const artwork = await getArtworkBounds(cellBuffer);
  await sharp(cellBuffer).extract(artwork).png({ compressionLevel: 9 }).toFile(output);
  return { width: artwork.width, height: artwork.height };
}

async function extractPack(pack) {
  const target = path.join(outputRoot, pack.id);
  fs.mkdirSync(target, { recursive: true });
  const sizes = [];

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const number = String(row * 5 + col + 1).padStart(2, '0');
      sizes.push(await extractSticker(pack.source, {
        left: pack.x[col], right: pack.x[col + 1], top: pack.y[row], bottom: pack.y[row + 1]
      }, path.join(target, `${number}.png`)));
    }
  }
  return { id: pack.id, count: sizes.length, sizes };
}

(async () => {
  const results = [];
  for (const pack of packs) results.push(await extractPack(pack));
  console.log(JSON.stringify(results, null, 2));
})();
