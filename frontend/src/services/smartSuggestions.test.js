import { analyzeMessage, getSmartSuggestions, normalizeMessage } from './smartSuggestions';
import { LOCAL_STICKERS } from '../data/stickerLibrary';

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
    ['yay', 'happy'], ['love you', 'love'], ['khóc rồi', 'cry']
  ])('returns visible local sticker variants for %s', (message, intent) => {
    const result = getSmartSuggestions(message, { stickers: LOCAL_STICKERS });
    expect(result.stickers.slice(0, 3)).toHaveLength(3);
  });

  test.each([
    ['xin chào', ['pastel-bunny-final-01']],
    ['nhớ you quá', ['pastel-bunny-final-03']],
    ['ngủ nha', ['pastel-bunny-final-12']],
    ['mắc cười quá haha', ['pastel-bunny-final-16']],
    ['buồn, bùn quá', ['pastel-bunny-final-09']],
    ['omg what shocked', ['pastel-bunny-final-15']],
    ['love you, iu quá', ['pastel-bunny-final-03']],
    ['ok, được rồi', ['pastel-bunny-final-06']],
    ["yay let's go", ['pastel-bunny-final-05']]
  ])('surfaces Pastel Bunny for %s', (message, expectedIds) => {
    const ids = getSmartSuggestions(message, { stickers: LOCAL_STICKERS }).stickers.map(sticker => sticker.id);
    expect(expectedIds.some(id => ids.includes(id))).toBe(true);
  });

  test.each([
    ['huhu', 'sadness'], ['hiccc', 'sadness'], ['khóc đây', 'sadness'], ['khóc', 'sadness'], ['bùn', 'sadness'], ['buồn', 'sadness'], ['chán', 'sadness'],
    ['iu', 'affection'], ['yêu', 'affection'], ['ôm', 'hug'], ['dễ thương', 'cute'], ['dệ thưn', 'cute'], ['dễ thưn', 'cute'], ['cute', 'cute'], ['cuti', 'cute'],
    ['ngủ đây', 'sleep'], ['ngủ', 'sleep'], ['đi ngủ', 'sleep'], ['mệt', 'sadness'], ['xong', 'completion'], ['ok', 'approval'], ['oke', 'approval'], ['oki', 'approval'],
    ['hả', 'confusion'], ['chịu', 'helplessness'], ['vỗ tay', 'praise'], ['omg', 'surprise'], ['lol', 'joy'], ['lmao', 'joy'], ['haha', 'joy'], ['hihi', 'joy'], ['hehe', 'joy'],
    ['học', 'study'], ['sorry', 'apology'], ['xin lũi', 'apology'], ['xin lỗi', 'apology'], ['nhớ', 'affection']
  ])('activates the lexicon for %s', (message, concept) => {
    expect(analyzeMessage(message).concepts.map(item => item.id)).toContain(concept);
  });

  test.each(['huhuuu', 'hicccc', 'okiii', 'hahaaa', 'hehee', 'cutiii', 'iuuu', 'mệttt', 'bùnnn'])('normalizes stretched input %s', (message) => {
    expect(analyzeMessage(message).concepts.length).toBeGreaterThan(0);
  });

  test.each(['huhu nhớ m quá', 'oki xong rồi', 'ngủ đây nha', 'xin lũi bro', 'haha dễ thưn quá', 'iu quá trời', 'mệt vl'])('activates combinations for %s', (message) => {
    expect(getSmartSuggestions(message, { stickers: LOCAL_STICKERS }).stickers.length).toBeGreaterThan(0);
  });
});
