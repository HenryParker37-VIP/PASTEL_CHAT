// DiceBear avatar helpers for PastelChat
// Two modes:
//   1. "sticker"   — fun-emoji style (50 preset seeds, pastel backgrounds)
//   2. "character" — custom SVG chibi (via AvatarRenderer)

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

// ── Character avatars (custom SVG chibi) ──────────────────────────────────
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
  { id: 'h1',  label: 'Short',       value: 'v01' },
  { id: 'h2',  label: 'Bob',         value: 'v02' },
  { id: 'h3',  label: 'Wavy',        value: 'v03' },
  { id: 'h4',  label: 'Long',        value: 'v04' },
  { id: 'h5',  label: 'Ponytail',    value: 'v05' },
  { id: 'h6',  label: 'Bun',         value: 'v06' },
  { id: 'h7',  label: 'Curly',       value: 'v07' },
  { id: 'h8',  label: 'Pixie',       value: 'v08' },
  { id: 'h9',  label: 'Braids',      value: 'v09' },
  { id: 'h10', label: 'Side-swept',  value: 'v10' },
  { id: 'h11', label: 'Twintails',   value: 'v11' },
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
  { id: 'cheery',   label: '😊 Cheery',   value: 'cheery' },
  { id: 'curious',  label: '🤔 Curious',  value: 'curious' },
  { id: 'happy',    label: '😄 Happy',    value: 'happy' },
  { id: 'sleepy',   label: '😴 Sleepy',   value: 'sleepy' },
  { id: 'excited',  label: '🤩 Excited',  value: 'excited' },
  { id: 'calm',     label: '😌 Calm',     value: 'calm' },
  { id: 'wink',     label: '😉 Wink',     value: 'wink' },
  { id: 'heart',    label: '🥰 Heart',    value: 'heart' },
];

export const ACCESSORIES = [
  { id: 'none',      label: 'None',       value: '' },
  { id: 'glasses1',  label: '👓 Glasses', value: 'g1' },
  { id: 'glasses2',  label: '🕶️ Shades',  value: 'g2' },
  { id: 'glasses3',  label: '🤓 Nerd',    value: 'g3' },
  { id: 'glasses4',  label: '💎 Cat-eye', value: 'g4' },
  { id: 'glasses5',  label: '✨ Round',   value: 'g5' },
];

export const OUTFITS = [
  { id: 'o1',  label: '👕 Casual',     value: 'o1' },
  { id: 'o2',  label: '🎀 Cute',       value: 'o2' },
  { id: 'o3',  label: '🌸 Floral',     value: 'o3' },
  { id: 'o4',  label: '⭐ Sporty',     value: 'o4' },
  { id: 'o5',  label: '💼 Smart',      value: 'o5' },
  { id: 'o6',  label: '🎓 Academic',   value: 'o6' },
  { id: 'o7',  label: '🌙 Cozy',       value: 'o7' },
  { id: 'o8',  label: '🦋 Boho',       value: 'o8' },
];

// Build character avatar URL from custom options
// Returns a compact chr: base64 string
export const getCharacterAvatarUrl = (opts = {}) => {
  const {
    skinColor = 'f8d9c4',
    hairColor = '4a2c2c',
    hairStyle = 'v01',
    bgColor = 'ffb6c1',
    expression = 'cheery',
    glasses = '',
    outfit = 'o1',
    earrings = false,
  } = opts;

  const data = { skinColor, hairColor, hairStyle, bgColor, expression, glasses, outfit, earrings };
  return 'chr:' + btoa(JSON.stringify(data));
};

// Parse a chr: URL back into opts
export const parseCharacterUrl = (url) => {
  if (!url) return null;
  try {
    if (url.startsWith('chr:')) {
      const data = JSON.parse(atob(url.slice(4)));
      return {
        skinColor: data.skinColor || 'f8d9c4',
        hairColor: data.hairColor || '4a2c2c',
        hairStyle: data.hairStyle || 'v01',
        bgColor: data.bgColor || 'ffb6c1',
        expression: data.expression || 'cheery',
        glasses: data.glasses || '',
        outfit: data.outfit || 'o1',
        earrings: !!data.earrings,
      };
    }
    // Legacy lorelei URL support
    const u = new URL(url);
    if (!u.pathname.includes('lorelei')) return null;
    return {
      skinColor: u.searchParams.get('skinColor') || 'f8d9c4',
      hairColor: u.searchParams.get('hairColor') || '4a2c2c',
      hairStyle: 'v01',
      bgColor: u.searchParams.get('backgroundColor') || 'ffb6c1',
      expression: 'cheery',
      glasses: '',
      outfit: 'o1',
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
  if (url.startsWith('chr:')) return 'character';
  if (url.includes('lorelei')) return 'character';
  return 'sticker';
};

export default AVATARS;
