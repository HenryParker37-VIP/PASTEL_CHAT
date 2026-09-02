import { SMART_SUGGESTION_TRIGGERS, applyLexiconNormalization } from './smartSuggestionLexicon';

const SLANG = {
  ko: 'không', k: 'không', hk: 'không', iu: 'yêu', thik: 'thích', bùn: 'buồn', dc: 'được',
  lol: 'laugh', lmao: 'laugh', omg: 'surprise', pls: 'please', damn: 'surprise', cooked: 'toang'
};

const normalizeFields = item => ({
  ...item,
  tags: item.tags || { en: item.triggers || [], vi: item.triggers || [] },
  emotion: item.emotion || [], intent: item.intent || [], tone: item.tone || []
});

const CONCEPTS = [
  { id: 'affection', phrases: ['love', 'love you', 'yêu', 'thương', 'miss you', 'miss u', 'miss you lots', 'nhớ bạn', 'nhớ you', 'nhớ em', 'nhớ anh', 'nhớ m', 'i miss', 'like you', 'thinking of you', 'hug', 'ôm', 'thích bạn', ...SMART_SUGGESTION_TRIGGERS.affection], emotion: 'love', tone: 'tender', intent: 'affection', gif: 'cute love reaction' },
  { id: 'joy', phrases: ['haha', 'hahaha', 'lol', 'lmao', 'funny', 'hilarious', 'buồn cười', 'mắc cười', 'cười', 'cười xỉu', 'great', 'yay', "let's go", 'gooo', ...SMART_SUGGESTION_TRIGGERS.laughter], emotion: 'joy', tone: 'playful', intent: 'react', gif: 'funny laughing reaction' },
  { id: 'panic', phrases: ['deadline', 'stress', 'stressed', 'lo quá', 'hoảng', 'panic', 'toang', 'cooked', 'thi rớt', 'cứu', 'fail'], emotion: 'panic', tone: 'dramatic', intent: 'commiserate', gif: 'stress panic reaction' },
  { id: 'surprise', phrases: ['omg', 'wow', 'what', 'shocked', 'trời ơi', 'vãi', 'xỉu', 'mind blown'], emotion: 'surprise', tone: 'dramatic', intent: 'react', gif: 'shocked surprised reaction' },
  { id: 'support', phrases: ['cố lên', 'you got this', 'i believe', 'ủng hộ', 'support', 'comfort', 'an ủi', 'cheer up', 'proud of you', 'good job', "it's okay", 'no problem'], emotion: 'encouragement', tone: 'warm', intent: 'support', gif: 'you got this encouragement' },
  { id: 'celebrate', phrases: ['chúc mừng', 'congrats', 'ăn mừng', 'celebrate', 'sinh nhật', 'birthday'], emotion: 'joy', tone: 'bright', intent: 'celebrate', gif: 'celebration congrats' },
  { id: 'sleep', phrases: ['ngủ ngon', 'ngủ nha', 'good night', 'sweet dreams', 'good evening', 'buồn ngủ', 'sleepy', 'sleep', 'bed', 'đi ngủ', ...SMART_SUGGESTION_TRIGGERS.sleep], emotion: 'calm', tone: 'tender', intent: 'greeting', gif: 'good night cute' },
  { id: 'apology', phrases: ['xin lỗi', 'sorry', 'so sorry', 'my bad', 'tha lỗi', 'forgive me', 'please', ...SMART_SUGGESTION_TRIGGERS.apology], emotion: 'hope', tone: 'tender', intent: 'apologize', gif: 'sorry cute reaction' },
  { id: 'sadness', phrases: ['buồn quá', 'sad', 'tired', 'so tired', 'mệt quá', 'bored', 'so bored', 'crying', ...SMART_SUGGESTION_TRIGGERS.crying, ...SMART_SUGGESTION_TRIGGERS.sadness, ...SMART_SUGGESTION_TRIGGERS.tired], emotion: 'sadness', tone: 'tender', intent: 'support', gif: 'comfort hug reaction' },
  { id: 'anger', phrases: ['tức', 'angry', 'mad', 'bực', 'giận', 'vl'], emotion: 'anger', tone: 'dramatic', intent: 'commiserate', gif: 'angry reaction' },
  { id: 'praise', phrases: ['m giỏi quá', 'proud of you', 'you are great', 'giỏi quá', 'proud', 'vỗ tay'], emotion: 'admiration', tone: 'warm', intent: 'praise', gif: 'proud celebration reaction' },
  { id: 'food', phrases: ['đi ăn', 'eat', 'food', 'lunch', 'dinner'], emotion: 'joy', tone: 'playful', intent: 'invite', gif: 'food excited reaction' },
  { id: 'greeting', phrases: ['xin chào', 'chào nha', 'chào', 'hello', 'hi', 'hey', 'good morning', 'welcome', 'welcome back'], emotion: 'joy', tone: 'warm', intent: 'greeting', gif: 'cute hello wave' },
  { id: 'farewell', phrases: ['tạm biệt', 'bye bye', 'good bye', 'goodbye', 'see you', 'see ya', 'see ya later', 'take care', 'bye'], emotion: 'calm', tone: 'warm', intent: 'farewell', gif: 'cute goodbye wave' },
  { id: 'approval', phrases: ['ok', 'okay', 'okayyy', 'good', 'nice', 'no problem', 'được', 'chuẩn'], emotion: 'approval', tone: 'positive', intent: 'confirm', gif: 'thumbs up reaction' },
  { id: 'thanks', phrases: ['thank you', 'thanks', 'cảm ơn'], emotion: 'gratitude', tone: 'warm', intent: 'thanks', gif: 'thank you cute reaction' },
  { id: 'hug', phrases: SMART_SUGGESTION_TRIGGERS.hug, emotion: 'comfort', tone: 'tender', intent: 'support', gif: 'cute hug reaction' },
  { id: 'cute', phrases: SMART_SUGGESTION_TRIGGERS.cute, emotion: 'affection', tone: 'playful', intent: 'praise', gif: 'cute adorable reaction' },
  { id: 'completion', phrases: SMART_SUGGESTION_TRIGGERS.completion, emotion: 'relief', tone: 'positive', intent: 'confirm', gif: 'done celebration reaction' },
  { id: 'confusion', phrases: SMART_SUGGESTION_TRIGGERS.confusion, emotion: 'surprise', tone: 'dramatic', intent: 'react', gif: 'confused reaction' },
  { id: 'helplessness', phrases: SMART_SUGGESTION_TRIGGERS.helplessness, emotion: 'frustration', tone: 'dramatic', intent: 'commiserate', gif: 'frustrated reaction' },
  { id: 'study', phrases: SMART_SUGGESTION_TRIGGERS.study, emotion: 'effort', tone: 'warm', intent: 'support', gif: 'study encouragement reaction' }
];

