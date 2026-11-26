/**
 * The 100 most common words in English, in rank order: most of the word cloud's words, decoration
 * rather than the model's runners-up (which the board does not expose). Copied from Wikipedia's "Most
 * common words in English" (https://en.wikipedia.org/wiki/Most_common_words_in_English), the
 * Oxford English Corpus list. Ten words a line, so a word's rank is easy to find. Internal.
 */
// prettier-ignore
export const COMMON_WORDS: readonly string[] = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
];

/**
 * A few of the most common words of six other languages, by their ISO 639-1 code: function words
 * that are among the most frequent of each language, chosen by hand, so the word cloud reads as a
 * model that speaks more than English. Internal.
 */
export const OTHER_LANGUAGES_WORDS: Readonly<Record<string, readonly string[]>> = {
  de: ['und', 'ist', 'nicht', 'auch', 'mit', 'ich'],
  es: ['que', 'el', 'por', 'pero', 'más', 'muy'],
  fr: ['le', 'et', 'les', 'avec', 'pour', 'très'],
  ja: ['の', 'は', 'です', 'ます', 'こと', 'ない'],
  hi: ['है', 'और', 'के', 'में', 'का', 'की'],
  zh: ['的', '是', '不', '我', '了', '在'],
};

/** The word cloud's words: the English ones, then the other languages', about a quarter of them. */
export const CLOUD_WORDS: readonly string[] = [
  ...COMMON_WORDS,
  ...Object.values(OTHER_LANGUAGES_WORDS).flat(),
];
