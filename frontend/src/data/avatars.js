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
  { id: 'black',     label: 'Black',       hex: '1a1a1a' },
  { id: 'darkbrown', label: 'Dark Brown',  hex: '4a2c2c' },
  { id: 'brown',     label: 'Brown',       hex: '8B5e3c' },
  { id: 'auburn',    label: 'Auburn',      hex: 'a0522d' },
  { id: 'blonde',    label: 'Blonde',      hex: 'deb887' },
  { id: 'platinum',  label: 'Platinum',    hex: 'ede3d0' },
  { id: 'red',       label: 'Red',         hex: 'cc3300' },
  { id: 'pink',      label: 'Pink',        hex: 'ff87b0' },
  { id: 'purple',    label: 'Purple',      hex: 'a070c0' },
  { id: 'blue',      label: 'Blue',        hex: '5090d0' },
  { id: 'teal',      label: 'Teal',        hex: '30b0a0' },
  { id: 'grey',      label: 'Grey',        hex: '9e9e9e' },
];

export const HAIR_STYLES = [
  { id: 'h1',  label: 'Short',       value: 'variant01' },
  { id: 'h2',  label: 'Bob',         value: 'variant02' },
  { id: 'h3',  label: 'Wavy',        value: 'variant03' },
  { id: 'h4',  label: 'Long',        value: 'variant04' },
  { id: 'h5',  label: 'Ponytail',    value: 'variant05' },
  { id: 'h6',  label: 'Bun',         value: 'variant06' },
  { id: 'h7',  label: 'Curly',       value: 'variant07' },
  { id: 'h8',  label: 'Pixie',       value: 'variant08' },
  { id: 'h9',  label: 'Braids',      value: 'variant09' },
  { id: 'h10', label: 'Side-swept',  value: 'variant10' },
  { id: 'h11', label: 'Twintails',   value: 'variant11' },
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

export const EXPRESSIONS = [
  { id: 'cheery',   label: '😊 Cheery',   value: 'variant01' },
  { id: 'curious',  label: '🤔 Curious',  value: 'variant02' },
  { id: 'happy',    label: '😄 Happy',    value: 'variant03' },
  { id: 'sleepy',   label: '😴 Sleepy',   value: 'variant04' },
  { id: 'excited',  label: '🤩 Excited',  value: 'variant05' },
  { id: 'calm',     label: '😌 Calm',     value: 'variant06' },
  { id: 'wink',     label: '😉 Wink',     value: 'variant07' },
  { id: 'heart',    label: '🥰 Heart',    value: 'variant08' },
];

export const ACCESSORIES = [
  { id: 'none',      label: 'None',       value: '' },
  { id: 'glasses1',  label: '👓 Glasses', value: 'variant01' },
  { id: 'glasses2',  label: '🕶️ Shades',  value: 'variant02' },
  { id: 'glasses3',  label: '🤓 Nerd',    value: 'variant03' },
  { id: 'glasses4',  label: '💎 Cat-eye', value: 'variant04' },
  { id: 'glasses5',  label: '✨ Round',   value: 'variant05' },
];

export const OUTFITS = [
  { id: 'o1',  label: '👕 Casual',     value: 'variant01' },
  { id: 'o2',  label: '🎀 Cute',       value: 'variant02' },
  { id: 'o3',  label: '🌸 Floral',     value: 'variant03' },
  { id: 'o4',  label: '⭐ Sporty',     value: 'variant04' },
  { id: 'o5',  label: '💼 Smart',      value: 'variant05' },
  { id: 'o6',  label: '🎓 Academic',   value: 'variant06' },
  { id: 'o7',  label: '🌙 Cozy',       value: 'variant07' },
  { id: 'o8',  label: '🦋 Boho',       value: 'variant08' },
];

// Build lorelei avatar URL from custom options
export const getCharacterAvatarUrl = (opts = {}) => {
  const {
    skinColor = 'f8d9c4',
    hairColor = '4a2c2c',
    hairStyle = 'variant01',
    bgColor = 'ffb6c1',
    eyes = 'variant01',
    glasses = '',
    outfit = 'variant01',
    earrings = false,
  } = opts;

  const params = new URLSearchParams({
    seed: 'custom',
    skinColor,
    hairColor,
    backgroundColor: bgColor,
    radius: '50',
  });
  if (eyes) params.set('eyes', eyes);
  if (hairStyle) params.set('hair', hairStyle);
  if (glasses) params.set('glasses', glasses);
  if (outfit) params.set('clothing', outfit);
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
      hairStyle: u.searchParams.get('hair') || 'variant01',
      bgColor: u.searchParams.get('backgroundColor') || 'ffb6c1',
      eyes: u.searchParams.get('eyes') || 'variant01',
      glasses: u.searchParams.get('glasses') || '',
      outfit: u.searchParams.get('clothing') || 'variant01',
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
