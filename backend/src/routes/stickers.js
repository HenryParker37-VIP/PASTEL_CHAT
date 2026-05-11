const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { findUserById, store, persist, genId } = require('../db/store');

// ── In-memory sticker data (no MongoDB needed) ────────────────────────────────
const SEED_PACKS = [
  {
    slug: 'love-hearts', name: 'Love & Hearts', nameVi: 'Tình Yêu & Trái Tim',
    description: 'Express your love with hearts and romantic stickers',
    cover: '💕', tags: ['love', 'hearts'], order: 1,
    stickers: [
      { emoji: '❤️', label: 'red heart', labelVi: 'trái tim đỏ' },
      { emoji: '💕', label: 'two hearts', labelVi: 'hai trái tim' },
      { emoji: '💖', label: 'sparkling heart', labelVi: 'tim lấp lánh' },
      { emoji: '💗', label: 'growing heart', labelVi: 'tim đập' },
      { emoji: '💓', label: 'beating heart', labelVi: 'tim rung' },
      { emoji: '💞', label: 'revolving hearts', labelVi: 'tim xoay' },
      { emoji: '💘', label: 'heart with arrow', labelVi: 'tim trúng tên' },
      { emoji: '💝', label: 'heart with ribbon', labelVi: 'tim có nơ' },
      { emoji: '🥰', label: 'smiling with hearts', labelVi: 'mặt cười có tim' },
      { emoji: '😍', label: 'heart eyes', labelVi: 'mắt tim' },
      { emoji: '😘', label: 'face blowing kiss', labelVi: 'mặt thổi hôn' },
      { emoji: '💋', label: 'kiss mark', labelVi: 'dấu hôn' },
      { emoji: '💌', label: 'love letter', labelVi: 'thư tình' },
      { emoji: '🫶', label: 'heart hands', labelVi: 'tay tim' },
      { emoji: '❣️', label: 'heart exclamation', labelVi: 'tim chấm than' },
      { emoji: '💟', label: 'heart decoration', labelVi: 'tim trang trí' },
      { emoji: '🩷', label: 'pink heart', labelVi: 'tim hồng' },
      { emoji: '🧡', label: 'orange heart', labelVi: 'tim cam' },
      { emoji: '💛', label: 'yellow heart', labelVi: 'tim vàng' },
      { emoji: '💜', label: 'purple heart', labelVi: 'tim tím' },
    ],
  },
  {
    slug: 'happy-vibes', name: 'Happy Vibes', nameVi: 'Vui Vẻ Phấn Khởi',
    description: 'Spread joy and happiness!',
    cover: '😄', tags: ['happy', 'joy'], order: 2,
    stickers: [
      { emoji: '😀', label: 'grinning', labelVi: 'cười toe' },
      { emoji: '😃', label: 'big smile', labelVi: 'cười lớn' },
      { emoji: '😄', label: 'grinning eyes', labelVi: 'cười híp mắt' },
      { emoji: '😁', label: 'beaming', labelVi: 'cười rộng' },
      { emoji: '🥳', label: 'partying', labelVi: 'ăn mừng' },
      { emoji: '🎉', label: 'party popper', labelVi: 'pháo nổ' },
      { emoji: '🎊', label: 'confetti', labelVi: 'giấy rực rỡ' },
      { emoji: '✨', label: 'sparkles', labelVi: 'lấp lánh' },
      { emoji: '🌟', label: 'glowing star', labelVi: 'sao sáng' },
      { emoji: '😊', label: 'smiling', labelVi: 'mỉm cười' },
      { emoji: '😉', label: 'winking', labelVi: 'nháy mắt' },
      { emoji: '🤗', label: 'hugging', labelVi: 'ôm ấp' },
      { emoji: '😆', label: 'laughing', labelVi: 'cười lăn' },
      { emoji: '🤩', label: 'star-struck', labelVi: 'sao mắt' },
      { emoji: '😎', label: 'cool sunglasses', labelVi: 'ngầu kính' },
      { emoji: '🙌', label: 'raising hands', labelVi: 'giơ tay' },
      { emoji: '👏', label: 'clapping', labelVi: 'vỗ tay' },
      { emoji: '🥰', label: 'feeling loved', labelVi: 'được yêu' },
      { emoji: '🎈', label: 'balloon', labelVi: 'bong bóng' },
      { emoji: '🌈', label: 'rainbow', labelVi: 'cầu vồng' },
    ],
  },
  {
    slug: 'cute-animals', name: 'Cute Animals', nameVi: 'Thú Cưng Dễ Thương',
    description: 'Adorable animals for every mood',
    cover: '🐱', tags: ['animals', 'cute', 'pets'], order: 3,
    stickers: [
      { emoji: '🐱', label: 'cat face', labelVi: 'mặt mèo' },
      { emoji: '🐶', label: 'dog face', labelVi: 'mặt chó' },
      { emoji: '🐰', label: 'rabbit face', labelVi: 'mặt thỏ' },
      { emoji: '🐹', label: 'hamster', labelVi: 'chuột hamster' },
      { emoji: '🐻', label: 'bear', labelVi: 'gấu' },
      { emoji: '🐼', label: 'panda', labelVi: 'gấu trúc' },
      { emoji: '🐨', label: 'koala', labelVi: 'gấu túi' },
      { emoji: '🦊', label: 'fox', labelVi: 'cáo' },
      { emoji: '🐸', label: 'frog', labelVi: 'ếch' },
      { emoji: '🐧', label: 'penguin', labelVi: 'chim cánh cụt' },
      { emoji: '🦋', label: 'butterfly', labelVi: 'bướm' },
      { emoji: '🦄', label: 'unicorn', labelVi: 'kỳ lân' },
      { emoji: '🐙', label: 'octopus', labelVi: 'bạch tuộc' },
      { emoji: '🦭', label: 'seal', labelVi: 'hải cẩu' },
      { emoji: '🦝', label: 'raccoon', labelVi: 'gấu mèo' },
      { emoji: '🦔', label: 'hedgehog', labelVi: 'nhím' },
      { emoji: '🐮', label: 'cow face', labelVi: 'mặt bò' },
      { emoji: '🐯', label: 'tiger face', labelVi: 'mặt hổ' },
      { emoji: '🦁', label: 'lion', labelVi: 'sư tử' },
      { emoji: '🐨', label: 'koala', labelVi: 'gấu koala' },
    ],
  },
  {
    slug: 'food-sweets', name: 'Food & Sweets', nameVi: 'Đồ Ăn & Bánh Ngọt',
    description: 'Yummy food stickers for foodies',
    cover: '🍰', tags: ['food', 'sweets', 'yummy'], order: 4,
    stickers: [
      { emoji: '🍰', label: 'shortcake', labelVi: 'bánh kem' },
      { emoji: '🧁', label: 'cupcake', labelVi: 'bánh muffin' },
      { emoji: '🎂', label: 'birthday cake', labelVi: 'bánh sinh nhật' },
      { emoji: '🍩', label: 'donut', labelVi: 'bánh donut' },
      { emoji: '🍪', label: 'cookie', labelVi: 'bánh quy' },
      { emoji: '🍫', label: 'chocolate', labelVi: 'socola' },
      { emoji: '🍭', label: 'lollipop', labelVi: 'kẹo mút' },
      { emoji: '🍬', label: 'candy', labelVi: 'kẹo' },
      { emoji: '🧋', label: 'bubble tea', labelVi: 'trà sữa' },
      { emoji: '🍡', label: 'dango', labelVi: 'bánh dango' },
      { emoji: '🍓', label: 'strawberry', labelVi: 'dâu tây' },
      { emoji: '🍑', label: 'peach', labelVi: 'đào' },
      { emoji: '🍒', label: 'cherries', labelVi: 'anh đào' },
      { emoji: '🫐', label: 'blueberries', labelVi: 'việt quất' },
      { emoji: '🥐', label: 'croissant', labelVi: 'bánh sừng bò' },
      { emoji: '🍜', label: 'noodles', labelVi: 'mỳ ramen' },
      { emoji: '🍣', label: 'sushi', labelVi: 'sushi' },
      { emoji: '🍕', label: 'pizza', labelVi: 'pizza' },
      { emoji: '🧋', label: 'cup with straw', labelVi: 'trà sữa trân châu' },
      { emoji: '☕', label: 'coffee', labelVi: 'cà phê' },
    ],
  },
  {
    slug: 'nature-vibes', name: 'Nature & Flowers', nameVi: 'Thiên Nhiên & Hoa',
    description: 'Beautiful nature and floral stickers',
    cover: '🌸', tags: ['nature', 'flowers'], order: 5,
    stickers: [
      { emoji: '🌸', label: 'cherry blossom', labelVi: 'hoa anh đào' },
      { emoji: '🌺', label: 'hibiscus', labelVi: 'hoa dâm bụt' },
      { emoji: '🌻', label: 'sunflower', labelVi: 'hướng dương' },
      { emoji: '🌹', label: 'rose', labelVi: 'hoa hồng' },
      { emoji: '🌷', label: 'tulip', labelVi: 'hoa tulip' },
      { emoji: '🌼', label: 'blossom', labelVi: 'hoa nở' },
      { emoji: '💐', label: 'bouquet', labelVi: 'bó hoa' },
      { emoji: '🌿', label: 'herb', labelVi: 'cây thảo mộc' },
      { emoji: '🍀', label: 'four leaf clover', labelVi: 'cỏ bốn lá' },
      { emoji: '🌱', label: 'seedling', labelVi: 'cây non' },
      { emoji: '🌙', label: 'crescent moon', labelVi: 'trăng lưỡi liềm' },
      { emoji: '☀️', label: 'sun', labelVi: 'mặt trời' },
      { emoji: '🌊', label: 'wave', labelVi: 'sóng biển' },
      { emoji: '🌈', label: 'rainbow', labelVi: 'cầu vồng' },
      { emoji: '⛅', label: 'partly cloudy', labelVi: 'mây một phần' },
      { emoji: '🪷', label: 'lotus', labelVi: 'hoa sen' },
      { emoji: '🌴', label: 'palm tree', labelVi: 'cây dừa' },
      { emoji: '🍁', label: 'maple leaf', labelVi: 'lá phong' },
      { emoji: '🌾', label: 'wheat', labelVi: 'lúa mỳ' },
      { emoji: '🍃', label: 'leaves', labelVi: 'lá cây' },
    ],
  },
  {
    slug: 'party-time', name: 'Party Time!', nameVi: 'Tiệc Tùng Vui Vẻ',
    description: 'Celebrate every occasion',
    cover: '🎉', tags: ['party', 'celebrate', 'birthday'], order: 6,
    stickers: [
      { emoji: '🎉', label: 'party popper', labelVi: 'pháo nổ' },
      { emoji: '🎊', label: 'confetti ball', labelVi: 'pháo hoa' },
      { emoji: '🎈', label: 'balloon', labelVi: 'bong bóng' },
      { emoji: '🎁', label: 'gift', labelVi: 'quà tặng' },
      { emoji: '🎀', label: 'ribbon', labelVi: 'nơ' },
      { emoji: '🥂', label: 'clinking glasses', labelVi: 'cụng ly' },
      { emoji: '🍾', label: 'champagne', labelVi: 'rượu sâm panh' },
      { emoji: '🎆', label: 'fireworks', labelVi: 'pháo hoa' },
      { emoji: '🎇', label: 'sparkler', labelVi: 'pháo hoa cầm tay' },
      { emoji: '🥳', label: 'partying face', labelVi: 'mặt ăn mừng' },
      { emoji: '🏆', label: 'trophy', labelVi: 'cúp' },
      { emoji: '🎯', label: 'bullseye', labelVi: 'bia bắn' },
      { emoji: '🎵', label: 'music note', labelVi: 'nốt nhạc' },
      { emoji: '🎶', label: 'music notes', labelVi: 'nốt nhạc đôi' },
      { emoji: '🎸', label: 'guitar', labelVi: 'đàn guitar' },
      { emoji: '🎹', label: 'piano', labelVi: 'đàn piano' },
      { emoji: '🎤', label: 'microphone', labelVi: 'microphone' },
      { emoji: '🕺', label: 'man dancing', labelVi: 'nhảy nhót' },
      { emoji: '💃', label: 'woman dancing', labelVi: 'nhảy múa' },
      { emoji: '🌟', label: 'glowing star', labelVi: 'sao tỏa sáng' },
    ],
  },
  {
    slug: 'all-the-feels', name: 'All the Feels', nameVi: 'Đủ Cảm Xúc',
    description: 'Express every emotion',
    cover: '😭', tags: ['emotions', 'moods'], order: 7,
    stickers: [
      { emoji: '😭', label: 'loudly crying', labelVi: 'khóc nức nở' },
      { emoji: '😢', label: 'crying', labelVi: 'khóc' },
      { emoji: '🥺', label: 'pleading', labelVi: 'năn nỉ' },
      { emoji: '😬', label: 'grimacing', labelVi: 'nhăn mặt' },
      { emoji: '😤', label: 'huffing', labelVi: 'thở tức giận' },
      { emoji: '😡', label: 'enraged', labelVi: 'tức giận' },
      { emoji: '🤯', label: 'exploding head', labelVi: 'vỡ não' },
      { emoji: '😱', label: 'screaming fear', labelVi: 'la hét sợ hãi' },
      { emoji: '😰', label: 'anxious', labelVi: 'lo lắng' },
      { emoji: '😓', label: 'downcast sweat', labelVi: 'buồn mồ hôi' },
      { emoji: '🤔', label: 'thinking', labelVi: 'suy nghĩ' },
      { emoji: '🤷', label: 'shrugging', labelVi: 'nhún vai' },
      { emoji: '🤦', label: 'facepalm', labelVi: 'bịt mặt' },
      { emoji: '🙄', label: 'eye roll', labelVi: 'trợn mắt' },
      { emoji: '😴', label: 'sleeping', labelVi: 'ngủ' },
      { emoji: '🥱', label: 'yawning', labelVi: 'ngáp' },
      { emoji: '😶', label: 'no mouth', labelVi: 'không miệng' },
      { emoji: '🤐', label: 'zipper mouth', labelVi: 'khóa miệng' },
      { emoji: '😏', label: 'smirking', labelVi: 'cười khẩy' },
      { emoji: '😌', label: 'relieved', labelVi: 'nhẹ nhõm' },
    ],
  },
  {
    slug: 'magic-sparkle', name: 'Magic & Sparkle', nameVi: 'Phép Thuật & Lấp Lánh',
    description: 'Magical and mystical vibes',
    cover: '✨', tags: ['magic', 'sparkle', 'fantasy'], order: 8,
    stickers: [
      { emoji: '✨', label: 'sparkles', labelVi: 'lấp lánh' },
      { emoji: '💫', label: 'dizzy', labelVi: 'chóng mặt' },
      { emoji: '⭐', label: 'star', labelVi: 'ngôi sao' },
      { emoji: '🌟', label: 'glowing star', labelVi: 'sao sáng' },
      { emoji: '🔮', label: 'crystal ball', labelVi: 'cầu pha lê' },
      { emoji: '🪄', label: 'magic wand', labelVi: 'đũa phép' },
      { emoji: '🌙', label: 'crescent moon', labelVi: 'trăng lưỡi liềm' },
      { emoji: '💎', label: 'gem stone', labelVi: 'đá quý' },
      { emoji: '👑', label: 'crown', labelVi: 'vương miện' },
      { emoji: '🦄', label: 'unicorn', labelVi: 'kỳ lân' },
      { emoji: '🧚', label: 'fairy', labelVi: 'tiên' },
      { emoji: '🧜', label: 'merperson', labelVi: 'người cá' },
      { emoji: '🧝', label: 'elf', labelVi: 'yêu tinh' },
      { emoji: '🪐', label: 'ringed planet', labelVi: 'sao thổ' },
      { emoji: '🌌', label: 'milky way', labelVi: 'dải ngân hà' },
      { emoji: '💠', label: 'diamond shape', labelVi: 'hình kim cương' },
      { emoji: '🫧', label: 'bubbles', labelVi: 'bong bóng' },
      { emoji: '🌀', label: 'cyclone', labelVi: 'xoáy' },
      { emoji: '🎆', label: 'fireworks', labelVi: 'pháo hoa' },
      { emoji: '🌈', label: 'rainbow', labelVi: 'cầu vồng' },
    ],
  },
  {
    slug: 'vietnam-meme', name: 'Vietnam Meme 🇻🇳', nameVi: 'Meme Việt Nam',
    description: 'Stickers for Vietnamese internet culture',
    cover: '😂', tags: ['vietnam', 'meme', 'funny'], order: 9,
    stickers: [
      { emoji: '😂', label: 'laughing so hard', labelVi: 'cười vỡ bụng' },
      { emoji: '🤣', label: 'rolling on floor', labelVi: 'cười lăn ra' },
      { emoji: '💀', label: 'dead (so funny)', labelVi: 'chết cười' },
      { emoji: '😭', label: 'crying deadlines', labelVi: 'deadline kề' },
      { emoji: '😤', label: 'boss calling', labelVi: 'sếp gọi lúc nghỉ' },
      { emoji: '💸', label: 'money gone', labelVi: 'tiền bay' },
      { emoji: '🥲', label: 'smiling but crying', labelVi: 'cười ra nước mắt' },
      { emoji: '😵', label: 'dizzy from work', labelVi: 'choáng vì công việc' },
      { emoji: '🙃', label: 'upside down smile', labelVi: 'cười ngược' },
      { emoji: '👀', label: 'side eye', labelVi: 'liếc mắt' },
      { emoji: '🤡', label: 'clown vibes', labelVi: 'hề vía' },
      { emoji: '🫠', label: 'melting away', labelVi: 'tan chảy' },
      { emoji: '🥵', label: 'overheating', labelVi: 'nóng quá' },
      { emoji: '🫣', label: 'peeking', labelVi: 'nhìn trộm' },
      { emoji: '🤌', label: 'chef kiss', labelVi: 'tuyệt vời' },
      { emoji: '💅', label: 'sassy nails', labelVi: 'sành điệu' },
      { emoji: '🫡', label: 'saluting', labelVi: 'chào sếp' },
      { emoji: '🫶', label: 'heart hands', labelVi: 'tay tim' },
      { emoji: '🔥', label: 'on fire', labelVi: 'bốc lửa' },
      { emoji: '💯', label: 'hundred points', labelVi: 'trăm điểm' },
    ],
  },
  {
    slug: 'greetings', name: 'Greetings & Reactions', nameVi: 'Lời Chào & Phản Ứng',
    description: 'Say hi, bye, thanks and more',
    cover: '👋', tags: ['greetings', 'reactions'], order: 10,
    stickers: [
      { emoji: '👋', label: 'waving hi', labelVi: 'chào' },
      { emoji: '🙏', label: 'folded hands thanks', labelVi: 'cảm ơn' },
      { emoji: '👍', label: 'thumbs up', labelVi: 'đồng ý' },
      { emoji: '👎', label: 'thumbs down', labelVi: 'không đồng ý' },
      { emoji: '🤝', label: 'handshake', labelVi: 'bắt tay' },
      { emoji: '🫂', label: 'people hugging', labelVi: 'ôm nhau' },
      { emoji: '💪', label: 'flexed bicep', labelVi: 'cơ bắp' },
      { emoji: '🤞', label: 'fingers crossed', labelVi: 'may mắn nha' },
      { emoji: '✌️', label: 'victory hand', labelVi: 'chiến thắng' },
      { emoji: '🤙', label: 'call me', labelVi: 'gọi cho tao' },
      { emoji: '👌', label: 'ok hand', labelVi: 'ổn' },
      { emoji: '👏', label: 'clapping', labelVi: 'vỗ tay' },
      { emoji: '🙌', label: 'raising hands', labelVi: 'giơ tay' },
      { emoji: '🫵', label: 'pointing at you', labelVi: 'chỉ vào bạn' },
      { emoji: '💋', label: 'kiss goodbye', labelVi: 'hôn chào' },
      { emoji: '😴', label: 'good night', labelVi: 'ngủ ngon' },
      { emoji: '🌅', label: 'good morning', labelVi: 'chào buổi sáng' },
      { emoji: '🫶', label: 'heart hands', labelVi: 'tay tim' },
      { emoji: '🥰', label: 'sending love', labelVi: 'gửi tình yêu' },
      { emoji: '😊', label: 'warm smile', labelVi: 'mỉm cười thân thiện' },
    ],
  },
];

