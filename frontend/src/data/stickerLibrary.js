// Active sticker catalog. Artwork is sourced from the ten user-provided
// contact sheets and kept separate from the existing legacy catalog.
export const STICKER_CATEGORIES = [
  'Love', 'Happy', 'Laugh', 'Cute', 'Sad', 'Cry', 'Angry', 'Annoyed', 'Shocked', 'Confused', 'Shy', 'Embarrassed', 'Sorry', 'Thank You', 'Hug', 'Miss You', 'Sleep', 'Tired', 'Good Morning', 'Good Night', 'Study', 'Work', 'Celebrate', 'Clap', 'Wow', 'OMG', 'LOL', 'Support', 'Comfort', 'Motivation', 'Food', 'Busy', 'Waiting', 'Okay', 'No', 'Yes', 'Hello', 'Bye', 'Thinking', 'Bored', 'Sick', 'Gaming', 'Music', 'Heartbreak', 'Friendship', 'Birthday', 'Special Moments', 'Jealous', 'Nervous', 'Proud', 'Excited', 'Awkward', 'Facepalm', 'Please', 'Begging', 'Hungry', 'Coffee', 'Rainy Day', 'Cozy', 'Working Late', 'Finished', 'Panic', 'Chill', 'Flirty', 'Good Luck'
].map(label => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label, labelVi: label }));

const categoryId = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const sticker = (pack, number, label, labelVi, categories, en, vi, primaryIntent = 'cute') => {
  const id = `${pack.id}-${String(number).padStart(2, '0')}`;
  return {
    id, pack: pack.id, packId: pack.id, characterId: pack.id, name: label, label, labelVi,
    category: categoryId(categories[0]), categories: categories.map(categoryId), secondaryCategories: categories.slice(1).map(categoryId),
    tags: { en, vi }, triggers: [...new Set([...en, ...vi])], triggerAliases: { en, vi },
    aliases: [...new Set([...en, ...vi, label, labelVi])], relatedKeywords: [...new Set([...categories, ...en, ...vi])],
    asset: `/stickers/source-packs/${pack.id}/${String(number).padStart(2, '0')}.${pack.assetExtension}`,
    previewAsset: `/stickers/source-packs/${pack.id}/${String(number).padStart(2, '0')}.${pack.assetExtension}`, assetType: pack.assetExtension,
    emotion: categories.map(category => category.toLowerCase()), tone: ['pastel', 'friendly'],
    intensity: number % 5 === 0 ? 4 : 2, style: 'pastelchat-user-source', isLegacy: false, isActive: true, sortOrder: number,
    primaryIntent,
    relatedIntents: [...new Set([primaryIntent, ...categories.map(categoryId)])],
    intent: [...new Set([...categories.map(categoryId), ...(categories.includes('Hello') ? ['greeting'] : []), ...(categories.includes('Good Night') ? ['sleep'] : [])])]
  };
};

const pack = (id, name, nameVi, description, coverColor, rows, assetExtension = 'webp') => {
  const descriptor = { id, name, nameVi, description, coverColor, assetExtension };
  return { ...descriptor, cover: `/stickers/source-packs/${id}/cover.${assetExtension}`, packId: id, characterId: id, featured: id === 'pastel-bunny-final', active: true, isLegacy: false, categories: [], stickerIds: rows.map((_, index) => `${id}-${String(index + 1).padStart(2, '0')}`), stickers: rows.map((row, index) => sticker(descriptor, index + 1, ...row)) };
};

