import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ɵBROWSER_CLOCK } from '@sima/neat-ui';
import { stylesheet } from './css.testing';
import { neatLabelColour } from './label-colour';
import { type NeatLabelRun, NeatLabelTimeline, type NeatTimelineMotion } from './label-timeline';
import timelineStyles from './label-timeline.css' with { loader: 'text' };
import { resize, stubResizeObserver } from './resize-observer.testing';

const { declared } = stylesheet(timelineStyles);

const NOW = 1_000_000;

@Component({
  imports: [NeatLabelTimeline],
  template: `<neat-label-timeline
    label="Recent gestures"
    [runs]="runs()"
    [nowMs]="now"
    [windowMs]="windowMs()"
    [labels]="labels()"
    [quiet]="quiet()"
    [labelRows]="labelRows()"
  />`,
})
class TimelineHost {
  readonly now = NOW;
  readonly runs = signal<readonly NeatLabelRun[]>([]);
  readonly windowMs = signal(30_000);
  readonly labels = signal<readonly string[]>([]);
  readonly quiet = signal<readonly string[]>([]);
  readonly labelRows = signal(1);
}

/** The strip's width in the specs: 600 px for 30 s, so 20 px a second, unless a spec resizes it. */
let stripPx = 600;
/** How wide a name is drawn in the specs, its gap included: 6 px a character. */
const nameWidth = (text: string) => text.length * 6;

