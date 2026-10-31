import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme, type NeatTone } from '@sima/neat-ui';
import { MIN_CHIP_FILL_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { NeatStatusChip, NeatStatusChipButton, type NeatStatusChipVariant } from './status-chip';

const TONES: NeatTone[] = ['neutral', 'success', 'warning', 'danger', 'info', 'highlight'];
const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
const VARIANTS: NeatStatusChipVariant[] = ['solid', 'tinted'];

@Component({
  imports: [NeatStatusChip, NeatStatusChipButton],
  template: `
    <neat-status-chip class="host-class" [tone]="tone()" [variant]="variant()"
      >Live</neat-status-chip
    >
    <neat-status-chip>Idle</neat-status-chip>
    <button
      neatStatusChip
      type="button"
      [tone]="tone()"
      [variant]="variant()"
      (click)="presses = presses + 1"
    >
      Metadata late
    </button>
  `,
})
class ChipHost {
  readonly tone = signal<NeatTone>('success');
  readonly variant = signal<NeatStatusChipVariant>('solid');
  presses = 0;
}

async function render() {
  const fixture = TestBed.createComponent(ChipHost);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const [chip, plain] = Array.from(root.querySelectorAll<HTMLElement>('neat-status-chip'));
  return {
    fixture,
    host: fixture.componentInstance,
    chip,
    plain,
    button: root.querySelector<HTMLButtonElement>('button')!,
  };
}

const classesOf = (element: HTMLElement) => [...element.classList];

describe('NeatStatusChip', () => {
  it('shows its content on the fill of its tone, neutral by default', async () => {
    const { chip, plain } = await render();

    expect(chip.textContent?.trim()).toBe('Live');
    expect(classesOf(chip)).toEqual(
      expect.arrayContaining(['bg-success', 'text-success-foreground']),
    );
    expect(classesOf(plain)).toEqual(
      expect.arrayContaining(['bg-neat-chip-neutral', 'text-muted-foreground']),
    );
  });

  it('follows a change of tone', async () => {
    const { fixture, host, chip } = await render();

    host.tone.set('danger');
    await fixture.whenStable();

    expect(classesOf(chip)).toEqual(
      expect.arrayContaining(['bg-destructive', 'text-destructive-foreground']),
    );
    expect(classesOf(chip)).not.toContain('bg-success');
  });

  it('shows the highlight tone, a distinct state that is no status, on the brand purple’s fill', async () => {
    const { fixture, host, chip } = await render();

    host.tone.set('highlight');
    await fixture.whenStable();

    expect(classesOf(chip)).toEqual(
      expect.arrayContaining(['bg-highlight', 'text-highlight-foreground']),
    );
  });

  it('is a small label that truncates rather than widen what holds it', async () => {
    const { chip } = await render();

    expect(classesOf(chip)).toEqual(
      expect.arrayContaining([
        'inline-block',
        'max-w-full',
        'truncate',
        'text-(length:--neat-text-xs)',
        'font-medium',
      ]),
    );
  });

  it('keeps classes the app sets alongside its own', async () => {
    const { chip } = await render();

    expect(classesOf(chip)).toEqual(expect.arrayContaining(['host-class', 'bg-success']));
  });

  describe('tinted', () => {
    /** Each tone's tinted fill and text, as the chip states them. */
    const TINTED: Record<NeatTone, [fill: string, text: string]> = {
      neutral: ['bg-neat-chip-neutral', 'text-muted-foreground'],
      success: ['bg-neat-tint-success-accent', 'text-success'],
      warning: ['bg-neat-tint-warning-accent', 'text-neat-warning-text'],
      danger: ['bg-neat-tint-danger-accent', 'text-destructive'],
      info: ['bg-neat-tint-info-accent', 'text-info'],
      highlight: ['bg-neat-tint-highlight-accent', 'text-highlight'],
    };

    it('puts each tone’s text in its colour on its tint, neutral on the neutral fill', async () => {
      const { fixture, host, chip, button } = await render();
      host.variant.set('tinted');
      for (const tone of TONES) {
        host.tone.set(tone);
        await fixture.whenStable();
        for (const element of [chip, button]) {
          expect(classesOf(element), tone).toEqual(expect.arrayContaining(TINTED[tone]));
        }
      }
    });

    it('keeps the chip’s shape and size: only the colours change', async () => {
      const { fixture, host, chip } = await render();
      const solid = classesOf(chip);
      host.variant.set('tinted');
      await fixture.whenStable();
      const colour = /^(bg|text)-(?!\()/;
      expect(classesOf(chip).filter((name) => !colour.test(name))).toEqual(
        solid.filter((name) => !colour.test(name)),
      );
    });

    it('is not the default: a chip that does not ask for it stays solid', async () => {
      const { chip } = await render();
      expect(classesOf(chip)).toEqual(
        expect.arrayContaining(['bg-success', 'text-success-foreground']),
      );
      expect(classesOf(chip)).not.toContain('bg-neat-tint-success-accent');
    });
  });

  describe('as a button', () => {
    it('looks like the chip of its tone and stays a button that is pressed like any', async () => {
      const { fixture, host, chip, button } = await render();

      const own = classesOf(chip).filter((name) => name !== 'host-class');
      expect(classesOf(button)).toEqual(expect.arrayContaining(own));
      button.click();
      expect(host.presses).toBe(1);
      expect(button.tabIndex).toBe(0);
      host.tone.set('warning');
      await fixture.whenStable();
      expect(classesOf(button)).toEqual(
        expect.arrayContaining(['bg-warning', 'text-warning-foreground']),
      );
    });

    it('shows a pointer, and a focus outline from the keyboard', async () => {
      const { button } = await render();

      expect(classesOf(button)).toEqual(
        expect.arrayContaining(['cursor-pointer', 'focus-visible:outline-2']),
      );
    });

    it('keeps its width in a row that shrinks, as a video tile’s bar beside a long status', async () => {
      const { button } = await render();

      expect(classesOf(button)).toContain('shrink-0');
    });

    it('looks disabled while disabled: dimmed, with a not-allowed cursor', async () => {
      const { button } = await render();

      expect(classesOf(button)).toEqual(
        expect.arrayContaining(['disabled:opacity-50', 'disabled:cursor-not-allowed']),
      );
    });
  });

  describe('contrast, from the emitted theme tokens', () => {
    const VOCABULARY = { dark: 'dark', 'focus-visible': 'focus' };

    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const on = scheme === 'dark' ? ['dark'] : [];

      it(`${scheme}: each tone’s text reaches 4.5:1 on its fill, solid and tinted`, async () => {
        const { fixture, host, chip } = await render();
        for (const variant of VARIANTS) {
          host.variant.set(variant);
          for (const tone of TONES) {
            host.tone.set(tone);
            await fixture.whenStable();
            const query = { tokens, vocabulary: VOCABULARY, on };
            const fill = stateColor(classesOf(chip), 'bg', query, tokens['background']);
            const text = stateColor(classesOf(chip), 'text', query, fill, tokens['foreground']);
            expect(
              contrastRatio(text, fill),
              `${variant} ${tone}: ${text} on ${fill}`,
            ).toBeGreaterThanOrEqual(4.5);
          }
        }
      });

      it(`${scheme}: the neutral chip’s fill shows on the card and the page (${MIN_CHIP_FILL_CONTRAST}:1), solid and tinted`, async () => {
        const { fixture, host, chip } = await render();
        host.tone.set('neutral');
        for (const variant of VARIANTS) {
          host.variant.set(variant);
          await fixture.whenStable();
          const query = { tokens, vocabulary: VOCABULARY, on };
          for (const surface of ['card', 'background']) {
            const fill = stateColor(classesOf(chip), 'bg', query, tokens[surface]);
            expect(
              contrastRatio(fill, tokens[surface]),
              `${variant}: ${fill} on --${surface} ${tokens[surface]}`,
            ).toBeGreaterThanOrEqual(MIN_CHIP_FILL_CONTRAST);
          }
        }
      });

      it(`${scheme}: every tone’s fill is opaque, so its text keeps 4.5:1 in a toned list row, over any row tint`, async () => {
        const { fixture, host, chip } = await render();
        const tints = Object.keys(tokens).filter((name) => name.startsWith('neat-tint-'));
        expect(tints.length).toBeGreaterThan(0);
        for (const variant of VARIANTS) {
          host.variant.set(variant);
          for (const tone of TONES) {
            host.tone.set(tone);
            await fixture.whenStable();
            const query = { tokens, vocabulary: VOCABULARY, on };
            for (const tint of tints) {
              const fill = stateColor(classesOf(chip), 'bg', query, tokens[tint]);
              const text = stateColor(classesOf(chip), 'text', query, fill, tokens['foreground']);
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
