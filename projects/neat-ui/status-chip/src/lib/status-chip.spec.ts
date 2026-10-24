import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme, type NeatTone } from '@sima/neat-ui';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { NeatStatusChip, NeatStatusChipButton } from './status-chip';

const TONES: NeatTone[] = ['neutral', 'success', 'warning', 'danger', 'info', 'highlight'];
const SCHEMES: NeatColorScheme[] = ['light', 'dark'];

@Component({
  imports: [NeatStatusChip, NeatStatusChipButton],
  template: `
    <neat-status-chip class="host-class" [tone]="tone()">Live</neat-status-chip>
    <neat-status-chip>Idle</neat-status-chip>
    <button neatStatusChip type="button" [tone]="tone()" (click)="presses = presses + 1">
      Metadata late
    </button>
  `,
})
class ChipHost {
  readonly tone = signal<NeatTone>('success');
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
    expect(classesOf(plain)).toEqual(expect.arrayContaining(['bg-muted', 'text-muted-foreground']));
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

      it(`${scheme}: each tone’s text reaches 4.5:1 on its fill`, async () => {
        const { fixture, host, chip } = await render();
        for (const tone of TONES) {
          host.tone.set(tone);
          await fixture.whenStable();
          const query = { tokens, vocabulary: VOCABULARY, on };
          const fill = stateColor(classesOf(chip), 'bg', query, tokens['background']);
          const text = stateColor(classesOf(chip), 'text', query, fill, tokens['foreground']);
          expect(contrastRatio(text, fill), `${tone}: ${text} on ${fill}`).toBeGreaterThanOrEqual(
            4.5,
          );
        }
      });

      it(`${scheme}: each tone keeps its text’s 4.5:1 in a toned list row, over every row tint`, async () => {
        const { fixture, host, chip } = await render();
        const tints = Object.keys(tokens).filter((name) => name.startsWith('neat-tint-'));
        expect(tints.length).toBeGreaterThan(0);
        for (const tone of TONES) {
          host.tone.set(tone);
          await fixture.whenStable();
          const query = { tokens, vocabulary: VOCABULARY, on };
          for (const tint of tints) {
            const fill = stateColor(classesOf(chip), 'bg', query, tokens[tint]);
            const text = stateColor(classesOf(chip), 'text', query, fill, tokens['foreground']);
            expect(
              contrastRatio(text, fill),
              `${tone} over --${tint}: ${text} on ${fill}`,
            ).toBeGreaterThanOrEqual(4.5);
          }
        }
      });
    }
  });
});
