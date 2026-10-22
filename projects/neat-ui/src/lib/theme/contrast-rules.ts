import { contrastRatio } from './color';
import type { ColorScale, ColorStep } from './color-scale';
import type { NeatColorScheme } from './theme.service';

/** WCAG 2.x AA for normal text. */
const MIN_CONTRAST = 4.5;

type ScaleStep = keyof ColorScale;

/** Where a colour scheme puts text, and in which order it searches scales for a readable step. */
export interface SchemeContrastRules {
  /** Surface step of the content background. */
  readonly background: ColorStep;
  /** Surface step of body text. */
  readonly text: ColorStep;
  /** Surface step of text on a filled colour (a primary button, for example). */
  readonly onColor: ColorStep;
  /** Every surface step text sits on; text steps must reach MIN_CONTRAST on all of them. */
  readonly textBackgrounds: readonly ColorStep[];
  /** Colour-scale steps from the base away from the background, in search order. */
  readonly colorWalk: readonly ScaleStep[];
  /** Surface steps from mid grey away from the background, in search order. */
  readonly surfaceWalk: readonly ColorStep[];
}

/**
 * The contrast rules every theme layer derives its text colours from. Light text sits on white and
 * on the palette background (50) used by the shell and pages; dark text on the content background
 * (900) and the raised surface (800). Filled colours carry white text in light and the palette text
 * in dark.
 */
export const CONTRAST_RULES: Record<NeatColorScheme, SchemeContrastRules> = {
  light: {
    background: 0,
    text: 950,
    onColor: 0,
    textBackgrounds: [0, 50],
    colorWalk: [500, 600, 700, 800, 900, 950],
    surfaceWalk: [500, 600, 700, 800, 900, 950],
  },
  dark: {
    background: 900,
    text: 0,
    onColor: 950,
    textBackgrounds: [900, 800],
    colorWalk: [400, 300, 200, 100, 50],
    surfaceWalk: [400, 300, 200, 100, 50, 0],
  },
};

/** Index into a walk of steps: the first step that reaches MIN_CONTRAST on every one of `backgrounds`. */
export function firstReadable<S extends number>(
  scale: Record<S, string>,
  walk: readonly S[],
  backgrounds: readonly string[],
): number {
  const index = walk.findIndex((step) =>
    backgrounds.every((background) => contrastRatio(scale[step], background) >= MIN_CONTRAST),
  );
  if (index < 0) {
    throw new Error(
      `No step of [${walk.join(', ')}] reaches ${MIN_CONTRAST}:1 on all of ${backgrounds.join(', ')}`,
    );
  }
  return index;
}

/** The step `offset` places further along a walk, stopping at its end. */
export function along<S extends number>(walk: readonly S[], index: number, offset: number): S {
  return walk[Math.min(index + offset, walk.length - 1)];
}
