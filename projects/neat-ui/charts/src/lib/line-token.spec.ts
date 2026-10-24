import { lineToken, seriesToken, textToken } from './line-token';

describe('lineToken', () => {
  it('maps each tone to its line token, the one place the charts do', () => {
    expect(lineToken('default')).toBe('var(--neat-line)');
    expect(lineToken('warning')).toBe('var(--neat-line-warning)');
    expect(lineToken('danger')).toBe('var(--neat-line-danger)');
  });

  it('maps a tone to a text colour: the foreground by default, the line tokens for warning and danger', () => {
    expect(textToken('default')).toBe('var(--foreground)');
    expect(textToken('warning')).toBe('var(--neat-line-warning)');
    expect(textToken('danger')).toBe('var(--neat-line-danger)');
  });

  it('counts series from 1 in the palette', () => {
    expect([0, 1, 7].map(seriesToken)).toEqual([
      'var(--neat-series-1)',
      'var(--neat-series-2)',
      'var(--neat-series-8)',
    ]);
  });
});
