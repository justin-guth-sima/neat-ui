import { buildColorScale, buildSurfaceScale, type ColorScale, type ColorStep } from './color-scale';
import { composite, withAlpha } from './color';
import { along, CONTRAST_RULES, firstReadable, MIN_NON_TEXT_CONTRAST } from './contrast-rules';
import { NEAT_DANGER_BASE, NEAT_PRIMARY_BASE, NEAT_WARN_BASE, SIMA_PALETTE } from './palette';
import type { NeatColorScheme } from './theme.service';

/** Spartan's corner radius; its preset derives the sm to 4xl radii from it. */
const RADIUS = '0.5rem';

/** Surface steps for the roles that carry no contrast rule of their own, per scheme. */
interface SurfaceRoles {
  /** Cards and popovers: the content background in light, the raised surface in dark. */
  readonly raised: ColorStep;
  /** Subdued areas that still carry (muted) text, so one of the scheme's text backgrounds. */
  readonly muted: ColorStep;
  readonly secondary: ColorStep;
  /**
   * Hover and selection fills: they must stay visible on the content background and on raised
   * surfaces (cards, popovers), so in dark it is a step above the raised surface.
   */
  readonly accent: ColorStep;
  /** Dividers and card outlines: decoration, so no contrast rule (form controls use `--input`). */
  readonly border: ColorStep;
}

const SURFACE_ROLES: Record<NeatColorScheme, SurfaceRoles> = {
  light: { raised: 0, muted: 50, secondary: 100, accent: 100, border: 200 },
  dark: { raised: 800, muted: 800, secondary: 800, accent: 700, border: 700 },
};
/**
 * How much of the video a video tile's scrim (its bars, a stopped frame) covers. Its text must
 * reach 4.5:1 over white video, the worst case for light text, which needs at least 0.57.
 */
const VIDEO_SCRIM_ALPHA = 0.6;
/** Spartan's chart palette: a single-hue ramp on the primary scale, like Spartan's own themes. */
const CHART_STEPS = [300, 400, 500, 600, 700] as const;

const surface = buildSurfaceScale();
const scales = {
  primary: buildColorScale(NEAT_PRIMARY_BASE),
  destructive: buildColorScale(NEAT_DANGER_BASE),
  success: buildColorScale(SIMA_PALETTE.green),
  warning: buildColorScale(NEAT_WARN_BASE),
  info: buildColorScale(SIMA_PALETTE.blue),
};

/** CSS custom property name (without `--`) to `#RRGGBB` (`#RRGGBBAA` if translucent), for one scheme. */
type SpartanTokens = Record<string, string>;

/**
 * The tokens `buildSpartanThemeCss` emits for one scheme. Internal: specs measure components
 * against these values (tokens.generated.css is checked to match them).
 */
