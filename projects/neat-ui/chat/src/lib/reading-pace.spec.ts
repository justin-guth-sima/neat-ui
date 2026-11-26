import { FINISH_MS, readingAt, REST_MS, ROUND_MS, SWEEP_MS } from './reading-pace';

describe('readingAt', () => {
  it('sweeps at 1300 ms for all tiles', () => {
    expect(SWEEP_MS).toBe(1300);
    expect(readingAt(140, 1000, null, 1000)).toEqual({ round: 0, shown: 0 });
    expect(readingAt(140, 1000, null, 1000 + 650)).toEqual({ round: 0, shown: 70 });
    expect(readingAt(140, 1000, null, 1000 + 130)).toEqual({ round: 0, shown: 14 });
    expect(readingAt(140, 1000, null, 1000 + 1300)).toEqual({ round: 0, shown: 140 });
  });

  it('rests on the whole picture, then sweeps again while the first word is not there', () => {
    expect(REST_MS).toBe(500);
    expect(ROUND_MS).toBe(SWEEP_MS + REST_MS);
    expect(readingAt(140, 0, null, 1799)).toEqual({ round: 0, shown: 140 });
    expect(readingAt(140, 0, null, 1800)).toEqual({ round: 1, shown: 0 });
    expect(readingAt(140, 0, null, 1800 + 650)).toEqual({ round: 1, shown: 70 });
    expect(readingAt(140, 0, null, 33 * 1800 + 1300)).toEqual({ round: 33, shown: 140 });
  });

  it('finishes the round within 300 ms of the first word, and starts no other', () => {
    expect(FINISH_MS).toBe(300);
    // Answered at 500 ms, with 54 tiles shown: the other 86 within 300 ms.
    expect(readingAt(140, 0, 500, 500)).toEqual({ round: 0, shown: 54 });
    expect(readingAt(140, 0, 500, 650)).toEqual({ round: 0, shown: 97 });
    expect(readingAt(140, 0, 500, 800)).toEqual({ round: 0, shown: 140 });
    // Answered 400 ms into the third round: its 43 tiles, then the rest; the round stays.
    expect(readingAt(140, 0, 4000, 4000)).toEqual({ round: 2, shown: 43 });
    expect(readingAt(140, 0, 4000, 4300)).toEqual({ round: 2, shown: 140 });
    expect(readingAt(140, 0, 4000, 9000)).toEqual({ round: 2, shown: 140 });
  });
});
