import { FINISH_MS, HOLD_SHARE, revealed, SWEEP_MS } from './reading-pace';

describe('revealed', () => {
  it('sweeps at 1300 ms for all tiles', () => {
    expect(SWEEP_MS).toBe(1300);
    expect(revealed(140, 1000, null, 1000)).toBe(0);
    expect(revealed(140, 1000, null, 1000 + 650)).toBe(70);
    expect(revealed(140, 1000, null, 1000 + 130)).toBe(14);
  });

  it('holds the last tenth until the first word', () => {
    expect(HOLD_SHARE).toBe(0.9);
    expect(revealed(140, 1000, null, 1000 + 1300)).toBe(126);
    expect(revealed(140, 1000, null, 1000 + 60_000)).toBe(126);
  });

  it('reveals what is left within 300 ms of the first word', () => {
    expect(FINISH_MS).toBe(300);
    // Answered at 500 ms, with 54 tiles shown: the other 86 within 300 ms.
    expect(revealed(140, 0, 500, 500)).toBe(54);
    expect(revealed(140, 0, 500, 650)).toBe(97);
    expect(revealed(140, 0, 500, 800)).toBe(140);
    expect(revealed(140, 0, 500, 5000)).toBe(140);
    // Answered after the hold: the last tenth within 300 ms.
    expect(revealed(140, 0, 4000, 4000)).toBe(126);
    expect(revealed(140, 0, 4000, 4300)).toBe(140);
  });
});