// jsdom lays nothing out: the names' row is 600 px wide and the probe as wide as its text says.
// A spec that needs another box (the strip, for the pointer) gives that element its own.
beforeEach(() => {
  stripPx = 600;
  stubResizeObserver();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const width = this.classList.contains('names')
      ? stripPx
      : this.classList.contains('probe')
        ? nameWidth(this.textContent ?? '')
        : 0;
    return { left: 0, top: 0, width, height: 0, right: width, bottom: 0 } as DOMRect;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A run from `from` to `to` seconds before now. */
const run = (label: string, from: number, to: number): NeatLabelRun => ({
  label,
  startMs: NOW - from * 1000,
  endMs: NOW - to * 1000,
});

async function render(runs: readonly NeatLabelRun[], setup?: (host: TimelineHost) => void) {
  const fixture = TestBed.createComponent(TimelineHost);
  fixture.componentInstance.runs.set(runs);
  setup?.(fixture.componentInstance);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  return {
    host,
    runs: Array.from<HTMLElement>(host.querySelectorAll('[data-slot="label-timeline-run"]')),
    ticks: Array.from(host.querySelectorAll('[data-slot="label-timeline-tick"]')).map((tick) =>
      tick.textContent?.trim(),
    ),
  };
}

/** The text a screen reader gets for a run: the visually hidden span inside the item. */
const spoken = (element: HTMLElement) => element.querySelector('.sr-only')?.textContent?.trim();

/** The rules the names hang from, down to the strip: where each stands (px) and its name's row. */
const rulesOf = (host: HTMLElement) =>
  Array.from(host.querySelectorAll<HTMLElement>('[data-slot="label-timeline-rule"]')).map(
    (rule) => ({
      x: Math.round(parseFloat(rule.style.left) * 100) / 100,
      row: Number(rule.style.getPropertyValue('--row')),
    }),
  );

/** The names drawn above the strip: each one's text, where it starts (px) and its row. */
const namesOf = (host: HTMLElement) =>
  Array.from(host.querySelectorAll<HTMLElement>('[data-slot="label-timeline-name"]')).map(
    (name) => ({
      text: name.textContent?.trim(),
      // To a hundredth of a px: the percentages the runs are placed by do not add up exactly.
      x: Math.round(parseFloat(name.style.left) * 100) / 100,
      row: Number(name.style.getPropertyValue('--row')),
    }),
  );

describe('NeatLabelTimeline', () => {
  it('places a run by its times', async () => {
    const { runs } = await render([run('Zoom in', 20, 10)]);

    expect(parseFloat(runs[0].style.left)).toBeCloseTo(33.33, 1);
    expect(parseFloat(runs[0].style.width)).toBeCloseTo(33.33, 1);
  });

  it('clips runs to the window', async () => {
    const { runs } = await render([run('Before', 40, 20), run('After', 10, -5)]);

    expect(parseFloat(runs[0].style.left)).toBe(0);
    expect(parseFloat(runs[0].style.width)).toBeCloseTo(33.33, 1);
    expect(parseFloat(runs[1].style.left)).toBeCloseTo(66.67, 1);
    expect(parseFloat(runs[1].style.width)).toBeCloseTo(33.33, 1);
  });

  it('drops runs outside the window and runs that end before they start', async () => {
    const { runs } = await render([
      run('Gone', 50, 40),
      run('Future', -5, -10),
      run('Inverted', 10, 20),
      run('Empty', 10, 10),
      { label: 'Bad', startMs: Number.NaN, endMs: NOW },
      run('Kept', 20, 10),
    ]);

    expect(runs.map(spoken)).toEqual(['Kept, 20 s to 10 s ago']);
  });

  it('draws overlaps in input order', async () => {
    const { runs } = await render([run('First', 25, 5), run('Second', 15, 0)]);

    expect(runs.map((element) => element.dataset['label'])).toEqual(['First', 'Second']);
    // Later in the DOM paints on top; nothing sets a z-index that would reorder them.
    expect(runs.every((element) => element.style.zIndex === '')).toBe(true);
  });

  it('names the runs above the strip, outside them, in one row by default', async () => {
    const { host } = await render([run('Zoom in', 20, 10), run('Throw up', 8.5, 0)]);
    const timeline = host.querySelector('neat-label-timeline')!;
    const names = timeline.querySelector<HTMLElement>('.names')!;

    expect(names.nextElementSibling?.classList.contains('runs')).toBe(true);
    expect(names.getAttribute('aria-hidden')).toBe('true');
    expect(names.style.getPropertyValue('--rows')).toBe('1');
    expect(timeline.querySelector('.run .name')).toBeNull();
    // Each starts at its run's left edge: 10 s and 21.5 s into the 30 s window.
    expect(namesOf(host)).toEqual([
      { text: 'Throw up', x: 430, row: 0 },
      { text: 'Zoom in', x: 200, row: 0 },
    ]);
  });

  it('names a run narrower than its name, from the run’s start', async () => {
    // One second is 20 px; the name is 150.
    const { host } = await render([run('Pointing with two fingers', 20, 19)]);

    expect(namesOf(host)).toEqual([{ text: 'Pointing with two fingers', x: 200, row: 0 }]);
  });

  it('holds a name back from the strip’s right end, its rule still at its run’s start', async () => {
    const { host } = await render([run('Zoom in', 10, 2), run('Pointing with two fingers', 2, 0)]);
    const name = host.querySelector<HTMLElement>('[data-slot="label-timeline-name"]')!;

    expect(namesOf(host)[0]).toEqual({ text: 'Pointing with two fingers', x: 450, row: 0 });
    // Its text is held back over the older run; the rule stands at its own run's start (560 px).
    expect(name.hasAttribute('data-held')).toBe(true);
    expect(rulesOf(host)[0]).toEqual({ x: 560, row: 0 });
    expect(declared('.name[data-held]', 'border-left-color')).toBe('transparent');
  });

  it('lets the newest name win, and leaves out one that fits nowhere but keeps it in words', async () => {
    // Alpha one (200 to 254 px) runs into Beta, which starts at 220 px.
    const runs = [run('Alpha one', 20, 19.5), run('Beta', 19, 18)];
    const { host, runs: items } = await render(runs);

    expect(namesOf(host).map((name) => name.text)).toEqual(['Beta']);
    expect(items.map(spoken)).toEqual(['Alpha one, 20 s to 19.5 s ago', 'Beta, 19 s to 18 s ago']);
  });

  it('uses a second row only with labelRows of 2 and the first row taken', async () => {
    const runs = [run('Alpha one', 20, 19.5), run('Beta', 19, 18), run('Gamma', 10, 5)];
    const { host } = await render(runs, (h) => h.labelRows.set(2));

    expect(host.querySelector<HTMLElement>('.names')!.style.getPropertyValue('--rows')).toBe('2');
    expect(namesOf(host)).toEqual([
      { text: 'Gamma', x: 400, row: 0 },
      { text: 'Beta', x: 220, row: 0 },
      { text: 'Alpha one', x: 200, row: 1 },
    ]);
  });

  it('never names a quiet run', async () => {
    const { host } = await render([run('Silence', 30, 10), run('Zoom in', 10, 0)], (h) =>
      h.quiet.set(['Silence']),
    );

    expect(namesOf(host).map((name) => name.text)).toEqual(['Zoom in']);
  });

  it('lays the names out again when the strip is resized or labelRows changes', async () => {
    const runs = [run('Alpha one', 20, 19.5), run('Beta', 19, 18)];
    const fixture = TestBed.createComponent(TimelineHost);
    fixture.componentInstance.runs.set(runs);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(namesOf(host).map((name) => name.text)).toEqual(['Beta']);

    // Four times as wide, Alpha one (800 to 854 px) ends before Beta starts (880 px).
    stripPx = 2400;
    resize(host.querySelector('.names')!, 2400);
    await fixture.whenStable();
    expect(namesOf(host)).toEqual([
      { text: 'Beta', x: 880, row: 0 },
      { text: 'Alpha one', x: 800, row: 0 },
    ]);

    stripPx = 600;
    resize(host.querySelector('.names')!, 600);
    fixture.componentInstance.labelRows.set(2);
    await fixture.whenStable();
    expect(namesOf(host).map((name) => [name.text, name.row])).toEqual([
      ['Beta', 0],
      ['Alpha one', 1],
    ]);
  });

  it('draws no names before the strip has a width', async () => {
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(
      () => ({ width: 0 }) as DOMRect,
    );
    const { host } = await render([run('Zoom in', 20, 10)]);

    expect(namesOf(host)).toEqual([]);
  });

  it('colours runs through neatLabelColour', async () => {
    const { runs } = await render(
      [run('B', 30, 20), run('A', 20, 10), run('Q', 10, 5), run('X', 5, 0)],
      (host) => {
        host.labels.set(['A', 'B', 'Q']);
        host.quiet.set(['Q']);
      },
    );

    expect(runs.map((element) => element.style.getPropertyValue('--run'))).toEqual([
      'var(--neat-series-2)',
      'var(--neat-series-1)',
      'var(--muted)',
      'var(--neat-chip-neutral)',
    ]);
  });

  it('fills a quiet run with --muted, the score bars keeping neatLabelColour', async () => {
    const { runs } = await render([run('Q', 30, 0)], (host) => host.quiet.set(['Q']));

    expect(runs[0].style.getPropertyValue('--run')).toBe('var(--muted)');
    expect(neatLabelColour('Q', [], ['Q'])).toBe('var(--muted-foreground)');
  });

  it('colours by first appearance when no labels are given', async () => {
    const { runs } = await render(
      [run('B', 30, 20), run('Q', 20, 15), run('A', 15, 10), run('B', 10, 0)],
      (host) => host.quiet.set(['Q']),
    );

    expect(runs.map((element) => element.style.getPropertyValue('--run'))).toEqual([
      'var(--neat-series-1)',
      'var(--muted)',
      'var(--neat-series-3)',
      'var(--neat-series-1)',
    ]);
  });

  it('counts a repeated label once when it orders colours by first appearance', async () => {
    const { runs } = await render([run('A', 30, 20), run('A', 20, 10), run('B', 10, 0)]);

    expect(runs.map((element) => element.style.getPropertyValue('--run'))).toEqual([
      'var(--neat-series-1)',
      'var(--neat-series-1)',
      'var(--neat-series-2)',
    ]);
  });

  it('draws no axis for a window that is not a positive number', async () => {
    for (const windowMs of [0, -1, Number.NaN]) {
      expect((await render([], (host) => host.windowMs.set(windowMs))).ticks).toEqual([]);
    }
  });

  it('cuts a name wider than the strip with an ellipsis, and keeps runs of one colour apart', () => {
    expect(declared('.name', 'max-width')).toBe('100%');
    expect(declared('.name', 'overflow')).toBe('hidden');
    expect(declared('.name', 'text-overflow')).toBe('ellipsis');
    expect(declared('.run', 'border-right')).toBe('2px solid var(--neat-surface)');
    // The probe measures a name with the gap kept after it in its row, and never shows.
    expect(declared('.probe', 'padding-inline-end')).toBe('var(--neat-space-2)');
    expect(declared('.probe', 'visibility')).toBe('hidden');
    expect(declared('.probe', 'max-width')).toBe('none');
  });

  it('labels the axis for the window', async () => {
    expect((await render([])).ticks).toEqual(['−30 s', '−20 s', '−10 s', 'now']);
    expect((await render([], (host) => host.windowMs.set(60_000))).ticks).toEqual([
      '−60 s',
      '−40 s',
      '−20 s',
      'now',
    ]);
  });

  it('gives screen readers the runs as a list', async () => {
    const { host, runs } = await render([run('Zoom in', 20, 10), run('Throw up', 8.5, 0)]);

    expect(host.querySelector('neat-label-timeline')?.getAttribute('aria-label')).toBe(
      'Recent gestures',
    );
    expect(host.querySelector('ul')?.getAttribute('role')).toBe('list');
    expect(runs.map(spoken)).toEqual(['Zoom in, 20 s to 10 s ago', 'Throw up, 8.5 s ago to now']);
  });
});

/** The strip's readout and the ways to move it: the pointer at a place across it, and keys. */
function readoutOf(host: HTMLElement, fixture: { whenStable(): Promise<unknown> }) {
  const timeline = host.querySelector<HTMLElement>('neat-label-timeline')!;
  const strip = timeline.querySelector<HTMLElement>('.runs')!;
  return {
    timeline,
    readout: () => timeline.querySelector<HTMLElement>('.readout'),
    live: () => timeline.querySelector<HTMLElement>('[aria-live]')!,
    /** Moves the pointer to `fraction` of the strip's width. */
    async point(fraction: number) {
      // jsdom lays nothing out; the pointer maths needs a box, so give the strip one 600 px wide.
      strip.getBoundingClientRect = () =>
        ({ left: 100, top: 0, width: 600, height: 64, right: 700, bottom: 64 }) as DOMRect;
      strip.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 100 + fraction * 600, bubbles: true }),
      );
      await fixture.whenStable();
    },
    async leave() {
      strip.dispatchEvent(new MouseEvent('pointerleave'));
      await fixture.whenStable();
    },
    async focus() {
      timeline.dispatchEvent(new FocusEvent('focus'));
      await fixture.whenStable();
    },
    async blur() {
      timeline.dispatchEvent(new FocusEvent('blur'));
      await fixture.whenStable();
    },
    async key(key: string) {
      timeline.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
      await fixture.whenStable();
    },
  };
}

