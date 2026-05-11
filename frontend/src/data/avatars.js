// DiceBear avatar helpers for PastelChat
// Two modes:
//   1. "sticker"   — fun-emoji style (50 preset seeds, pastel backgrounds)
//   2. "character" — lorelei style  (customizable: skin, hair, bg, accessories)

// ── Sticker avatars (fun-emoji) ───────────────────────────────────────────
const BG = 'ffb6c1,add8e6,dda0dd,ffe4e1,fff8f3,ffd1dc,b0e0e6,e6e6fa';

const SEEDS = [
  'Peach', 'Mochi', 'Bubbles', 'Honey', 'Muffin', 'Pudding', 'Cookie', 'Sprinkle',
  'Cupcake', 'Jelly', 'Taffy', 'Marshmallow', 'Bunny', 'Kitten', 'Puppy', 'Panda',
  'Koala', 'Duckling', 'Chick', 'Bear', 'Fox', 'Deer', 'Lamb', 'Hamster',
  'Cherry', 'Strawberry', 'Lemon', 'Lime', 'Blueberry', 'Raspberry', 'Mango', 'Melon',
  'Cloud', 'Star', 'Moon', 'Sun', 'Rainbow', 'Heart', 'Sparkle', 'Fairy',
  'Angel', 'Candy', 'Lollipop', 'Donut', 'Macaron', 'Tofu', 'Dango', 'Pocky',
  'Sakura', 'Petal',
];

export const AVATARS = SEEDS.map((seed) => ({
  id: seed.toLowerCase(),
  seed,
  url: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${BG}&radius=50`,
}));

export const getAvatarUrl = (seed, bgColor) => {
  const bg = bgColor || BG;
  return `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(seed || 'Peach')}&backgroundColor=${bg}&radius=50`;
};

// ── Character avatars (lorelei — supports skin/hair/accessories) ───────────
export const SKIN_COLORS = [
  { id: 'light',    label: 'Light',    hex: 'f8d9c4' },
  { id: 'medium',   label: 'Medium',   hex: 'e8b89a' },
  { id: 'tan',      label: 'Tan',      hex: 'd4956a' },
  { id: 'brown',    label: 'Brown',    hex: 'b07540' },
  { id: 'dark',     label: 'Dark',     hex: '7c4c28' },
  { id: 'ebony',    label: 'Ebony',    hex: '4a2c12' },
];

export const HAIR_COLORS = [
  { id: 'black',    label: 'Black',    hex: '1a1a1a' },
  { id: 'darkbrown',label: 'Dark Brown',hex: '4a2c2c' },
  { id: 'brown',    label: 'Brown',    hex: '8B5e3c' },
  { id: 'auburn',   label: 'Auburn',   hex: 'a0522d' },
  { id: 'blonde',   label: 'Blonde',   hex: 'deb887' },
  { id: 'platinum', label: 'Platinum', hex: 'ede3d0' },
  { id: 'red',      label: 'Red',      hex: 'cc3300' },
  { id: 'pink',     label: 'Pink',     hex: 'ff87b0' },
  { id: 'purple',   label: 'Purple',   hex: 'a070c0' },
  { id: 'blue',     label: 'Blue',     hex: '5090d0' },
  { id: 'teal',     label: 'Teal',     hex: '30b0a0' },
  { id: 'grey',     label: 'Grey',     hex: '9e9e9e' },
];

export const PASTEL_BG_COLORS = [
  { id: 'pink',     label: 'Pink',     hex: 'ffb6c1' },
  { id: 'blue',     label: 'Blue',     hex: 'add8e6' },
  { id: 'lavender', label: 'Lavender', hex: 'dda0dd' },
  { id: 'peach',    label: 'Peach',    hex: 'ffe4b5' },
  { id: 'mint',     label: 'Mint',     hex: '98ffcc' },
  { id: 'cream',    label: 'Cream',    hex: 'fff8f3' },
  { id: 'lilac',    label: 'Lilac',    hex: 'e6e6fa' },
  { id: 'rose',     label: 'Rose',     hex: 'ffd1dc' },
  { id: 'sky',      label: 'Sky',      hex: 'b0e0e6' },
  { id: 'yellow',   label: 'Yellow',   hex: 'fffacd' },
];

// Eyes/expressions for lorelei
export const EXPRESSIONS = [
  { id: 'cheery',   label: 'Cheery',   value: 'variant01' },
  { id: 'curious',  label: 'Curious',  value: 'variant02' },
  { id: 'happy',    label: 'Happy',    value: 'variant03' },
  { id: 'sleepy',   label: 'Sleepy',   value: 'variant04' },
  { id: 'excited',  label: 'Excited',  value: 'variant05' },
  { id: 'calm',     label: 'Calm',     value: 'variant06' },
];

// Accessories
export const ACCESSORIES = [
  { id: 'none',     label: 'None',     value: '' },
  { id: 'glasses1', label: 'Glasses',  value: 'variant01' },
  { id: 'glasses2', label: 'Sunglasses',value: 'variant02' },
];

// Build lorelei avatar URL from custom options
export const getCharacterAvatarUrl = (opts = {}) => {
  const {
    seed = 'custom',
    skinColor = 'f8d9c4',
    hairColor = '4a2c2c',
    bgColor = 'ffb6c1',
    eyes = 'variant01',
    glasses = '',
    earrings = false,
  } = opts;

  const params = new URLSearchParams({
    seed: encodeURIComponent(seed),
    skinColor,
    hairColor,
    backgroundColor: bgColor,
    radius: '50',
  });
  if (eyes) params.set('eyes', eyes);
  if (glasses) params.set('glasses', glasses);
  if (earrings) params.set('earringsProbability', '100');

  return `https://api.dicebear.com/7.x/lorelei/svg?${params.toString()}`;
};

// Parse an existing lorelei URL back into opts
export const parseCharacterUrl = (url) => {
  try {
    const u = new URL(url);
    if (!u.pathname.includes('lorelei')) return null;
    return {
      skinColor: u.searchParams.get('skinColor') || 'f8d9c4',
      hairColor: u.searchParams.get('hairColor') || '4a2c2c',
      bgColor: u.searchParams.get('backgroundColor') || 'ffb6c1',
      eyes: u.searchParams.get('eyes') || 'variant01',
      glasses: u.searchParams.get('glasses') || '',
      earrings: u.searchParams.get('earringsProbability') === '100',
    };
  } catch {
    return null;
  }
};

// Detect which mode an avatar URL is in
export const detectAvatarMode = (url) => {
  if (!url) return 'sticker';
  if (url.startsWith('data:')) return 'photo';
  if (url.includes('lorelei')) return 'character';
  return 'sticker';
};

export default AVATARS;
