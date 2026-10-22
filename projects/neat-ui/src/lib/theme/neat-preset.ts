import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import type { Preset } from '@primeuix/themes/types';
import { buildColorScale, buildSurfaceScale } from './color-scale';
import { along, CONTRAST_RULES, firstReadable } from './contrast-rules';
import { NEAT_DANGER_BASE, NEAT_PRIMARY_BASE, NEAT_WARN_BASE, SIMA_PALETTE } from './palette';

const primary = buildColorScale(NEAT_PRIMARY_BASE);
const surface = buildSurfaceScale();
const success = buildColorScale(SIMA_PALETTE.green);
const info = buildColorScale(SIMA_PALETTE.blue);
const warn = buildColorScale(NEAT_WARN_BASE);
const danger = buildColorScale(NEAT_DANGER_BASE);

const { light, dark } = CONTRAST_RULES;

const lightPrimary = firstReadable(primary, light.colorWalk, [surface[light.onColor]]);
const darkPrimary = firstReadable(primary, dark.colorWalk, [surface[dark.onColor]]);
const lightMuted = firstReadable(
  surface,
  light.surfaceWalk,
  light.textBackgrounds.map((step) => surface[step]),
);
const darkMuted = firstReadable(
  surface,
  dark.surfaceWalk,
  dark.textBackgrounds.map((step) => surface[step]),
);

const lightDark = (lightValue: string, darkValue: string) =>
  `light-dark(${lightValue}, ${darkValue})`;
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
        primaryStep(light.colorWalk, lightPrimary, 0),
        primaryStep(dark.colorWalk, darkPrimary, 0),
      ),
      contrastColor: lightDark(surfaceStep(light.onColor), surfaceStep(dark.onColor)),
      hoverColor: lightDark(
        primaryStep(light.colorWalk, lightPrimary, 1),
        primaryStep(dark.colorWalk, darkPrimary, 1),
      ),
      activeColor: lightDark(
        primaryStep(light.colorWalk, lightPrimary, 2),
        primaryStep(dark.colorWalk, darkPrimary, 2),
      ),
    },
    surface,
    content: {
      background: lightDark(surfaceStep(light.background), surfaceStep(dark.background)),
    },
    text: {
      color: lightDark(surfaceStep(light.text), surfaceStep(dark.text)),
      hoverColor: lightDark(surfaceStep(light.text), surfaceStep(dark.text)),
      mutedColor: lightDark(
        surfaceStep(along(light.surfaceWalk, lightMuted, 0)),
        surfaceStep(along(dark.surfaceWalk, darkMuted, 0)),
      ),
      hoverMutedColor: lightDark(
        surfaceStep(along(light.surfaceWalk, lightMuted, 1)),
        surfaceStep(along(dark.surfaceWalk, darkMuted, 1)),
      ),
    },
  },
});
