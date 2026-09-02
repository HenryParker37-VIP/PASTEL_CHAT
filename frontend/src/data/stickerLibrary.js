import { PASTEL_BUNNY_PACK } from './pastelBunnyStickers';
import { PASTEL_BUNNY_EXPANSION_STICKERS } from './pastelBunnyExpansionStickers';
import { LEGACY_STICKER_PACKS } from './stickerPacks';

export const STICKER_CATEGORIES = [
  'Love', 'Happy', 'Laugh', 'Cute', 'Sad', 'Cry', 'Angry', 'Annoyed',
  'Shocked', 'Confused', 'Shy', 'Embarrassed', 'Sorry', 'Thank You', 'Hug',
  'Miss You', 'Sleep', 'Tired', 'Good Morning', 'Good Night', 'Study', 'Work',
  'Celebrate', 'Clap', 'Wow', 'OMG', 'LOL', 'Support', 'Comfort', 'Motivation',
  'Food', 'Busy', 'Waiting', 'Okay', 'No', 'Yes', 'Hello', 'Bye', 'Thinking',
  'Bored', 'Sick', 'Gaming', 'Music', 'Heartbreak', 'Friendship', 'Birthday',
  'Special Moments', 'Jealous', 'Nervous', 'Proud', 'Excited', 'Awkward',
  'Facepalm', 'Please', 'Begging', 'Hungry', 'Coffee', 'Rainy Day', 'Cozy',
  'Working Late', 'Finished', 'Panic', 'Chill', 'Flirty', 'Good Luck'
].map(label => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label, labelVi: label }));

const characters = [
  ['mochi-bear', 'Mochi Bear', 'Gấu Mochi', 'bear', '#F6D2C4', '#8F6870'],
  ['cloud-cat', 'Cloud Cat', 'Mèo Mây', 'cat', '#DCEBFA', '#697FA3'],
  ['pudding-puppy', 'Pudding Puppy', 'Cún Pudding', 'dog', '#F9E6AD', '#927857'],
  ['peach-fox', 'Peach Fox', 'Cáo Đào', 'fox', '#F6C3AA', '#9A6E62'],
  ['mint-dino', 'Mint Dino', 'Khủng Long Bạc Hà', 'dino', '#BFE9D7', '#5A8C79'],
  ['lilac-otter', 'Lilac Otter', 'Rái Cá Tím', 'otter', '#D8C8EE', '#76668D'],
  ['baby-seal', 'Baby Seal', 'Hải Cẩu Bé', 'seal', '#C8E5EC', '#5E8490'],
  ['sleepy-duck', 'Sleepy Duck', 'Vịt Buồn Ngủ', 'duck', '#F7E7A8', '#9B8556'],
  ['star-hamster', 'Star Hamster', 'Hamster Sao', 'hamster', '#F3D2E7', '#956681'],
  ['jelly-blob', 'Jelly Blob', 'Jelly Nhún Nhảy', 'blob', '#F6C6D9', '#A35F7D'],
  ['pastel-ghost', 'Pastel Ghost', 'Ma Pastel', 'ghost', '#E7DDF7', '#75658D'],
  ['tiny-axolotl', 'Tiny Axolotl', 'Axolotl Nhỏ', 'axolotl', '#F5B9C9', '#A55E77'],
  ['bubble-penguin', 'Bubble Penguin', 'Cánh Cụt Bong Bóng', 'penguin', '#C7DDF0', '#607895'],
  ['moon-kitty', 'Moon Kitty', 'Mèo Mặt Trăng', 'cat', '#D6D3F3', '#6A6595'],
  ['soft-capybara', 'Soft Capybara', 'Capybara Mềm', 'capybara', '#E4D0B8', '#866B56'],
  ['berry-panda', 'Berry Panda', 'Gấu Trúc Berry', 'panda', '#F1C5D0', '#80616D'],
  ['cotton-lamb', 'Cotton Lamb', 'Cừu Bông', 'lamb', '#F8EEE5', '#A38B84'],
  ['mini-dragon', 'Mini Dragon', 'Rồng Nhỏ', 'dragon', '#C6E5D5', '#5A816C'],
  ['pastel-chick', 'Pastel Chick', 'Gà Con Pastel', 'chick', '#F8E2A3', '#9A8150'],
  ['peachy-frog', 'Peachy Frog', 'Ếch Đào', 'frog', '#CBE6B8', '#66835D'],
  ['tiny-raccoon', 'Tiny Raccoon', 'Gấu Mèo Nhỏ', 'raccoon', '#D5D5E5', '#6C6C80'],
  ['marshmallow-sheep', 'Marshmallow Sheep', 'Cừu Kẹo Bông', 'lamb', '#F4D9E7', '#936C81'],
  ['bubble-koala', 'Bubble Koala', 'Koala Bong Bóng', 'koala', '#D5E1E0', '#698080'],
  ['starry-mouse', 'Starry Mouse', 'Chuột Sao', 'mouse', '#E5D6F2', '#79688B'],
  ['mini-red-panda', 'Mini Red Panda', 'Gấu Trúc Đỏ Nhỏ', 'panda', '#F1C2AE', '#98695B'],
  ['pastel-whale', 'Pastel Whale', 'Cá Voi Pastel', 'whale', '#BEDDEA', '#5E8090'],
  ['cotton-bunny-friend', 'Cotton Bunny Friend', 'Bạn Thỏ Bông', 'bunny', '#F6D3E4', '#96687C'],
  ['jelly-octopus', 'Jelly Octopus', 'Bạch Tuộc Jelly', 'octopus', '#D9C7EF', '#7D6699'],
  ['dreamy-bat', 'Dreamy Bat', 'Dơi Mơ Mộng', 'bat', '#CFC8E8', '#696180'],
  ['baby-alpaca', 'Baby Alpaca', 'Alpaca Bé', 'alpaca', '#E8D7C1', '#8B725C']
].map(([id, name, nameVi, shape, fill, ink]) => ({ id, name, nameVi, shape, fill, ink }));

