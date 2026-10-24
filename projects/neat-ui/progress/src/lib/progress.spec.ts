import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import helmProgress from '../../../src/lib/ui/progress/src/lib/hlm-progress.ts?source' with {
  loader: 'text',
};
import helmIndicator from '../../../src/lib/ui/progress/src/lib/hlm-progress-indicator.ts?source' with {
  loader: 'text',
};
import { MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
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

/** A titled readout, as the import dialog, the encode readout and the progress toast show one. */
@Component({
  imports: [NeatProgress],
  template: `<neat-progress
    [heading]="heading()"
    [detail]="detail()"
    [label]="label()"
    [value]="value()"
  />`,
})
class TitledHost {
  readonly heading = signal('Uploading 3 files');
  readonly detail = signal('clip.mp4 · file 1 of 3');
  readonly label = signal('');
  readonly value = signal<number | null>(41.6);
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

  describe('titled', () => {
    async function renderTitled(setup: (host: TitledHost) => void = () => undefined) {
      const fixture = TestBed.createComponent(TitledHost);
      setup(fixture.componentInstance);
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement.querySelector('neat-progress');
      const text = (selector: string) =>
        root.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
      return { fixture, host: fixture.componentInstance, root, text };
    }

    it('without a heading it is the bar alone', async () => {
      const { root } = await render(42);

      expect(root.querySelector('[data-slot="progress-title"]')).toBeNull();
      expect(root.children).toHaveLength(1);
    });

    it('shows the heading with the whole percent at its line’s end, the detail under it, then the bar', async () => {
      const { root, text } = await renderTitled();

      const parts = [...root.querySelector('[data-slot="progress-readout"]')!.children].map(
        (child) => child.getAttribute('data-slot'),
      );
      expect(parts).toEqual(['progress-title', 'progress-detail', 'progress']);
      const title = root.querySelector('[data-slot="progress-title"]')!;
      expect([...title.children].map((part) => part.textContent?.trim())).toEqual([
        'Uploading 3 files',
        '42%',
      ]);
      expect(text('[data-slot="progress-detail"]')).toBe('clip.mp4 · file 1 of 3');
    });

    it('announces the heading politely as a status, not the changing percent or detail', async () => {
      const { root, fixture, host } = await renderTitled();

      const status = root.querySelector('[role="status"]')!;
      expect(status.textContent?.trim()).toBe('Uploading 3 files');
      host.heading.set('Preparing clip.mp4');
      await fixture.whenStable();
      expect(status.textContent?.trim()).toBe('Preparing clip.mp4');
      expect(root.querySelectorAll('[role="status"]')).toHaveLength(1);
    });

    it('leaves the percent out while the work cannot say, and the detail out while empty', async () => {
      const { text, root } = await renderTitled((host) => {
        host.value.set(null);
        host.detail.set('');
      });

      expect(text('[data-slot="progress-title"]')).toBe('Uploading 3 files');
      expect(root.querySelector('[data-slot="progress-detail"]')).toBeNull();
    });

    it('cuts a long detail on one line, with its full text as a tooltip', async () => {
      const { root } = await renderTitled();

      const detail = root.querySelector<HTMLElement>('[data-slot="progress-detail"]')!;
      expect([...detail.classList]).toEqual(expect.arrayContaining(['truncate']));
      expect(detail.getAttribute('title')).toBe('clip.mp4 · file 1 of 3');
    });

    it('names the bar by the heading, or by label when one is given', async () => {
      const { root, fixture, host } = await renderTitled();
      const bar = () => root.querySelector('[role="progressbar"]')!;
      expect(bar().getAttribute('aria-label')).toBe('Uploading 3 files');

      host.label.set('Upload');
      await fixture.whenStable();
      expect(bar().getAttribute('aria-label')).toBe('Upload');
    });

    for (const scheme of SCHEMES) {
      it(`${scheme}: the heading and the detail reach 4.5:1 on background, card and popover`, async () => {
        const { root } = await renderTitled();
        const tokens = spartanThemeTokens(scheme);
        const q = { tokens, vocabulary: VOCABULARY, on: scheme === 'dark' ? ['dark'] : [] };
        for (const slot of ['progress-title', 'progress-detail']) {
          const classes = [...root.querySelector(`[data-slot="${slot}"]`)!.classList];
          for (const surface of SURFACES) {
            const under = tokens[surface];
            const text = stateColor(classes, 'text', q, under, tokens['foreground']);
            expect(
              contrastRatio(text, under),
              `${slot}: ${text} on --${surface}`,
            ).toBeGreaterThanOrEqual(4.5);
          }
        }
      });
    }
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

      it(`${scheme}: with reduced motion the unknown state is still stripes of full-strength --primary on the track, which reach ${MIN_NON_TEXT_CONTRAST}:1 against the track and the surface`, async () => {
        const { track, fill } = await render(null);
        const classes = [...fill.classList];
        expect(classes).toContain('motion-reduce:animate-none');
        // The fill is transparent between stripes of `--primary`; a gradient is no colour a
        // utility's value resolves to, so the stripes' colour is read from the class itself.
        expect(classes).toContain('motion-reduce:bg-transparent');
        const stripes = classes.find((name) => name.startsWith('motion-reduce:bg-[repeating'))!;
        expect(stripes).toContain('(135deg,var(--primary)_0_6px,transparent_6px_12px)');
        expect(stripes).not.toMatch(/#|rgb|hsl/);
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const rail = stateColor([...track.classList], 'bg', q(on()), under);
          expect(
            contrastRatio(tokens['primary'], rail),
            `${scheme}, stripes ${tokens['primary']} on track ${rail}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          expect(
            contrastRatio(tokens['primary'], under),
            `${scheme}, stripes on --${surface}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });
    }
  });
});
