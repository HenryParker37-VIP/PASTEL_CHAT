import { analyzeMessage, getSmartSuggestions, normalizeMessage } from './smartSuggestions';
import { LOCAL_STICKERS } from '../data/stickerPacks';

describe('smart sticker suggestions', () => {
  test.each([
    ['buồn quá', 'sadness'], ['xin lỗi nha', 'apology'], ['ngủ ngon', 'sleep'], ['mai thi rồi cứu t', 'panic'],
    ['tức vl', 'anger'], ['êy đi ăn ko', 'food'], ['m giỏi quá', 'praise'], ['nhớ m ghê', 'affection'],
    ['I miss you', 'affection'], ['I’m so tired', 'sadness'], ['good night', 'sleep'], ['I’m cooked', 'panic'],
    ['that was hilarious', 'joy'], ['I’m proud of you', 'praise'], ['sorry about that', 'apology'], ['let’s gooo', 'joy'],
    ['sorry nha', 'apology'], ['miss u quá', 'affection'], ['t so tired', 'sadness'], ['good night nha', 'sleep'],
    ['mai thi and I’m cooked', 'panic'], ['omg xỉu', 'surprise'], ['cứu bro', 'panic'], ['love this quá', 'affection']
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
});
