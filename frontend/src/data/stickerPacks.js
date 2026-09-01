import { PASTEL_BUNNY_PACK } from './pastelBunnyStickers';

const asset = (pack, name) => `/stickers/openmoji/${pack}/${name}.png`;
const pastelAsset = (name) => `/stickers/pastelchat/${name}.svg`;

const sticker = (pack, id, name, nameVi, tags, emotion, intent, tone, intensity = 2) => ({
  id: `${pack}-${id}`,
  pack,
  asset: asset(pack, id),
  assetType: 'png',
  label: name,
  labelVi: nameVi,
  tags: { en: tags, vi: tags },
  emotion,
  intent,
  context: tags,
  tone,
  actions: [],
  intensity,
  style: 'openmoji-local'
});

const pastelSticker = (id, name, nameVi, tags, emotion, intent, tone, intensity = 2) => ({
  ...sticker('greetings', id, name, nameVi, tags, emotion, intent, tone, intensity),
  asset: pastelAsset(id),
  assetType: 'svg',
  style: 'pastelchat-original'
});

export const LOCAL_STICKER_PACKS = [
  PASTEL_BUNNY_PACK,
  {
    id: 'greetings', name: 'Hello & Bye', nameVi: 'Chào & Tạm biệt', category: 'Greetings',
    cover: pastelAsset('greeting-wave'), source: 'PastelChat',
    stickers: [
      pastelSticker('greeting-cute', 'Cute hello', 'Chào dễ thương', ['hello', 'hi', 'hey', 'xin chào', 'chào', 'chào nha', 'hello nha', 'hi bro'], ['joy'], ['greeting'], ['warm', 'cute'], 3),
      pastelSticker('greeting-wave', 'Waving hello', 'Vẫy chào', ['hello', 'hi', 'hey', 'xin chào', 'chào', 'wave', 'hello nha', 'hi bro'], ['joy'], ['greeting'], ['warm', 'playful'], 3),
      pastelSticker('greeting-energetic', 'Energetic hello', 'Chào thật vui', ['hello', 'hi', 'hey', 'xin chào', 'chào', 'chào nha', 'hello bro'], ['joy'], ['greeting'], ['warm', 'bright', 'playful'], 4),
      pastelSticker('farewell-soft', 'Soft goodbye', 'Tạm biệt nhẹ nhàng', ['bye', 'bye bye', 'goodbye', 'good bye', 'tạm biệt', 'see you', 'see ya', 'bye nha'], ['calm'], ['farewell'], ['warm', 'tender'], 3),
      pastelSticker('farewell-wave', 'Waving goodbye', 'Vẫy tạm biệt', ['bye', 'bye bye', 'goodbye', 'good bye', 'tạm biệt', 'see you', 'see ya', 'bye nha', 'see you nha'], ['calm'], ['farewell'], ['warm', 'playful'], 3),
      pastelSticker('farewell-funny', 'Funny goodbye', 'Tạm biệt hài hước', ['bye', 'bye bye', 'goodbye', 'good bye', 'tạm biệt', 'see you', 'see ya', 'bye bye bro'], ['calm'], ['farewell'], ['warm', 'playful', 'funny'], 4)
    ]
  },
  {
    id: 'pastel', name: 'Pastel', nameVi: 'Pastel', category: 'Pastel',
    cover: asset('pastel', 'smiling-hearts'), source: 'OpenMoji',
    stickers: [
      sticker('pastel', 'grinning', 'Happy', 'Vui vẻ', ['happy', 'vui', 'smile', 'cười'], ['joy'], ['greeting', 'celebrate'], ['warm', 'playful']),
      sticker('pastel', 'smiling-hearts', 'Feeling loved', 'Được yêu', ['love', 'yêu', 'sweet', 'ngọt ngào'], ['love'], ['affection', 'support'], ['warm', 'tender']),
      sticker('pastel', 'party', 'Celebrate', 'Ăn mừng', ['party', 'celebrate', 'ăn mừng', 'chúc mừng'], ['joy'], ['celebrate'], ['excited', 'playful'], 3),
      sticker('pastel', 'sparkles', 'Sparkles', 'Lấp lánh', ['sparkle', 'magic', 'lấp lánh'], ['wonder'], ['encourage', 'celebrate'], ['bright', 'playful'])
    ]
  },
  {
    id: 'cute', name: 'Cute', nameVi: 'Dễ thương', category: 'Cute',
    cover: asset('cute', 'bear'), source: 'OpenMoji',
    stickers: [
      sticker('cute', 'joy', 'Laughing', 'Cười lớn', ['laugh', 'funny', 'cười', 'buồn cười'], ['joy'], ['react'], ['playful'], 3),
      sticker('cute', 'sunglasses', 'Cool', 'Ngầu', ['cool', 'ngầu', 'confident'], ['confidence'], ['react'], ['playful']),
      sticker('cute', 'kiss', 'Kiss', 'Gửi nụ hôn', ['kiss', 'hôn', 'love', 'yêu'], ['love'], ['affection'], ['tender', 'playful']),
      sticker('cute', 'bear', 'Bear hug', 'Ôm gấu', ['hug', 'ôm', 'cute', 'dễ thương'], ['comfort'], ['support', 'affection'], ['warm', 'tender'])
    ]
  },
  {
    id: 'love', name: 'Love', nameVi: 'Tình yêu', category: 'Love',
    cover: asset('love', 'heart-eyes'), source: 'OpenMoji',
    stickers: [
      sticker('love', 'heart-eyes', 'Heart eyes', 'Mắt tim', ['love', 'heart', 'yêu', 'tim'], ['love'], ['affection'], ['tender', 'playful'], 3),
      sticker('love', 'pleading', 'Please', 'Năn nỉ', ['please', 'năn nỉ', 'sorry', 'xin lỗi'], ['hope'], ['apologize', 'request'], ['tender']),
      sticker('love', 'rose', 'A rose for you', 'Tặng hoa', ['rose', 'flower', 'hoa', 'tặng'], ['love'], ['affection', 'thanks'], ['warm', 'tender'])
    ]
  },
  {
    id: 'reactions', name: 'Reactions', nameVi: 'Phản ứng', category: 'Reactions',
    cover: asset('reactions', 'thumbs-up'), source: 'OpenMoji',
    stickers: [
      sticker('reactions', 'thumbs-up', 'Yes', 'Đồng ý', ['yes', 'ok', 'agree', 'ừ', 'đồng ý'], ['approval'], ['confirm', 'react'], ['positive']),
      sticker('reactions', 'clap', 'Well done', 'Hay lắm', ['clap', 'great', 'giỏi', 'vỗ tay'], ['admiration'], ['praise', 'support'], ['warm', 'positive']),
      sticker('reactions', 'strong', 'You got this', 'Cố lên', ['strong', 'support', 'cố lên', 'mạnh mẽ'], ['encouragement'], ['support'], ['warm', 'positive'], 3),
      sticker('reactions', 'party-popper', 'Congrats', 'Chúc mừng', ['congrats', 'chúc mừng', 'celebrate'], ['joy'], ['celebrate'], ['excited', 'bright'], 3)
    ]
  },
  {
    id: 'funny', name: 'Funny / Meme', nameVi: 'Hài / Meme', category: 'Funny / Meme',
    cover: asset('funny', 'rofl'), source: 'OpenMoji',
    stickers: [
      sticker('funny', 'rofl', 'ROFL', 'Cười lăn', ['lol', 'lmao', 'funny', 'cười lăn'], ['joy'], ['react'], ['playful', 'intense'], 4),
      sticker('funny', 'exploding-head', 'Mind blown', 'Vỡ não', ['omg', 'wow', 'mind blown', 'vỡ não'], ['surprise'], ['react'], ['dramatic', 'playful'], 4),
      sticker('funny', 'cooked', 'I am cooked', 'Toang rồi', ['cooked', 'toang', 'fail', 'hỏng rồi'], ['panic'], ['commiserate', 'react'], ['dramatic', 'playful'], 4),
      sticker('funny', 'thinking', 'Thinking', 'Đang nghĩ', ['think', 'thinking', 'suy nghĩ', 'hmm'], ['curiosity'], ['react'], ['calm', 'playful'])
    ]
  },
  {
    id: 'animals', name: 'Animals', nameVi: 'Động vật', category: 'Animals',
    cover: asset('animals', 'cat'), source: 'OpenMoji',
    stickers: [
      sticker('animals', 'cat', 'Cute cat', 'Mèo dễ thương', ['cat', 'cute', 'mèo', 'dễ thương'], ['affection'], ['affection', 'react'], ['warm', 'playful']),
      sticker('animals', 'dog', 'Good dog', 'Cún ngoan', ['dog', 'cute', 'chó', 'cún'], ['joy'], ['greeting', 'affection'], ['warm', 'playful']),
      sticker('animals', 'fox', 'Clever fox', 'Cáo thông minh', ['fox', 'smart', 'cáo'], ['confidence'], ['react'], ['playful']),
      sticker('animals', 'panda', 'Panda hug', 'Gấu trúc', ['panda', 'bear', 'gấu trúc', 'cute'], ['comfort'], ['support', 'affection'], ['warm', 'tender'])
    ]
  }
];

export const LOCAL_STICKERS = LOCAL_STICKER_PACKS.flatMap(pack => pack.stickers);
