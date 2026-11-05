import generated from './tokens.generated.css' with { loader: 'text' };
import { composite, contrastRatio, mixOklab } from './color';
import {
  buildColorScale,
  buildNeutralSurfaceScale,
  buildSurfaceScale,
  type ColorScale,
} from './color-scale';
import {
  along,
  CONTRAST_RULES,
  MIN_CHIP_FILL_CONTRAST,
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
import { buildSpartanThemeCss } from './spartan-theme';
import { NEAT_DARK_CLASS } from './theme.service';

type Declarations = Map<string, string>;

/** Splits a flat stylesheet into its rules: selector -> declarations (property -> value). */
function parseRules(css: string): Map<string, Declarations> {
  const rules = new Map<string, Declarations>();
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selector, body] of withoutComments.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const declarations: Declarations = new Map();
    for (const [, property, value] of body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
      declarations.set(property, value.trim());
    }
    rules.set(selector.trim(), declarations);
  }
  return rules;
}

const rules = parseRules(buildSpartanThemeCss(NEAT_DARK_CLASS));
const DARK_SELECTOR = `:root.${NEAT_DARK_CLASS}`;
const schemes = { light: rules.get(':root')!, dark: rules.get(DARK_SELECTOR)! };

/**
 * Coloured text that sits directly on the page's surfaces rather than on its own fill. Warning is
 * a fill-only colour (amber with dark text); its text is `neat-warning-text`.
 */
const COLORED_TEXT = [
  'muted-foreground',
  'primary',
  'destructive',
  'success',
  'info',
  'highlight',
  'neat-warning-text',
];
/** The surfaces text sits on. */
const TEXT_SURFACES = ['background', 'card', 'popover', 'muted'];
/**
 * Status colours are also text on a tint of themselves (badges, alerts, soft buttons such as helm's
 * destructive button: `bg-destructive/10`, `dark:bg-destructive/20`), composited over these surfaces.
 */
const STATUS_TEXT = ['destructive', 'success', 'info', 'highlight'];
const TINTS = {
  light: { alpha: 0.1, over: ['background'] },
  dark: { alpha: 0.2, over: ['background', 'card'] },
} as const;
/**
 * Muted text also sits on the hover and selection fill: a hovered or selected list row keeps its
 * muted cells.
 */
const MUTED_ON_FILLS = ['accent', 'neat-chip-neutral'];
/** Each tinted tone's own colour, the scale base its row tint is mixed from. */
const ROW_TINT_BASES = {
  success: SIMA_PALETTE.green,
  warning: NEAT_WARN_BASE,
  danger: NEAT_DANGER_BASE,
  info: SIMA_PALETTE.blue,
  highlight: NEAT_HIGHLIGHT_BASE,
} as const;
/** How much of its tone a row tint holds, mixed in OKLab over the content background. */
const ROW_TINT_SHARES = { light: 0.1, dark: 0.14 } as const;
/** The text a toned row carries: body text and muted text. */
const TEXT_ON_ROW_TINTS = ['foreground', 'muted-foreground'];
/**
 * The light tokens of 0.8.0, in order. Light mode keeps them exactly; what later releases add to
 * light (the highlight tone, the row tints) comes on top.
 */
