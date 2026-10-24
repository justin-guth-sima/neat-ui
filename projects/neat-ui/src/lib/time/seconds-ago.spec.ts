import { neatSecondsAgo } from './seconds-ago';

describe('neatSecondsAgo', () => {
  // The thresholds and words are Insight's `formatRelativeTime` (#170's "relative times"), which
  // the app will call this function for, so each switch of unit is pinned on both sides.
  it('reads just now under 10 s, then seconds, minutes, hours and days, each cut to whole units', () => {
    for (const [seconds, text] of [
      [0, 'just now'],
      [9, 'just now'],
      [10, '10 s ago'],
      [30, '30 s ago'],
      [59, '59 s ago'],
      [60, '1 min ago'],
      [299, '4 min ago'],
      [3599, '59 min ago'],
      [3600, '1 h ago'],
      [10_800, '3 h ago'],
      [86_399, '23 h ago'],
      [86_400, '1 d ago'],
      [172_800, '2 d ago'],
    ] as const) {
      expect(neatSecondsAgo(seconds), `${seconds} s`).toBe(text);
    }
  });

  it('rounds to whole seconds before it picks the unit, as the app does with a time difference', () => {
    expect(neatSecondsAgo(9.4)).toBe('just now');
    expect(neatSecondsAgo(9.6)).toBe('10 s ago');
    expect(neatSecondsAgo(59.6)).toBe('1 min ago');
  });

  it('reads a time ahead of now, as a clock that stepped back shows it, as just now', () => {
    expect(neatSecondsAgo(-5)).toBe('just now');
  });
});
