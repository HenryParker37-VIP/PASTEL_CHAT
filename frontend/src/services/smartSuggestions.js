import { SMART_SUGGESTION_TRIGGERS, applyLexiconNormalization } from './smartSuggestionLexicon';

const SLANG = { ko: 'không', k: 'không', hk: 'không', iu: 'yêu', thik: 'thích', bùn: 'buồn', dc: 'được', lol: 'laugh', lmao: 'laugh', omg: 'surprise', cooked: 'toang' };
const CONCEPTS = [
  ['affection', ['love', 'love you', 'yêu', 'thương', 'miss you', 'miss u', 'nhớ', 'thích bạn', ...SMART_SUGGESTION_TRIGGERS.affection], 'love', 'affection', 'cute love reaction'],
  ['joy', ['haha', 'lol', 'lmao', 'funny', 'hilarious', 'buồn cười', 'mắc cười', 'cười', 'great', 'yay', "let's go", 'gooo', ...SMART_SUGGESTION_TRIGGERS.laughter], 'joy', 'joy', 'funny laughing reaction'],
  ['panic', ['deadline', 'stress', 'stressed', 'lo quá', 'hoảng', 'panic', 'toang', 'cooked', 'thi rớt', 'cứu', 'fail'], 'panic', 'panic', 'stress panic reaction'],
  ['surprise', ['omg', 'wow', 'what', 'shocked', 'trời ơi', 'vãi', 'xỉu', 'mind blown'], 'surprise', 'surprise', 'shocked surprised reaction'],
  ['support', ['cố lên', 'you got this', 'i believe', 'ủng hộ', 'support', 'comfort', 'an ủi', 'cheer up', 'proud of you', 'good job', "it's okay", 'no problem'], 'encouragement', 'support', 'you got this encouragement'],
  ['celebrate', ['chúc mừng', 'congrats', 'ăn mừng', 'celebrate', 'sinh nhật', 'birthday'], 'joy', 'celebrate', 'celebration congrats'],
  ['sleep', ['ngủ ngon', 'ngủ nha', 'good night', 'sweet dreams', 'buồn ngủ', 'sleepy', 'sleep', 'bed', 'đi ngủ', ...SMART_SUGGESTION_TRIGGERS.sleep], 'calm', 'sleep', 'good night cute'],
  ['apology', ['xin lỗi', 'sorry', 'so sorry', 'my bad', 'tha lỗi', 'forgive me', ...SMART_SUGGESTION_TRIGGERS.apology], 'hope', 'apology', 'sorry cute reaction'],
  ['sadness', ['buồn quá', 'sad', 'tired', 'so tired', 'mệt quá', 'bored', 'so bored', 'crying', ...SMART_SUGGESTION_TRIGGERS.crying, ...SMART_SUGGESTION_TRIGGERS.sadness, ...SMART_SUGGESTION_TRIGGERS.tired], 'sadness', 'sadness', 'comfort hug reaction'],
  ['anger', ['tức', 'angry', 'mad', 'bực', 'giận', 'vl'], 'anger', 'anger', 'angry reaction'],
  ['praise', ['m giỏi quá', 'proud of you', 'you are great', 'giỏi quá', 'proud', 'vỗ tay'], 'admiration', 'praise', 'proud celebration reaction'],
  ['food', ['đi ăn', 'eat', 'food', 'lunch', 'dinner'], 'joy', 'food', 'food excited reaction'],
  ['greeting', ['xin chào', 'chào nha', 'chào', 'hello', 'hi', 'hey', 'good morning', 'welcome', 'welcome back'], 'joy', 'greeting', 'cute hello wave'],
  ['farewell', ['tạm biệt', 'bye bye', 'good bye', 'goodbye', 'see you', 'see ya', 'take care', 'bye'], 'calm', 'farewell', 'cute goodbye wave'],
  ['approval', ['ok', 'okay', 'good', 'nice', 'no problem', 'được', 'chuẩn', ...SMART_SUGGESTION_TRIGGERS.approval], 'approval', 'approval', 'thumbs up reaction'],
  ['thanks', ['thank you', 'thanks', 'cảm ơn'], 'gratitude', 'thanks', 'thank you cute reaction'],
  ['hug', SMART_SUGGESTION_TRIGGERS.hug, 'comfort', 'hug', 'cute hug reaction'],
  ['cute', SMART_SUGGESTION_TRIGGERS.cute, 'affection', 'cute', 'cute adorable reaction'],
  ['completion', SMART_SUGGESTION_TRIGGERS.completion, 'relief', 'completion', 'done celebration reaction'],
  ['confusion', SMART_SUGGESTION_TRIGGERS.confusion, 'surprise', 'confusion', 'confused reaction'],
  ['helplessness', SMART_SUGGESTION_TRIGGERS.helplessness, 'frustration', 'helplessness', 'frustrated reaction'],
  ['study', SMART_SUGGESTION_TRIGGERS.study, 'effort', 'study', 'study encouragement reaction']
].map(([id, phrases, emotion, intent, gif]) => ({ id, phrases, emotion, intent, gif }));