export function spartanThemeTokens(scheme: NeatColorScheme): SpartanTokens {
  const rules = CONTRAST_RULES[scheme];
  const roles = SURFACE_ROLES[scheme];
  const textBackgrounds = rules.textBackgrounds.map((step) => surface[step]);
  const onColor = surface[rules.onColor];
  const text = surface[rules.text];

  /**
   * A colour that is both text on the page (`text-primary`) and a fill under `onColor`
   * (`bg-primary text-primary-foreground`): the first step readable in both roles.
   */
  const asTextAndFill = [onColor, ...textBackgrounds];
  /** Status colours are also text on a tint of themselves (see `tint` in the contrast rules). */
  const withOwnTint = (color: string) => [
    ...asTextAndFill,
    ...rules.tint.over.map((step) => composite(color, rules.tint.alpha, surface[step])),
  ];
  const status = (scale: ColorScale) =>
    scale[rules.colorWalk[firstReadable(scale, rules.colorWalk, withOwnTint)]];
  const mutedText =
    surface[rules.surfaceWalk[firstReadable(surface, rules.surfaceWalk, textBackgrounds)]];
  /**
   * Form-control boundaries (`--input`) and focus rings (`--ring`) identify a control and its
   * state, so they take the non-text minimum wherever text sits: the first grey step, and the first
   * primary step, of the scheme's walks that reach it.
   */
  const nonText = <S extends number>(scale: Record<S, string>, walk: readonly S[]) =>
    scale[walk[firstReadable(scale, walk, textBackgrounds, MIN_NON_TEXT_CONTRAST)]];
  const input = nonText(surface, rules.surfaceWalk);
  const ring = nonText(scales.primary, rules.colorWalk);

  const primaryIndex = firstReadable(scales.primary, rules.colorWalk, asTextAndFill);
  const primary = scales.primary[rules.colorWalk[primaryIndex]];
  /** One step further from the background, so text on the fill gains contrast on hover. */
  const primaryHover = scales.primary[along(rules.colorWalk, primaryIndex, 1)];
  const background = surface[rules.background];
  const raised = surface[roles.raised];
  const accent = surface[roles.accent];
  const border = surface[roles.border];

  return {
    background,
    foreground: text,
    card: raised,
    'card-foreground': text,
    popover: raised,
    'popover-foreground': text,
    primary,
    'primary-foreground': onColor,
    // Spartan has no hover colours; helm's `bg-primary/80` takes white text below 4.5:1.
    'primary-hover': primaryHover,
    secondary: surface[roles.secondary],
    'secondary-foreground': text,
    muted: surface[roles.muted],
    'muted-foreground': mutedText,
    accent,
    'accent-foreground': text,
    // Spartan has no -foreground for destructive and no success, warning or info: kit extensions.
    destructive: status(scales.destructive),
    'destructive-foreground': onColor,
    success: status(scales.success),
    'success-foreground': onColor,
    warning: status(scales.warning),
    'warning-foreground': onColor,
    info: status(scales.info),
    'info-foreground': onColor,
    border,
    input,
    ring,
    ...Object.fromEntries(CHART_STEPS.map((step, i) => [`chart-${i + 1}`, scales.primary[step]])),
    // The sidebar is the shell's rail: it sits on the content background.
    sidebar: background,
    'sidebar-foreground': text,
    'sidebar-primary': primary,
    'sidebar-primary-foreground': onColor,
    'sidebar-accent': accent,
    'sidebar-accent-foreground': text,
    'sidebar-border': border,
    'sidebar-ring': ring,
    // Video tiles: a scrim over the video for bar text and stopped frames. Video looks the same in
    // both schemes, so the scrim is the palette text colour with light text in both.
    'neat-video-scrim': withAlpha(surface[950], VIDEO_SCRIM_ALPHA),
    'neat-video-scrim-foreground': surface[0],
  };
}

/** A rule with one declaration per line, hex in lower case, as Prettier formats CSS. */
function cssRule(selector: string, declarations: [property: string, value: string][]): string {
  const lines = declarations.map(([property, value]) => `  ${property}: ${value.toLowerCase()};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

const customProperties = (tokens: SpartanTokens): [string, string][] =>
  Object.entries(tokens).map(([name, value]) => [`--${name}`, value]);

/**
 * The kit's colours as Spartan's CSS variables plus the kit extensions: light on `:root`, dark on
 * `:root.<darkClass>`, the class ThemeService puts on `<html>`. `npm run theme:emit` writes it to
 * tokens.generated.css, which the kit stylesheet compiles in, so colour literals stay in `theme/`.
 */
export function buildSpartanThemeCss(darkClass: string): string {
  const light = customProperties(spartanThemeTokens('light'));
  const dark = customProperties(spartanThemeTokens('dark'));
  const rules = [
    '/* Generated by `npm run theme:emit` from src/lib/theme/*.ts. Do not edit. */',
    cssRule(':root', [['color-scheme', 'light'], ['--radius', RADIUS], ...light]),
    cssRule(`:root.${darkClass}`, [['color-scheme', 'dark'], ...dark]),
  ];
  return `${rules.join('\n\n')}\n`;
}
