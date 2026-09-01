const bunnyAsset = (id) => `/stickers/pastel-bunny/${id}.webp`;

const bunnySticker = (id, label, labelVi, tagsEn, tagsVi, emotion, intent, tone, intensity = 2) => ({
  id,
  pack: 'pastel-bunny',
  type: 'sticker',
  asset: bunnyAsset(id),
  assetType: 'webp',
  label,
  labelVi,
  tags: { en: tagsEn, vi: tagsVi },
  tags_en: tagsEn,
  tags_vi: tagsVi,
  emotion,
  intent,
  tone,
  context: [...tagsEn, ...tagsVi],
  actions: [],
  intensity,
  style: 'pastel-bunny'
});

export const PASTEL_BUNNY_STICKERS = [
  bunnySticker('bunny_hello', 'Hello', 'Xin chào', ['hello', 'hi', 'hey'], ['xin chào', 'chào', 'chào nha'], ['joy'], ['greeting'], ['cute', 'soft', 'pastel'], 3),
  bunnySticker('bunny_xinchao', 'Xin chào', 'Xin chào', ['hello', 'hi', 'hey'], ['xin chào', 'chào', 'chào nha'], ['joy'], ['greeting'], ['cute', 'soft', 'pastel'], 3),
  bunnySticker('bunny_byebye', 'Bye bye', 'Tạm biệt', ['bye', 'bye bye', 'goodbye'], ['tạm biệt', 'bye nha'], ['calm'], ['farewell'], ['cute', 'soft', 'pastel'], 3),
  bunnySticker('bunny_seeyou', 'See you', 'Hẹn gặp lại', ['see you', 'see ya', 'bye'], ['hẹn gặp lại', 'tạm biệt'], ['calm'], ['farewell'], ['cute', 'soft', 'pastel'], 3),
  bunnySticker('bunny_sorry', 'Sorry nha', 'Xin lỗi nha', ['sorry', 'my bad', 'apology'], ['xin lỗi', 'sorry nha', 'tha lỗi'], ['hope'], ['apology'], ['cute', 'soft', 'pastel'], 3),
  bunnySticker('bunny_imissyou', 'I miss you', 'Nhớ bạn', ['i miss you', 'miss you', 'miss u', 'thinking of you'], ['nhớ bạn', 'nhớ m', 'nhớ quá'], ['affection', 'longing'], ['affection'], ['cute', 'soft', 'pastel'], 3),
  bunnySticker('bunny_nhoyou', 'Nhớ you', 'Nhớ you', ['miss you', 'miss u', 'love', 'thinking of you'], ['nhớ', 'nhớ you', 'nhớ quá', 'iu', 'yêu'], ['affection', 'longing'], ['affection'], ['cute', 'soft', 'pastel'], 3),
  bunnySticker('bunny_goodnight', 'Good night', 'Ngủ ngon', ['good night', 'sleep well', 'night'], ['ngủ ngon', 'ngủ nha'], ['calm'], ['sleep', 'farewell', 'affection'], ['cute', 'soft', 'pastel'], 3),
  bunnySticker('bunny_laugh', 'Laughing', 'Cười xỉu', ['haha', 'lol', 'lmao', 'funny', 'laugh'], ['mắc cười', 'cười xỉu', 'buồn cười'], ['joy'], ['laughter', 'funny'], ['cute', 'soft', 'pastel'], 4),
  bunnySticker('bunny_cry', 'Crying', 'Đang khóc', ['sad', 'cry', 'crying'], ['buồn', 'khóc', 'bùn quá'], ['sadness'], ['sadness', 'crying'], ['cute', 'soft', 'pastel'], 4),
  bunnySticker('bunny_angry', 'Angry', 'Tức quá', ['angry', 'mad', 'annoyed'], ['tức', 'bực', 'giận'], ['anger'], ['anger', 'annoyed'], ['cute', 'soft', 'pastel'], 4),
  bunnySticker('bunny_shocked', 'Shocked', 'Sốc', ['omg', 'what', 'shocked', 'surprise'], ['xỉu', 'trời ơi', 'sốc'], ['surprise'], ['surprise', 'shock'], ['cute', 'soft', 'pastel'], 4),
  bunnySticker('bunny_sleepy', 'Sleepy', 'Buồn ngủ', ['sleepy', 'tired', 'sleep'], ['buồn ngủ', 'mệt', 'ngủ nha'], ['calm'], ['sleep'], ['cute', 'soft', 'pastel'], 3),
  bunnySticker('bunny_love', 'Love', 'Yêu quá', ['love you', 'love', 'like you'], ['iu', 'yêu', 'thích quá'], ['love', 'affection'], ['love', 'affection'], ['cute', 'soft', 'pastel'], 3),
  bunnySticker('bunny_thumbsup', 'Thumbs up', 'Chuẩn luôn', ['ok', 'okay', 'good', 'nice', 'yes'], ['được', 'chuẩn', 'ổn'], ['approval'], ['approval', 'support'], ['cute', 'soft', 'pastel'], 3),
  bunnySticker('bunny_celebrate', 'Celebrate', 'Chúc mừng', ['yay', "let's go", 'congrats', 'celebrate', 'amazing'], ['chúc mừng', 'tuyệt vời', 'ăn mừng'], ['joy', 'excitement'], ['celebration', 'excitement'], ['cute', 'soft', 'pastel'], 4)
];

export const PASTEL_BUNNY_PACK = {
  id: 'pastel-bunny',
  name: 'Pastel Bunny',
  nameVi: 'Thỏ Pastel',
  category: 'Pastel Bunny',
  cover: bunnyAsset('bunny_hello'),
  source: 'PastelChat first-party · kawaii pink bunny pastel sticker sheet',
  stickers: PASTEL_BUNNY_STICKERS
};
