// Extend these seed maps as new personal vocabulary appears. They are kept
// separate from ranking so normalization and activation remain independently testable.
export const SMART_SUGGESTION_NORMALIZATION = {
  'dệ thưn': 'dễ thương',
  'dễ thưn': 'dễ thương',
  'xin lũi': 'xin lỗi',
  cuti: 'cute',
  iuuu: 'iu',
  iuu: 'iu',
  okii: 'oki',
  okiii: 'oki',
  hihiii: 'hihi',
  hihii: 'hihi',
  huhuuu: 'huhu',
  huhuu: 'huhu',
  hicccc: 'hiccc',
  hicc: 'hiccc',
  hahaaa: 'haha',
  hahaa: 'haha',
  hehee: 'hehe',
  cutiii: 'cuti',
  cutii: 'cuti',
  mệttt: 'mệt',
  mệtt: 'mệt',
  bùnnn: 'buồn',
  bùnn: 'buồn'
};

export const SMART_SUGGESTION_TRIGGERS = {
  crying: ['huhu', 'hiccc', 'khóc đây', 'khóc'],
  sadness: ['bùn', 'buồn', 'chán'],
  affection: ['iu', 'yêu', 'nhớ'],
  hug: ['ôm'],
  cute: ['dễ thương', 'cute'],
  sleep: ['ngủ đây', 'ngủ', 'đi ngủ'],
  tired: ['mệt'],
  completion: ['xong'],
  approval: ['ok', 'oke', 'oki'],
  confusion: ['hả'],
  helplessness: ['chịu'],
  applause: ['vỗ tay'],
  laughter: ['lol', 'lmao', 'haha', 'hihi', 'hehe'],
  study: ['học'],
  apology: ['sorry', 'xin lũi', 'xin lỗi']
};

export const SMART_SUGGESTION_CONCEPTS = {
  crying: ['sadness'], sadness: ['sadness'], affection: ['affection'], hug: ['hug'],
  cute: ['cute'], sleep: ['sleep'], tired: ['sadness'], completion: ['completion'],
  approval: ['approval'], confusion: ['confusion'], helplessness: ['helplessness'],
  applause: ['praise'], laughter: ['joy'], study: ['study'], apology: ['apology']
};

export const normalizeStretchedText = (value = '') => value
  .normalize('NFC')
  .toLowerCase()
  .replace(/([a-zà-ỹ])\1{2,}/giu, '$1$1');

export const applyLexiconNormalization = (value = '') => {
  let normalized = normalizeStretchedText(value);
  const aliases = Object.entries(SMART_SUGGESTION_NORMALIZATION).sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of aliases) normalized = normalized.replaceAll(from, to);
  return normalized;
};