const EN = {
  hello: ['hello', 'hi', 'hey', 'xin chao'], happy: ['happy', 'yay', 'vui', 'vui qua'], love: ['love', 'loving', 'yeu', 'iu'], hug: ['hug', 'ôm', 'an ui'], laugh: ['laugh', 'haha', 'lol', 'cuoi'], support: ['support', 'good job', 'you got this', 'co len'], chill: ['chill', 'relax', 'cozy'], sad: ['sad', 'buon', 'bùn'], cry: ['cry', 'crying', 'khoc'], tired: ['tired', 'sleepy', 'met'], food: ['food', 'hungry', 'doi', 'an thoi'], thinking: ['thinking', 'hmm', 'suy nghi'], shock: ['shocked', 'omg', 'wow', 'what'], okay: ['okay', 'ok', 'deal', 'nice'], celebrate: ['celebrate', 'great', 'amazing', 'lets go'], work: ['work', 'busy', 'study'], coffee: ['coffee', 'cafe'], cute: ['cute', 'adorable', 'de thuong'], bye: ['bye', 'goodbye', 'see you']
};
const VI = {
  hello: ['xin chào', 'chào', 'chào nha'], happy: ['vui', 'vui quá', 'yay'], love: ['yêu', 'iu', 'đang yêu'], hug: ['ôm', 'ôm nha', 'an ủi'], laugh: ['cười', 'haha', 'cười xỉu'], support: ['cố lên', 'giỏi quá', 'tuyệt vời'], chill: ['chill', 'thư giãn', 'cozy'], sad: ['buồn', 'buồn quá', 'buồn rồi'], cry: ['khóc', 'khóc rồi', 'khóc đây'], tired: ['mệt', 'buồn ngủ', 'ngủ thôi'], food: ['đói', 'ăn thôi', 'đến giờ ăn'], thinking: ['đang nghĩ', 'suy nghĩ', 'hmmm'], shock: ['trời ơi', 'sốc', 'hả'], okay: ['okie', 'ổn', 'đồng ý'], celebrate: ['ăn mừng', 'tuyệt vời', 'đi thôi'], work: ['làm việc', 'đang bận', 'học'], coffee: ['cà phê', 'uống cà phê'], cute: ['dễ thương', 'đáng yêu'], bye: ['tạm biệt', 'hẹn gặp lại']
};
Object.assign(EN, { bored: ['bored', 'meh'], hungry: ['hungry', 'food'], study: ['study', 'studying'], work: ['work', 'working'], wait: ['wait', 'waiting', 'brb'], panic: ['panic', 'help', 'why'], thanks: ['thanks', 'thank you'], praise: ['proud', 'clap', 'amazing'], calm: ['calm', 'relax'], morning: ['good morning', 'morning'], water: ['water', 'take care'], sick: ['sick', 'feel better'], bye: ['bye', 'goodbye'] });
Object.assign(VI, { bored: ['chán', 'chán quá'], hungry: ['đói', 'ăn thôi'], study: ['học', 'học bài'], work: ['làm việc', 'đang bận'], wait: ['đợi', 'chờ'], panic: ['hoảng', 'cứu'], thanks: ['cảm ơn'], praise: ['tự hào', 'vỗ tay'], calm: ['bình tĩnh', 'thư giãn'], morning: ['buổi sáng', 'chào ngày mới'], water: ['uống nước', 'giữ gìn'], sick: ['ốm', 'mau khỏe'], bye: ['tạm biệt', 'hẹn gặp'] });
const triggers = key => [EN[key] || EN.cute, VI[key] || VI.cute];
const row = (label, labelVi, categories, key) => [label, labelVi, categories, ...triggers(key), key];