const LIGHT_0_8_0 = {
  background: '#ffffff',
  foreground: '#010f0e',
  card: '#ffffff',
  'card-foreground': '#010f0e',
  popover: '#ffffff',
  'popover-foreground': '#010f0e',
  primary: '#b3541b',
  'primary-foreground': '#ffffff',
  'primary-hover': '#91400b',
  secondary: '#e8e9eb',
  'secondary-foreground': '#010f0e',
  muted: '#f3f4f5',
  'muted-foreground': '#4c5858',
  accent: '#e8e9eb',
  'accent-foreground': '#010f0e',
  destructive: '#ab2a22',
  'destructive-foreground': '#ffffff',
  success: '#0a692f',
  'success-foreground': '#ffffff',
  warning: '#e9a23b',
  'warning-foreground': '#010f0e',
  info: '#346498',
  'info-foreground': '#ffffff',
  border: '#cdd0d2',
  input: '#687272',
  ring: '#d26728',
  'chart-1': '#f4a076',
  'chart-2': '#e28250',
  'chart-3': '#d26728',
  'chart-4': '#b3541b',
  'chart-5': '#91400b',
  sidebar: '#ffffff',
  'sidebar-foreground': '#010f0e',
  'sidebar-primary': '#b3541b',
  'sidebar-primary-foreground': '#ffffff',
  'sidebar-accent': '#e8e9eb',
  'sidebar-accent-foreground': '#010f0e',
  'sidebar-border': '#cdd0d2',
  'sidebar-ring': '#d26728',
  'neat-video-scrim': '#010f0e99',
  'neat-video-scrim-foreground': '#ffffff',
};
/** Surface tokens of the dark scheme, which are greys of the neutral scale. */
const DARK_SURFACES = [
  'background',
  'card',
  'popover',
  'secondary',
  'muted',
  'muted-foreground',
  'accent',
  'border',
  'input',
  'sidebar',
  'sidebar-accent',
  'sidebar-border',
];
/** Hover fills (kit extensions) keep the resting fill's text colour. */
const HOVER_FILLS = { 'primary-hover': 'primary-foreground' } as const;
/** Surfaces a hover or selection fill (`--accent`) sits on. */
const FILL_SURFACES = ['background', 'card', 'popover'];
/**
 * Non-text colours that identify a control or its state (WCAG 1.4.11): form-control boundaries
 * and focus indicators. They sit wherever text does, so they are measured on the text surfaces.
 */
const NON_TEXT = ['input', 'ring', 'sidebar-ring'];
/**
 * Translucent fills drawn over video rather than the theme's surfaces. Their text is measured over
 * the video extremes in a test of its own, not on the fill alone.
 */
const OVER_VIDEO = ['neat-video-scrim'];

/** The steps of a colour scale, lightest to darkest. */
const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const SURFACE_SCALES = { light: buildSurfaceScale(), dark: buildNeutralSurfaceScale() };
const HUES: Record<'blue' | 'purple' | 'orange' | 'teal', ColorScale> = {
  blue: buildColorScale(SIMA_PALETTE.blue),
  purple: buildColorScale(NEAT_HIGHLIGHT_BASE),
  orange: buildColorScale(NEAT_PRIMARY_BASE),
  teal: buildColorScale(NEAT_SERIES_TEAL_BASE),
};
/** The series' hues in order: series 1–4 are their line steps. */
const SERIES_HUES = ['blue', 'purple', 'orange', 'teal'] as const;

/**
 * The index into SCALE_STEPS of a scale's line step: the first step along the scheme's colour walk
 * that reaches 3:1 on every text background, found here step by step rather than with the theme's
 * own `firstReadable`, so the spec does not repeat the code it checks.
 */
function lineStepIndex(scale: ColorScale, scheme: keyof typeof schemes): number {
  const { colorWalk, textBackgrounds } = CONTRAST_RULES[scheme];
  const surface = SURFACE_SCALES[scheme];
  for (const step of colorWalk) {
    if (
      textBackgrounds.every(
        (background) => contrastRatio(scale[step], surface[background]) >= MIN_NON_TEXT_CONTRAST,
      )
    ) {
      return SCALE_STEPS.indexOf(step);
    }
  }
  throw new Error(`No step of ${colorWalk.join(', ')} reaches ${MIN_NON_TEXT_CONTRAST}:1`);
}

/** The series values of a scheme as the spec states them: `offset` places down SCALE_STEPS from the line step. */
const seriesValue = (
  scheme: keyof typeof schemes,
  hue: (typeof SERIES_HUES)[number],
  offset = 0,
) => {
  const scale = HUES[hue];
  return scale[SCALE_STEPS[lineStepIndex(scale, scheme) + offset]].toLowerCase();
};

const SERIES_VALUES = {
  light: ['#477fbc', '#837ab5', '#d26728', '#2a8c9a', '#214974', '#afa6e2', '#f4a076', '#75acea'],
  dark: ['#75acea', '#afa6e2', '#e28250', '#55a3af', '#477fbc', '#d5d0fc', '#ffbd9c', '#b2d6ff'],
};

interface TextPair {
  label: string;
  foreground: string;
  background: string;
}

/**
 * Every text/background pair a scheme emits: each `--x-foreground` on `--x`, coloured text on
 * every surface, and status text on its own tint.
 */
