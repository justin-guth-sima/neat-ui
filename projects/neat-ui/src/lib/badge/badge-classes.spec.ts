import helmBadge from '../ui/badge/src/lib/hlm-badge.ts?source' with { loader: 'text' };
import { contrastRatio } from '../theme/color';
import { MIN_CHIP_FILL_CONTRAST, MIN_FILL_CONTRAST } from '../theme/contrast-rules';
import { spartanThemeTokens } from '../theme/spartan-theme';
import { stateColor } from '../theme/state-colors';
import type { NeatColorScheme } from '../theme/theme.service';
import type { NeatTone } from '../theme/tone';
import { classSet, helmCvaBase, takenFromHelm } from '../typography/helm-classes.testing';
import { badgeButtonClasses, badgeClasses } from './badge-classes';

const TONES: NeatTone[] = ['neutral', 'success', 'warning', 'danger', 'info', 'highlight'];
const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
const VARIANTS = ['soft', 'solid'] as const;

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

const list = (classes: string) => classes.split(' ');

describe('badgeClasses', () => {
  /** The helm classes the kit replaces or leaves out (badge-classes.ts says why). */
  const DEPARTURES = ['inline-flex', 'py-0.5', 'shrink-0'];
  /** What the kit adds to every badge: its truncation, and the replacements of the departures. */
  const KIT_ADDITIONS = [
    'max-w-full',
    'truncate',
    'inline-block',
    'has-[>neat-icon]:inline-flex',
    'py-0',
    'leading-4.5',
    'align-middle',
    'shrink',
  ];

  it('helm drift: is helm’s badge base less the departures, plus the kit’s classes and the tone’s', () => {
    for (const tone of TONES) {
      for (const variant of VARIANTS) {
        const colors = (variant === 'soft' ? SOFT : SOLID)[tone];
        expect(classSet(list(badgeClasses(tone, variant))), `${variant} ${tone}`).toEqual(
          takenFromHelm(helmCvaBase(helmBadge), {
            departures: DEPARTURES,
            additions: [...KIT_ADDITIONS, ...colors],
          }),
        );
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

  it('may shrink in a crowded row, so it cuts its text there rather than overflow the row', () => {
    for (const tone of TONES) {
      for (const variant of VARIANTS) {
        const classes = list(badgeClasses(tone, variant));
        expect(classes, `${variant} ${tone}`).toContain('shrink');
        expect(classes, `${variant} ${tone}`).not.toContain('shrink-0');
      }
    }
  });

  it('is helm’s shape: 1.25rem high, a pill, small text in medium weight', () => {
    expect(list(badgeClasses('neutral', 'soft'))).toEqual(
      expect.arrayContaining(['h-5', 'rounded-4xl', 'px-2', 'text-xs', 'font-medium']),
    );
  });

  it('soft: each tone’s color on its tint, neutral muted text on the neutral fill', () => {
    for (const tone of TONES) {
      expect(list(badgeClasses(tone, 'soft')), tone).toEqual(expect.arrayContaining(SOFT[tone]));
    }
  });

  it('solid: each tone’s status fill under the text the theme pairs with it, neutral as soft', () => {
    for (const tone of TONES) {
      expect(list(badgeClasses(tone, 'solid')), tone).toEqual(expect.arrayContaining(SOLID[tone]));
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

    it('stays whole in a crowded row, as the status chip’s button did', () => {
      for (const tone of TONES) {
        for (const variant of VARIANTS) {
          expect(list(badgeButtonClasses(tone, variant)), `${variant} ${tone}`).toContain(
            'shrink-0',
          );
        }
      }
    });

    it('keeps everything else of the badge: only helm’s ring color and the shrinking are replaced', () => {
      for (const tone of TONES) {
        for (const variant of VARIANTS) {
          const button = list(badgeButtonClasses(tone, variant));
          expect(
            list(badgeClasses(tone, variant))
              .filter((name) => !button.includes(name))
              .sort(),
            `${variant} ${tone}`,
          ).toEqual(['shrink', 'focus-visible:ring-ring/50'].sort());
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
