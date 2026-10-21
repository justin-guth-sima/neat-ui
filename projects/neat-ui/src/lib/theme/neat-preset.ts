import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import type { Preset } from '@primeuix/themes/types';
import { contrastRatio } from './color';
import { buildColorScale, buildSurfaceScale } from './color-scale';
import { NEAT_DANGER_BASE, NEAT_PRIMARY_BASE, NEAT_WARN_BASE, SIMA_PALETTE } from './palette';

/** WCAG 2.x AA for normal text. */
const MIN_CONTRAST = 4.5;

const primary = buildColorScale(NEAT_PRIMARY_BASE);
const surface = buildSurfaceScale();
const success = buildColorScale(SIMA_PALETTE.green);
const info = buildColorScale(SIMA_PALETTE.blue);
const warn = buildColorScale(NEAT_WARN_BASE);
const danger = buildColorScale(NEAT_DANGER_BASE);

/** Content background step per scheme; the text and primary choices below are checked against it. */
const LIGHT_BACKGROUND = 0;
const DARK_BACKGROUND = 900;
/** Body text: the palette text in light, white in dark. */
const LIGHT_TEXT = 950;
const DARK_TEXT = 0;

/** Primary steps from 500 towards dark, and from 400 towards light. */
const PRIMARY_DARKWARD = [500, 600, 700, 800, 900, 950] as const;
const PRIMARY_LIGHTWARD = [400, 300, 200, 100, 50] as const;
/** Surface steps from mid grey towards the palette text, and towards white. */
const SURFACE_DARKWARD = [500, 600, 700, 800, 900, 950] as const;
const SURFACE_LIGHTWARD = [400, 300, 200, 100, 50, 0] as const;

/** Index into a walk of steps: the first step that reaches MIN_CONTRAST against `background`. */
function firstReadable<S extends number>(
  scale: Record<S, string>,
  walk: readonly S[],
  background: string,
): number {
  const index = walk.findIndex((step) => contrastRatio(scale[step], background) >= MIN_CONTRAST);
  if (index < 0) {
    throw new Error(`No step of [${walk.join(', ')}] reaches ${MIN_CONTRAST}:1 on ${background}`);
  }
  return index;
}

/** The step `offset` places further along a walk, stopping at its end. */
function along<S extends number>(walk: readonly S[], index: number, offset: number): S {
  return walk[Math.min(index + offset, walk.length - 1)];
}

const lightPrimary = firstReadable(primary, PRIMARY_DARKWARD, surface[0]);
const darkPrimary = firstReadable(primary, PRIMARY_LIGHTWARD, surface[950]);
const lightMuted = firstReadable(surface, SURFACE_DARKWARD, surface[LIGHT_BACKGROUND]);
const darkMuted = firstReadable(surface, SURFACE_LIGHTWARD, surface[DARK_BACKGROUND]);

const lightDark = (light: string, dark: string) => `light-dark(${light}, ${dark})`;
const primaryStep = (walk: readonly number[], index: number, offset: number) =>
  `{primary.${along(walk, index, offset)}}`;
const surfaceStep = (step: number) => `{surface.${step}}`;

/**
 * The SiMa preset on top of Aura. Primary and surface come from the palette; hover and active
 * states step one and two places further from the background. Aura's severity colours come from
 * primitive families (green, sky/blue, orange/amber/yellow, red), so those families are replaced
 * by the SiMa functional scales and every severity-aware component follows.
 */
export const NeatPreset: Preset = definePreset(Aura, {
  primitive: {
    green: success,
    sky: info,
    blue: info,
    orange: warn,
    amber: warn,
    yellow: warn,
    red: danger,
  },
  semantic: {
    primary: {
      ...primary,
      color: lightDark(
        primaryStep(PRIMARY_DARKWARD, lightPrimary, 0),
        primaryStep(PRIMARY_LIGHTWARD, darkPrimary, 0),
      ),
      contrastColor: lightDark(surfaceStep(0), surfaceStep(950)),
      hoverColor: lightDark(
        primaryStep(PRIMARY_DARKWARD, lightPrimary, 1),
        primaryStep(PRIMARY_LIGHTWARD, darkPrimary, 1),
      ),
      activeColor: lightDark(
        primaryStep(PRIMARY_DARKWARD, lightPrimary, 2),
        primaryStep(PRIMARY_LIGHTWARD, darkPrimary, 2),
      ),
    },
    surface,
    content: {
      background: lightDark(surfaceStep(LIGHT_BACKGROUND), surfaceStep(DARK_BACKGROUND)),
    },
    text: {
      color: lightDark(surfaceStep(LIGHT_TEXT), surfaceStep(DARK_TEXT)),
      hoverColor: lightDark(surfaceStep(LIGHT_TEXT), surfaceStep(DARK_TEXT)),
      mutedColor: lightDark(
        surfaceStep(along(SURFACE_DARKWARD, lightMuted, 0)),
        surfaceStep(along(SURFACE_LIGHTWARD, darkMuted, 0)),
      ),
      hoverMutedColor: lightDark(
        surfaceStep(along(SURFACE_DARKWARD, lightMuted, 1)),
        surfaceStep(along(SURFACE_LIGHTWARD, darkMuted, 1)),
      ),
    },
  },
});
