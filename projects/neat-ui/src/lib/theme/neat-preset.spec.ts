import { contrastRatio } from './color';
import { buildColorScale, buildSurfaceScale } from './color-scale';
import { NeatPreset } from './neat-preset';
import { NEAT_DANGER_BASE, NEAT_PRIMARY_BASE, NEAT_WARN_BASE, SIMA_PALETTE } from './palette';

type Scheme = 'light' | 'dark';
type TokenTree = Record<string, unknown>;

const PRIMARY_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/** Flattens a token tree into PrimeNG token paths: `text.mutedColor` becomes `text.muted.color`. */
function flatten(tree: TokenTree, prefix: string, into: Map<string, string>): Map<string, string> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix + key.replace(/([a-z0-9])([A-Z])/g, '$1.$2').toLowerCase();
    if (typeof value === 'string') into.set(path, value);
    else if (value && typeof value === 'object') flatten(value as TokenTree, `${path}.`, into);
  }
  return into;
}

const preset = NeatPreset as { primitive: TokenTree; semantic: TokenTree };
const tokens = flatten(preset.semantic, '', flatten(preset.primitive, '', new Map()));

/** Picks the scheme's branch of a top-level `light-dark(a, b)`. */
function pickScheme(value: string, scheme: Scheme): string {
  const match = /^light-dark\((.*)\)$/s.exec(value.trim());
  if (!match) return value.trim();
  const args = match[1];
  let depth = 0;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '(') depth++;
    else if (args[i] === ')') depth--;
    else if (args[i] === ',' && depth === 0) {
      return (scheme === 'light' ? args.slice(0, i) : args.slice(i + 1)).trim();
    }
  }
  throw new Error(`Malformed light-dark(): ${value}`);
}

/** Resolves a token path to its final colour in a scheme, following `{path}` references. */
function resolve(path: string, scheme: Scheme): string {
  const raw = tokens.get(path);
  if (raw === undefined) throw new Error(`No token ${path}`);
  const value = pickScheme(raw, scheme);
  const reference = /^\{([^}]+)\}$/.exec(value);
  return reference ? resolve(reference[1], scheme) : value;
}

const primaryColor = (s: Scheme) => resolve('primary.color', s);
const primaryContrastColor = (s: Scheme) => resolve('primary.contrast.color', s);
const textColor = (s: Scheme) => resolve('text.color', s);
const mutedTextColor = (s: Scheme) => resolve('text.muted.color', s);
const contentBackground = (s: Scheme) => resolve('content.background', s);

describe('NeatPreset', () => {
  for (const scheme of ['light', 'dark'] as const) {
    describe(`${scheme} scheme`, () => {
      it('meets 4.5:1 for primary against its contrast colour', () => {
        expect(
          contrastRatio(primaryColor(scheme), primaryContrastColor(scheme)),
        ).toBeGreaterThanOrEqual(4.5);
      });

      it('meets 4.5:1 for text and muted text on the content background', () => {
        expect(contrastRatio(textColor(scheme), contentBackground(scheme))).toBeGreaterThanOrEqual(
          4.5,
        );
        expect(
          contrastRatio(mutedTextColor(scheme), contentBackground(scheme)),
        ).toBeGreaterThanOrEqual(4.5);
      });

      it('uses the SiMa surface scale', () => {
        const surface = buildSurfaceScale();
        for (const [step, color] of Object.entries(surface)) {
          expect(resolve(`surface.${step}`, scheme)).toBe(color);
        }
      });
    });
  }

  it('builds the primary scale from NEAT_PRIMARY_BASE', () => {
    const scale = buildColorScale(NEAT_PRIMARY_BASE);
    for (const step of PRIMARY_STEPS) {
      expect(resolve(`primary.${step}`, 'light')).toBe(scale[step]);
      expect(resolve(`primary.${step}`, 'dark')).toBe(scale[step]);
    }
  });

  it('uses the lightest primary step from 500 down that reaches 4.5:1 on white in light', () => {
    const scale = buildColorScale(NEAT_PRIMARY_BASE);
    expect(primaryContrastColor('light')).toBe(SIMA_PALETTE.white);
    const chosen = PRIMARY_STEPS.find((step) => scale[step] === primaryColor('light'));
    expect(chosen).toBeGreaterThanOrEqual(500);
    if (chosen !== 500) {
      const lighter = PRIMARY_STEPS[PRIMARY_STEPS.indexOf(chosen!) - 1];
      expect(contrastRatio(scale[lighter], SIMA_PALETTE.white)).toBeLessThan(4.5);
    }
  });

  it('uses the darkest primary step from 400 up that reaches 4.5:1 on the palette text in dark', () => {
    const scale = buildColorScale(NEAT_PRIMARY_BASE);
    expect(primaryContrastColor('dark')).toBe(SIMA_PALETTE.text);
    const chosen = PRIMARY_STEPS.find((step) => scale[step] === primaryColor('dark'));
    expect(chosen).toBeLessThanOrEqual(400);
    if (chosen !== 400) {
      const darker = PRIMARY_STEPS[PRIMARY_STEPS.indexOf(chosen!) + 1];
      expect(contrastRatio(scale[darker], SIMA_PALETTE.text)).toBeLessThan(4.5);
    }
  });

  it('sets light text to the palette text colour', () => {
    expect(textColor('light')).toBe(SIMA_PALETTE.text);
  });

  it("maps Aura's severity colour families to the SiMa functional scales", () => {
    const families: Record<string, string> = {
      green: SIMA_PALETTE.green,
      sky: SIMA_PALETTE.blue,
      blue: SIMA_PALETTE.blue,
      orange: NEAT_WARN_BASE,
      amber: NEAT_WARN_BASE,
      yellow: NEAT_WARN_BASE,
      red: NEAT_DANGER_BASE,
    };
    for (const [family, base] of Object.entries(families)) {
      const scale = buildColorScale(base);
      for (const step of PRIMARY_STEPS)
        expect(resolve(`${family}.${step}`, 'light')).toBe(scale[step]);
    }
  });
});