export const STICKER_CHARACTERS = characters;

const concepts = [
  ['hello', 'Hello', 'Xin chào', ['Hello', 'Good Morning'], ['hello', 'hi', 'hey', 'xin chào', 'chào'], 'joy'],
  ['bye', 'Bye for now', 'Tạm biệt nha', ['Bye'], ['bye', 'goodbye', 'see you', 'tạm biệt'], 'calm'],
  ['love', 'Sending love', 'Gửi yêu thương', ['Love', 'Friendship'], ['love', 'yêu', 'thương', 'iu'], 'love'],
  ['hug', 'Big hug', 'Ôm một cái', ['Hug', 'Comfort'], ['hug', 'ôm', 'an ủi'], 'comfort'],
  ['laugh', 'Crying laughing', 'Cười xỉu', ['Laugh', 'LOL'], ['lol', 'haha', 'funny', 'cười'], 'joy'],
  ['happy', 'So happy', 'Vui quá', ['Happy', 'Excited'], ['happy', 'vui', 'yay'], 'joy'],
  ['sad', 'A little sad', 'Hơi buồn', ['Sad', 'Heartbreak'], ['sad', 'buồn', 'bùn'], 'sadness'],
  ['cry', 'Need a tissue', 'Cho xin khăn giấy', ['Cry', 'Comfort'], ['cry', 'crying', 'khóc'], 'sadness'],
  ['angry', 'Tiny angry', 'Tức xíu thôi', ['Angry', 'Annoyed'], ['angry', 'mad', 'tức', 'bực'], 'anger'],
  ['shock', 'No way!', 'Trời ơi!', ['Shocked', 'OMG', 'Wow'], ['omg', 'wow', 'shocked', 'trời ơi'], 'surprise'],
  ['confused', 'Hmm…', 'Hmmm…', ['Confused', 'Thinking'], ['confused', 'hmm', 'suy nghĩ'], 'curiosity'],
  ['shy', 'Shy hello', 'Ngại quá', ['Shy', 'Embarrassed'], ['shy', 'ngại', 'xấu hổ'], 'shy'],
  ['sorry', 'Sorry nha', 'Xin lỗi nha', ['Sorry', 'Please', 'Begging'], ['sorry', 'xin lỗi', 'please', 'năn nỉ'], 'hope'],
  ['thanks', 'Thank you', 'Cảm ơn nha', ['Thank You', 'Friendship'], ['thanks', 'thank you', 'cảm ơn'], 'gratitude'],
  ['sleep', 'Good night', 'Ngủ ngon', ['Sleep', 'Good Night', 'Cozy'], ['sleep', 'good night', 'ngủ ngon'], 'calm'],
  ['tired', 'Running on empty', 'Mệt xỉu', ['Tired', 'Working Late'], ['tired', 'mệt', 'deadline'], 'tired'],
  ['study', 'You got this', 'Cố lên học nhé', ['Study', 'Motivation', 'Good Luck'], ['study', 'exam', 'cố lên', 'may mắn'], 'support'],
  ['work', 'Busy but cute', 'Đang bận nha', ['Work', 'Busy'], ['work', 'busy', 'đang làm'], 'effort'],
  ['celebrate', 'Let’s celebrate', 'Ăn mừng thôi', ['Celebrate', 'Birthday', 'Special Moments'], ['celebrate', 'congrats', 'chúc mừng'], 'celebrate'],
  ['clap', 'Well done!', 'Giỏi quá!', ['Clap', 'Proud', 'Support'], ['clap', 'great', 'giỏi', 'vỗ tay'], 'admiration'],
  ['food', 'Snack time', 'Đến giờ ăn rồi', ['Food', 'Hungry'], ['food', 'hungry', 'đói', 'đi ăn'], 'joy'],
  ['coffee', 'Coffee break', 'Nghỉ uống cà phê', ['Coffee', 'Chill'], ['coffee', 'cà phê', 'nghỉ'], 'calm'],
  ['waiting', 'Still waiting', 'Vẫn đang đợi', ['Waiting', 'Busy'], ['wait', 'waiting', 'đợi'], 'patience'],
  ['finished', 'All done', 'Xong rồi!', ['Finished', 'Okay'], ['done', 'finished', 'xong rồi'], 'relief'],
  ['panic', 'Small panic', 'Panic nhẹ', ['Panic', 'Nervous'], ['panic', 'stress', 'hoảng', 'toang'], 'panic'],
  ['chill', 'Cozy chill', 'Chill thôi', ['Chill', 'Rainy Day', 'Cozy'], ['chill', 'cozy', 'mưa'], 'calm'],
  ['flirty', 'A little flirty', 'Thả thính nhẹ', ['Flirty', 'Jealous'], ['flirty', 'thả thính', 'ghen'], 'affection']
];