describe('NeatLabelTimeline readout', () => {
  const RUNS = [run('Silence', 30, 20), run('Zoom in', 20, 10), run('Throw up', 8.5, 0)];
  const setup = async () => {
    const fixture = TestBed.createComponent(TimelineHost);
    fixture.componentInstance.runs.set(RUNS);
    fixture.componentInstance.quiet.set(['Silence']);
    await fixture.whenStable();
    return { fixture, ...readoutOf(fixture.nativeElement as HTMLElement, fixture) };
  };
  const lines = (element: HTMLElement | null) =>
    Array.from(element?.children ?? []).map((line) => line.textContent?.trim());

  it('shows the run under the pointer, its label and its span, and hides when it leaves', async () => {
    const chart = await setup();
    expect(chart.readout(), 'hidden until the pointer or a key').toBeNull();

    await chart.point(0.5);
    expect(lines(chart.readout())).toEqual(['Zoom in', '20 s to 10 s ago']);
    // It stands at the run's middle, to the right of it before the strip's middle.
    expect(parseFloat(chart.readout()!.style.getPropertyValue('--at'))).toBeCloseTo(0.5, 6);
    expect(chart.readout()?.hasAttribute('data-flip')).toBe(false);
    // A pointer move is not announced: that would be noise at every pixel.
    expect(chart.live().textContent?.trim()).toBe('');

    await chart.point(0.9);
    expect(lines(chart.readout())).toEqual(['Throw up', '8.5 s ago to now']);
    expect(chart.readout()?.hasAttribute('data-flip')).toBe(true);

    await chart.leave();
    expect(chart.readout()).toBeNull();
  });

  it('reads out a name’s run when the pointer is on the name, and hides when it leaves', async () => {
    const chart = await setup();
    const name = Array.from(
      chart.timeline.querySelectorAll<HTMLElement>('[data-slot="label-timeline-name"]'),
    ).find((element) => element.textContent?.trim() === 'Zoom in')!;

    name.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));
    await chart.fixture.whenStable();
    expect(lines(chart.readout())).toEqual(['Zoom in', '20 s to 10 s ago']);

    chart.timeline.querySelector('.names')!.dispatchEvent(new MouseEvent('pointerleave'));
    await chart.fixture.whenStable();
    expect(chart.readout()).toBeNull();
  });

  it('reads out a quiet run too, which has no name under it', async () => {
    const chart = await setup();

    await chart.point(0.1);

    expect(lines(chart.readout())).toEqual(['Silence', '30 s to 20 s ago']);
  });

  it('shows nothing over a stretch of the strip without a run', async () => {
    const fixture = TestBed.createComponent(TimelineHost);
    fixture.componentInstance.runs.set([run('Zoom in', 20, 10)]);
    await fixture.whenStable();
    const chart = readoutOf(fixture.nativeElement as HTMLElement, fixture);

    await chart.point(0.9);

    expect(chart.readout()).toBeNull();
  });

  it('leaves the names as they were', async () => {
    const chart = await setup();
    const before = namesOf(chart.timeline);

    await chart.point(0.5);

    expect(namesOf(chart.timeline)).toEqual(before);
    expect(before.map((name) => name.text)).toEqual(['Throw up', 'Zoom in']);
  });

  it('is one tab stop: focus reads out the newest run and the arrow keys walk the runs', async () => {
    const chart = await setup();
    expect(chart.timeline.getAttribute('tabindex')).toBe('0');
    expect(chart.timeline.querySelectorAll('[tabindex]')).toHaveLength(0);

    await chart.focus();
    expect(lines(chart.readout())).toEqual(['Throw up', '8.5 s ago to now']);
    // Focus alone lands on the strip without a sentence in the reader's ear.
    expect(chart.live().textContent?.trim()).toBe('');

    await chart.key('ArrowLeft');
    expect(lines(chart.readout())).toEqual(['Zoom in', '20 s to 10 s ago']);
    expect(chart.live().textContent?.trim()).toBe('Zoom in, 20 s to 10 s ago');

    await chart.key('Home');
    expect(lines(chart.readout())?.[0]).toBe('Silence');
    await chart.key('ArrowLeft');
    expect(lines(chart.readout())?.[0]).toBe('Silence');
    await chart.key('End');
    expect(lines(chart.readout())?.[0]).toBe('Throw up');
    await chart.key('ArrowRight');
    expect(lines(chart.readout())?.[0]).toBe('Throw up');

    await chart.key('Escape');
    expect(chart.readout()).toBeNull();
    await chart.key('Home');
    expect(lines(chart.readout())?.[0]).toBe('Silence');
    await chart.key('Escape');
    await chart.key('ArrowLeft');
    expect(lines(chart.readout())?.[0]).toBe('Throw up');
    await chart.blur();
    expect(chart.readout()).toBeNull();
  });

  it('walks the runs by time, whatever order they come in', async () => {
    const fixture = TestBed.createComponent(TimelineHost);
    fixture.componentInstance.runs.set([run('Late', 10, 0), run('Early', 30, 10)]);
    await fixture.whenStable();
    const chart = readoutOf(fixture.nativeElement as HTMLElement, fixture);

    await chart.focus();
    expect(lines(chart.readout())?.[0]).toBe('Late');
    await chart.key('ArrowLeft');
    expect(lines(chart.readout())?.[0]).toBe('Early');
  });

  it('keeps a run a key chose while the app drops older runs', async () => {
    const chart = await setup();
    await chart.focus();
    await chart.key('ArrowLeft');

    chart.fixture.componentInstance.runs.set(RUNS.slice(1));
    await chart.fixture.whenStable();

    expect(lines(chart.readout())?.[0]).toBe('Zoom in');
  });

  it('keeps its live region a child of its host, the box the sheet positions', async () => {
    const chart = await setup();

    expect(chart.live().parentElement).toBe(chart.timeline);
    expect(declared(':host', 'position')).toBe('relative');
  });
});

