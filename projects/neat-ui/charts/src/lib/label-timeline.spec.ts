import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type NeatLabelRun, NeatLabelTimeline } from './label-timeline';

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
    runs: Array.from<HTMLElement>(host.querySelectorAll('[data-slot="timeline-run"]')),
    ticks: Array.from(host.querySelectorAll('[data-slot="timeline-tick"]')).map((tick) =>
      tick.textContent?.trim(),
    ),
  };
}

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

    expect(runs.map((element) => element.getAttribute('aria-label'))).toEqual([
      'Kept, 20 s to 10 s ago',
    ]);
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
      'var(--muted-foreground)',
      'var(--neat-chip-neutral)',
    ]);
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
    expect(runs.map((element) => element.getAttribute('aria-label'))).toEqual([
      'Zoom in, 20 s to 10 s ago',
      'Throw up, 8.5 s ago to now',
    ]);
  });
});