function textPairs(scheme: keyof typeof schemes): TextPair[] {
  const tokens = schemes[scheme];
  const pair = (foreground: string, background: string): TextPair => ({
    label: `${scheme}: --${foreground} on --${background}`,
    foreground: tokens.get(`--${foreground}`)!,
    background: tokens.get(`--${background}`)!,
  });
  const fillOf = (name: string) => name.replace(/-foreground$/, '');
  const ownFills = [...tokens.keys()]
    .map((name) => name.replace(/^--/, ''))
    .filter((name) => name.endsWith('-foreground') && tokens.has(`--${fillOf(name)}`))
    .filter((name) => !OVER_VIDEO.includes(fillOf(name)))
    .map((name) => pair(name, fillOf(name)));
  const onSurfaces = COLORED_TEXT.flatMap((text) =>
    TEXT_SURFACES.map((surface) => pair(text, surface)),
  );
  const { alpha, over } = TINTS[scheme];
  const onTints = STATUS_TEXT.flatMap((text) =>
    over.map((surface) => {
      const color = tokens.get(`--${text}`)!;
      return {
        label: `${scheme}: --${text} on --${text}/${alpha * 100} over --${surface}`,
        foreground: color,
        background: composite(color, alpha, tokens.get(`--${surface}`)!),
      };
    }),
  );
  const onHoverFills = Object.entries(HOVER_FILLS).map(([fill, text]) => pair(text, fill));
  const mutedOnFills = MUTED_ON_FILLS.map((fill) => pair('muted-foreground', fill));
  const onRowTints = Object.keys(ROW_TINT_BASES).flatMap((tone) =>
    [`neat-tint-${tone}`, `neat-tint-${tone}-accent`].flatMap((tint) =>
      TEXT_ON_ROW_TINTS.map((text) => pair(text, tint)),
    ),
  );
  return [
    pair('foreground', 'background'),
    ...ownFills,
    ...onHoverFills,
    ...mutedOnFills,
    ...onSurfaces,
    ...onTints,
    ...onRowTints,
  ];
}

