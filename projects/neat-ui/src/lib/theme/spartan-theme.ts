import {
  buildColorScale,
  buildNeutralSurfaceScale,
  buildSurfaceScale,
  type ColorScale,
  type ColorStep,
  type SurfaceScale,
} from './color-scale';
import { composite, contrastRatio, mixOklab, withAlpha } from './color';
import {
  along,
  CONTRAST_RULES,
  firstReadable,
  MIN_CHIP_FILL_CONTRAST,
  MIN_CONTRAST,
  MIN_FILL_CONTRAST,
  MIN_NON_TEXT_CONTRAST,
} from './contrast-rules';
import {
  NEAT_DANGER_BASE,
  NEAT_HIGHLIGHT_BASE,
  NEAT_PRIMARY_BASE,
  NEAT_SERIES_TEAL_BASE,
  NEAT_WARN_BASE,
  SIMA_PALETTE,
} from './palette';
import type { NeatColorScheme } from './theme.service';
import type { NeatTone } from './tone';

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
  dark: { raised: 900, muted: 900, secondary: 900, accent: 800, border: 800 },
};
/**
 * Each scheme's surfaces: the brand ramp in light; in dark, the neutral ramp, so the dark page is a
 * near-black grey rather than a step towards the palette text's teal.
 */
const SURFACES: Record<NeatColorScheme, SurfaceScale> = {
  light: buildSurfaceScale(),
  dark: buildNeutralSurfaceScale(),
};
/**
 * How much of the video a video tile's scrim (its bars, a stopped frame) covers. Its text must
 * reach 4.5:1 over white video, the worst case for light text, which needs at least 0.57.
 */
const VIDEO_SCRIM_ALPHA = 0.6;
/**
 * The video the live dot is held to under the scrim: black and mid grey. A red is darker than light
 * video, and past mid grey no red reaches the non-text minimum on the scrim and on a white page at
 * once; there the badge's word ("Live") carries the state.
 */
const LIVE_VIDEO = ['#000000', '#808080'] as const;
/** The danger steps searched for the live red, from the base outwards, lighter first. */
const LIVE_WALK = [500, 400, 600, 300, 700] as const;
/** Spartan's chart palette: a single-hue ramp on the primary scale, like Spartan's own themes. */
const CHART_STEPS = [300, 400, 500, 600, 700] as const;

/** The tones that tint a row; a neutral row is untinted. */
type TintedTone = Exclude<NeatTone, 'neutral'>;
/** How much of its tone a row tint holds, mixed in OKLab over the content background. */
const ROW_TINT_SHARE: Record<NeatColorScheme, number> = { light: 0.1, dark: 0.14 };
/**
 * The step by which a row tint's hover and selection fill takes more of its tone than the tint,
 * from the tint's share on, until it shows on the tint (MIN_FILL_CONTRAST). Fine enough that each
 * tone gets about the least that shows, as a plain row's `--accent` does on the page.
 */
const ROW_TINT_ACCENT_STEP = 0.02;

/**
 * The neutral chip's fill is mixed from the accent step toward the next step away from the
 * background: dark `--muted` is the card's own step, so a chip on it vanished on a card, and the
 * accent step alone vanishes on a hovered or selected list row, whose fill is `--accent`.
 */
const NEUTRAL_CHIP_STEPS: Record<NeatColorScheme, readonly [from: ColorStep, to: ColorStep]> = {
  light: [100, 200],
  dark: [800, 700],
};
/** How finely the neutral chip's share of the step past `--accent` is searched, least first. */
const NEUTRAL_CHIP_SHARE_STEP = 0.1;
/** How finely the share of `--foreground` in warning's text colour is searched, least first. */
const WARNING_TEXT_STEP = 0.05;

/**
 * Dark segmented track: this share of the accent step over the card step. The accent step alone
 * (`--accent`) leaves no room for a lighter thumb that the primary label still reads on, and the
 * card step is too faint on a card (1.0:1). At this share the track shows on both the page and
 * a card (MIN_FILL_CONTRAST).
 */
const SEGMENTED_DARK_TRACK_SHARE = 0.8;
/** How finely the dark thumb's share of the step above the track is searched, lightest first. */
const SEGMENTED_THUMB_STEP = 0.05;