@Component({
  imports: [NeatLabelTimeline],
  template: `<neat-label-timeline
    label="Recent gestures"
    [runs]="runs"
    [nowMs]="now()"
    [motion]="motion()"
  />`,
})
class MotionHost {
  readonly now = signal(NOW);
  readonly motion = signal<NeatTimelineMotion>('smooth');
  readonly runs = [run('Zoom in', 20, 10), run('Throw up', 10, 0)];
}

/** The frame clock and `requestAnimationFrame` stepped by hand, so motion is checked frame by frame. */
function motionSetup(options: { reduced?: boolean; motion?: NeatTimelineMotion } = {}) {
  let clock = 5000;
  const frames = new Map<number, () => void>();
  let requested = 0;
  let nextHandle = 1;
  // The kit's frame clock, not the globals: Angular's own scheduler asks for frames too.
  vi.spyOn(ɵBROWSER_CLOCK, 'now').mockImplementation(() => clock);
  vi.spyOn(ɵBROWSER_CLOCK, 'request').mockImplementation((callback) => {
    requested++;
    frames.set(nextHandle, callback);
    return nextHandle++;
  });
  vi.spyOn(ɵBROWSER_CLOCK, 'cancel').mockImplementation((handle) => {
    frames.delete(handle);
  });
  let reduced = !!options.reduced;
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduced, media: query }));
  const fixture = TestBed.createComponent(MotionHost);
  if (options.motion) fixture.componentInstance.motion.set(options.motion);
  /** Moves the clock in 100 ms frames, each run once, and lets the view follow. */
  const advance = async (ms: number) => {
    for (let spent = 0; spent < ms; spent += 100) {
      clock += Math.min(100, ms - spent);
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback());
      await fixture.whenStable();
    }
  };
  const lefts = () =>
    Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('[data-slot="label-timeline-run"]'),
    ).map((element) => parseFloat(element.style.left));
  return {
    setReduced: (value: boolean) => (reduced = value),
    fixture,
    host: fixture.componentInstance,
    advance,
    lefts,
    frames,
    requested: () => requested,
  };
}

