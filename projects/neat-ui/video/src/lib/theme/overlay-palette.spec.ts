import { OVERLAY_NEUTRAL_COLOR, OVERLAY_PALETTE } from './overlay-palette';

// A simple RGB Euclidean distance on the 0-255 scale. Used as a cheap proxy for perceptual
// separation between palette colors so nearby slots don't look alike on screen.
function hexDistance(a: string, b: string): number {
  const parse = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16));
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

describe('overlay palette', () => {
  it('has 40 distinct hex colors and a neutral color', () => {
    expect(OVERLAY_PALETTE.length).toBe(40);
    expect(new Set(OVERLAY_PALETTE).size).toBe(40);
    OVERLAY_PALETTE.forEach((color) => expect(color).toMatch(/^#[0-9a-f]{6}$/));
    expect(OVERLAY_NEUTRAL_COLOR).toBe('#f8fafc');
    expect(OVERLAY_PALETTE.includes(OVERLAY_NEUTRAL_COLOR)).toBe(false);
  });

  it('keeps entries perceptually separate, except the ten original, already-shipped track colors', () => {
    // PALETTE[0..9] are the original track colors (kept exactly as-is; existing tests key on
    // PALETTE[0..5]) and already ship with a couple of pairs closer than 60 apart. Every pair
    // that involves one of the ten colors added after them (10..19) must stay at least 60
    // apart. The twenty overflow colors (20..39) are only handed out once a channel shows more
    // than twenty identities at once; they stay at least 45 apart from every other entry, which
    // is as far as forty colors can be pushed while staying readable over video.
    const MIN_DISTANCE_CORE = 60;
    const MIN_DISTANCE_OVERFLOW = 45;
    for (let i = 0; i < OVERLAY_PALETTE.length; i += 1) {
      for (let j = i + 1; j < OVERLAY_PALETTE.length; j += 1) {
        if (i < 10 && j < 10) continue;
        const minDistance = j >= 20 ? MIN_DISTANCE_OVERFLOW : MIN_DISTANCE_CORE;
        const distance = hexDistance(OVERLAY_PALETTE[i], OVERLAY_PALETTE[j]);
        expect(
          distance,
          `PALETTE[${i}]=${OVERLAY_PALETTE[i]} and PALETTE[${j}]=${OVERLAY_PALETTE[j]} are only ${distance.toFixed(1)} apart`,
        ).toBeGreaterThanOrEqual(minDistance);
      }
    }
  });
});
