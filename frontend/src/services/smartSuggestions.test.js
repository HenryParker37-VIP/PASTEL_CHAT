import { analyzeMessage, getSmartSuggestions, normalizeMessage } from './smartSuggestions';
import { LOCAL_STICKERS } from '../data/stickerPacks';

describe('smart sticker suggestions', () => {
  test.each([
    ['buồn quá', 'sadness'], ['xin lỗi nha', 'apology'], ['ngủ ngon', 'sleep'], ['mai thi rồi cứu t', 'panic'],
    ['tức vl', 'anger'], ['êy đi ăn ko', 'food'], ['m giỏi quá', 'praise'], ['nhớ m ghê', 'affection'],
    ['I miss you', 'affection'], ['I’m so tired', 'sadness'], ['good night', 'sleep'], ['I’m cooked', 'panic'],
    ['that was hilarious', 'joy'], ['I’m proud of you', 'praise'], ['sorry about that', 'apology'], ['let’s gooo', 'joy'],
    ['sorry nha', 'apology'], ['miss u quá', 'affection'], ['t so tired', 'sadness'], ['good night nha', 'sleep'],
    ['mai thi and I’m cooked', 'panic'], ['omg xỉu', 'surprise'], ['cứu bro', 'panic'], ['love this quá', 'affection'],
    ['xin chào', 'greeting'], ['chào nha', 'greeting'], ['hello', 'greeting'], ['hi bro', 'greeting'], ['hello nha', 'greeting'],
    ['tạm biệt', 'farewell'], ['bye bye', 'farewell'], ['see you', 'farewell'], ['bye nha', 'farewell'], ['see you nha', 'farewell']
  ])('detects the shared concept in %s', (message, concept) => {
    expect(analyzeMessage(message).concepts.map(item => item.id)).toContain(concept);
  });

  test('normalizes common mixed-language chat shorthand', () => {
    expect(normalizeMessage('ko thik bài này lol')).toContain('không thích bài này laugh');
  });

  test('returns varied, non-empty suggestions for meaningful text', () => {
    const result = getSmartSuggestions('deadline stress quá, mai thi rồi', { stickers: LOCAL_STICKERS });
    expect(result.stickers.length).toBeGreaterThan(0);
    expect(new Set(result.stickers.map(item => item.pack)).size).toBeGreaterThan(1);
    expect(result.gifQueries.length).toBeGreaterThan(0);
  });

  test('does not suggest for meaningless characters', () => {
    expect(getSmartSuggestions('!!!', { stickers: LOCAL_STICKERS }).stickers).toEqual([]);
  });

  test.each([
    ['hell', 'greeting'], ['xin ch', 'greeting'], ['goodb', 'farewell']
  ])('recognizes meaningful partial %s', (message, concept) => {
    expect(analyzeMessage(message).concepts.map(item => item.id)).toContain(concept);
  });

  test.each([
    ['hello', 'greeting'], ['xin chào', 'greeting'], ['hello bro', 'greeting'],
    ['bye bye', 'farewell'], ['see you', 'farewell'], ['bye nha', 'farewell']
  ])('returns visible local sticker variants for %s', (message, intent) => {
    const result = getSmartSuggestions(message, { stickers: LOCAL_STICKERS });
    expect(result.stickers.slice(0, 3)).toHaveLength(3);
    expect(result.stickers.slice(0, 3).every(sticker => sticker.intent.includes(intent))).toBe(true);
  });

  test.each([
    ['xin chào', ['bunny_hello', 'bunny_xinchao']],
    ['bye bye', ['bunny_byebye', 'bunny_seeyou']],
    ['sorry nha', ['bunny_sorry']],
    ['nhớ you quá', ['bunny_imissyou', 'bunny_nhoyou']],
    ['ngủ nha', ['bunny_goodnight', 'bunny_sleepy']],
    ['mắc cười quá haha', ['bunny_laugh']],
    ['buồn, bùn quá', ['bunny_cry']],
    ['tức quá, angry', ['bunny_angry']],
    ['omg what shocked', ['bunny_shocked']],
    ['love you, iu quá', ['bunny_love']],
    ['ok, được rồi', ['bunny_thumbsup', 'bunny_okayyy']],
    ["yay let's go", ['bunny_celebrate']]
  ])('surfaces Pastel Bunny for %s', (message, expectedIds) => {
    const ids = getSmartSuggestions(message, { stickers: LOCAL_STICKERS }).stickers.map(sticker => sticker.id);
    expect(expectedIds.some(id => ids.includes(id))).toBe(true);
  });
});