const scales = {
  primary: buildColorScale(NEAT_PRIMARY_BASE),
  destructive: buildColorScale(NEAT_DANGER_BASE),
  success: buildColorScale(SIMA_PALETTE.green),
  warning: buildColorScale(NEAT_WARN_BASE),
  info: buildColorScale(SIMA_PALETTE.blue),
  highlight: buildColorScale(NEAT_HIGHLIGHT_BASE),
};
/** The chart series' fourth hue, which is not a status colour. */
const SERIES_TEAL = buildColorScale(NEAT_SERIES_TEAL_BASE);
/** The steps of a colour scale, lightest to darkest. */
const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
/** How many places a series' darker or lighter shade sits from its hue's line step. */
const SERIES_SHADE_OFFSET = 2;
/** Where the heatmap ramp (a blue scale) starts and ends, per scheme: the low end is the fill that shows on the page. */
const HEAT_STEPS: Record<NeatColorScheme, { low: keyof ColorScale; high: keyof ColorScale }> = {
  light: { low: 100, high: 800 },
  dark: { low: 900, high: 300 },
};
/** Each tinted tone's scale; its base (step 500), the tone's own colour, is what tints a row. */
const TONE_SCALES: Record<TintedTone, ColorScale> = {
  success: scales.success,
  warning: scales.warning,
  danger: scales.destructive,
  info: scales.info,
  highlight: scales.highlight,
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
  const surface = SURFACES[scheme];
  const textBackgrounds = rules.textBackgrounds.map((step) => surface[step]);
  const onColor = surface[rules.onColor];
  const text = surface[rules.text];

  /**
   * A colour that is both text on the page (`text-primary`) and a fill under `onColor`
   * (`bg-primary text-primary-foreground`): the first step readable in both roles.
   */
  const asTextAndFill = [onColor, ...textBackgrounds];
  /**
   * Status colours other than warning are also text on a tint of themselves (see `tint` in the
   * contrast rules).
   */
  const withOwnTint = (color: string) => [
    ...asTextAndFill,
    ...rules.tint.over.map((step) => composite(color, rules.tint.alpha, surface[step])),
  ];
  const status = (scale: ColorScale) =>
    scale[rules.colorWalk[firstReadable(scale, rules.colorWalk, withOwnTint)]];
  const accent = surface[roles.accent];
  /**
   * Muted text is also read on the hover and selection fill: a hovered or selected list row keeps
   * its muted cells. In dark that fill is the lightest surface text sits on.
   */
  const mutedText =
    surface[
      rules.surfaceWalk[firstReadable(surface, rules.surfaceWalk, [...textBackgrounds, accent])]
    ];
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
  const border = surface[roles.border];
  const tints = rowTints(ROW_TINT_SHARE[scheme], background);
  const charts = chartTokens(scheme, status(scales.destructive));
  const chipNeutral = neutralChipFill(scheme, surface, [raised, background], accent);

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
    // Warning is a fill only, in both schemes: the scale's base with the scheme's darkest surface
    // on it (the palette text in light, the near-black in dark; about 9:1). Derived like the
    // others, as text on the page, it darkened to brown under white text. It is not readable as
    // text on the page or on its own tint; warning-coloured text is `neat-warning-text`.
    warning: scales.warning[500],
    'warning-foreground': surface[950],
    info: status(scales.info),
    'info-foreground': onColor,
    // A distinct state that is none of the statuses (the status chip's `highlight`), derived like
    // them from the brand purple's hue.
    highlight: status(scales.highlight),
    'highlight-foreground': onColor,
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
    // both schemes, so the scrim is the palette text colour with light text in both, whatever the
    // dark scheme's surfaces are.
    'neat-video-scrim': withAlpha(SIMA_PALETTE.text, VIDEO_SCRIM_ALPHA),
    'neat-video-scrim-foreground': SIMA_PALETTE.white,
    'neat-live': liveToken(),
    ...segmentedTokens(scheme, surface, primary),
    ...tints,
    'neat-chip-neutral': chipNeutral,
    // An empty track or a quiet stretch inside a card (score bars, label timeline): the muted
    // surface in light; in dark the muted surface is the card's own colour, so the neutral chip's
    // fill, which is chosen to show on cards.
    'neat-track': scheme === 'dark' ? chipNeutral : surface[roles.muted],
    'neat-warning-text': warningText(charts['neat-line-warning'], text, [
      tints['neat-tint-warning'],
      tints['neat-tint-warning-accent'],
    ]),
    ...charts,
  };
}

/**
 * The live dot's red (`--neat-live`): a mark on the page and on a badge over video, where
 * `--destructive`, a text colour, is too dark on the scrim. The danger step nearest the base that
 * reaches the non-text minimum on both schemes' text backgrounds and on the scrim over LIVE_VIDEO,
 * so it is one red in both schemes, as video looks the same in either.
 */
