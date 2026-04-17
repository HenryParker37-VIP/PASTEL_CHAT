// 50 DiceBear "fun-emoji" sticker avatars
// Uses pastel background colors matching PastelChat palette
const BG = 'ffb6c1,add8e6,dda0dd,ffe4e1,fff8f3,ffd1dc,b0e0e6,e6e6fa';

const SEEDS = [
  'Peach', 'Mochi', 'Bubbles', 'Honey', 'Muffin', 'Pudding', 'Cookie', 'Sprinkle',
  'Cupcake', 'Jelly', 'Taffy', 'Marshmallow', 'Bunny', 'Kitten', 'Puppy', 'Panda',
  'Koala', 'Duckling', 'Chick', 'Bear', 'Fox', 'Deer', 'Lamb', 'Hamster',
  'Cherry', 'Strawberry', 'Lemon', 'Lime', 'Blueberry', 'Raspberry', 'Mango', 'Melon',
  'Cloud', 'Star', 'Moon', 'Sun', 'Rainbow', 'Heart', 'Sparkle', 'Fairy',
  'Angel', 'Candy', 'Lollipop', 'Donut', 'Macaron', 'Tofu', 'Dango', 'Pocky',
  'Sakura', 'Petal'
];

export const AVATARS = SEEDS.map((seed) => ({
  id: seed.toLowerCase(),
  seed,
  url: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${BG}&radius=50`
}));

export const getAvatarUrl = (seed) =>
  `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(seed || 'Peach')}&backgroundColor=${BG}&radius=50`;

export default AVATARS;
