import generated from './tokens.generated.css' with { loader: 'text' };
import { contrastRatio } from './color';
import { buildSurfaceScale } from './color-scale';
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

/** Coloured text that sits directly on the page's surfaces rather than on its own fill. */
const COLORED_TEXT = ['muted-foreground', 'primary', 'destructive', 'success', 'warning', 'info'];
/** The surfaces text sits on. */
const TEXT_SURFACES = ['background', 'card', 'popover', 'muted'];

/** Every text/background pair a scheme emits: each `--x-foreground` on `--x`, plus coloured text on every surface. */
function textPairs(tokens: Declarations): [foreground: string, background: string][] {
  const ownFills = [...tokens.keys()]
    .filter((name) => name.endsWith('-foreground') && tokens.has(name.replace(/-foreground$/, '')))
    .map((name): [string, string] => [name, name.replace(/-foreground$/, '')]);
  const onSurfaces = COLORED_TEXT.flatMap((text) =>
    TEXT_SURFACES.map((surface): [string, string] => [`--${text}`, `--${surface}`]),
  );
  return [['--foreground', '--background'], ...ownFills, ...onSurfaces];
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
    for (const [scheme, tokens] of Object.entries(schemes)) {
      const pairs = textPairs(tokens);
      // The kit extensions take part, so a missing one cannot pass silently.
      for (const fill of ['--primary', '--destructive', '--success', '--warning', '--info']) {
        expect(pairs).toContainEqual([`${fill}-foreground`, fill]);
      }
      for (const [foreground, background] of pairs) {
        const ratio = contrastRatio(tokens.get(foreground)!, tokens.get(background)!);
        expect(ratio, `${scheme}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('tokens.generated.css matches buildSpartanThemeCss (run `npm run theme:emit` on failure)', () => {
    expect(generated).toBe(buildSpartanThemeCss(NEAT_DARK_CLASS));
  });
});