/** Where the first run starts (in percent) when the window ends `shiftMs` after NOW. */
const leftAfter = (shiftMs: number) => ((10_000 - shiftMs) / 30_000) * 100;

describe('NeatLabelTimeline motion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('advances between updates in smooth mode', async () => {
    const { fixture, advance, lefts } = motionSetup();
    await fixture.whenStable();
    const before = lefts()[0];

    await advance(500);

    expect(lefts()[0]).toBeCloseTo(leftAfter(500), 4);
    expect(before - lefts()[0]).toBeCloseTo((500 / 30_000) * 100, 4);
  });

  it('stops 1000 ms past the last update', async () => {
    const { fixture, advance, lefts } = motionSetup();
    await fixture.whenStable();

    await advance(3000);

    expect(lefts()[0]).toBeCloseTo(leftAfter(1000), 4);
  });

  it('never moves backwards', async () => {
    const { fixture, host, advance, lefts } = motionSetup();
    await fixture.whenStable();
    await advance(800);
    const ahead = lefts();

    host.now.set(NOW + 200);
    await fixture.whenStable();
    expect(lefts()).toEqual(ahead);

    // Real time catches up with the drawn now only after 600 ms more; until then it holds.
    await advance(500);
    expect(lefts()).toEqual(ahead);
    await advance(300);
    expect(lefts()[0]).toBeLessThan(ahead[0]);
  });

  it('idles at the cap and wakes for the next update', async () => {
    const { fixture, host, advance, frames } = motionSetup();
    await fixture.whenStable();

    await advance(3000);
    expect(frames.size).toBe(0);

    host.now.set(NOW + 3000);
    await fixture.whenStable();
    expect(frames.size).toBe(1);
  });

  it('holds a jitter behind the drawn now but snaps to a rewind', async () => {
    const { fixture, host, advance, lefts } = motionSetup();
    await fixture.whenStable();
    await advance(1000);

    host.now.set(NOW + 100);
    await fixture.whenStable();
    expect(lefts()[0]).toBeCloseTo(leftAfter(1000), 4);

    host.now.set(NOW - 5000);
    await fixture.whenStable();
    expect(lefts()[0]).toBeCloseTo(leftAfter(-5000), 4);
    await advance(300);
    expect(lefts()[0]).toBeCloseTo(leftAfter(-4700), 4);
  });

  it('follows the reduced-motion setting when the next update arrives', async () => {
    const { fixture, host, advance, lefts, frames, setReduced } = motionSetup();
    await fixture.whenStable();
    await advance(300);
    expect(lefts()[0]).toBeCloseTo(leftAfter(300), 4);

    setReduced(true);
    host.now.set(NOW + 400);
    await fixture.whenStable();
    expect(lefts()[0]).toBeCloseTo(leftAfter(400), 4);
    expect(frames.size).toBe(0);
    await advance(500);
    expect(lefts()[0]).toBeCloseTo(leftAfter(400), 4);
  });

  it('restarts from a later update', async () => {
    const { fixture, host, advance, lefts } = motionSetup();
    await fixture.whenStable();
    await advance(1000);

    host.now.set(NOW + 1000);
    await fixture.whenStable();
    await advance(400);

    expect(lefts()[0]).toBeCloseTo(leftAfter(1400), 4);
  });

  it('moves a run’s readout with the run as the strip scrolls', async () => {
    const { fixture, advance } = motionSetup();
    await fixture.whenStable();
    const chart = readoutOf(fixture.nativeElement as HTMLElement, fixture);
    await chart.focus();
    await chart.key('ArrowLeft');
    const at = () => parseFloat(chart.readout()!.style.getPropertyValue('--at'));
    // Zoom in, 20 s to 10 s before NOW: its middle is half the window back.
    expect(at()).toBeCloseTo(0.5, 4);

    await advance(500);

    expect(chart.readout()?.textContent).toContain('Zoom in');
    expect(at()).toBeCloseTo(0.5 - 500 / 30_000, 4);
  });

  it('moves the names with their runs as the strip scrolls', async () => {
    const { fixture, advance } = motionSetup();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    // Zoom in starts 20 s back (200 px), Throw up 10 s back (400 px); both slide 10 px in 500 ms.
    expect(namesOf(host)).toEqual([
      { text: 'Throw up', x: 400, row: 0 },
      { text: 'Zoom in', x: 200, row: 0 },
    ]);

    await advance(500);

    expect(namesOf(host)).toEqual([
      { text: 'Throw up', x: 390, row: 0 },
      { text: 'Zoom in', x: 190, row: 0 },
    ]);
  });

  it('stays put between updates in step mode', async () => {
    const { fixture, advance, lefts, requested } = motionSetup({ motion: 'step' });
    await fixture.whenStable();
    const before = lefts();

    await advance(2000);

    expect(lefts()).toEqual(before);
    expect(requested()).toBe(0);
  });

  it('steps under reduced motion even in smooth mode', async () => {
    const { fixture, advance, lefts, requested } = motionSetup({ reduced: true });
    await fixture.whenStable();
    const before = lefts();

    await advance(2000);

    expect(lefts()).toEqual(before);
    expect(requested()).toBe(0);
  });

  it('stops its frame loop on destroy and in step mode', async () => {
    const { fixture, host, advance, frames, requested } = motionSetup();
    await fixture.whenStable();
    expect(frames.size).toBe(1);

    host.motion.set('step');
    await fixture.whenStable();
    expect(frames.size).toBe(0);
    const asked = requested();
    await advance(500);
    expect(requested()).toBe(asked);

    host.motion.set('smooth');
    await fixture.whenStable();
    expect(frames.size).toBe(1);
    const asking = requested();
    fixture.destroy();
    expect(frames.size).toBe(0);
    await advance(500);
    expect(requested()).toBe(asking);
  });
});
