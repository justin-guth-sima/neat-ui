import { relativeLuminance } from './color';
import { buildColorScale, buildSurfaceScale } from './color-scale';
import { NEAT_DANGER_BASE, NEAT_PRIMARY_BASE, NEAT_WARN_BASE, SIMA_PALETTE } from './palette';

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const SURFACE_STEPS = [0, ...STEPS] as const;
const NEUTRALS: readonly string[] = [
  SIMA_PALETTE.text,
  SIMA_PALETTE.background,
  SIMA_PALETTE.backgroundAlt,
  SIMA_PALETTE.white,
];
const HEX = /^#[0-9A-F]{6}$/;

function pairwise<T>(items: readonly T[]): [T, T][] {
  return items.slice(1).map((item, i) => [items[i], item]);
}

const isChromatic = (color: string): boolean => !NEUTRALS.includes(color);

const chromaticBases = [
  ...Object.values(SIMA_PALETTE).filter(isChromatic),
  NEAT_DANGER_BASE,
  NEAT_WARN_BASE,
];

describe('buildColorScale', () => {
  it('keeps the base colour exactly as step 500', () => {
    const s = buildColorScale(SIMA_PALETTE.orange);
    expect(s[500]).toBe('#D26728');
    for (const base of chromaticBases) expect(buildColorScale(base)[500]).toBe(base);
  });

  it('accepts a lower-case base and answers in upper case', () => {
    expect(buildColorScale('#d26728')).toEqual(buildColorScale('#D26728'));
  });

  it('gets strictly darker from step 50 to step 950 for every chromatic base', () => {
    for (const base of chromaticBases) {
      const s = buildColorScale(base);
      for (const [a, b] of pairwise(STEPS)) {
        expect(relativeLuminance(s[a]), `${base} ${a} vs ${b}`).toBeGreaterThan(
          relativeLuminance(s[b]),
        );
      }
    }
  });

  it('yields only sRGB colours as #RRGGBB', () => {
    for (const base of chromaticBases) {
      for (const step of STEPS) expect(buildColorScale(base)[step]).toMatch(HEX);
    }
  });

  it('starts from the SiMa orange as primary', () => {
    expect(NEAT_PRIMARY_BASE).toBe(SIMA_PALETTE.orange);
  });
});

describe('buildSurfaceScale', () => {
  it('anchors on white, the two palette backgrounds and the palette text', () => {
    const surf = buildSurfaceScale();
    expect([surf[0], surf[50], surf[100], surf[950]]).toEqual([
      '#FFFFFF',
      '#F3F4F5',
      '#E8E9EB',
      '#010F0E',
    ]);
  });

  it('gets strictly darker across all steps', () => {
    const surf = buildSurfaceScale();
    for (const [a, b] of pairwise(SURFACE_STEPS)) {
      expect(relativeLuminance(surf[a]), `${a} vs ${b}`).toBeGreaterThan(
        relativeLuminance(surf[b]),
      );
    }
  });

  it('yields only #RRGGBB colours', () => {
    const surf = buildSurfaceScale();
    for (const step of SURFACE_STEPS) expect(surf[step]).toMatch(HEX);
  });
});