function liveToken(): string {
  const backgrounds = [
    ...(['light', 'dark'] as const).flatMap((scheme) =>
      CONTRAST_RULES[scheme].textBackgrounds.map((step) => SURFACES[scheme][step]),
    ),
    ...LIVE_VIDEO.map((video) => composite(SIMA_PALETTE.text, VIDEO_SCRIM_ALPHA, video)),
  ];
  const danger = scales.destructive;
  return danger[LIVE_WALK[firstReadable(danger, LIVE_WALK, backgrounds, MIN_NON_TEXT_CONTRAST)]];
}

/**
 * How far the dark thumb's hairline edge stands from the track: the fill alone is about 1.1:1 from
 * it, so the edge carries the thumb's outline.
 */
const SEGMENTED_EDGE_CONTRAST = 1.5;

/**
 * The segmented control's track, its raised thumb (which the chosen `--primary` label sits on) and
 * the thumb's hairline edge. Light: the accent step, white and a faint grey edge that the shadow
 * backs. Dark: the thumb is lighter than the track, as on iOS, but only as light as keeps the
 * primary label at the text minimum on it, a mix of the next step up over the accent step, which
 * leaves the fill about 1.1:1 from the track; so the edge is the first grey step further up that
 * reaches SEGMENTED_EDGE_CONTRAST on the track, and a shadow would not show there.
 */
function segmentedTokens(scheme: NeatColorScheme, surface: SurfaceScale, primary: string) {
  if (scheme === 'light') {
    return {
      'neat-segmented-track': surface[100],
      'neat-segmented-thumb': surface[0],
      'neat-segmented-thumb-edge': surface[200],
    };
  }
  const track = mixOklab(surface[800], SEGMENTED_DARK_TRACK_SHARE, surface[900]);
  const shares = Array.from(
    { length: Math.round(1 / SEGMENTED_THUMB_STEP) },
    (_, i) => 1 - i * SEGMENTED_THUMB_STEP,
  );
  const thumbs = shares.map((share) => mixOklab(surface[700], share, surface[800]));
  const thumb = thumbs.find((color) => contrastRatio(primary, color) >= MIN_CONTRAST);
  if (thumb === undefined) throw new Error('No dark thumb the primary label reads on');
  const edgeWalk = [700, 600, 500] as const;
  const edge =
    surface[edgeWalk[firstReadable(surface, edgeWalk, [track], SEGMENTED_EDGE_CONTRAST)]];
  return {
    'neat-segmented-track': track,
    'neat-segmented-thumb': thumb,
    'neat-segmented-thumb-edge': edge,
  };
}

/**
 * The step of `scale` that is a line or a mark on the page: the first along the scheme's colour
 * walk that reaches the non-text minimum on every text background. Series, lines and heat colours
 * are shapes, not text, so they take 3:1 (WCAG 1.4.11) and not 4.5:1.
 */
function lineStep(scale: ColorScale, scheme: NeatColorScheme): keyof ColorScale {
  const rules = CONTRAST_RULES[scheme];
  const surface = SURFACES[scheme];
  const backgrounds = rules.textBackgrounds.map((step) => surface[step]);
  return rules.colorWalk[firstReadable(scale, rules.colorWalk, backgrounds, MIN_NON_TEXT_CONTRAST)];
}

/** The step `offset` places down SCALE_STEPS (towards 950) from `step`; negative is lighter. */
function shifted(step: keyof ColorScale, offset: number): keyof ColorScale {
  const shiftedStep = SCALE_STEPS[SCALE_STEPS.indexOf(step) + offset];
  if (shiftedStep === undefined) throw new Error(`No step ${offset} places from ${step}`);
  return shiftedStep;
}

/**
 * The tokens a chart draws with: eight series colours, the single-metric and threshold lines, and
 * the heatmap ramp's ends (`danger` is the theme's own `--destructive`). Series 1 to 4 are four hues (blue, purple, orange, teal) at their line
 * step, and 5 to 8 are the "darker and lighter shade" set of the colours mockup: blue two steps
 * darker, then purple, orange and blue two steps lighter. Green, amber and red are left out on
 * purpose: they mean status, and a series in one of them would read as a state.
 *
 * Light series 6 to 8 reach only about 2.1 to 2.4:1 on white. They are kept (the palette was
 * chosen by eye): the lighter shades sit below 3:1 on light surfaces and are used as stacked
 * fills whose values the legend carries as text. The theme spec pins the shortfall.
 */
