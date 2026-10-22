import { buildColorScale, buildSurfaceScale, type ColorScale, type ColorStep } from './color-scale';
import { CONTRAST_RULES, firstReadable } from './contrast-rules';
import { NEAT_DANGER_BASE, NEAT_PRIMARY_BASE, NEAT_WARN_BASE, SIMA_PALETTE } from './palette';
import type { NeatColorScheme } from './theme.service';

/** Spartan's corner radius; its preset derives the sm to 4xl radii from it. */
const RADIUS = '0.5rem';

/** Surface steps for the roles that carry no text rule of their own, per scheme. */
interface SurfaceRoles {
  /** Cards and popovers: the content background in light, the raised surface in dark. */
  readonly raised: ColorStep;
  /** Subdued areas that still carry (muted) text, so one of the scheme's text backgrounds. */
  readonly muted: ColorStep;
  readonly secondary: ColorStep;
  /** Hover and selection fills. */
  readonly accent: ColorStep;
  readonly border: ColorStep;
  /** Form-control borders. */
  readonly input: ColorStep;
}

const SURFACE_ROLES: Record<NeatColorScheme, SurfaceRoles> = {
  light: { raised: 0, muted: 50, secondary: 100, accent: 100, border: 200, input: 300 },
  dark: { raised: 800, muted: 800, secondary: 800, accent: 800, border: 700, input: 600 },
};

/** Focus rings in the primary hue at full strength: the base in light, a step lighter in dark. */
const RING_STEP: Record<NeatColorScheme, keyof ColorScale> = { light: 500, dark: 400 };
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

/** CSS custom property name (without `--`) to `#rrggbb`, for one scheme. */
type SpartanTokens = Record<string, string>;

function schemeTokens(scheme: NeatColorScheme): SpartanTokens {
  const rules = CONTRAST_RULES[scheme];
  const roles = SURFACE_ROLES[scheme];
  const textBackgrounds = rules.textBackgrounds.map((step) => surface[step]);
  const onColor = surface[rules.onColor];
  const text = surface[rules.text];

  /**
   * A colour that is both text on the page (`text-destructive`) and a fill under `onColor`
   * (`bg-destructive text-destructive-foreground`): the first step readable in both roles.
   */
  const readable = (scale: ColorScale) =>
    scale[rules.colorWalk[firstReadable(scale, rules.colorWalk, [onColor, ...textBackgrounds])]];
  const mutedText =
    surface[rules.surfaceWalk[firstReadable(surface, rules.surfaceWalk, textBackgrounds)]];

  const primary = readable(scales.primary);
  const background = surface[rules.background];
  const raised = surface[roles.raised];
  const accent = surface[roles.accent];
  const border = surface[roles.border];
  const ring = scales.primary[RING_STEP[scheme]];

  return {
    background,
    foreground: text,
    card: raised,
    'card-foreground': text,
    popover: raised,
    'popover-foreground': text,
    primary,
    'primary-foreground': onColor,
    secondary: surface[roles.secondary],
    'secondary-foreground': text,
    muted: surface[roles.muted],
    'muted-foreground': mutedText,
    accent,
    'accent-foreground': text,
    // Spartan has no -foreground for destructive and no success, warning or info: kit extensions.
    destructive: readable(scales.destructive),
    'destructive-foreground': onColor,
    success: readable(scales.success),
    'success-foreground': onColor,
    warning: readable(scales.warning),
    'warning-foreground': onColor,
    info: readable(scales.info),
    'info-foreground': onColor,
    border,
    input: surface[roles.input],
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
  const light = customProperties(schemeTokens('light'));
  const dark = customProperties(schemeTokens('dark'));
  const rules = [
    '/* Generated by `npm run theme:emit` from src/lib/theme/*.ts. Do not edit. */',
    cssRule(':root', [['color-scheme', 'light'], ['--radius', RADIUS], ...light]),
    cssRule(`:root.${darkClass}`, [['color-scheme', 'dark'], ...dark]),
  ];
  return `${rules.join('\n\n')}\n`;
}
