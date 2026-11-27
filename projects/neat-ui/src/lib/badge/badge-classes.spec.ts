import helmBadge from '../ui/badge/src/lib/hlm-badge.ts?source' with { loader: 'text' };
import { contrastRatio } from '../theme/color';
import { MIN_CHIP_FILL_CONTRAST, MIN_FILL_CONTRAST } from '../theme/contrast-rules';
import { spartanThemeTokens } from '../theme/spartan-theme';
import { stateColor } from '../theme/state-colors';
import type { NeatColorScheme } from '../theme/theme.service';
import type { NeatTone } from '../theme/tone';
import { badgeButtonClasses, badgeClasses } from './badge-classes';

const TONES: NeatTone[] = ['neutral', 'success', 'warning', 'danger', 'info', 'highlight'];
const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
const VARIANTS = ['soft', 'solid'] as const;

/** Helm's badge base, as `badgeVariants` in the vendored file states it. */
const helmBase = (): string[] => {
  const base = /cva\(\s*'([^']+)'/.exec(helmBadge);
  expect(base, 'the base string of helm’s badgeVariants').not.toBeNull();
  return base![1].split(' ');
};

const list = (classes: string) => classes.split(' ');

describe('badgeClasses', () => {
  /** The helm classes the kit replaces, each by its own (badge-classes.ts says why). */
  const REPLACED = { 'inline-flex': 'inline-block', 'py-0.5': 'py-0' };

  it('helm drift: takes every class of helm’s badge base but the two it replaces', () => {
    const kept = helmBase().filter((name) => !(name in REPLACED));
    expect(kept.length).toBe(helmBase().length - Object.keys(REPLACED).length);
    for (const tone of TONES) {
      for (const variant of VARIANTS) {
        const classes = list(badgeClasses(tone, variant));
        expect(classes, `${variant} ${tone}`).toEqual(
          expect.arrayContaining([...kept, ...Object.values(REPLACED)]),
        );
        for (const name of Object.keys(REPLACED)) {
          expect(classes, `${variant} ${tone}`).not.toContain(name);
        }
      }
    }
  });

  it('ends its text in an ellipsis at the width of what holds it, and is helm’s flex row with an icon', () => {
    expect(list(badgeClasses('info', 'soft'))).toEqual(
      expect.arrayContaining([
        'max-w-full',
        'truncate',
        'inline-block',
        'has-[>neat-icon]:inline-flex',
        'leading-4.5',
        'align-middle',
      ]),
    );
  });

  it('is helm’s shape: 1.25rem high, a pill, small text in medium weight', () => {
    expect(list(badgeClasses('neutral', 'soft'))).toEqual(
      expect.arrayContaining(['h-5', 'rounded-4xl', 'px-2', 'text-xs', 'font-medium']),
    );
  });

  /** Each tone's fill and text, as the badge states them. */
  const SOFT: Record<NeatTone, [fill: string, text: string]> = {
    neutral: ['bg-neat-chip-neutral', 'text-muted-foreground'],
    success: ['bg-neat-tint-success-accent', 'text-success'],
    warning: ['bg-neat-tint-warning-accent', 'text-neat-warning-text'],
    danger: ['bg-neat-tint-danger-accent', 'text-destructive'],
    info: ['bg-neat-tint-info-accent', 'text-info'],
    highlight: ['bg-neat-tint-highlight-accent', 'text-highlight'],
  };
  const SOLID: Record<NeatTone, [fill: string, text: string]> = {
    neutral: ['bg-neat-chip-neutral', 'text-muted-foreground'],
    success: ['bg-success', 'text-success-foreground'],
    warning: ['bg-warning', 'text-warning-foreground'],
    danger: ['bg-destructive', 'text-destructive-foreground'],
    info: ['bg-info', 'text-info-foreground'],
    highlight: ['bg-highlight', 'text-highlight-foreground'],
  };

  it('soft: each tone’s color on its tint, neutral muted text on the neutral fill', () => {
    for (const tone of TONES) {
      expect(list(badgeClasses(tone, 'soft')), tone).toEqual(expect.arrayContaining(SOFT[tone]));
    }
  });

  it('solid: each tone’s status fill under the text the theme pairs with it, neutral as soft', () => {
    for (const tone of TONES) {
      expect(list(badgeClasses(tone, 'solid')), tone).toEqual(
        expect.arrayContaining(SOLID[tone]),
      );
    }
  });

  it('changes only the colors between the variants', () => {
    const color = /^(bg|text)-(?!\()(?!\[)/;
    for (const tone of TONES) {
      const shape = (variant: (typeof VARIANTS)[number]) =>
        list(badgeClasses(tone, variant)).filter((name) => !color.test(name));
      expect(shape('soft'), tone).toEqual(shape('solid'));
    }
  });

  describe('as a button', () => {
    it('adds the pointer, the kit’s full focus ring in place of helm’s half one, and the disabled look', () => {
      const classes = list(badgeButtonClasses('warning', 'solid'));
      expect(classes).toEqual(
        expect.arrayContaining([
          'cursor-pointer',
          'outline-none',
          'focus-visible:ring-ring',
          'focus-visible:ring-[3px]',
          'disabled:cursor-not-allowed',
          'disabled:opacity-50',
          ...SOLID.warning,
        ]),
      );
      expect(classes).not.toContain('focus-visible:ring-ring/50');
    });

    it('keeps everything else of the badge: only helm’s ring color is replaced', () => {
      for (const tone of TONES) {
        for (const variant of VARIANTS) {
          const button = list(badgeButtonClasses(tone, variant));
          expect(
            list(badgeClasses(tone, variant)).filter((name) => !button.includes(name)),
            `${variant} ${tone}`,
          ).toEqual(['focus-visible:ring-ring/50']);
        }
      }
    });
  });

  describe('contrast, from the emitted theme tokens', () => {
    const VOCABULARY = { dark: 'dark', 'focus-visible': 'focus', 'aria-invalid': false };

    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const on = scheme === 'dark' ? ['dark'] : [];
      const query = { tokens, vocabulary: VOCABULARY, on };
      const colors = (tone: NeatTone, variant: (typeof VARIANTS)[number], under: string) => {
        const classes = list(badgeClasses(tone, variant));
        const fill = stateColor(classes, 'bg', query, under);
        return { fill, text: stateColor(classes, 'text', query, fill, tokens['foreground']) };
      };

      it(`${scheme}: each tone’s text reaches 4.5:1 on its fill, soft and solid, on the page, a card and a dialog`, () => {
        for (const variant of VARIANTS) {
          for (const tone of TONES) {
            for (const surface of ['background', 'card', 'popover']) {
              const { fill, text } = colors(tone, variant, tokens[surface]);
              expect(
                contrastRatio(text, fill),
                `${variant} ${tone} on --${surface}: ${text} on ${fill}`,
              ).toBeGreaterThanOrEqual(4.5);
            }
          }
        }
      });

      it(`${scheme}: the neutral badge’s fill shows on the card and the page (${MIN_CHIP_FILL_CONTRAST}:1) and on a hovered or selected row’s --accent (${MIN_FILL_CONTRAST}:1), soft and solid`, () => {
        const minimum = {
          card: MIN_CHIP_FILL_CONTRAST,
          background: MIN_CHIP_FILL_CONTRAST,
          accent: MIN_FILL_CONTRAST,
        };
        for (const variant of VARIANTS) {
          for (const [surface, ratio] of Object.entries(minimum)) {
            const { fill } = colors('neutral', variant, tokens[surface]);
            expect(
              contrastRatio(fill, tokens[surface]),
              `${variant}: ${fill} on --${surface} ${tokens[surface]}`,
            ).toBeGreaterThanOrEqual(ratio);
          }
        }
      });

      it(`${scheme}: every tone’s fill is opaque, so its text keeps 4.5:1 in a toned list row, over any row tint`, () => {
        const tints = Object.keys(tokens).filter((name) => name.startsWith('neat-tint-'));
        expect(tints.length).toBeGreaterThan(0);
        for (const variant of VARIANTS) {
          for (const tone of TONES) {
            for (const tint of tints) {
              const { fill, text } = colors(tone, variant, tokens[tint]);
              expect(
                contrastRatio(text, fill),
                `${variant} ${tone} over --${tint}: ${text} on ${fill}`,
              ).toBeGreaterThanOrEqual(4.5);
            }
          }
        }
      });
    }
  });
});
