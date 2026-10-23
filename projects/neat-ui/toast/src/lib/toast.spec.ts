import { Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import { NeatDialog } from '@sima/neat-ui/dialog';
import { MIN_FILL_CONTRAST, MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { NeatToastHost } from './toast-host';
import { ERROR_TOAST_MS, MAX_VISIBLE_TOASTS, STATUS_TOAST_MS } from './toast-store';
import { NeatToasts, type NeatProgressToast } from './toasts';

const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
const VOCABULARY = { dark: 'dark', '*': false };

@Component({ template: '<p>Pick a source.</p>' })
class DialogBody {}

@Component({ imports: [NeatToastHost], template: `<neat-toast-host />` })
class ToastApp {
  readonly toasts = inject(NeatToasts);
}

describe('NeatToasts and the toast host', () => {
  let fixture: ComponentFixture<ToastApp>;
  let toasts: NeatToasts;

  /** Applies what the toasts changed: the host renders signals, so one change detection does. */
  const render = () => fixture.detectChanges();
  /** Moves the clock and renders what the passing time removed. */
  const advance = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    render();
  };
  const region = () =>
    document.querySelector<HTMLElement>('.cdk-overlay-container [aria-live="polite"]');
  const items = () =>
    Array.from(region()?.querySelectorAll<HTMLElement>('[data-slot="toast"]') ?? []);
  const messages = () => items().map((item) => item.textContent?.replace(/\s+/g, ' ').trim());

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fixture = TestBed.createComponent(ToastApp);
    toasts = fixture.componentInstance.toasts;
    render();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  it('error and status toasts clear after 4.6 s and 3.2 s; a progress toast stays until done or fail', async () => {
    expect(ERROR_TOAST_MS).toBe(4600);
    expect(STATUS_TOAST_MS).toBe(3200);
    toasts.error('Upload failed.');
    toasts.status('Stopped 2 sources.');
    const progress = toasts.progress('Importing from YouTube');
    render();
    expect(items()).toHaveLength(3);

    await advance(3199);
    expect(messages()).toHaveLength(3);
    await advance(1);
    expect(messages().join('|')).not.toContain('Stopped 2 sources.');
    expect(items()).toHaveLength(2);

    await advance(1399);
    expect(messages().join('|')).toContain('Upload failed.');
    await advance(1);
    expect(messages().join('|')).not.toContain('Upload failed.');

    // Minutes later it is still there.
    await advance(10 * 60_000);
    expect(messages()).toEqual([expect.stringContaining('Importing from YouTube')]);

    progress.done('Imported 1 file.');
    render();
    expect(messages()).toEqual(['Imported 1 file.']);
    await advance(3199);
    expect(items()).toHaveLength(1);
    await advance(1);
    expect(items()).toHaveLength(0);
  });

  it('a failed progress toast becomes an error toast, which clears after 4.6 s', async () => {
    const progress = toasts.progress('Uploading');
    progress.fail('Upload failed: disk full.');
    render();

    expect(items()).toHaveLength(1);
    expect(items()[0].dataset['kind']).toBe('error');
    expect(messages()).toEqual(['Error: Upload failed: disk full.']);
    await advance(ERROR_TOAST_MS - 1);
    expect(items()).toHaveLength(1);
    await advance(1);
    expect(items()).toHaveLength(0);
  });

  it('the host announces politely from the start and keeps at most 3 toasts, newest last', async () => {
    // The live region exists before the first toast: assistive technology announces additions to
    // a region it already knows, not one that appears with its content.
    expect(region()).not.toBeNull();
    expect(region()!.getAttribute('aria-live')).toBe('polite');
    expect(items()).toHaveLength(0);

    expect(MAX_VISIBLE_TOASTS).toBe(3);
    toasts.status('one');
    toasts.status('two');
    toasts.status('three');
    render();
    expect(messages()).toEqual(['one', 'two', 'three']);

    toasts.status('four');
    render();
    expect(messages()).toEqual(['two', 'three', 'four']);

    // The oldest cleared on its own clock, hidden or not; a toast kept hidden by newer ones
    // comes back while it lives.
    await advance(1);
    const progress = toasts.progress('Importing');
    toasts.error('a');
    toasts.error('b');
    toasts.error('c');
    render();
    expect(messages().join('|')).not.toContain('Importing');
    await advance(ERROR_TOAST_MS);
    expect(messages()).toEqual([expect.stringContaining('Importing')]);
    progress.done('Imported.');
  });

  it('a progress toast shows its title, detail and percent, and an unknown percent is indeterminate', () => {
    const progress = toasts.progress('Uploading 3 files');
    render();
    const bar = () => items()[0].querySelector<HTMLElement>('[role="progressbar"]')!;

    expect(items()[0].dataset['kind']).toBe('progress');
    expect(items()[0].textContent).toContain('Uploading 3 files');
    expect(bar().getAttribute('aria-label')).toBe('Uploading 3 files');
    expect(bar().hasAttribute('aria-valuenow')).toBe(false);
    expect(bar().dataset['indeterminate']).toBe('');

    progress.update('clip.mp4 · file 1 of 3', 41.6);
    render();
    expect(items()[0].textContent).toContain('clip.mp4 · file 1 of 3');
    expect(items()[0].textContent).toContain('42%');
    expect(bar().getAttribute('aria-valuenow')).toBe('42');
    expect(bar().getAttribute('aria-valuemin')).toBe('0');
    expect(bar().getAttribute('aria-valuemax')).toBe('100');
    expect(bar().hasAttribute('data-indeterminate')).toBe(false);
    expect(bar().querySelector<HTMLElement>('[data-slot="toast-fill"]')!.style.width).toBe('42%');

    // Back to unknown, and out-of-range values are held to the bar.
    progress.update('Preparing', null);
    render();
    expect(bar().hasAttribute('aria-valuenow')).toBe(false);
    progress.update('Over', 140);
    render();
    expect(bar().getAttribute('aria-valuenow')).toBe('100');
    progress.update('Under', -5);
    render();
    expect(bar().getAttribute('aria-valuenow')).toBe('0');
  });

  it('a progress toast’s changing text is not read out on every update', () => {
    const progress = toasts.progress('Uploading');
    progress.update('clip.mp4', 10);
    render();

    const changing = items()[0].querySelector('[aria-live="off"]')!;
    expect(changing.textContent).toContain('clip.mp4');
    expect(changing.textContent).toContain('10%');
  });

  it('a settled progress toast ignores later calls, and a result comes up as the newest toast', async () => {
    const first = toasts.progress('First');
    const second = toasts.progress('Second');
    toasts.status('Between');
    render();
    expect(messages()).toHaveLength(3);

    first.done('First done.');
    render();
    expect(messages()).toEqual([expect.stringContaining('Second'), 'Between', 'First done.']);

    first.update('late', 50);
    first.fail('late failure');
    first.done('again');
    render();
    expect(messages()).toEqual([expect.stringContaining('Second'), 'Between', 'First done.']);

    second.fail('Second failed.');
    render();
    expect(messages()).toEqual(['Between', 'First done.', 'Error: Second failed.']);
  });

  it('shows a toast above a modal dialog, outside what the dialog hides from assistive technology', async () => {
    const ref = TestBed.inject(NeatDialog).open(DialogBody, { title: 'Assign source' });
    render();
    await vi.advanceTimersByTimeAsync(0);
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog).not.toBeNull();

    toasts.error('Could not assign src3.');
    render();

    // The page is hidden while the dialog is open; the toast is not.
    expect(fixture.nativeElement.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(items()).toHaveLength(1);
    expect(items()[0].closest('[aria-hidden="true"]')).toBeNull();
    // Overlays stack in DOM order here (no popover API in jsdom): the toast's comes after the
    // dialog's, though it was created first.
    const layers = () => Array.from(document.querySelector('.cdk-overlay-container')!.children);
    const layer = (element: Element) => layers().find((candidate) => candidate.contains(element))!;
    expect(layers().indexOf(layer(items()[0]))).toBeGreaterThan(layers().indexOf(layer(dialog)));

    ref.close();
  });

  it('brings the stack to the top of the top layer with each new toast where the browser has popovers', async () => {
    // With the popover API the CDK shows each overlay as a popover; the top layer orders them by
    // when they were shown. jsdom has none, so the calls are recorded.
    const shown: Element[] = [];
    const hidden: Element[] = [];
    HTMLElement.prototype.showPopover = function (this: HTMLElement) {
      shown.push(this);
    };
    HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
      hidden.push(this);
    };
    try {
      fixture.destroy();
      fixture = TestBed.createComponent(ToastApp);
      toasts = fixture.componentInstance.toasts;
      render();
      const stackHost = region()!.closest('[popover]')!;
      expect(stackHost).not.toBeNull();
      expect(shown).toEqual([stackHost]);

      TestBed.inject(NeatDialog).open(DialogBody, { title: 'Assign source' });
      render();
      await vi.advanceTimersByTimeAsync(0);
      const dialogHost = document.querySelector('[role="dialog"]')!.closest('[popover]')!;
      expect(shown.at(-1)).toBe(dialogHost);

      toasts.error('Could not assign src3.');
      render();
      expect(hidden.at(-1)).toBe(stackHost);
      expect(shown.at(-1)).toBe(stackHost);

      // A change to a toast that is already shown does not reshuffle the layers.
      const count = shown.length;
      const progress = toasts.progress('Importing');
      render();
      expect(shown.length).toBe(count + 1);
      progress.update('clip.mp4', 40);
      render();
      expect(shown.length).toBe(count + 1);
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
      delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
    }
  });

  it('removes its stack from the overlay layer when the host is destroyed', () => {
    toasts.status('Stopped 2 sources.');
    render();
    expect(region()).not.toBeNull();

    fixture.destroy();
    expect(region()).toBeNull();
  });

  describe('contrast, from the emitted theme tokens', () => {
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const q = { tokens, vocabulary: VOCABULARY, on: scheme === 'dark' ? ['dark'] : [] };

      it(`${scheme}: every kind of toast meets the theme contrast rules`, () => {
        toasts.error('Upload failed.');
        toasts.status('Stopped 2 sources.');
        const progress: NeatProgressToast = toasts.progress('Importing');
        progress.update('clip.mp4', 40);
        render();

        for (const item of items()) {
          const kind = item.dataset['kind'];
          const classes = [...item.classList];
          const fill = stateColor(classes, 'bg', q, tokens['background']);
          const text = stateColor(classes, 'text', q, fill);
          expect(
            contrastRatio(text, fill),
            `${scheme}: ${kind} text ${text} on ${fill}`,
          ).toBeGreaterThanOrEqual(4.5);
          const outline = stateColor(classes, 'ring', q, fill);
          // A toast is no control, so its outline is held to the panels' (the dialog's, the
          // popover's), not to the 3:1 of a control's boundary.
          expect(
            contrastRatio(outline, tokens['background']),
            `${scheme}: ${kind} outline ${outline}`,
          ).toBeGreaterThanOrEqual(MIN_FILL_CONTRAST);
        }

        // The bar's fill against its track: what tells done from to do.
        const bar = items().find((item) => item.dataset['kind'] === 'progress')!;
        const track = [...bar.querySelector('[role="progressbar"]')!.classList];
        const fill = [...bar.querySelector('[data-slot="toast-fill"]')!.classList];
        const trackColor = stateColor(track, 'bg', q, tokens['popover']);
        const fillColor = stateColor(fill, 'bg', q, trackColor);
        expect(
          contrastRatio(fillColor, trackColor),
          `${scheme}: bar fill ${fillColor} on ${trackColor}`,
        ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
      });
    }
  });
});
