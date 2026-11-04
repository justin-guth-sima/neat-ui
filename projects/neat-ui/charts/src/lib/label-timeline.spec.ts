import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ɵBROWSER_CLOCK } from '@sima/neat-ui';
import { stylesheet } from './css.testing';
import { neatLabelColour } from './label-colour';
import { type NeatLabelRun, NeatLabelTimeline, type NeatTimelineMotion } from './label-timeline';
import timelineStyles from './label-timeline.css' with { loader: 'text' };

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
  />`,
})
class TimelineHost {
  readonly now = NOW;
  readonly runs = signal<readonly NeatLabelRun[]>([]);
  readonly windowMs = signal(30_000);
  readonly labels = signal<readonly string[]>([]);
  readonly quiet = signal<readonly string[]>([]);
}

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

const named = (element: HTMLElement) => element.querySelector('.name')?.textContent?.trim();

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

  it('names a wide run and not a narrow or quiet one', async () => {
    const { runs } = await render(
      [run('Wide', 20, 10), run('Narrow', 8, 6), run('Edge', 6, 2.4), run('Silence', 30, 20)],
      (host) => host.quiet.set(['Silence']),
    );

    expect(runs.map(named)).toEqual(['Wide', undefined, 'Edge', undefined]);
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

  it('keeps a run name inside its run, cut with an ellipsis', () => {
    expect(declared('.name', 'max-width')).toBe('100%');
    expect(declared('.name', 'overflow')).toBe('hidden');
    expect(declared('.name', 'text-overflow')).toBe('ellipsis');
    expect(declared('.run', 'border-right')).toBe('2px solid var(--neat-surface)');
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
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: !!options.reduced, media: query }));
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

  it('restarts from a later update', async () => {
    const { fixture, host, advance, lefts } = motionSetup();
    await fixture.whenStable();
    await advance(1000);

    host.now.set(NOW + 1000);
    await fixture.whenStable();
    await advance(400);

    expect(lefts()[0]).toBeCloseTo(leftAfter(1400), 4);
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
