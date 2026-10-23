import { Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import { NeatDialog } from '@sima/neat-ui/dialog';
import { MIN_FILL_CONTRAST } from '../../../src/lib/theme/contrast-rules';
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
  const text = (element: Element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  /** What a screen reader announces: the visually hidden live region. */
  const announcer = () =>
    document.querySelector<HTMLElement>('.cdk-overlay-container [data-slot="toast-announcer"]');
  const announcements = () =>
    Array.from(announcer()?.querySelectorAll('[data-slot="toast-announcement"]') ?? []).map(text);
  /** What the user sees: the stack. */
  const stack = () =>
    document.querySelector<HTMLElement>('.cdk-overlay-container [data-slot="toast"]')
      ?.parentElement ?? null;
  const items = () =>
    Array.from(
      document.querySelectorAll<HTMLElement>('.cdk-overlay-container [data-slot="toast"]'),
    );
  const messages = () => items().map(text);

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
    expect(messages()).toEqual(['Upload failed: disk full.']);
    expect(announcements()).toContain('Error: Upload failed: disk full.');
    await advance(ERROR_TOAST_MS - 1);
    expect(items()).toHaveLength(1);
    await advance(1);
    expect(items()).toHaveLength(0);
  });

  it('keeps at most 3 toasts, newest last, and hides error and status toasts before progress ones', async () => {
    expect(MAX_VISIBLE_TOASTS).toBe(3);
    toasts.status('one');
    toasts.status('two');
    toasts.status('three');
    render();
    expect(messages()).toEqual(['one', 'two', 'three']);

    toasts.status('four');
    render();
    expect(messages()).toEqual(['two', 'three', 'four']);

    // Work in progress is what the user waits for: it is the last to be hidden.
    await advance(ERROR_TOAST_MS);
    const progress = toasts.progress('Importing');
    toasts.error('a');
    toasts.error('b');
    toasts.error('c');
    render();
    expect(messages()).toEqual([expect.stringContaining('Importing'), 'b', 'c']);

    // A hidden toast keeps its own clock and is back while it lives.
    await advance(ERROR_TOAST_MS);
    expect(messages()).toEqual([expect.stringContaining('Importing')]);
    progress.done('Imported.');
  });

  it('with more than 3 progress toasts the oldest is the one that is hidden', () => {
    const first = toasts.progress('First');
    toasts.progress('Second');
    toasts.progress('Third');
    toasts.progress('Fourth');
    render();

    expect(messages().map((message) => message.split(' ')[0])).toEqual([
      'Second',
      'Third',
      'Fourth',
    ]);
    // Its result is the news, so it shows; a running toast makes room, and is back when the
    // result clears.
    first.done('First done.');
    render();
    expect(messages().map((message) => message.split(' ')[0])).toEqual([
      'Third',
      'Fourth',
      'First',
    ]);
    expect(messages().at(-1)).toBe('First done.');
  });

  it('a progress toast shows its title, detail and percent, and an unknown percent is indeterminate', () => {
    const progress = toasts.progress('Uploading 3 files');
    render();
    const bar = () => items()[0].querySelector<HTMLElement>('neat-progress [role="progressbar"]')!;
    const fill = () => items()[0].querySelector<HTMLElement>('[data-slot="progress-indicator"]')!;

    expect(items()[0].dataset['kind']).toBe('progress');
    expect(items()[0].textContent).toContain('Uploading 3 files');
    expect(bar().getAttribute('aria-label')).toBe('Uploading 3 files');
    expect(bar().hasAttribute('aria-valuenow')).toBe(false);
    expect(fill().classList).toContain('animate-indeterminate');

    progress.update('clip.mp4 · file 1 of 3', 41.6);
    render();
    expect(items()[0].textContent).toContain('clip.mp4 · file 1 of 3');
    expect(items()[0].textContent).toContain('42%');
    expect(bar().getAttribute('aria-valuenow')).toBe('42');
    expect(fill().classList).not.toContain('animate-indeterminate');

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

  it('a settled progress toast ignores later calls, and a result comes up as the newest toast', () => {
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
    expect(messages()).toEqual(['Between', 'First done.', 'Second failed.']);
  });

  describe('what a screen reader announces', () => {
    /** Entries added to the live region, as an assistive technology would be told of them. */
    function watchAdditions(region: Element) {
      const added: string[] = [];
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          record.addedNodes.forEach((node) => {
            if (node instanceof Element && node.matches('[data-slot="toast-announcement"]')) {
              added.push(text(node));
            }
          });
        }
      });
      observer.observe(region, { childList: true, subtree: true });
      return { added, stop: () => observer.disconnect() };
    }

    it('is one polite, visually hidden live region that exists before the first toast; the stack is hidden from assistive technology', () => {
      const region = announcer()!;
      expect(region).not.toBeNull();
      expect(region.getAttribute('aria-live')).toBe('polite');
      expect(region.classList).toContain('sr-only');
      expect(announcements()).toEqual([]);

      toasts.status('Stopped 2 sources.');
      render();
      expect(stack()!.getAttribute('aria-hidden')).toBe('true');
      expect(stack()!.closest('[aria-live]')).toBeNull();
      expect(region.closest('[aria-hidden="true"]')).toBeNull();
    });

    it('gets each toast’s text exactly once: a new toast, a progress update, bringing the stack forward and a toast clearing add nothing else', async () => {
      const region = announcer()!;
      const watch = watchAdditions(region);

      toasts.error('Upload failed.');
      render();
      toasts.status('Stopped 2 sources.');
      const progress = toasts.progress('Importing');
      render();
      progress.update('clip.mp4', 10);
      render();
      progress.update('clip.mp4', 60);
      render();
      await advance(STATUS_TOAST_MS);
      progress.done('Imported.');
      render();
      // The observer delivers its records in a microtask.
      await Promise.resolve();
      watch.stop();

      expect(watch.added.map((entry) => entry.replace(/ +\d+%| clip\.mp4/g, '').trim())).toEqual([
        'Error: Upload failed.',
        'Stopped 2 sources.',
        'Importing',
        'Imported.',
      ]);
      expect(announcer()).toBe(region);
    });

    it('is the same node, connected and never hidden, across new toasts and the stack being brought forward', async () => {
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
        const region = announcer()!;
        const announcerHost = region.closest('[popover]')!;

        toasts.status('one');
        render();
        toasts.error('two');
        render();

        expect(announcer()).toBe(region);
        expect(region.isConnected).toBe(true);
        expect(hidden).not.toContain(announcerHost);
        expect(hidden.length).toBeGreaterThan(0);
        // It was shown once, when it was created.
        expect(shown.filter((host) => host === announcerHost)).toHaveLength(1);
      } finally {
        delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
        delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
      }
    });

    it('describes a progress toast by its title, with the changing detail in a part that is not live', () => {
      const progress = toasts.progress('Uploading');
      progress.update('clip.mp4', 10);
      render();

      const entry = announcer()!.querySelector('[data-slot="toast-announcement"]')!;
      expect(entry.firstChild?.textContent?.trim()).toBe('Uploading');
      const changing = entry.querySelector('[aria-live="off"]')!;
      expect(text(changing)).toBe('clip.mp4 10%');
    });
  });

  it('takes no pointer events, so a toast never sits on a dialog’s buttons', () => {
    toasts.status('Stopped 2 sources.');
    render();

    const paneOf = (element: Element) => element.closest<HTMLElement>('.cdk-overlay-pane')!;
    expect(paneOf(stack()!).style.pointerEvents).toBe('none');
    expect(paneOf(announcer()!).style.pointerEvents).toBe('none');
  });

  it('shows a toast above a modal dialog, outside what the dialog hides from assistive technology', async () => {
    const ref = TestBed.inject(NeatDialog).open(DialogBody, { title: 'Assign source' });
    render();
    await vi.advanceTimersByTimeAsync(0);
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog).not.toBeNull();

    toasts.error('Could not assign src3.');
    render();

    // The page is hidden while the dialog is open; the announcements are not.
    expect(fixture.nativeElement.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(announcements()).toEqual(['Error: Could not assign src3.']);
    expect(announcer()!.closest('[aria-hidden="true"]')).toBeNull();
    // Overlays stack in DOM order here (no popover API in jsdom): the stack's comes after the
    // dialog's, though it was created first.
    const layers = () => Array.from(document.querySelector('.cdk-overlay-container')!.children);
    const layer = (element: Element) => layers().find((candidate) => candidate.contains(element))!;
    expect(layers().indexOf(layer(items()[0]))).toBeGreaterThan(layers().indexOf(layer(dialog)));

    ref.close();
  });

  it('brings the stack to the top of the top layer when a toast is added, and only then, where the browser has popovers', async () => {
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
      toasts.status('first');
      render();
      const stackHost = stack()!.closest('[popover]')!;
      expect(stackHost).not.toBeNull();
      expect(shown.at(-1)).toBe(stackHost);

      TestBed.inject(NeatDialog).open(DialogBody, { title: 'Assign source' });
      render();
      await vi.advanceTimersByTimeAsync(0);
      const dialogHost = document.querySelector('[role="dialog"]')!.closest('[popover]')!;
      expect(shown.at(-1)).toBe(dialogHost);

      toasts.error('Could not assign src3.');
      render();
      expect(hidden.at(-1)).toBe(stackHost);
      expect(shown.at(-1)).toBe(stackHost);

      // A toast that is updated does not reshuffle the layers; neither does one that clears,
      // which would replay every remaining toast's entry animation.
      const progress = toasts.progress('Importing');
      render();
      const count = shown.length;
      progress.update('clip.mp4', 40);
      render();
      expect(shown.length).toBe(count);
      toasts.status('Stopped 2 sources.');
      render();
      expect(shown.length).toBe(count + 1);
      await advance(STATUS_TOAST_MS);
      expect(items().map((item) => item.dataset['kind'])).toEqual(['error', 'progress']);
      expect(shown.length).toBe(count + 1);
      await advance(ERROR_TOAST_MS);
      expect(items()).toHaveLength(1);
      expect(shown.length).toBe(count + 1);
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
      delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
    }
  });

  it('removes its layers from the overlay layer when the host is destroyed', () => {
    toasts.status('Stopped 2 sources.');
    render();
    expect(announcer()).not.toBeNull();
    expect(stack()).not.toBeNull();

    fixture.destroy();
    expect(announcer()).toBeNull();
    expect(stack()).toBeNull();
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
        // The progress bar is `neat-progress`; progress.spec holds its fill and track to 3:1 on
        // the popover surface a toast sits on.
      });
    }
  });
});
