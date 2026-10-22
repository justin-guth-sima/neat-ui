/**
 * Colour maths for the theme: hex <-> linear sRGB <-> OKLab/OKLCH, and WCAG 2.x contrast.
 * OKLab matrices from Björn Ottosson, "A perceptual color space for image processing" (2020).
 */

/** OKLCH: lightness 0..1, chroma >= 0, hue in degrees. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

/** Three channels: gamma-encoded or linear sRGB, or OKLab `[L, a, b]`. */
type Vec3 = readonly [number, number, number];

const HEX_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
/** Tolerance for float error when deciding whether a colour lies inside the sRGB cube. */
const GAMUT_EPSILON = 1e-6;

function parseHex(hex: string): Vec3 {
  const match = HEX_PATTERN.exec(hex);
  if (!match) throw new Error(`Expected a #RRGGBB colour, got "${hex}"`);
  return [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255];
}

function formatHex(rgb: Vec3): string {
  const channel = (value: number) =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${rgb.map(channel).join('')}`.toUpperCase();
}

function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function fromLinear(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
}

function linearToOklab([r, g, b]: Vec3): Vec3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear([lightness, a, b]: Vec3): Vec3 {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Validates `#RRGGBB` in either case and returns it in upper case. */
export function normalizeHex(hex: string): string {
  return formatHex(parseHex(hex));
}

function hexToLinear(hex: string): Vec3 {
  const [r, g, b] = parseHex(hex);
  return [toLinear(r), toLinear(g), toLinear(b)];
}

function linearToHex([r, g, b]: Vec3): string {
  return formatHex([fromLinear(r), fromLinear(g), fromLinear(b)]);
}

/** Converts `#RRGGBB` (either case) to OKLab `[L, a, b]`. */
export function hexToOklab(hex: string): Vec3 {
  return linearToOklab(hexToLinear(hex));
}

/** Converts OKLab `[L, a, b]` to upper-case `#RRGGBB`, clamping channels into sRGB. */
export function oklabToHex(lab: Vec3): string {
  return linearToHex(oklabToLinear(lab));
}

function oklchToOklab({ l, c, h }: Oklch): Vec3 {
  const radians = (h * Math.PI) / 180;
  return [l, c * Math.cos(radians), c * Math.sin(radians)];
}

/** Converts `#RRGGBB` (either case) to OKLCH. */
export function hexToOklch(hex: string): Oklch {
  const [l, a, b] = hexToOklab(hex);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { l, c: Math.hypot(a, b), h: h < 0 ? h + 360 : h };
}

/** Converts OKLCH to upper-case `#RRGGBB`, clamping channels into sRGB. */
export function oklchToHex(color: Oklch): string {
  return oklabToHex(oklchToOklab(color));
}

/** Whether an OKLCH colour can be shown in sRGB without clamping. */
export function isInSrgbGamut(color: Oklch): boolean {
  return oklabToLinear(oklchToOklab(color)).every(
    (channel) => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON,
  );
}

/**
 * `foreground` at `alpha` (0 to 1) over an opaque `background`, blended per channel in
 * gamma-encoded sRGB as browsers composite a translucent fill such as Tailwind's `bg-x/10`.
 */
export function composite(foreground: string, alpha: number, background: string): string {
  const top = parseHex(foreground);
  const bottom = parseHex(background);
  const mix = (channel: 0 | 1 | 2) => top[channel] * alpha + bottom[channel] * (1 - alpha);
  return formatHex([mix(0), mix(1), mix(2)]);
}

/**
 * `color` with an alpha channel, as `#RRGGBBAA`, for a translucent token such as a scrim. The alpha
 * is rounded to the nearest of the 256 values the hex byte can hold.
 */
export function withAlpha(color: string, alpha: number): string {
  if (!(alpha >= 0 && alpha <= 1)) throw new Error(`Expected an alpha from 0 to 1, got ${alpha}`);
  const byte = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${normalizeHex(color)}${byte}`.toUpperCase();
}

/** WCAG 2.x relative luminance of `#RRGGBB`. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio (1 to 21) between two `#RRGGBB` colours, in either order. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}
