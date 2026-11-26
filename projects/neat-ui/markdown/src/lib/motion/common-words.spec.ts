import { CLOUD_WORDS, COMMON_WORDS, OTHER_LANGUAGES_WORDS } from './common-words';

describe('COMMON_WORDS', () => {
  it('holds 100 distinct words, "the" first and "us" last', () => {
    expect(COMMON_WORDS).toHaveLength(100);
    expect(new Set(COMMON_WORDS).size).toBe(100);
    expect(COMMON_WORDS[0]).toBe('the');
    expect(COMMON_WORDS.at(-1)).toBe('us');
    for (const word of COMMON_WORDS) expect(word).toMatch(/^[A-Za-z]+$/);
  });
});

describe('CLOUD_WORDS', () => {
  it('are the English words and a few common words of six other languages, all distinct', () => {
    const languages = Object.keys(OTHER_LANGUAGES_WORDS);
    expect(languages).toEqual(['de', 'es', 'fr', 'ja', 'hi', 'zh']);
    for (const language of languages)
      expect(OTHER_LANGUAGES_WORDS[language], language).toHaveLength(6);
    const others = Object.values(OTHER_LANGUAGES_WORDS).flat();
    expect(CLOUD_WORDS).toEqual([...COMMON_WORDS, ...others]);
    expect(new Set(CLOUD_WORDS).size).toBe(CLOUD_WORDS.length);
    // About a quarter of what the cloud shows is not English.
    expect(others.length / CLOUD_WORDS.length).toBeGreaterThan(0.2);
    for (const word of CLOUD_WORDS) expect(word).toMatch(/^\S+$/u);
  });
});