const bunnyRows = [
  row('Hiiui!', 'Hiiui!', ['Hello', 'Cute'], 'hello'), row('So cute!', 'Dễ thương quá!', ['Cute', 'Happy'], 'cute'), row('I love you~', 'Iuuuuu~', ['Love', 'Flirty'], 'love'), row('Hug me~', 'Ôm nà~', ['Hug', 'Love'], 'hug'),
  row('Amazing!', 'Tuyệt vời!', ['Happy', 'Celebrate'], 'celebrate'), row('Okay!', 'Okiee!', ['Okay', 'Yes'], 'okay'), row('You got this!', 'Cố lên!', ['Support', 'Motivation'], 'support'), row('In love!', 'Đang yêu!', ['Love', 'Flirty'], 'love'),
  row('So sad…', 'Buồn ghê…', ['Sad', 'Heartbreak'], 'sad'), row('Hic…', 'Hiccc…', ['Cry', 'Sad'], 'cry'), row('So tired…', 'Mệt rồi…', ['Tired', 'Sleep'], 'tired'), row('Sleepy~', 'Ngủ đây~', ['Sleep', 'Cozy'], 'tired'),
  row('Time to eat!', 'Ăn thôiii~', ['Food', 'Hungry'], 'food'), row('Chill time~', 'Chill nè~', ['Chill', 'Cozy'], 'chill'), row('Huh?', 'Hả??', ['Confused', 'Thinking'], 'shock'), row('Haha!!', 'Haha!!', ['Laugh', 'LOL'], 'laugh')
];
const beanRows = [
  row('Hello!', 'Hello!', ['Hello', 'Cute'], 'hello'), row('Yayyy!', 'Yayyy!', ['Happy', 'Excited'], 'happy'), row('So happy!', 'So happy!', ['Happy', 'Celebrate'], 'happy'), row('Deal!!', 'Deal!!', ['Okay', 'Yes'], 'okay'),
  row('Niceee!', 'Niceee!', ['Happy', 'Proud'], 'happy'), row('Good job!', 'Good job!', ['Support', 'Proud'], 'support'), row('You got this!', 'Cố lên nha!', ['Support', 'Motivation'], 'support'), row('Chill!', 'Chill ♡', ['Chill', 'Cozy'], 'chill'),
  row('Feeling blue…', 'Bùn quê…', ['Sad', 'Heartbreak'], 'sad'), row('Crying here…', 'Khóc đây…', ['Cry', 'Sad'], 'cry'), row('Huhu…', 'Huhu…', ['Cry', 'Comfort'], 'cry'), row('Big hug…', 'Ôm ôm…', ['Hug', 'Comfort'], 'hug'),
  row('Hungry…', 'Đói rùi…', ['Hungry', 'Food'], 'food'), row('Bed time…', 'Ngủ thôi…', ['Sleep', 'Tired'], 'tired'), row('Thinking…', 'Thinking…', ['Thinking', 'Confused'], 'thinking'), row('Huh??', 'Huh??', ['Confused', 'Shocked'], 'shock')
];
const kittyRows = [
  row('Meow~', 'Meow~', ['Hello', 'Cute'], 'hello'), row('I’m cute~', 'Iucute~', ['Cute', 'Love'], 'cute'), row('No way!', 'Ảo ma Canada!', ['Shocked', 'OMG'], 'shock'), row('Awesome!', 'Đỉnhhhh!', ['Proud', 'Excited'], 'celebrate'),
  row('Okay~', 'Okela~', ['Okay', 'Yes'], 'okay'), row('Work time!', 'Work nè!', ['Work', 'Busy'], 'work'), row('Study time!', 'Học thui!', ['Study', 'Work'], 'work'), row('Coffee?', 'Cà phê nhé?', ['Coffee', 'Chill'], 'coffee'),
  row('Bored…', 'Chán quá…', ['Bored', 'Sad'], 'sad'), row('So tired…', 'Mệt xỉu…', ['Tired', 'Sleep'], 'tired'), row('Crying…', 'Khóc rùi…', ['Cry', 'Sad'], 'cry'), row('Want a hug…', 'Muốn ôm…', ['Hug', 'Comfort'], 'hug'),
  row('What?!', 'Háaa??', ['Shocked', 'Confused'], 'shock'), row('Thinking…', 'Suy suy…', ['Thinking', 'Confused'], 'thinking'), row('Haha~', 'Haha~', ['Laugh', 'LOL'], 'laugh'), row('Love you!', 'Iu lắm!', ['Love', 'Flirty'], 'love')
];
const foxRows = [
  row('Angry', 'Giận', ['Angry', 'Annoyed'], 'shock'), row('Jealous', 'Ghen', ['Jealous', 'Annoyed'], 'sad'), row('Shy', 'Ngại', ['Shy', 'Embarrassed'], 'cute'), row('Worried', 'Lo quá', ['Nervous', 'Panic'], 'sad'),
  row('Sorry', 'Có lỗi', ['Sorry', 'Sad'], 'sad'), row('Lonely', 'Cô đơn', ['Lonely', 'Sad'], 'sad'), row('Heartbroken', 'Đau lòng', ['Heartbreak', 'Sad'], 'sad'), row('Suspicious', 'Nghi ngờ', ['Suspicious', 'Thinking'], 'thinking'),
  row('Confused', 'Bối rối', ['Confused', 'Nervous'], 'thinking'), row('Embarrassed', 'Xấu hổ', ['Embarrassed', 'Shy'], 'sad'), row('Fed up', 'Mệt lòng', ['Tired', 'Annoyed'], 'tired'), row('Panicked', 'Hoảng hốt', ['Panic', 'Shocked'], 'shock'),
  row('Disappointed', 'Hụt hẫng', ['Sad', 'Heartbreak'], 'sad'), row('Unsure', 'Khó xử', ['Awkward', 'Nervous'], 'thinking'), row('Dizzy', 'Ngơ ngác', ['Confused', 'Sick'], 'shock'), row('Giving up', 'Bó tay', ['Annoyed', 'Tired'], 'sad')
];
const lambRows = [
  row('Sorry', 'Xin lỗi', ['Sorry', 'Sad'], 'sad'), row('Thank you', 'Cảm ơn', ['Thank You', 'Happy'], 'support'), row('Hello', 'Chào nha', ['Hello', 'Cute'], 'hello'), row('Goodbye', 'Tạm biệt', ['Bye', 'Friendship'], 'bye'),
  row('Miss you', 'Nhớ quá', ['Miss You', 'Love'], 'love'), row('Congratulations', 'Chúc mừng', ['Celebrate', 'Special Moments'], 'celebrate'), row('Welcome', 'Chào mừng', ['Hello', 'Friendship'], 'hello'), row('Hug', 'Ôm nè', ['Hug', 'Comfort'], 'hug'),
  row('Good night', 'Ngủ ngon', ['Good Night', 'Sleep'], 'tired'), row('Good morning', 'Chào ngày mới', ['Good Morning', 'Happy'], 'hello'), row('Good luck', 'May mắn', ['Good Luck', 'Support'], 'support'), row('Take care', 'Giữ gìn', ['Support', 'Comfort'], 'support'),
  row('See you', 'Hẹn gặp', ['Bye', 'Waiting'], 'bye'), row('I’m back', 'Về rồi', ['Hello', 'Special Moments'], 'hello'), row('Cheer up', 'Cố lên', ['Motivation', 'Support'], 'support'), row('Love you', 'Thương nhiều', ['Love', 'Friendship'], 'love')
];
const blobRows = [
  row('Shocked', 'Sốc', ['Shocked', 'Panic'], 'shock'), row('Look!', 'Ơ kìa', ['Shocked', 'Wow'], 'shock'), row('Huh?', 'Ủa?', ['Confused', 'Shocked'], 'shock'), row('Wow', 'Wow', ['Wow', 'Excited'], 'celebrate'),
  row('Confused', 'Khó hiểu', ['Confused', 'Thinking'], 'thinking'), row('Annoyed', 'Lườm nhẹ', ['Annoyed', 'Angry'], 'sad'), row('Facepalm', 'Trời ạ', ['Facepalm', 'Annoyed'], 'sad'), row('Seriously?!', 'Thiệt hả', ['Shocked', 'Angry'], 'shock'),
  row('Suspicious', 'Nghi quá', ['Suspicious', 'Thinking'], 'thinking'), row('Frozen', 'Đứng hình', ['Shocked', 'Confused'], 'shock'), row('Dizzy', 'Rối não', ['Confused', 'Panic'], 'thinking'), row('Speechless', 'Hết nói', ['Awkward', 'Annoyed'], 'sad'),
  row('Overwhelmed', 'Hoang mang', ['Nervous', 'Panic'], 'sad'), row('Amazed', 'Ghê ta', ['Wow', 'Excited'], 'celebrate'), row('Unbelievable', 'Không thể tin', ['Shocked', 'Wow'], 'shock'), row('Crying hard', 'Ối trời', ['Cry', 'Panic'], 'cry')
];
const puppyRows = [
  row('Eating', 'Ăn nè', ['Food', 'Hungry'], 'food'), row('Drinking water', 'Uống nước', ['Food', 'Support'], 'food'), row('Sleeping', 'Ngủ đấy', ['Sleep', 'Cozy'], 'tired'), row('Working', 'Làm việc', ['Work', 'Busy'], 'work'),
  row('Studying', 'Học bài', ['Study', 'Work'], 'work'), row('Wait a bit', 'Đợi chút', ['Waiting', 'Thinking'], 'thinking'), row('Celebrating', 'Ăn mừng', ['Celebrate', 'Happy'], 'celebrate'), row('Waving', 'Vẫy tay', ['Hello', 'Bye'], 'hello'),
  row('Busy', 'Bận xỉu', ['Busy', 'Work'], 'work'), row('Running late', 'Trễ rồi', ['Waiting', 'Panic'], 'sad'), row('Finished', 'Xong rồi', ['Finished', 'Happy'], 'okay'), row('Coffee', 'Cà phê', ['Coffee', 'Chill'], 'coffee'),
  row('Listening to music', 'Nghe nhạc', ['Music', 'Chill'], 'chill'), row('Gaming', 'Chơi game', ['Gaming', 'Happy'], 'happy'), row('On my way', 'Đi thôi', ['Waiting', 'Celebrate'], 'celebrate'), row('Cleaning', 'Dọn dẹp', ['Finished', 'Work'], 'work')
];
const bearRows = [
  row('Sick', 'Ốm quá', ['Sick', 'Sad'], 'sad'), row('Get well soon', 'Mau khỏe', ['Sick', 'Support'], 'support'), row('Rest', 'Nghỉ ngơi', ['Sleep', 'Cozy'], 'tired'), row('Don’t worry', 'Đừng lo', ['Comfort', 'Support'], 'support'),
  row('Comfort', 'An ủi nè', ['Comfort', 'Hug'], 'hug'), row('I’m here', 'Ở đây nè', ['Support', 'Friendship'], 'support'), row('You can do it', 'Cố lên nha', ['Motivation', 'Support'], 'support'), row('Stay calm', 'Bình tĩnh', ['Chill', 'Comfort'], 'chill'),
  row('Birthday', 'Sinh nhật vui', ['Birthday', 'Celebrate'], 'celebrate'), row('Proud', 'Tự hào', ['Proud', 'Celebrate'], 'celebrate'), row('Love you', 'Thương lắm', ['Love', 'Hug'], 'love'), row('Stay healthy', 'Nhớ giữ sức', ['Support', 'Sick'], 'support'),
  row('Take medicine', 'Uống thuốc', ['Sick', 'Support'], 'support'), row('Warm hug', 'Ấm áp nè', ['Comfort', 'Hug'], 'hug'), row('Cheer up', 'Vui lên', ['Happy', 'Support'], 'happy'), row('It’s okay', 'Ổn thôi', ['Okay', 'Comfort'], 'okay')
];
const bunnyEnglishRows = [
  row('Haha!!', 'Haha!!', ['Laugh', 'LOL'], 'laugh'), row('Yay!', 'Yay!', ['Happy', 'Celebrate'], 'happy'), row('Aww', 'Aww', ['Cute', 'Love'], 'cute'), row('Miss you', 'Miss you', ['Miss You', 'Love'], 'love'),
  row('Hugs!', 'Hugs!', ['Hug', 'Love'], 'hug'), row('Good night', 'Good night', ['Good Night', 'Sleep'], 'sleep'), row('Good morning', 'Good morning', ['Good Morning', 'Happy'], 'morning'), row('So tired', 'So tired', ['Tired', 'Sleep'], 'tired'),
  row('OMG', 'OMG', ['OMG', 'Shocked'], 'shock'), row('Sorry!', 'Sorry!', ['Sorry', 'Sad'], 'apology'), row('Thank you', 'Thank you', ['Thank You', 'Happy'], 'thanks'), row('Love you', 'Love you', ['Love', 'Flirty'], 'love'),
  row("Let's go!", "Let's go!", ['Celebrate', 'Excited'], 'celebrate'), row('Cute!', 'Cute!', ['Cute', 'Love'], 'cute'), row('Proud of you', 'Proud of you', ['Proud', 'Support'], 'praise'), row('Okayyy', 'Okayyy', ['Okay', 'Yes'], 'approval')
];
const cloudBearEnglishRows = [
  row('Feel better', 'Feel better', ['Sick', 'Support'], 'sick'), row('Rest well', 'Rest well', ['Sleep', 'Cozy'], 'sleep'), row("Don't worry", "Don't worry", ['Comfort', 'Support'], 'support'), row("I'm here", "I'm here", ['Support', 'Friendship'], 'support'),
  row('Take care', 'Take care', ['Support', 'Comfort'], 'water'), row('Get well soon', 'Get well soon', ['Sick', 'Support'], 'sick'), row('Deep breaths', 'Deep breaths', ['Chill', 'Comfort'], 'calm'), row('Stay strong', 'Stay strong', ['Motivation', 'Support'], 'support'),
  row('Be calm', 'Be calm', ['Chill', 'Comfort'], 'calm'), row('Big hug', 'Big hug', ['Hug', 'Comfort'], 'hug'), row('Drink water', 'Drink water', ['Support', 'Sick'], 'water'), row('Good luck', 'Good luck', ['Good Luck', 'Support'], 'support'),
  row('You got this', 'You got this', ['Support', 'Motivation'], 'support'), row('Sleepy…', 'Sleepy…', ['Sleep', 'Tired'], 'tired'), row('Happy birthday', 'Happy birthday', ['Birthday', 'Celebrate'], 'celebrate'), row('Eat well', 'Eat well', ['Food', 'Support'], 'food')
];
const peachKittyRows = [
  row('Meh…', 'Meh…', ['Bored', 'Annoyed'], 'bored'), row('Bored', 'Bored', ['Bored', 'Sad'], 'bored'), row('Hungry', 'Hungry', ['Hungry', 'Food'], 'hungry'), row('Sleepy', 'Sleepy', ['Sleep', 'Cozy'], 'sleep'),
  row('Study time', 'Study time', ['Study', 'Work'], 'study'), row('Working…', 'Working…', ['Work', 'Busy'], 'work'), row('Done!', 'Done!', ['Finished', 'Celebrate'], 'completion'), row('Waittt', 'Waittt', ['Waiting', 'Thinking'], 'wait'),
  row('Nooo', 'Nooo', ['Cry', 'Sad'], 'cry'), row('Yesss!', 'Yesss!', ['Happy', 'Celebrate'], 'happy'), row('Wow!', 'Wow!', ['Wow', 'Shocked'], 'shock'), row('Phew…', 'Phew…', ['Tired', 'Relief'], 'tired'),
  row('Need coffee', 'Need coffee', ['Coffee', 'Tired'], 'coffee'), row('Miss me?', 'Miss me?', ['Miss You', 'Love'], 'love'), row('Love this', 'Love this', ['Love', 'Happy'], 'love'), row('Oopsie', 'Oopsie', ['Sorry', 'Awkward'], 'apology')
];
const duckRows = [
  row('LOL', 'LOL', ['LOL', 'Laugh'], 'laugh'), row('LMAO', 'LMAO', ['LOL', 'Laugh'], 'laugh'), row('BRB', 'BRB', ['Waiting', 'Bye'], 'wait'), row('IDK', 'IDK', ['Confused', 'Thinking'], 'confusion'),
  row('Why?!', 'Why?!', ['Cry', 'Confused'], 'cry'), row('Help meee', 'Help meee', ['Panic', 'Please'], 'panic'), row('Slay!', 'Slay!', ['Proud', 'Happy'], 'praise'), row('Nope', 'Nope', ['No', 'Annoyed'], 'approval'),
  row('Okay', 'Okay', ['Okay', 'Yes'], 'approval'), row('Hii!', 'Hii!', ['Hello', 'Cute'], 'hello'), row('Byeee', 'Byeee', ['Bye', 'Friendship'], 'bye'), row('Tea time', 'Tea time', ['Food', 'Cozy'], 'food'),
  row('Good vibes', 'Good vibes', ['Happy', 'Chill'], 'happy'), row('Chill', 'Chill', ['Chill', 'Cozy'], 'chill'), row('Clap clap', 'Clap clap', ['Clap', 'Praise'], 'applause'), row('Shocked!', 'Shocked!', ['Shocked', 'Panic'], 'shock')
];
const sheepyRows = [
  row('Hi babe', 'Hi babe', ['Hello', 'Flirty'], 'hello'), row('Sweet dreams', 'Sweet dreams', ['Sleep', 'Love'], 'sleep'), row('Morning sun', 'Morning sun', ['Good Morning', 'Happy'], 'morning'), row('Sending love', 'Sending love', ['Love', 'Friendship'], 'love'),
  row('Cuddle?', 'Cuddle?', ['Hug', 'Love'], 'hug'), row('Kiss kiss', 'Kiss kiss', ['Love', 'Flirty'], 'love'), row('Thinking of you', 'Thinking of you', ['Miss You', 'Love'], 'affection'), row('Take a break', 'Take a break', ['Cozy', 'Tired'], 'tired'),
  row('Cheer up', 'Cheer up', ['Motivation', 'Support'], 'support'), row('Homesick', 'Homesick', ['Sad', 'Miss You'], 'sad'), row('Thank youuu', 'Thank youuu', ['Thank You', 'Love'], 'thanks'), row('So proud', 'So proud', ['Proud', 'Celebrate'], 'praise'),
  row('Stay cozy', 'Stay cozy', ['Cozy', 'Chill'], 'chill'), row('Be safe', 'Be safe', ['Support', 'Comfort'], 'support'), row('Text me', 'Text me', ['Friendship', 'Miss You'], 'affection'), row('See you', 'See you', ['Bye', 'Love'], 'bye')
];
const dinoRows = [
  row('Roarrr!', 'Roarrr!', ['Excited', 'Happy'], 'happy'), row('Yeeee!', 'Yeeee!', ['Happy', 'Celebrate'], 'happy'), row('Let’s go!', 'Let’s go!', ['Celebrate', 'Excited'], 'celebrate'), row('You got this!', 'You got this!', ['Support', 'Motivation'], 'support'),
  row('Nice!', 'Nice!', ['Proud', 'Happy'], 'happy'), row('Amazing!', 'Tuyệt vời!', ['Celebrate', 'Proud'], 'celebrate'), row('Time to eat!', 'Ăn thôiii!', ['Food', 'Hungry'], 'food'), row('Chill chill~', 'Chill chill~', ['Chill', 'Cozy'], 'chill'),
  row('Feeling sad…', 'Buồn rùi…', ['Sad', 'Comfort'], 'sad'), row('Hug please~', 'Ôm cái nè~', ['Hug', 'Love'], 'hug'), row('Crying…', 'Khóc òa…', ['Cry', 'Sad'], 'cry'), row('So tired…', 'Mệt ngang…', ['Tired', 'Sleep'], 'tired'),
  row('Sleepy…', 'Ngủ thôi…', ['Sleep', 'Tired'], 'tired'), row('Huh?', 'Hả??', ['Confused', 'Thinking'], 'shock'), row('Haha!!', 'Haha!!', ['Laugh', 'LOL'], 'laugh'), row('Love!!', 'Iuuu!!', ['Love', 'Flirty'], 'love')
];
const cloudRows = [
  row('Hi~', 'Hi~', ['Hello', 'Cute'], 'hello'), row('You’re amazing!', 'You’re amazing!', ['Proud', 'Support'], 'support'), row('Shine!', 'Shine!', ['Happy', 'Excited'], 'happy'), row('Sending love', 'Sending love', ['Love', 'Friendship'], 'love'),
  row('Good vibes!', 'Good vibes!', ['Happy', 'Motivation'], 'happy'), row('You got this!', 'Cố lên nha!', ['Support', 'Motivation'], 'support'), row('All good!', 'All good!', ['Okay', 'Yes'], 'okay'), row('Relax~', 'Relax~', ['Chill', 'Cozy'], 'chill'),
  row('A little sad…', 'Buồn tí…', ['Sad', 'Heartbreak'], 'sad'), row('Crying…', 'Khóc rùi…', ['Cry', 'Sad'], 'cry'), row('Hug here~', 'Ôm đây~', ['Hug', 'Comfort'], 'hug'), row('Tired…', 'Mệt rùi…', ['Tired', 'Sleep'], 'tired'),
  row('Good night~', 'Ngủ ngon~', ['Good Night', 'Sleep'], 'tired'), row('What??', 'Hảa??', ['Shocked', 'Confused'], 'shock'), row('Cute!', 'Cutee!', ['Cute', 'Love'], 'cute'), row('Love you~', 'Iu lắm~', ['Love', 'Flirty'], 'love')
];