// Build pack lookup maps at startup
const PACKS_BY_SLUG = {};
SEED_PACKS.forEach(p => { PACKS_BY_SLUG[p.slug] = p; });

// ── Ensure store has sticker fields ──────────────────────────────────────────
if (!store.userStickerPacks) {
  store.userStickerPacks = []; // [{ userId, packSlug, addedAt }]
  persist();
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'pastel-chat-secret';

function getUser(req) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    return findUserById(decoded.userId || decoded.id);
  } catch { return null; }
}

function requireUser(req, res) {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  return user;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /stickers/packs
router.get('/packs', (req, res) => {
  const user = getUser(req);
  const addedSlugs = new Set(
    user ? store.userStickerPacks.filter(u => u.userId === user._id).map(u => u.packSlug) : []
  );

  const packs = SEED_PACKS.map(p => ({
    id: p.slug,
    slug: p.slug,
    name: p.name,
    nameVi: p.nameVi,
    description: p.description,
    cover: p.cover,
    tags: p.tags,
    isPremium: false,
    isAdded: addedSlugs.has(p.slug),
    stickerCount: p.stickers.length,
  }));

  res.json({ packs });
});

// GET /stickers/packs/:packSlug
router.get('/packs/:packSlug', (req, res) => {
  const pack = PACKS_BY_SLUG[req.params.packSlug];
  if (!pack) return res.status(404).json({ error: 'Pack not found' });

  const user = getUser(req);
  const isAdded = user
    ? store.userStickerPacks.some(u => u.userId === user._id && u.packSlug === pack.slug)
    : false;

  res.json({
    id: pack.slug,
    slug: pack.slug,
    name: pack.name,
    nameVi: pack.nameVi,
    description: pack.description,
    cover: pack.cover,
    tags: pack.tags,
    isPremium: false,
    isAdded,
    stickers: pack.stickers.map((s, i) => ({ id: `${pack.slug}_${i}`, ...s })),
  });
});

// POST /stickers/packs/:packSlug/add
router.post('/packs/:packSlug/add', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const pack = PACKS_BY_SLUG[req.params.packSlug];
  if (!pack) return res.status(404).json({ error: 'Pack not found' });

  const already = store.userStickerPacks.find(u => u.userId === user._id && u.packSlug === pack.slug);
  if (!already) {
    store.userStickerPacks.push({ userId: user._id, packSlug: pack.slug, addedAt: new Date().toISOString() });
    persist();
  }

  res.json({ success: true });
});

