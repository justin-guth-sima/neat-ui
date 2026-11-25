import { COMMON_WORDS } from './common-words';

describe('COMMON_WORDS', () => {
  it('holds 100 distinct words, "the" first and "us" last', () => {
    expect(COMMON_WORDS).toHaveLength(100);
    expect(new Set(COMMON_WORDS).size).toBe(100);
    expect(COMMON_WORDS[0]).toBe('the');
    expect(COMMON_WORDS.at(-1)).toBe('us');
    for (const word of COMMON_WORDS) expect(word).toMatch(/^[A-Za-z]+$/);
  });
});