export const ACTIVE_STICKER_PACKS = [
  pack('pastel-bunny-final', 'Pastel Bunny', 'Pastel Bunny', 'The original Pastel Bunny sheet, now in a clean 16-sticker pack.', '#FCE2EA', bunnyRows),
  pack('mini-bean-crew', 'Mini Bean Crew', 'Mini Bean Crew', 'Friendly, expressive bean reactions for everyday chats.', '#E4F4FC', beanRows),
  pack('mocha-kitty', 'Mocha Kitty', 'Mocha Kitty', 'Cozy kitty moods for work, study, coffee, and love.', '#EEE8FB', kittyRows),
  pack('dino-and-friends', 'Dino & Friends', 'Dino & Friends', 'Playful dino energy for encouragement and fun.', '#DDF7EA', dinoRows),
  pack('cloud-pals', 'Cloud Pals', 'Cloud Pals', 'Dreamy cloud and star reactions for soft support.', '#FFF3C9', cloudRows),
  pack('peach-fox-feelings', 'Peach Fox Feelings', 'Peach Fox Feelings', 'A warm fox pack for nuanced feelings and reactions.', '#FFE6D9', foxRows),
  pack('cotton-lamb-socials', 'Cotton Lamb Socials', 'Cotton Lamb Socials', 'Soft social messages for hellos, thanks, and everyday care.', '#F5E8F7', lambRows),
  pack('jelly-blob-reactions', 'Jelly Blob Reactions', 'Jelly Blob Reactions', 'Playful reactions for surprise, confusion, and drama.', '#EDE6FF', blobRows),
  pack('pudding-puppy-daily-life', 'Pudding Puppy Daily Life', 'Pudding Puppy Daily Life', 'Daily routines, small wins, and cozy activities.', '#FFF0CE', puppyRows),
  pack('cloud-bear-care', 'Cloud Bear Care', 'Cloud Bear Care', 'Gentle comfort, wellness, and support for close friends.', '#E9E7FA', bearRows),
  pack('bunny-english-vibes', 'Bunny English Vibes', 'Bunny English Vibes', 'English-first bunny reactions for everyday feelings.', '#FBE7EE', bunnyEnglishRows, 'png'),
  pack('cloud-bear-care-new', 'Cloud Bear Care', 'Cloud Bear Care', 'Soft English care messages for comfort and encouragement.', '#E8E5FA', cloudBearEnglishRows, 'png'),
  pack('peach-kitty-mood', 'Peach Kitty Mood', 'Peach Kitty Mood', 'Peachy kitty moods for work, reactions, and affection.', '#FFE8DC', peachKittyRows, 'png'),
  pack('tiny-duck-chaos', 'Tiny Duck Chaos', 'Tiny Duck Chaos', 'Bright little duck reactions for playful chat moments.', '#FFF1C9', duckRows, 'png'),
  pack('sheepy-sweet-love', 'Sheepy Sweet Love', 'Sheepy Sweet Love', 'Warm sheepy messages for closeness and care.', '#F2E6F5', sheepyRows, 'png')
];

export const LOCAL_STICKER_PACKS = ACTIVE_STICKER_PACKS;
export const LOCAL_STICKERS = ACTIVE_STICKER_PACKS.flatMap(packItem => packItem.stickers);
export const STICKER_BY_ID = Object.fromEntries(LOCAL_STICKERS.map(item => [item.id, item]));
export const STICKER_PACK_BY_ID = Object.fromEntries(LOCAL_STICKER_PACKS.map(packItem => [packItem.id, packItem]));
export const normalizeStickerSearch = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/(.)\1{2,}/g, '$1$1').trim();
export const stickerMatchesSearch = (item, query) => {
  const term = normalizeStickerSearch(query); if (!term || !item) return !term;
  const haystack = normalizeStickerSearch([item.name, item.label, item.labelVi, item.pack, item.characterId, ...(item.tags?.en || []), ...(item.tags?.vi || []), ...(item.triggers || []), ...(item.aliases || []), ...(item.relatedKeywords || [])].join(' '));
  return haystack.includes(term) || term.split(/\s+/).every(token => haystack.includes(token));
};