export const normalizeMessage = value => applyLexiconNormalization(value).replace(/[.,!?;:()[\]{}]/g, ' ').split(/\s+/).filter(Boolean).map(word => SLANG[word] || word).join(' ');
const normalizeFields = item => ({ ...item, tags: item.tags || { en: [], vi: [] }, intent: item.intent || [], emotion: item.emotion || [], tone: item.tone || [] });
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phrasePattern = phrase => new RegExp(`(^|[^a-z0-9à-ỹ])${escapeRegex(normalizeMessage(phrase))}(?=$|[^a-z0-9à-ỹ])`, 'iu');

export const analyzeMessage = value => {
  const normalized = normalizeMessage(value);
  if (!normalized || !/[a-z\u00c0-\u024f\u1e00-\u1eff]/i.test(normalized)) return { normalized, concepts: [], signals: [] };
  const concepts = CONCEPTS.filter(concept => concept.phrases.some(phrase => {
    const normalizedPhrase = normalizeMessage(phrase);
    return phrasePattern(phrase).test(normalized) || (normalized.length >= 4 && normalizedPhrase.startsWith(normalized));
  }));
  const signals = [...new Set(concepts.flatMap(c => [c.id, c.emotion, c.intent]))];
  return { normalized, concepts, signals };
};

const INTENT_ALIASES = { sadness: ['sad', 'cry', 'tired', 'bored', 'sick', 'heartbreak'], crying: ['cry'], joy: ['happy', 'laugh', 'celebrate', 'excited'], surprise: ['shock', 'shocked', 'wow'], affection: ['love', 'cute', 'flirty'], support: ['support', 'comfort', 'motivation', 'good-luck'], sleep: ['sleep', 'good-night', 'cozy', 'tired'] };
const intentScore = (item, concept) => {
  const key = item.primaryIntent || '';
  if (key === concept.intent || key === concept.id) return 22;
  if ((INTENT_ALIASES[concept.id] || []).includes(key)) return 24;
  const fields = [...(item.categories || []), ...(item.relatedIntents || []), ...(item.intent || [])];
  return fields.includes(concept.intent) || fields.includes(concept.id) ? 8 : 0;
};

export const getSmartSuggestions = (message, { stickers = [], recentIds = [], favoriteIds = [] } = {}) => {
  const analysis = analyzeMessage(message);
  if (!analysis.concepts.length) return { ...analysis, stickers: [], gifQueries: [] };
  const ranked = stickers.map((rawItem, index) => {
    const item = normalizeFields(rawItem);
    const textFields = [item.label, item.labelVi, ...(item.tags.en || []), ...(item.tags.vi || [])].filter(Boolean);
    let score = analysis.concepts.reduce((sum, concept) => sum + intentScore(item, concept), 0);
    score += textFields.reduce((sum, tag) => sum + (phrasePattern(tag).test(analysis.normalized) ? (tag.length > 3 ? 40 : 18) : 0), 0);
    if (favoriteIds.includes(item.id)) score += 3;
    if (recentIds.includes(item.id)) score += 2;
    return { item, score, index };
  }).filter(candidate => candidate.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  const chosen = [];
  const packCounts = new Map();
  const curated = { greeting: 'pastel-bunny-final-01', affection: 'pastel-bunny-final-03', sleep: 'pastel-bunny-final-12', joy: 'pastel-bunny-final-16', sadness: 'pastel-bunny-final-09', surprise: 'pastel-bunny-final-15', approval: 'pastel-bunny-final-06' };
  for (const concept of analysis.concepts) {
    const item = stickers.find(candidate => candidate.id === curated[concept.id]);
    if (item && ranked.some(candidate => candidate.item.id === item.id) && !chosen.includes(item)) {
      chosen.push(item);
      packCounts.set(item.pack, (packCounts.get(item.pack) || 0) + 1);
    }
  }
  const celebratoryBunny = analysis.concepts.some(concept => concept.id === 'joy') && /\b(yay|let'?s go|gooo)\b/i.test(analysis.normalized)
    ? stickers.find(item => item.id === 'pastel-bunny-final-05') : null;
  if (celebratoryBunny) {
    chosen.push(celebratoryBunny);
    packCounts.set(celebratoryBunny.pack, 1);
  }
  for (const candidate of ranked) {
    if (chosen.length >= 5) break;
    if (chosen.includes(candidate.item)) continue;
    const count = packCounts.get(candidate.item.pack) || 0;
    if (count >= 2) continue;
    chosen.push(candidate.item);
    packCounts.set(candidate.item.pack, count + 1);
  }
  return { ...analysis, stickers: chosen, gifQueries: [...new Set(analysis.concepts.map(concept => concept.gif))].slice(0, 2) };
};