function chartTokens(scheme: NeatColorScheme, danger: string): SpartanTokens {
  /** The palette blue's scale: `info` is its status use, so the scale is shared, not rebuilt. */
  const blue = scales.info;
  const hues = [blue, scales.highlight, scales.primary, SERIES_TEAL];
  const lines = hues.map((scale) => lineStep(scale, scheme));
  const series = [
    ...hues.map((scale, i) => scale[lines[i]]),
    blue[shifted(lines[0], SERIES_SHADE_OFFSET)],
    ...[1, 2, 0].map((i) => hues[i][shifted(lines[i], -SERIES_SHADE_OFFSET)]),
  ];
  const heat = HEAT_STEPS[scheme];
  return {
    ...Object.fromEntries(series.map((color, i) => [`neat-series-${i + 1}`, color])),
    'neat-line': series[0],
    // `--warning` is a fill (2.2:1 on white), too faint for a line.
    'neat-line-warning': scales.warning[lineStep(scales.warning, scheme)],
    'neat-line-danger': danger,
    'neat-heat-low': blue[heat.low],
    'neat-heat-high': blue[heat.high],
  };
}

/**
 * A select-list row's tint for each tone that has one, and its hover and selection fill
 * (`-accent`): the tone's own colour mixed in OKLab over the content background, by `share` for
 * the tint and by as much more as it takes to show on the tint for the accent. The tints are opaque
 * and mixed over `--background`, so a toned list belongs on the content background.
 */
function rowTints(share: number, background: string): SpartanTokens {
  return Object.fromEntries(
    Object.entries(TONE_SCALES).flatMap(([tone, scale]) => {
      const base = scale[500];
      const tint = mixOklab(base, share, background);
      return [
        [`neat-tint-${tone}`, tint],
        [`neat-tint-${tone}-accent`, tintAccent(base, share, tint, background)],
      ];
    }),
  );
}

/** The first mix of `base`, a step at a time above `share`, that shows on `tint`. */
function tintAccent(base: string, share: number, tint: string, background: string): string {
  const steps = Math.floor((1 - share) / ROW_TINT_ACCENT_STEP);
  for (let step = 1; step <= steps; step++) {
    const accent = mixOklab(base, share + step * ROW_TINT_ACCENT_STEP, background);
    if (contrastRatio(accent, tint) >= MIN_FILL_CONTRAST) return accent;
  }
  throw new Error(`No mix of ${base} over ${background} shows on its tint ${tint}`);
}

/**
 * The neutral chip's fill: the least mix of the step past `--accent` over the accent step that
 * shows on the card and the page (MIN_CHIP_FILL_CONTRAST) and on a hovered or selected row's
 * `--accent` (MIN_FILL_CONTRAST). Muted text sits on it; the theme spec holds that to 4.5:1.
 */
function neutralChipFill(
  scheme: NeatColorScheme,
  surface: SurfaceScale,
  surfaces: readonly string[],
  accent: string,
): string {
  const [from, to] = NEUTRAL_CHIP_STEPS[scheme].map((step) => surface[step]);
  const steps = Math.round(1 / NEUTRAL_CHIP_SHARE_STEP);
  for (let step = 1; step <= steps; step++) {
    const fill = mixOklab(to, step * NEUTRAL_CHIP_SHARE_STEP, from);
    const shows =
      surfaces.every((under) => contrastRatio(fill, under) >= MIN_CHIP_FILL_CONTRAST) &&
      contrastRatio(fill, accent) >= MIN_FILL_CONTRAST;
    if (shows) return fill;
  }
  throw new Error(`No mix of ${to} over ${from} shows on the card, the page and --accent`);
}

/**
 * Warning-coloured text (a tinted warning chip's), which `--warning`, a fill, cannot be: the
 * warning line mixed toward `--foreground` by the least share that reads on the warning tints.
 * Dark's line already does, so there it is the line itself; light's needs some of the text colour.
 */
function warningText(line: string, foreground: string, tints: readonly string[]): string {
  for (let step = 0; step * WARNING_TEXT_STEP <= 1; step++) {
    const color = mixOklab(foreground, step * WARNING_TEXT_STEP, line);
    if (tints.every((tint) => contrastRatio(color, tint) >= MIN_CONTRAST)) return color;
  }
  throw new Error(`No mix of ${line} toward ${foreground} reads on the warning tints`);
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
