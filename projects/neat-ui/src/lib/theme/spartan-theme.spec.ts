import generated from './tokens.generated.css' with { loader: 'text' };
import { composite, contrastRatio } from './color';
import { buildColorScale, buildSurfaceScale } from './color-scale';
import { along, CONTRAST_RULES, MIN_FILL_CONTRAST, MIN_NON_TEXT_CONTRAST } from './contrast-rules';
import { NEAT_PRIMARY_BASE } from './palette';
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
 * not here: it is a fill-only colour (amber with dark text), so it need not be readable as text.
 */
const COLORED_TEXT = ['muted-foreground', 'primary', 'destructive', 'success', 'info'];
/** The surfaces text sits on. */
const TEXT_SURFACES = ['background', 'card', 'popover', 'muted'];
/**
 * Status colours are also text on a tint of themselves (badges, alerts, soft buttons such as helm's
 * destructive button: `bg-destructive/10`, `dark:bg-destructive/20`), composited over these surfaces.
 */
const STATUS_TEXT = ['destructive', 'success', 'info'];
const TINTS = {
  light: { alpha: 0.1, over: ['background'] },
  dark: { alpha: 0.2, over: ['background', 'card'] },
} as const;
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
  return [
    pair('foreground', 'background'),
    ...ownFills,
    ...onHoverFills,
    ...onSurfaces,
    ...onTints,
  ];
}

describe('buildSpartanThemeCss', () => {
  it('puts light values on :root and dark values on :root.neat-dark', () => {
    const surface = buildSurfaceScale();
    expect([...rules.keys()]).toEqual([':root', DARK_SELECTOR]);
    expect(schemes.light.get('color-scheme')).toBe('light');
    expect(schemes.dark.get('color-scheme')).toBe('dark');
    expect(schemes.light.get('--background')).toBe(surface[0].toLowerCase());
    expect(schemes.dark.get('--background')).toBe(surface[900].toLowerCase());
    // Dark redefines every colour, so nothing from light leaks into it; only the radius is shared.
    const lightColors = [...schemes.light.keys()].filter((name) => name !== '--radius');
    expect([...schemes.dark.keys()]).toEqual(lightColors);
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
      for (const fill of ['primary', 'destructive', 'success', 'warning', 'info']) {
        expect(labels).toContain(`${scheme}: --${fill}-foreground on --${fill}`);
      }
      expect(labels).toContain(`${scheme}: --primary-foreground on --primary-hover`);
      expect(labels.filter((label) => label.includes('/'))).toHaveLength(
        STATUS_TEXT.length * TINTS[scheme].over.length,
      );
      for (const { label, foreground, background } of pairs) {
        expect(contrastRatio(foreground, background), label).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('warning is #e9a23b with #010f0e text in both schemes, at least 4.5:1', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = schemes[scheme];
      expect(tokens.get('--warning'), scheme).toBe('#e9a23b');
      expect(tokens.get('--warning-foreground'), scheme).toBe('#010f0e');
      expect(
        contrastRatio(tokens.get('--warning-foreground')!, tokens.get('--warning')!),
        scheme,
      ).toBeGreaterThanOrEqual(4.5);
    }
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

  it('tokens.generated.css matches buildSpartanThemeCss (run `npm run theme:emit` on failure)', () => {
    expect(generated).toBe(buildSpartanThemeCss(NEAT_DARK_CLASS));
  });
});
