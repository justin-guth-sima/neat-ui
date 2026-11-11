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
 * The 1×1 2D context colors are resolved on, made on first use and kept. Internal: specs put a
 * fake in its place, since jsdom has no canvas, or null for none.
 */
export const colorProbe: { context?: CanvasRenderingContext2D | null } = {};

function probe(): CanvasRenderingContext2D | null {
  if (colorProbe.context === undefined) {
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
    if (canvas) canvas.width = canvas.height = 1;
    const context = canvas?.getContext('2d', { willReadFrequently: true }) ?? null;
    // Only a context is kept. Where there is none (jsdom, a server) the next call asks again,
    // which costs nothing a browser pays: a spec that stubs the canvas after code in the same
    // test run resolved a color without one still gets its stub.
    if (!context) return null;
    colorProbe.context = context;
  }
  return colorProbe.context;
}

/**
 * A CSS color as sRGB channels from 0 to 1, for code that draws outside CSS.
 *
 * ```ts
 * const [r, g, b] = neatResolveColor('oklch(0.62 0.19 260)') ?? [0, 0, 0];
 * ```
 *
 * It takes any notation the browser knows: hex, `rgb()`, `oklch()`, a name. It is for code that
 * draws outside CSS, such as three.js or a canvas, which takes colors as numbers. That may be the
 * theme's colors or any other color an app holds.
 *
 * The color is resolved by drawing it on a 1×1 canvas and reading the pixel back, so the kit
 * parses no color syntax of its own. The answer is null where there is no canvas, or the color does
 * not parse. Alpha is ignored, so a token with alpha, such as a scrim, is not a fit.
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
 * The theme's colors, as numbers, for code that draws outside CSS.
 *
 * ```ts
 * readonly colors = neatThemeColors({ line: '--neat-line', grid: '--border' });
 * ```
 *
 * `tokens` maps the app's names to custom properties. The signal answers each resolved, as
 * `neatResolveColor` does, or null where the property is not set or not a color. Call it in an
 * injection context.
 *
 * The colors are read from `element`: the document element by default, or while `element` answers
 * undefined. They are read again when the color scheme changes, which `ThemeService` applies
 * before the signal is read again.
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