describe('buildSpartanThemeCss', () => {
  it('puts light values on :root and dark values on :root.neat-dark', () => {
    expect([...rules.keys()]).toEqual([':root', DARK_SELECTOR]);
    expect(schemes.light.get('color-scheme')).toBe('light');
    expect(schemes.dark.get('color-scheme')).toBe('dark');
    expect(schemes.light.get('--background')).toBe(buildSurfaceScale()[0].toLowerCase());
    expect(schemes.dark.get('--background')).toBe(buildNeutralSurfaceScale()[950].toLowerCase());
    // Dark redefines every colour, so nothing from light leaks into it; only the radius is shared.
    const lightColors = [...schemes.light.keys()].filter((name) => name !== '--radius');
    expect([...schemes.dark.keys()]).toEqual(lightColors);
  });

  it('keeps every light token of 0.8.0 exactly, in order', () => {
    const before = Object.keys(LIGHT_0_8_0);
    const light = [...schemes.light.entries()]
      .filter(([name]) => before.includes(name.replace(/^--/, '')))
      .map(([name, value]) => [name.replace(/^--/, ''), value]);
    expect(Object.fromEntries(light)).toEqual(LIGHT_0_8_0);
    expect(light.map(([name]) => name)).toEqual(before);
  });

  it('draws the dark surfaces in neutral near-black greys: page #101010, raised #1e1e1e, hover and borders #2e2e2e', () => {
    const dark = schemes.dark;
    expect(dark.get('--background')).toBe('#101010');
    for (const name of ['--card', '--popover', '--secondary', '--muted']) {
      expect(dark.get(name), name).toBe('#1e1e1e');
    }
    for (const name of ['--accent', '--border', '--sidebar-accent', '--sidebar-border']) {
      expect(dark.get(name), name).toBe('#2e2e2e');
    }
    expect(dark.get('--muted-foreground')).toBe('#b3b3b3');
    expect(dark.get('--input')).toBe('#929292');
    // Text on a coloured fill is the page's near-black too, not the palette's dark teal.
    for (const name of ['--primary-foreground', '--success-foreground', '--warning-foreground']) {
      expect(dark.get(name), name).toBe('#101010');
    }
    for (const name of DARK_SURFACES) {
      const hex = dark.get(`--${name}`)!;
      expect(hex.slice(1, 3) === hex.slice(3, 5) && hex.slice(3, 5) === hex.slice(5, 7), name).toBe(
        true,
      );
    }
  });

  it('mixes each tone’s row tint in OKLab over the content background: 10% in light, 14% in dark', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = schemes[scheme];
      for (const [tone, base] of Object.entries(ROW_TINT_BASES)) {
        expect(tokens.get(`--neat-tint-${tone}`), `${scheme}: ${tone}`).toBe(
          mixOklab(base, ROW_TINT_SHARES[scheme], tokens.get('--background')!).toLowerCase(),
        );
      }
      // Neutral is the untinted row: it has no tint of its own.
      expect(tokens.has('--neat-tint-neutral'), scheme).toBe(false);
    }
  });

  it(`gives each row tint a hover and selection fill of more of its tone, visible on the tint (${MIN_FILL_CONTRAST}:1)`, () => {
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = schemes[scheme];
      for (const tone of Object.keys(ROW_TINT_BASES)) {
        const tint = tokens.get(`--neat-tint-${tone}`)!;
        const accent = tokens.get(`--neat-tint-${tone}-accent`)!;
        const background = tokens.get('--background')!;
        expect(contrastRatio(accent, tint), `${scheme}: ${tone}`).toBeGreaterThanOrEqual(
          MIN_FILL_CONTRAST,
        );
        // More of the tone: further from the background than the resting tint.
        expect(contrastRatio(accent, background), `${scheme}: ${tone}`).toBeGreaterThan(
          contrastRatio(tint, background),
        );
      }
    }
  });

  it('uses the same primary steps as the contrast rules: light #b3541b, dark #e28250', () => {
    expect(schemes.light.get('--primary')).toBe('#b3541b');
    expect(schemes.dark.get('--primary')).toBe('#e28250');
  });

  it('every foreground/background pair it emits reaches 4.5:1 in both schemes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const pairs = textPairs(scheme);
      const labels = pairs.map((pair) => pair.label);
      // The kit extensions and the tints take part, so a missing one cannot pass silently.
      for (const fill of ['primary', 'destructive', 'success', 'warning', 'info', 'highlight']) {
        expect(labels).toContain(`${scheme}: --${fill}-foreground on --${fill}`);
      }
      expect(labels).toContain(`${scheme}: --primary-foreground on --primary-hover`);
      expect(labels).toContain(`${scheme}: --muted-foreground on --accent`);
      expect(labels).toContain(`${scheme}: --muted-foreground on --neat-chip-neutral`);
      expect(labels).toContain(`${scheme}: --neat-warning-text on --card`);
      for (const tone of Object.keys(ROW_TINT_BASES)) {
        for (const text of TEXT_ON_ROW_TINTS) {
          expect(labels).toContain(`${scheme}: --${text} on --neat-tint-${tone}`);
          expect(labels).toContain(`${scheme}: --${text} on --neat-tint-${tone}-accent`);
        }
      }
      expect(labels.filter((label) => label.includes('/'))).toHaveLength(
        STATUS_TEXT.length * TINTS[scheme].over.length,
      );
      for (const { label, foreground, background } of pairs) {
        expect(contrastRatio(foreground, background), label).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('warning is #e9a23b in both schemes, with the scheme’s darkest surface as text (#010f0e, #101010), at least 4.5:1', () => {
    const text = { light: '#010f0e', dark: '#101010' };
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = schemes[scheme];
      expect(tokens.get('--warning'), scheme).toBe('#e9a23b');
      expect(tokens.get('--warning-foreground'), scheme).toBe(text[scheme]);
      expect(
        contrastRatio(tokens.get('--warning-foreground')!, tokens.get('--warning')!),
        scheme,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it(`mixes the neutral chip's fill a step further from the background than --accent, as little as shows on --card and --background (${MIN_CHIP_FILL_CONTRAST}:1) and on --accent (${MIN_FILL_CONTRAST}:1): light #d8dadc, dark #383838`, () => {
    // Dark --muted is the card's own #1e1e1e, so a neutral chip on --muted vanished on a card; the
    // accent step alone would vanish on a hovered or selected list row, whose fill is --accent.
    const steps = { light: [100, 200], dark: [800, 700] } as const;
    const shareStep = 0.1;
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = schemes[scheme];
      const [from, to] = steps[scheme].map((step) => SURFACE_SCALES[scheme][step]);
      expect(from.toLowerCase(), `${scheme}: mixed from the accent step`).toBe(
        tokens.get('--accent'),
      );
      const shows = (color: string) =>
        ['--card', '--background'].every(
          (surface) => contrastRatio(color, tokens.get(surface)!) >= MIN_CHIP_FILL_CONTRAST,
        ) && contrastRatio(color, tokens.get('--accent')!) >= MIN_FILL_CONTRAST;
      const shares = Array.from({ length: 1 / shareStep }, (_, i) => (i + 1) * shareStep);
      const share = shares.find((candidate) => shows(mixOklab(to, candidate, from)));
      expect(share, scheme).toBeDefined();
      expect(tokens.get('--neat-chip-neutral'), scheme).toBe(
        mixOklab(to, share!, from).toLowerCase(),
      );
    }
    expect(schemes.light.get('--neat-chip-neutral')).toBe('#d8dadc');
    expect(schemes.dark.get('--neat-chip-neutral')).toBe('#383838');
  });

  it('gives empty tracks and quiet stretches a fill that shows on a card: --muted in light, the neutral chip fill in dark', () => {
    expect(schemes.light.get('--neat-track')).toBe(schemes.light.get('--muted'));
    expect(schemes.dark.get('--neat-track')).toBe(schemes.dark.get('--neat-chip-neutral'));
    expect(
      contrastRatio(schemes.dark.get('--neat-track')!, schemes.dark.get('--card')!),
    ).toBeGreaterThanOrEqual(MIN_CHIP_FILL_CONTRAST);
  });

  it('gives warning a text colour: its line mixed toward --foreground by the least 5% step that reads at 4.5:1 on the warning tints', () => {
    const shareStep = 0.05;
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = schemes[scheme];
      const line = tokens.get('--neat-line-warning')!;
      const foreground = tokens.get('--foreground')!;
      const tints = ['--neat-tint-warning', '--neat-tint-warning-accent'].map((name) =>
        tokens.get(name)!,
      );
      const reads = (color: string) => tints.every((tint) => contrastRatio(color, tint) >= 4.5);
      const shares = Array.from({ length: 1 / shareStep + 1 }, (_, i) => i * shareStep);
      const share = shares.find((candidate) => reads(mixOklab(foreground, candidate, line)));
      expect(share, scheme).toBeDefined();
      expect(tokens.get('--neat-warning-text'), scheme).toBe(
        mixOklab(foreground, share!, line).toLowerCase(),
      );
    }
    // Dark's line already reads on its tints, so dark's text is the line itself.
    expect(schemes.dark.get('--neat-warning-text')).toBe(schemes.dark.get('--neat-line-warning'));
  });

  it('steps the primary hover one place further from the background than the primary', () => {
    // Stated as a relation, so it holds for any NEAT_PRIMARY_BASE the theme checkpoint picks.
    const scale = buildColorScale(NEAT_PRIMARY_BASE);
    for (const scheme of ['light', 'dark'] as const) {
      const walk = CONTRAST_RULES[scheme].colorWalk;
      const primary = schemes[scheme].get('--primary');
      const index = walk.findIndex((step) => scale[step].toLowerCase() === primary);
      expect(index, `${scheme}: --primary is a step of the walk`).toBeGreaterThanOrEqual(0);
      expect(schemes[scheme].get('--primary-hover'), scheme).toBe(
        scale[along(walk, index, 1)].toLowerCase(),
      );
    }
  });

  it('keeps the hover and selection fill (--accent) visible on every surface it sits on', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = schemes[scheme];
      for (const surface of FILL_SURFACES) {
        const ratio = contrastRatio(tokens.get('--accent')!, tokens.get(`--${surface}`)!);
        expect(ratio, `${scheme}: --accent on --${surface}`).toBeGreaterThanOrEqual(
          MIN_FILL_CONTRAST,
        );
      }
    }
  });

  it(`form-control boundaries and focus rings reach ${MIN_NON_TEXT_CONTRAST}:1 on every surface text sits on`, () => {
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = schemes[scheme];
      for (const name of NON_TEXT) {
        for (const surface of TEXT_SURFACES) {
          const ratio = contrastRatio(tokens.get(`--${name}`)!, tokens.get(`--${surface}`)!);
          expect(ratio, `${scheme}: --${name} on --${surface}`).toBeGreaterThanOrEqual(
            MIN_NON_TEXT_CONTRAST,
          );
        }
      }
    }
  });

  it('makes the video scrim of the palette text colour in both schemes: video looks the same in either', () => {
    for (const scheme of ['light', 'dark'] as const) {
      expect(schemes[scheme].get('--neat-video-scrim')!.slice(0, 7), scheme).toBe(
        SIMA_PALETTE.text.toLowerCase(),
      );
    }
  });

  it('keeps text on the video scrim readable over any video, from black to white', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = schemes[scheme];
      const scrim = tokens.get('--neat-video-scrim')!;
      const text = tokens.get('--neat-video-scrim-foreground')!;
      expect(scrim, `${scheme}: the scrim is #rrggbbaa`).toMatch(/^#[0-9a-f]{8}$/);
      const color = scrim.slice(0, 7);
      const alpha = parseInt(scrim.slice(7), 16) / 255;
      expect(alpha, `${scheme}: the scrim lets the video show through`).toBeLessThan(1);
      // The scrim's text is light, so white video is the worst case; black is checked as well so
      // a dark text colour could not pass.
      for (const video of ['#000000', '#ffffff']) {
        const ratio = contrastRatio(text, composite(color, alpha, video));
        expect(ratio, `${scheme}: scrim text over ${video}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('gives the live dot a red that reads at 3:1 on the page and on the video scrim, over black to mid-grey video', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = schemes[scheme];
      const live = tokens.get('--neat-live')!;
      const scrim = tokens.get('--neat-video-scrim')!;
      const alpha = parseInt(scrim.slice(7), 16) / 255;
      const surface = SURFACE_SCALES[scheme];
      for (const step of CONTRAST_RULES[scheme].textBackgrounds) {
        expect(
          contrastRatio(live, surface[step]),
          `${scheme}: on surface ${step}`,
        ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
      }
      // A red is darker than light video: past mid grey no red reaches 3:1 on the scrim and on a
      // white page at once, so the badge's word ("Live") carries the state there.
      for (const video of ['#000000', '#808080']) {
        const backdrop = composite(scrim.slice(0, 7), alpha, video);
        expect(
          contrastRatio(live, backdrop),
          `${scheme}: on the scrim over ${video}`,
        ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
      }
    }
    // Light `--destructive` does not, on the scrim: the reason the dot has a token of its own.
    const scrim = schemes.light.get('--neat-video-scrim')!;
    const alpha = parseInt(scrim.slice(7), 16) / 255;
    expect(
      contrastRatio(
        schemes.light.get('--destructive')!,
        composite(scrim.slice(0, 7), alpha, '#808080'),
      ),
    ).toBeLessThan(MIN_NON_TEXT_CONTRAST);
  });

  it('takes the live red from the danger scale, the same in both schemes, as video is', () => {
    const danger = buildColorScale(NEAT_DANGER_BASE);
    expect(schemes.light.get('--neat-live')).toBe(danger[400].toLowerCase());
    expect(schemes.dark.get('--neat-live')).toBe(schemes.light.get('--neat-live'));
  });

  it('series 1–4 are the first step of blue, purple, orange and teal that reaches 3:1 on every text background, in both schemes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const { textBackgrounds } = CONTRAST_RULES[scheme];
      SERIES_HUES.forEach((hue, i) => {
        const value = schemes[scheme].get(`--neat-series-${i + 1}`);
        expect(value, `${scheme}: ${hue}`).toBe(seriesValue(scheme, hue));
        for (const background of textBackgrounds) {
          const ratio = contrastRatio(value!, SURFACE_SCALES[scheme][background]);
          expect(
            ratio,
            `${scheme}: series ${i + 1} on surface ${background}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });
    }
  });

  it('series 5 is blue two steps darker than series 1; series 6–8 are purple, orange and blue two steps lighter than their line steps', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = schemes[scheme];
      expect(tokens.get('--neat-series-5'), scheme).toBe(seriesValue(scheme, 'blue', 2));
      expect(tokens.get('--neat-series-6'), scheme).toBe(seriesValue(scheme, 'purple', -2));
      expect(tokens.get('--neat-series-7'), scheme).toBe(seriesValue(scheme, 'orange', -2));
      expect(tokens.get('--neat-series-8'), scheme).toBe(seriesValue(scheme, 'blue', -2));
    }
  });

  it('series values: light #477fbc #837ab5 #d26728 #2a8c9a #214974 #afa6e2 #f4a076 #75acea; dark #75acea #afa6e2 #e28250 #55a3af #477fbc #d5d0fc #ffbd9c #b2d6ff', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const values = SERIES_VALUES[scheme].map((_, i) =>
        schemes[scheme].get(`--neat-series-${i + 1}`),
      );
      expect(values, scheme).toEqual(SERIES_VALUES[scheme]);
    }
  });

  it('pins the known shortfall: light series 6–8 are the lighter shades, below 3:1 on white (2.2, 2.1 and 2.4:1), and every other series reaches 3:1', () => {
    // Deliberate, chosen by eye: the lighter shades are stacked fills whose values the legend
    // carries as text. A change to this must be as deliberate, so this test names the shortfall.
    const below = (scheme: keyof typeof schemes) =>
      SERIES_VALUES[scheme]
        .map((_, i) => i + 1)
        .filter(
          (n) =>
            contrastRatio(
              schemes[scheme].get(`--neat-series-${n}`)!,
              schemes[scheme].get('--background')!,
            ) < MIN_NON_TEXT_CONTRAST,
        );
    expect(below('light')).toEqual([6, 7, 8]);
    expect(below('dark')).toEqual([]);
    const ratios = [6, 7, 8].map((n) =>
      contrastRatio(schemes.light.get(`--neat-series-${n}`)!, schemes.light.get('--background')!),
    );
    expect(ratios.map((ratio) => ratio.toFixed(1))).toEqual(['2.2', '2.1', '2.4']);
  });

  it('neat-line is series 1, neat-line-danger is --destructive, and neat-line-warning reaches 3:1 on every text background', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = schemes[scheme];
      expect(tokens.get('--neat-line'), scheme).toBe(tokens.get('--neat-series-1'));
      expect(tokens.get('--neat-line-danger'), scheme).toBe(tokens.get('--destructive'));
      for (const background of CONTRAST_RULES[scheme].textBackgrounds) {
        const ratio = contrastRatio(
          tokens.get('--neat-line-warning')!,
          SURFACE_SCALES[scheme][background],
        );
        expect(ratio, `${scheme}: warning line on surface ${background}`).toBeGreaterThanOrEqual(
          MIN_NON_TEXT_CONTRAST,
        );
      }
    }
    // The first step of the warning scale that does, which --warning (a fill, 2.2:1 on white) is not.
    expect(schemes.light.get('--neat-line-warning')).toBe('#9d6812');
    expect(schemes.dark.get('--neat-line-warning')).toBe('#f2b35f');
  });

  it('neat-line-warning and neat-line-danger reach 4.5:1 as text on --background and --card, which is how the heatmap writes a row end', () => {
    // neat-line itself is line strength (4.2:1 on white), so the heatmap writes a default end in
    // --foreground; only these two line tokens are used as text.
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = schemes[scheme];
      for (const line of ['neat-line-warning', 'neat-line-danger']) {
        for (const surface of ['background', 'card']) {
          expect(
            contrastRatio(tokens.get(`--${line}`)!, tokens.get(`--${surface}`)!),
            `${scheme}: ${line} on --${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it(`neat-heat-low shows on --background and --card (${MIN_FILL_CONTRAST}:1) and neat-heat-high reaches ${MIN_NON_TEXT_CONTRAST}:1 on neat-heat-low, in both schemes`, () => {
    const blue = HUES.blue;
    const ends = { light: [100, 800], dark: [900, 300] } as const;
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = schemes[scheme];
      const low = tokens.get('--neat-heat-low')!;
      const high = tokens.get('--neat-heat-high')!;
      expect(low, scheme).toBe(blue[ends[scheme][0]].toLowerCase());
      expect(high, scheme).toBe(blue[ends[scheme][1]].toLowerCase());
      for (const surface of ['background', 'card']) {
        expect(
          contrastRatio(low, tokens.get(`--${surface}`)!),
          `${scheme}: low on --${surface}`,
        ).toBeGreaterThanOrEqual(MIN_FILL_CONTRAST);
      }
      expect(contrastRatio(high, low), scheme).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
    }
  });

  it('tokens.generated.css matches buildSpartanThemeCss (run `npm run theme:emit` on failure)', () => {
    expect(generated).toBe(buildSpartanThemeCss(NEAT_DARK_CLASS));
  });
});
