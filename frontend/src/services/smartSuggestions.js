const SLANG = {
  ko: 'không', k: 'không', hk: 'không', iu: 'yêu', thik: 'thích', bùn: 'buồn', dc: 'được',
  lol: 'laugh', lmao: 'laugh', omg: 'surprise', pls: 'please', damn: 'surprise', cooked: 'toang'
};

const CONCEPTS = [
  { id: 'affection', phrases: ['love', 'yêu', 'thương', 'miss you', 'miss u', 'nhớ bạn', 'nhớ em', 'nhớ anh', 'nhớ m', 'i miss', 'like you', 'thích bạn'], emotion: 'love', tone: 'tender', intent: 'affection', gif: 'cute love reaction' },
  { id: 'joy', phrases: ['haha', 'hahaha', 'lol', 'lmao', 'funny', 'hilarious', 'buồn cười', 'cười', 'great', 'yay', 'gooo'], emotion: 'joy', tone: 'playful', intent: 'react', gif: 'funny laughing reaction' },
  { id: 'panic', phrases: ['deadline', 'stress', 'stressed', 'lo quá', 'hoảng', 'panic', 'toang', 'cooked', 'thi rớt', 'cứu', 'fail'], emotion: 'panic', tone: 'dramatic', intent: 'commiserate', gif: 'stress panic reaction' },
  { id: 'surprise', phrases: ['omg', 'wow', 'what', 'trời ơi', 'vãi', 'xỉu', 'mind blown'], emotion: 'surprise', tone: 'dramatic', intent: 'react', gif: 'shocked surprised reaction' },
  { id: 'support', phrases: ['cố lên', 'you got this', 'i believe', 'ủng hộ', 'support', 'comfort', 'an ủi'], emotion: 'encouragement', tone: 'warm', intent: 'support', gif: 'you got this encouragement' },
  { id: 'celebrate', phrases: ['chúc mừng', 'congrats', 'ăn mừng', 'celebrate', 'sinh nhật', 'birthday'], emotion: 'joy', tone: 'bright', intent: 'celebrate', gif: 'celebration congrats' },
  { id: 'sleep', phrases: ['ngủ ngon', 'good night', 'buồn ngủ', 'sleep', 'bed', 'đi ngủ'], emotion: 'calm', tone: 'tender', intent: 'greeting', gif: 'good night cute' },
  { id: 'apology', phrases: ['xin lỗi', 'sorry', 'my bad', 'tha lỗi', 'please'], emotion: 'hope', tone: 'tender', intent: 'apologize', gif: 'sorry cute reaction' },
  { id: 'sadness', phrases: ['buồn quá', 'sad', 'tired', 'so tired', 'mệt quá'], emotion: 'sadness', tone: 'tender', intent: 'support', gif: 'comfort hug reaction' },
  { id: 'anger', phrases: ['tức', 'angry', 'mad', 'bực', 'vl'], emotion: 'anger', tone: 'dramatic', intent: 'commiserate', gif: 'angry reaction' },
  { id: 'praise', phrases: ['m giỏi quá', 'proud of you', 'you are great', 'giỏi quá', 'proud'], emotion: 'admiration', tone: 'warm', intent: 'praise', gif: 'proud celebration reaction' },
  { id: 'food', phrases: ['đi ăn', 'eat', 'food', 'lunch', 'dinner'], emotion: 'joy', tone: 'playful', intent: 'invite', gif: 'food excited reaction' }
];

export const normalizeMessage = (value = '') => value.normalize('NFC').toLowerCase().replace(/[.,!?;:()[\]{}]/g, ' ').split(/\s+/).filter(Boolean).map(word => SLANG[word] || word).join(' ');

export const analyzeMessage = (value = '') => {
  const normalized = normalizeMessage(value);
  if (!normalized || !/[a-z\u00c0-\u024f\u1e00-\u1eff]/i.test(normalized)) return { normalized, concepts: [], signals: [] };
  const concepts = CONCEPTS.filter(concept => concept.phrases.some(phrase => normalized.includes(normalizeMessage(phrase))));
  const signals = [...new Set(concepts.flatMap(c => [c.id, c.emotion, c.intent, c.tone]))];
  return { normalized, concepts, signals };
};

export const getSmartSuggestions = (message, { stickers = [], recentIds = [], favoriteIds = [] } = {}) => {
  const analysis = analyzeMessage(message);
  if (analysis.concepts.length === 0) return { ...analysis, stickers: [], gifQueries: [] };
  const score = (item) => {
    const fields = [item.label, item.labelVi, ...(item.tags?.en || []), ...(item.tags?.vi || []), ...(item.emotion || []), ...(item.intent || []), ...(item.tone || [])].join(' ').toLowerCase();
    const overlap = analysis.signals.reduce((sum, signal) => sum + (fields.includes(signal) ? 3 : 0), 0);
    return overlap + (favoriteIds.includes(item.id) ? 4 : 0) + (recentIds.includes(item.id) ? 2 : 0) + (item.intensity >= 4 && analysis.normalized.length > 30 ? 1 : 0);
  };
  const ranked = stickers.map(item => ({ item, score: score(item) })).filter(candidate => candidate.score > 0).sort((a, b) => b.score - a.score);
  const chosen = [];
  const usedPacks = new Set();
  for (const candidate of ranked) {
    if (chosen.length >= 5) break;
    if (usedPacks.has(candidate.item.pack) && chosen.length < 3) continue;
    chosen.push(candidate.item);
    usedPacks.add(candidate.item.pack);
  }
  // Keep the strip varied even when the message has one dominant emotion.
  for (const item of stickers) {
    if (chosen.length >= 5) break;
    if (!usedPacks.has(item.pack)) { chosen.push(item); usedPacks.add(item.pack); }
  }
  const gifQueries = [...new Set(analysis.concepts.map(concept => concept.gif))].slice(0, 2);
  return { ...analysis, stickers: chosen, gifQueries };
};
