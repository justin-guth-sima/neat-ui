import {
  hexToOklab,
  hexToOklch,
  isInSrgbGamut,
  normalizeHex,
  Oklch,
  oklabToHex,
  oklchToHex,
} from './color';
import { NEAT_NEAR_BLACK, SIMA_PALETTE } from './palette';

/**
 * A step of a ramp, named as Tailwind names its shades: 50 the lightest through 950 the darkest.
 * Step 0 exists only in a surface ramp, where it is white.
 */
export type ColorStep = 0 | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;
/** A color ramp: a hex color for each step from 50 to 950, as `buildColorScale` makes it. */
export type ColorScale = Record<Exclude<ColorStep, 0>, string>;
/** A ramp of surface colors, white at step 0 to the darkest at 950, from the surface builders. */
export type SurfaceScale = Record<ColorStep, string>;

type LighterStep = 50 | 100 | 200 | 300 | 400;
type DarkerStep = 600 | 700 | 800 | 900 | 950;
type InterpolatedSurfaceStep = 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

/** OKLCH lightness that lighter steps move towards. */
const LIGHTEST_L = 0.985;
/** OKLCH lightness that darker steps move towards. */
const DARKEST_L = 0.13;
/** How far each lighter step moves from the base towards LIGHTEST_L. */
const LIGHTER_FRACTIONS: Record<LighterStep, number> = {
  50: 0.92,
  100: 0.8,
  200: 0.62,
  300: 0.42,
  400: 0.2,
};
/** How far each darker step moves from the base towards DARKEST_L. */
const DARKER_FRACTIONS: Record<DarkerStep, number> = {
  600: 0.15,
  700: 0.32,
  800: 0.5,
  900: 0.66,
  950: 0.8,
};
/** Chroma shrinks by this share of the step's fraction, so the ends of the ramp are calmer. */
const CHROMA_FALLOFF = 0.6;
/** Bisection rounds when pulling chroma back into sRGB; far below one 8-bit step. */
const GAMUT_SEARCH_ROUNDS = 24;
/** Position of each interpolated surface step between the alternate background and the text. */
const SURFACE_FRACTIONS: Record<InterpolatedSurfaceStep, number> = {
  200: 0.1,
  300: 0.22,
  400: 0.36,
  500: 0.5,
  600: 0.62,
  700: 0.73,
  800: 0.83,
  900: 0.92,
};

/** Reduces chroma, keeping lightness and hue, until the color fits in sRGB. */
export function fitToSrgb(color: Oklch): Oklch {
  if (isInSrgbGamut(color)) return color;
  let inside = 0;
  let outside = color.c;
  for (let round = 0; round < GAMUT_SEARCH_ROUNDS; round++) {
    const c = (inside + outside) / 2;
    if (isInSrgbGamut({ ...color, c })) inside = c;
    else outside = c;
  }
  return { ...color, c: inside };
}

function shade(base: Oklch, targetL: number, fraction: number): string {
  return oklchToHex(
    fitToSrgb({
      l: base.l + (targetL - base.l) * fraction,
      c: base.c * (1 - CHROMA_FALLOFF * fraction),
      h: base.h,
    }),
  );
}

/** Builds a 50-950 ramp in OKLCH around `base`, which becomes step 500 unchanged. */
export function buildColorScale(base: string): ColorScale {
  const oklch = hexToOklch(base);
  const lighter = (step: LighterStep) => shade(oklch, LIGHTEST_L, LIGHTER_FRACTIONS[step]);
  const darker = (step: DarkerStep) => shade(oklch, DARKEST_L, DARKER_FRACTIONS[step]);
  return {
    50: lighter(50),
    100: lighter(100),
    200: lighter(200),
    300: lighter(300),
    400: lighter(400),
    500: normalizeHex(base),
    600: darker(600),
    700: darker(700),
    800: darker(800),
    900: darker(900),
    950: darker(950),
  };
}

/** The anchors of a surface ramp that are not white: the two light backgrounds and the darkest step. */
interface SurfaceAnchors {
  readonly background: string;
  readonly backgroundAlt: string;
  readonly darkest: string;
}

/**
 * White and the anchors, with 200-900 interpolated in OKLab between the alternate background and
 * the darkest step.
 */
function surfaceRamp({ background, backgroundAlt, darkest }: SurfaceAnchors): SurfaceScale {
  const from = hexToOklab(backgroundAlt);
  const to = hexToOklab(darkest);
  const between = (step: InterpolatedSurfaceStep) => {
    const t = SURFACE_FRACTIONS[step];
    const mix = (channel: 0 | 1 | 2) => from[channel] + (to[channel] - from[channel]) * t;
    return oklabToHex([mix(0), mix(1), mix(2)]);
  };
  return {
    0: SIMA_PALETTE.white,
    50: background,
    100: backgroundAlt,
    200: between(200),
    300: between(300),
    400: between(400),
    500: between(500),
    600: between(600),
    700: between(700),
    800: between(800),
    900: between(900),
    950: darkest,
  };
}

/** The gray as light as `hex` in OKLab: the color with its chroma removed. */
function gray(hex: string): string {
  return oklabToHex([hexToOklab(hex)[0], 0, 0]);
}

/**
 * Builds the brand surface ramp, the light scheme's surfaces.
 *
 * White, the two palette backgrounds and the palette text are its anchors. Steps 200-900 are
 * interpolated in OKLab between the alternate background and the text.
 */
export function buildSurfaceScale(): SurfaceScale {
  return surfaceRamp({
    background: SIMA_PALETTE.background,
    backgroundAlt: SIMA_PALETTE.backgroundAlt,
    darkest: SIMA_PALETTE.text,
  });
}

/**
 * Builds the neutral surface ramp, the dark scheme's surfaces, which carry no hue of their own.
 *
 * It is the brand ramp's construction in grays only. It runs from grays as light as the two palette
 * backgrounds down to the near-black (`NEAT_NEAR_BLACK`).
 */
export function buildNeutralSurfaceScale(): SurfaceScale {
  return surfaceRamp({
    background: gray(SIMA_PALETTE.background),
    backgroundAlt: gray(SIMA_PALETTE.backgroundAlt),
    darkest: NEAT_NEAR_BLACK,
  });
}
