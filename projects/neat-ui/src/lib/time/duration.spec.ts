import { neatDuration } from './duration';

describe('neatDuration', () => {
  it('says seconds, then minutes and seconds, hours and minutes, days and hours', () => {
    for (const [seconds, text] of [
      [0, '0 s'],
      [42, '42 s'],
      [59, '59 s'],
      [60, '1 min 00 s'],
      [307, '5 min 07 s'],
      [3599, '59 min 59 s'],
      [3600, '1 h 00 min'],
      [2 * 3600 + 5 * 60 + 59, '2 h 05 min'],
      [86_399, '23 h 59 min'],
      [86_400, '1 d 00 h'],
      [3 * 86_400 + 4 * 3600 + 59 * 60, '3 d 04 h'],
      [400 * 86_400, '400 d 00 h'],
    ] as const) {
      expect(neatDuration(seconds), `${seconds} s`).toBe(text);
    }
  });

  it('cuts each unit to whole units, as a clock does, never rounding up', () => {
    expect(neatDuration(4.9)).toBe('4 s');
    expect(neatDuration(59.99)).toBe('59 s');
    expect(neatDuration(312.5)).toBe('5 min 12 s');
    expect(neatDuration(3599.99)).toBe('59 min 59 s');
  });

  it('is a dash for anything that is not a finite length of time', () => {
    for (const value of [null, undefined, Number.NaN, Infinity, -Infinity, -1, -0.5]) {
      expect(neatDuration(value), String(value)).toBe('–');
    }
    // A field of another type from JSON, which the type alone cannot keep out.
    expect(neatDuration('12' as unknown as number)).toBe('–');
  });

  it('reads -0, which a subtraction can give, as 0 s', () => {
    expect(neatDuration(-0)).toBe('0 s');
  });

  describe('with tenths', () => {
    const tenths = (seconds: number | null) => neatDuration(seconds, { tenths: true });

    it('says tenths of a second under a minute, always one digit after the point', () => {
      expect(tenths(0)).toBe('0.0 s');
      expect(tenths(0.85)).toBe('0.8 s');
      expect(tenths(34)).toBe('34.0 s');
      expect(tenths(34.4)).toBe('34.4 s');
    });

    it('cuts to tenths as a clock does, never rounding up into the next unit', () => {
      expect(tenths(34.39)).toBe('34.3 s');
      expect(tenths(59.99)).toBe('59.9 s');
      expect(tenths(60)).toBe('1 min 00 s');
    });

    it('says a minute and more as without tenths', () => {
      expect(tenths(307.5)).toBe('5 min 07 s');
      expect(tenths(7559)).toBe('2 h 05 min');
    });

    it('is a dash for anything that is not a finite length of time', () => {
      expect(tenths(null)).toBe('–');
      expect(tenths(-1)).toBe('–');
      expect(tenths(Number.NaN)).toBe('–');
    });
  });
});