export const normalizeMessage = (value = '') => applyLexiconNormalization(value).replace(/[.,!?;:()[\]{}]/g, ' ').split(/\s+/).filter(Boolean).map(word => SLANG[word] || word).join(' ');

export const analyzeMessage = (value = '') => {
  const normalized = normalizeMessage(value);
  if (!normalized || !/[a-z\u00c0-\u024f\u1e00-\u1eff]/i.test(normalized)) return { normalized, concepts: [], signals: [] };
  const concepts = CONCEPTS.filter(concept => concept.phrases.some((phrase) => {
    const normalizedPhrase = normalizeMessage(phrase);
    return normalized.includes(normalizedPhrase) || (
      normalized.length >= 4 && normalizedPhrase.startsWith(normalized)
    );
  }));
  const signals = [...new Set(concepts.flatMap(c => [c.id, c.emotion, c.intent, c.tone]))];
  return { normalized, concepts, signals };
};

export const getSmartSuggestions = (message, { stickers = [], recentIds = [], favoriteIds = [] } = {}) => {
  const analysis = analyzeMessage(message);
  if (analysis.concepts.length === 0) return { ...analysis, stickers: [], gifQueries: [] };
  const score = (rawItem) => {
    const item = normalizeFields(rawItem);
    const fields = [item.label, item.labelVi, ...(item.tags?.en || []), ...(item.tags?.vi || []), ...(item.emotion || []), ...(item.intent || []), ...(item.tone || [])].join(' ').toLowerCase();
    const overlap = analysis.signals.reduce((sum, signal) => sum + (fields.includes(signal) ? 3 : 0), 0);
    const directPhraseMatches = [...(item.tags?.en || []), ...(item.tags?.vi || [])]
      .filter(tag => tag.length > 2 && analysis.normalized.includes(normalizeMessage(tag))).length;
    const directPhraseMatch = directPhraseMatches * 5;
    const firstPartyBonus = item.style === 'pastel-bunny' && overlap > 0 ? 12 : 0;
    return overlap + directPhraseMatch + firstPartyBonus + (favoriteIds.includes(item.id) ? 4 : 0) + (recentIds.includes(item.id) ? 2 : 0) + (item.intensity >= 4 && analysis.normalized.length > 30 ? 1 : 0);
  };
  const ranked = stickers.map(item => ({ item, score: score(item) })).filter(candidate => candidate.score > 0).sort((a, b) => b.score - a.score);
  const chosen = [];
  const usedPacks = new Set();
  const packCounts = new Map();
  const needsVisualVariants = analysis.concepts.some(({ intent }) => intent === 'greeting' || intent === 'farewell');
  const preferredBunnyIds = {
    greeting: ['bunny_hello', 'bunny_xinchao'], farewell: ['bunny_byebye', 'bunny_seeyou'],
    laughter: ['bunny_laugh'], joy: ['bunny_laugh'], sadness: ['bunny_cry'], anger: ['bunny_angry'],
    surprise: ['bunny_shocked'], affection: ['bunny_love', 'bunny_imissyou', 'bunny_nhoyou'], approval: ['bunny_thumbsup'], celebrate: ['bunny_celebrate'], celebration: ['bunny_celebrate']
  };
  const extraPreferred = /\b(yay|let's go|gooo)\b/.test(analysis.normalized) ? ['bunny_celebrate'] : [];
  const preferred = [...analysis.concepts.flatMap(concept => preferredBunnyIds[concept.id] || []), ...extraPreferred]
    .map(id => stickers.find(item => item.id === id)).filter(Boolean);
  for (const item of preferred) {
    if (chosen.length >= 5 || chosen.some(candidate => candidate.id === item.id)) break;
    chosen.push(item); usedPacks.add(item.pack); packCounts.set(item.pack, (packCounts.get(item.pack) || 0) + 1);
  }
  if (needsVisualVariants) {
    const visualIntent = analysis.concepts.find(concept => concept.intent === 'greeting' || concept.intent === 'farewell')?.intent;
    for (const item of stickers) {
      if (chosen.length >= 3 || item.intent?.includes(visualIntent) === false || chosen.some(candidate => candidate.id === item.id)) continue;
      if (item.intent?.includes(visualIntent)) chosen.push(item);
    }
  }
  for (const candidate of ranked) {
    if (chosen.length >= 5) break;
    const packCount = packCounts.get(candidate.item.pack) || 0;
    if (packCount >= 2 || (!needsVisualVariants && packCount >= 1 && chosen.length < 3)) continue;
    chosen.push(candidate.item);
    packCounts.set(candidate.item.pack, packCount + 1);
    usedPacks.add(candidate.item.pack);
  }
  // Keep the strip varied even when the message has one dominant emotion.
  for (const item of stickers) {
    if (chosen.length >= 5) break;
    if (!usedPacks.has(item.pack)) { chosen.push(item); usedPacks.add(item.pack); }
  }
  for (const item of stickers) {
    if (chosen.length >= 5) break;
    if (!chosen.some(candidate => candidate.id === item.id)) chosen.push(item);
  }
  const gifQueries = [...new Set(analysis.concepts.map(concept => concept.gif))].slice(0, 2);
  return { ...analysis, stickers: chosen, gifQueries };
};