const makeSticker = (character, concept, index) => {
  const [id, label, labelVi, categories, tags, emotion] = concept;
  const stickerId = `${character.id}-${id}`;
  const categoryIds = categories.map(value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  return {
    id: stickerId, pack: character.id, packId: character.id, characterId: character.id,
    name: label, label, labelVi, category: categoryIds[0], categories: categoryIds,
    secondaryCategories: categoryIds.slice(1), tags: { en: tags, vi: tags },
    triggers: tags, asset: `vector:${stickerId}`, previewAsset: `vector:${stickerId}`,
    assetType: 'vector', emotion: [emotion], tone: ['warm', 'playful'],
    intensity: index % 4 === 0 ? 4 : 2, style: 'pastelchat-original', isLegacy: false, isActive: true, sortOrder: index,
    intent: [id === 'hello' ? 'greeting' : id === 'bye' ? 'farewell' : id, ...categoryIds]
  };
};

const generatedPacks = characters.map((character, packIndex) => ({
  id: character.id, packId: character.id, slug: character.id, characterId: character.id,
  name: character.name, nameVi: character.nameVi,
  description: `${character.name} has a soft sticker for every mood.`,
  descriptionVi: `${character.nameVi} luôn có một miếng dán dịu dàng cho mọi cảm xúc.`,
  cover: `vector:${character.id}-happy`, categories: STICKER_CATEGORIES.slice(packIndex % 8, (packIndex % 8) + 5).map(c => c.id),
  tags: [character.name.toLowerCase(), 'pastel', 'cute'], featured: packIndex < 6, active: true,
  isLegacy: false, stickerIds: concepts.map(c => `${character.id}-${c[0]}`),
  stickers: concepts.map((concept, index) => makeSticker(character, concept, index))
}));

const bunnyStickers = [...PASTEL_BUNNY_PACK.stickers, ...PASTEL_BUNNY_EXPANSION_STICKERS].map((item, index) => ({
  ...item, packId: 'pastel-bunny', characterId: 'pastel-bunny', name: item.label,
  category: item.intent?.[0] || 'cute', categories: item.intent || ['cute'],
  secondaryCategories: item.intent?.slice(1) || [], triggers: [...(item.tags?.en || []), ...(item.tags?.vi || [])],
  previewAsset: item.asset, isLegacy: false, isActive: true, sortOrder: index
}));

const originalGreetingPack = LEGACY_STICKER_PACKS.find(pack => pack.id === 'greetings');
const activeGreetingPack = originalGreetingPack ? {
  ...originalGreetingPack, featured: true, active: true, isLegacy: false,
  stickers: originalGreetingPack.stickers.map((item, index) => ({ ...item, packId: 'greetings', characterId: 'pastel-bunny', isLegacy: false, isActive: true, previewAsset: item.asset, sortOrder: index }))
} : null;

export const ACTIVE_STICKER_PACKS = [{
  ...PASTEL_BUNNY_PACK, packId: 'pastel-bunny', characterId: 'pastel-bunny', featured: true, active: true,
  isLegacy: false, description: 'Pastel Bunny brings a gentle reaction for every chat moment.',
  stickers: bunnyStickers
}, ...(activeGreetingPack ? [activeGreetingPack] : []), ...generatedPacks];

export const LOCAL_STICKER_PACKS = ACTIVE_STICKER_PACKS;
export const LOCAL_STICKERS = ACTIVE_STICKER_PACKS.flatMap(pack => pack.stickers);
export const STICKER_BY_ID = Object.fromEntries(LOCAL_STICKERS.map(item => [item.id, item]));
export const STICKER_PACK_BY_ID = Object.fromEntries(LOCAL_STICKER_PACKS.map(pack => [pack.id, pack]));

export const normalizeStickerSearch = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/(.)\1{2,}/g, '$1$1').trim();

export const stickerMatchesSearch = (item, query) => {
  const term = normalizeStickerSearch(query);
  if (!term) return true;
  const haystack = normalizeStickerSearch([
    item.name, item.label, item.labelVi, item.pack, item.characterId,
    ...(item.tags?.en || []), ...(item.tags?.vi || []), ...(item.triggers || [])
  ].join(' '));
  return haystack.includes(term) || term.split(/\s+/).every(token => haystack.includes(token));
};
