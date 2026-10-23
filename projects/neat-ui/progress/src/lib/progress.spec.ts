import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import helmProgress from '../../../src/lib/ui/progress/src/lib/hlm-progress.ts?source' with {
  loader: 'text',
};
import helmIndicator from '../../../src/lib/ui/progress/src/lib/hlm-progress-indicator.ts?source' with {
  loader: 'text',
};
import { MIN_FILL_CONTRAST, MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { NeatProgress, PROGRESS_HELM_CLASSES } from './progress';

const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
/** The page, a card and the toasts' popover surface. */
const SURFACES = ['background', 'card', 'popover'] as const;

/** The variants on the bar's colour classes. */
const VOCABULARY = { dark: 'dark', 'motion-reduce': 'motion-reduce' };

@Component({
  imports: [NeatProgress],
  template: `<neat-progress label="Uploading clip.mp4" [value]="value()" />`,
})
class ProgressHost {
  readonly value = signal<number | null>(null);
}

async function render(value: number | null) {
  const fixture = TestBed.createComponent(ProgressHost);
  fixture.componentInstance.value.set(value);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement.querySelector('neat-progress');
  const bar = root.querySelector<HTMLElement>('[role="progressbar"]')!;
  const track = root.querySelector<HTMLElement>('[data-slot="progress"]')!;
  const fill = root.querySelector<HTMLElement>('[data-slot="progress-indicator"]')!;
  return { fixture, host: fixture.componentInstance, root, bar, track, fill };
}

describe('NeatProgress', () => {
  it('is one progress bar, named by label, with its value, range and a percent as text', async () => {
    const { root, bar } = await render(42);

    expect(root.querySelectorAll('[role="progressbar"]')).toHaveLength(1);
    expect(bar.getAttribute('aria-label')).toBe('Uploading clip.mp4');
    expect(bar.getAttribute('aria-valuenow')).toBe('42');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuetext')).toBe('42%');
  });

  it('indeterminate (null) leaves out aria-valuenow and the text, and says so in data-state', async () => {
    const { bar, track, fill } = await render(null);

    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.hasAttribute('aria-valuenow')).toBe(false);
    expect(bar.hasAttribute('aria-valuetext')).toBe(false);
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(track.dataset['state']).toBe('indeterminate');
    expect(fill.classList).toContain('animate-indeterminate');
  });

  it('follows the bound value, between known and unknown', async () => {
    const { fixture, host, bar, track, fill } = await render(10);
    expect(track.dataset['state']).toBe('loading');
    expect(fill.style.transform).toBe('translateX(-90%)');
    expect(fill.classList).not.toContain('animate-indeterminate');

    host.value.set(100);
    await fixture.whenStable();
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
    expect(track.dataset['state']).toBe('complete');
    expect(fill.style.transform).toBe('translateX(-0%)');

    host.value.set(null);
    await fixture.whenStable();
    expect(bar.hasAttribute('aria-valuenow')).toBe(false);
    expect(fill.classList).toContain('animate-indeterminate');
  });

  it.each<[number, string]>([
    [140, '100'],
    [-5, '0'],
  ])('holds %s to the range the bar can show: aria-valuenow %s', async (value, now) => {
    const { bar } = await render(value);

    expect(bar.getAttribute('aria-valuenow')).toBe(now);
  });

  it('treats a value that is not a number as unknown rather than failing', async () => {
    const { bar } = await render(Number.NaN);

    expect(bar.hasAttribute('aria-valuenow')).toBe(false);
  });

  it('draws the bar with helm’s classes', async () => {
    const { track, fill } = await render(50);

    expect([...track.classList]).toEqual(
      expect.arrayContaining(['rounded-full', 'h-1.5', 'overflow-hidden']),
    );
    expect([...fill.classList]).toEqual(expect.arrayContaining(['bg-primary', 'h-full']));
  });

  it('helm drift: the copied class strings still appear in the vendored helm progress', () => {
    expect(helmProgress).toContain(PROGRESS_HELM_CLASSES.track);
    expect(helmIndicator).toContain(PROGRESS_HELM_CLASSES.indicator);
  });

  describe('contrast, from the emitted theme tokens', () => {
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const q = (on: string[]) => ({ tokens, vocabulary: VOCABULARY, on });
      const on = (...states: string[]) => (scheme === 'dark' ? ['dark', ...states] : states);

      it(`${scheme}: the track's outline and the fill each reach ${MIN_NON_TEXT_CONTRAST}:1 against background, card and popover, and the fill against the track`, async () => {
        const { track, fill } = await render(50);
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const outline = stateColor([...track.classList], 'ring', q(on()), under);
          const rail = stateColor([...track.classList], 'bg', q(on()), under);
          const bar = stateColor([...fill.classList], 'bg', q(on()), rail);
          expect(
            contrastRatio(outline, under),
            `${scheme}, outline ${outline} on --${surface}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          expect(
            contrastRatio(bar, rail),
            `${scheme}, fill ${bar} on track ${rail}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          expect(
            contrastRatio(bar, under),
            `${scheme}, fill ${bar} on --${surface}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });

      it(`${scheme}: with reduced motion the unknown state is a still bar that stays ${MIN_FILL_CONTRAST}:1 or more from the track`, async () => {
        const { track, fill } = await render(null);
        const classes = [...fill.classList];
        expect(classes).toContain('motion-reduce:animate-none');
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const rail = stateColor([...track.classList], 'bg', q(on()), under);
          const bar = stateColor(classes, 'bg', q(on('motion-reduce')), rail);
          expect(
            contrastRatio(bar, rail),
            `${scheme}, still fill ${bar} on track ${rail}`,
          ).toBeGreaterThanOrEqual(MIN_FILL_CONTRAST);
        }
      });
    }
  });
});
