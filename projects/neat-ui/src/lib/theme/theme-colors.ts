import { computed, DOCUMENT, inject, type Signal } from '@angular/core';
import { ThemeService } from './theme.service';

/** A color as sRGB red, green and blue, each from 0 to 1, as WebGL and canvas code take it. */
export type NeatRgb = readonly [red: number, green: number, blue: number];

/*
 * The colors the probe's fill is set to before the color asked for. A canvas keeps its last
 * fill when given one it cannot parse, so the color parsed only if both reads agree; with one
 * sentinel, a color equal to it would read as unparsed.
 */
const SENTINELS = ['#000000', '#ffffff'] as const;

/**
 * The 1×1 2D context colors are resolved on, made on first use (null where there is no canvas).
 * Internal: specs put a fake in its place, since jsdom has no canvas.
 */
export const colorProbe: { context?: CanvasRenderingContext2D | null } = {};

function probe(): CanvasRenderingContext2D | null {
  if (colorProbe.context === undefined) {
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
    if (canvas) canvas.width = canvas.height = 1;
    colorProbe.context = canvas?.getContext('2d', { willReadFrequently: true }) ?? null;
  }
  return colorProbe.context;
}

/**
 * A CSS color in any notation the browser knows (hex, `rgb()`, `oklch()`, a name) as sRGB
 * channels from 0 to 1, resolved by drawing it on a 1×1 canvas and reading the pixel back, so the
 * kit parses no color syntax of its own. Null where there is no canvas or the color does not
 * parse. For code that draws outside CSS (three.js, a canvas) in the theme's colors or any other
 * color an app holds, which such code takes as numbers. Alpha is ignored, so a token with alpha
 * (a scrim) is not a fit.
 */
export function neatResolveColor(css: string): NeatRgb | null {
  const context = probe();
  if (!context) return null;
  const parsed = SENTINELS.map((sentinel) => {
    context.fillStyle = sentinel;
    context.fillStyle = css;
    return context.fillStyle;
  });
  if (parsed[0] !== parsed[1]) return null;
  context.clearRect(0, 0, 1, 1);
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  return [red / 255, green / 255, blue / 255];
}

/**
 * The theme's colors for code that draws outside CSS: `tokens` maps the app's names to custom
 * properties (`{ line: '--neat-line', grid: '--border' }`), and the signal answers each resolved
 * (`neatResolveColor`), or null where the property is not set or not a color. They are read from
 * `element` (the document element by default, or while it answers undefined) and read again when
 * the color scheme changes, which `ThemeService` applies before the signal is read again. Call in
 * an injection context.
 */
export function neatThemeColors<K extends string>(
  tokens: Record<K, string>,
  element?: () => Element | undefined,
): Signal<Record<K, NeatRgb | null>> {
  const document = inject(DOCUMENT);
  const theme = inject(ThemeService);
  return computed(() => {
    theme.scheme();
    const style = getComputedStyle(element?.() ?? document.documentElement);
    const entries = Object.entries<string>(tokens).map(([name, token]) => [
      name,
      neatResolveColor(style.getPropertyValue(token).trim()),
    ]);
    return Object.fromEntries(entries) as Record<K, NeatRgb | null>;
  });
}