// DELETE /stickers/packs/:packSlug/remove
router.delete('/packs/:packSlug/remove', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  store.userStickerPacks = store.userStickerPacks.filter(
    u => !(u.userId === user._id && u.packSlug === req.params.packSlug)
  );
  persist();

  res.json({ success: true });
});

// GET /stickers/my-packs  (packs user added + their stickers, for chat picker)
router.get('/my-packs', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  let userEntries = store.userStickerPacks.filter(u => u.userId === user._id);

  // Auto-add first 3 packs for brand-new users
  if (userEntries.length === 0) {
    const defaults = SEED_PACKS.slice(0, 3);
    defaults.forEach(p => {
      store.userStickerPacks.push({ userId: user._id, packSlug: p.slug, addedAt: new Date().toISOString() });
    });
    persist();
    userEntries = store.userStickerPacks.filter(u => u.userId === user._id);
  }

  // Sort by addedAt desc (most recently added first)
  userEntries.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

  const packs = userEntries
    .map(entry => {
      const pack = PACKS_BY_SLUG[entry.packSlug];
      if (!pack) return null;
      return {
        id: pack.slug,
        slug: pack.slug,
        name: pack.name,
        nameVi: pack.nameVi,
        cover: pack.cover,
        stickers: pack.stickers.map((s, i) => ({ id: `${pack.slug}_${i}`, ...s })),
      };
    })
    .filter(Boolean);

  res.json({ packs });
});

module.exports = router;
