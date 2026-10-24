import { hexToOklab, hexToOklch, relativeLuminance } from './color';
import { buildColorScale, buildNeutralSurfaceScale, buildSurfaceScale } from './color-scale';
import {
  NEAT_DANGER_BASE,
  NEAT_HIGHLIGHT_BASE,
  NEAT_NEAR_BLACK,
  NEAT_PRIMARY_BASE,
  NEAT_WARN_BASE,
  SIMA_PALETTE,
} from './palette';

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const SURFACE_STEPS = [0, ...STEPS] as const;
const NEUTRALS: readonly string[] = [
  SIMA_PALETTE.text,
  SIMA_PALETTE.background,
  SIMA_PALETTE.backgroundAlt,
  SIMA_PALETTE.white,
];
/** Hue drift allowed per step: 8-bit rounding only, not the 19-32° that plain channel clamping causes. */
const MAX_HUE_DRIFT = 5;

function pairwise<T>(items: readonly T[]): [T, T][] {
  return items.slice(1).map((item, i) => [items[i], item]);
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

const isChromatic = (color: string): boolean => !NEUTRALS.includes(color);

const chromaticBases = [
  ...Object.values(SIMA_PALETTE).filter(isChromatic),
  NEAT_DANGER_BASE,
  NEAT_WARN_BASE,
  NEAT_HIGHLIGHT_BASE,
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

  it('keeps the base hue on steps 50 to 900 when pulling colours into sRGB', () => {
    for (const base of chromaticBases) {
      const hue = hexToOklch(base).h;
      const s = buildColorScale(base);
      for (const step of STEPS.filter((step) => step !== 950)) {
        expect(hueDistance(hexToOklch(s[step]).h, hue), `${base} ${step}`).toBeLessThanOrEqual(
          MAX_HUE_DRIFT,
        );
      }
    }
  });

  it('builds the expected orange scale', () => {
    expect(buildColorScale(SIMA_PALETTE.orange)).toEqual({
      50: '#FFECE4',
      100: '#FFDAC8',
      200: '#FFBD9C',
      300: '#F4A076',
      400: '#E28250',
      500: '#D26728',
      600: '#B3541B',
      700: '#91400B',
      800: '#6D2C00',
      900: '#4E1D00',
      950: '#341100',
    });
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

  it('builds the expected surface scale', () => {
    expect(buildSurfaceScale()).toEqual({
      0: '#FFFFFF',
      50: '#F3F4F5',
      100: '#E8E9EB',
      200: '#CDD0D2',
      300: '#ADB3B4',
      400: '#8A9292',
      500: '#687272',
      600: '#4C5858',
      700: '#344141',
      800: '#1F2E2D',
      900: '#0D1D1C',
      950: '#010F0E',
    });
  });
});

describe('buildNeutralSurfaceScale', () => {
  /** A grey: equal channels, which is zero chroma in OKLab up to 8-bit rounding. */
  const isGrey = (hex: string) =>
    hex.slice(1, 3) === hex.slice(3, 5) && hex.slice(3, 5) === hex.slice(5, 7);

  it('is grey at every step, with no hue of its own', () => {
    for (const [step, hex] of Object.entries(buildNeutralSurfaceScale())) {
      expect(isGrey(hex), `${step}: ${hex}`).toBe(true);
    }
  });

  it('anchors on white, greys as light as the two palette backgrounds, and the near-black', () => {
    const neutral = buildNeutralSurfaceScale();
    expect(neutral[0]).toBe('#FFFFFF');
    expect(neutral[950]).toBe(NEAT_NEAR_BLACK);
    for (const [step, color] of [
      [50, SIMA_PALETTE.background],
      [100, SIMA_PALETTE.backgroundAlt],
    ] as const) {
      expect(hexToOklab(neutral[step])[0], `${step}`).toBeCloseTo(hexToOklab(color)[0], 2);
    }
  });

  it('gets strictly darker across all steps', () => {
    const neutral = buildNeutralSurfaceScale();
    for (const [a, b] of pairwise(SURFACE_STEPS)) {
      expect(relativeLuminance(neutral[a]), `${a} vs ${b}`).toBeGreaterThan(
        relativeLuminance(neutral[b]),
      );
    }
  });

  it('builds the expected neutral scale', () => {
    expect(buildNeutralSurfaceScale()).toEqual({
      0: '#FFFFFF',
      50: '#F4F4F4',
      100: '#E9E9E9',
      200: '#D0D0D0',
      300: '#B3B3B3',
      400: '#929292',
      500: '#727272',
      600: '#595959',
      700: '#424242',
      800: '#2E2E2E',
      900: '#1E1E1E',
      950: '#101010',
    });
  });
});

describe('NEAT_HIGHLIGHT_BASE', () => {
  it('has the palette purple’s hue, with more chroma than the pale palette colour', () => {
    const base = hexToOklch(NEAT_HIGHLIGHT_BASE);
    const purple = hexToOklch(SIMA_PALETTE.purple);
    expect(hueDistance(base.h, purple.h)).toBeLessThan(2);
    expect(base.c).toBeGreaterThan(purple.c * 2);
  });
});
