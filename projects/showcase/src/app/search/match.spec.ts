import { haystack, matchScore, rank, wordsOf } from './match';

describe('the showcase search matching', () => {
  it('splits names and text into lowercase words', () => {
    expect(wordsOf('FolderOpen')).toEqual(['folder', 'open']);
    expect(wordsOf('folder-open')).toEqual(['folder', 'open']);
    expect(wordsOf('NeatSlider.describedBy')).toEqual(['neat', 'slider', 'described', 'by']);
    expect(wordsOf('Trash2 and a/b_c')).toEqual(['trash', '2', 'and', 'a', 'b', 'c']);
  });

  it('scores the name first: whole, its start, its words, then the other words', () => {
    const hay = haystack('NeatSlider.describedBy', [], ['notes', 'about', 'the', 'slider']);

    expect(matchScore(hay, 'neatslider.describedby')).toBe(0);
    expect(matchScore(hay, 'NeatSl')).toBe(1);
    expect(matchScore(hay, 'described')).toBe(2);
    expect(matchScore(hay, 'describedby')).toBe(2);
    expect(matchScore(hay, 'slider notes')).toBe(3);
    expect(matchScore(hay, 'range')).toBeNull();
  });

  it('counts other names as the name', () => {
    expect(matchScore(haystack('close', ['X']), 'x')).toBe(2);
  });

  it('keeps the matches best first and otherwise in order, and all for an empty query', () => {
    const items = ['Slider', 'Select', 'Search', 'Segmented'];
    const hay = (item: string) => haystack(item);

    expect(rank(items, 'se', hay)).toEqual(['Select', 'Search', 'Segmented']);
    expect(rank(items, 'search', hay)).toEqual(['Search']);
    expect(rank(items, ' ', hay)).toBe(items);
  });
});
