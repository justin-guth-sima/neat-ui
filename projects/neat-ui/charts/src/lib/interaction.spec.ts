import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatHeatmap, type NeatHeatmapRow } from './heatmap';
import { type NeatLabelRun, NeatLabelTimeline } from './label-timeline';
import { sampleNear } from './readout';
import { stubResizeObserver } from './resize-observer.testing';
import { NeatStackedChart } from './stacked-chart';
import { NeatTimeChart } from './time-chart';
import type {
  NeatHeatmapCell,
  NeatHeatmapPick,
  NeatRunPick,
  NeatSamplePick,
  NeatSeries,
} from './types';

/*
 * The charts' side of the kit's rule for widget interaction (AGENTS.md): `hovered`, both ways, and
 * `activated` for a click or Enter. The time-based charts name a moment, so several share one
 * crosshair; the heatmap names a cell.
 */

/** Five samples two minutes apart, in ms. */
const TIMES = [0, 120, 240, 360, 480].map((s) => s * 1000);
const cpu: NeatSeries = { key: 'cpu', label: 'CPU', values: [10, 20, 30, 40, 50] };

/** Gives every element a 600 px wide box from x 100, as jsdom lays nothing out. */
function stubBoxes(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ left: 100, top: 0, width: 600, height: 20, right: 700, bottom: 20 }) as DOMRect,
  );
}

const pointer = (type: string, fraction: number) =>
  new MouseEvent(type, { clientX: 100 + fraction * 600, bubbles: true });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sampleNear', () => {
  it('finds the sample nearest a moment within the span the times cover', () => {
    expect(sampleNear(TIMES, 5, 250_000)).toBe(2);
    expect(sampleNear(TIMES, 5, 300_000)).toBe(2);
    expect(sampleNear(TIMES, 5, 480_000)).toBe(4);
    expect(sampleNear(TIMES, 5, 500_000)).toBe(-1);
    expect(sampleNear(TIMES, 5, null)).toBe(-1);
    expect(sampleNear([null, 1000, null], 3, 1000)).toBe(1);
    expect(sampleNear([null, 1000, null], 3, 900)).toBe(-1);
  });
});

@Component({
  imports: [NeatTimeChart, NeatStackedChart],
  template: `
    <neat-time-chart
      class="a"
      label="CPU"
      [series]="[cpu]"
      [times]="times"
      [domain]="[0, 100]"
      [(hovered)]="hovered"
      (activated)="picks.push($event)"
    />
    <neat-stacked-chart
      class="b"
      label="Power"
      [series]="[cpu]"
      [times]="later"
      [domain]="[0, 100]"
      [(hovered)]="hovered"
    />
  `,
})
class TimeHost {
  readonly cpu = cpu;
  readonly times = TIMES;
  /** The second chart's samples, 30 s after the first's. */
  readonly later = TIMES.map((time) => time + 30_000);
  readonly hovered = signal<number | null>(null);
  readonly picks: NeatSamplePick[] = [];
}

describe('the time and stacked charts', () => {
  async function render() {
    stubBoxes();
    const fixture = TestBed.createComponent(TimeHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const plot = (chart: 'a' | 'b') => root.querySelector<HTMLElement>(`.${chart} .plot`)!;
    const settle = () => fixture.whenStable();
    return {
      host: fixture.componentInstance,
      plot,
      settle,
      readout: (chart: 'a' | 'b') => root.querySelector<HTMLElement>(`.${chart} .readout`),
      crosshair: (chart: 'a' | 'b') =>
        root.querySelector<HTMLElement>(`.${chart} .crosshair`)?.style.left ?? null,
      async key(key: string) {
        plot('a').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        await settle();
      },
    };
  }

  it("names the pointer's sample by its time, and nothing once it leaves", async () => {
    const chart = await render();
    chart.plot('a').dispatchEvent(pointer('pointermove', 0.5));
    await chart.settle();
    expect(chart.host.hovered()).toBe(240_000);
    chart.plot('a').dispatchEvent(new MouseEvent('pointerleave'));
    await chart.settle();
    expect(chart.host.hovered()).toBeNull();
  });

  it('names the sample the keys hold, and nothing after Escape', async () => {
    const chart = await render();
    chart.plot('a').dispatchEvent(new FocusEvent('focus'));
    await chart.settle();
    expect(chart.host.hovered()).toBe(480_000);
    await chart.key('ArrowLeft');
    expect(chart.host.hovered()).toBe(360_000);
    await chart.key('Escape');
    expect(chart.host.hovered()).toBeNull();
  });

  it('shows a moment the app sets at the nearest sample, leaving the moment as it was', async () => {
    const chart = await render();
    chart.host.hovered.set(250_000);
    await chart.settle();
    expect(chart.readout('a')).not.toBeNull();
    expect(chart.crosshair('a')).toBe('50%');
    expect(chart.host.hovered()).toBe(250_000);
    chart.host.hovered.set(null);
    await chart.settle();
    expect(chart.readout('a')).toBeNull();
  });

  it('shares one crosshair between charts bound to one moment, without them answering each other', async () => {
    const chart = await render();
    chart.plot('a').dispatchEvent(pointer('pointermove', 0.75));
    await chart.settle();
    // The first chart names its sample; the second, sampled 30 s later, shows its nearest.
    expect(chart.host.hovered()).toBe(360_000);
    expect(chart.readout('b')).not.toBeNull();
    await chart.settle();
    expect(chart.host.hovered()).toBe(360_000);
    chart.plot('a').dispatchEvent(new MouseEvent('pointerleave'));
    await chart.settle();
    expect(chart.readout('b')).toBeNull();
  });

  it('reports a click, and Enter, with the time and each value', async () => {
    const chart = await render();
    chart.plot('a').dispatchEvent(pointer('click', 0.25));
    expect(chart.host.picks).toEqual([{ time: 120_000, values: [{ key: 'cpu', value: 20 }] }]);
    chart.plot('a').dispatchEvent(new FocusEvent('focus'));
    await chart.settle();
    await chart.key('Enter');
    expect(chart.host.picks.at(-1)).toEqual({
      time: 480_000,
      values: [{ key: 'cpu', value: 50 }],
    });
  });
});

@Component({
  imports: [NeatHeatmap],
  template: `<neat-heatmap
    label="Cores"
    [rows]="rows"
    [times]="times"
    [(hovered)]="hovered"
    (activated)="picks.push($event)"
  />`,
})
class HeatmapHost {
  readonly times = TIMES;
  readonly rows: readonly NeatHeatmapRow[] = [
    { key: 'core0', label: 'Core 0', values: [10, 20, 30, 40, 50], end: '', endTone: 'default' },
    { key: 'core1', label: 'Core 1', values: [60, 70, 80, 90, 95], end: '', endTone: 'default' },
  ];
  readonly hovered = signal<NeatHeatmapCell | null>(null);
  readonly picks: NeatHeatmapPick[] = [];
}

describe('the heatmap', () => {
  async function render() {
    stubBoxes();
    const fixture = TestBed.createComponent(HeatmapHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const row = (index: number) => root.querySelectorAll<HTMLElement>('.cells')[index];
    return { fixture, host: fixture.componentInstance, root, row };
  }

  it("names the pointer's cell by its row and time, and nothing once it leaves", async () => {
    const { fixture, host, root, row } = await render();
    // Five samples, one column each: the middle of the second row is its third sample.
    row(1).dispatchEvent(pointer('pointermove', 0.5));
    await fixture.whenStable();
    expect(host.hovered()).toEqual({ row: 'core1', time: 240_000 });
    root.querySelector('.grid')!.dispatchEvent(new MouseEvent('pointerleave'));
    await fixture.whenStable();
    expect(host.hovered()).toBeNull();
  });

  it('shows the cell the app names', async () => {
    const { fixture, host, root } = await render();
    host.hovered.set({ row: 'core0', time: 370_000 });
    await fixture.whenStable();
    const cursor = root.querySelectorAll('.cells')[0].querySelectorAll('.cell');
    expect(cursor[3].hasAttribute('data-cursor')).toBe(true);
    expect(root.querySelector('.readout')?.textContent).toContain('Core 0');
  });

  it('reports a click with its row, time and mean', async () => {
    const { host, row } = await render();
    row(0).dispatchEvent(pointer('click', 0.1));
    expect(host.picks).toEqual([{ row: 'core0', time: 0, value: 10 }]);
  });
});

const NOW = 1_000_000;

@Component({
  imports: [NeatLabelTimeline],
  template: `<neat-label-timeline
    label="Gestures"
    [runs]="runs"
    [nowMs]="now"
    [windowMs]="30000"
    [(hovered)]="hovered"
    (activated)="picks.push($event)"
  />`,
})
class TimelineHost {
  readonly now = NOW;
  readonly runs: readonly NeatLabelRun[] = [
    { label: 'wave', startMs: NOW - 30_000, endMs: NOW - 20_000 },
    { label: 'point', startMs: NOW - 20_000, endMs: NOW },
  ];
  readonly hovered = signal<number | null>(null);
  readonly picks: NeatRunPick[] = [];
}

describe('the label timeline', () => {
  async function render() {
    stubResizeObserver();
    stubBoxes();
    const fixture = TestBed.createComponent(TimelineHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const strip = root.querySelector<HTMLElement>('.runs')!;
    return { fixture, host: fixture.componentInstance, root, strip };
  }

  it('names the moment under the pointer, and nothing once it leaves', async () => {
    const { fixture, host, strip } = await render();
    strip.dispatchEvent(pointer('pointermove', 0.5));
    await fixture.whenStable();
    expect(host.hovered()).toBe(NOW - 15_000);
    strip.dispatchEvent(new MouseEvent('pointerleave'));
    await fixture.whenStable();
    expect(host.hovered()).toBeNull();
  });

  it('reads out the run covering a moment the app sets', async () => {
    const { fixture, host, root } = await render();
    host.hovered.set(NOW - 25_000);
    await fixture.whenStable();
    expect(root.querySelector('.readout')?.textContent).toContain('wave');
    host.hovered.set(NOW - 5_000);
    await fixture.whenStable();
    expect(root.querySelector('.readout')?.textContent).toContain('point');
  });

  it('reports a click with the run under it and the moment', async () => {
    const { host, strip } = await render();
    strip.dispatchEvent(pointer('click', 0.1));
    expect(host.picks).toEqual([
      { run: { label: 'wave', startMs: NOW - 30_000, endMs: NOW - 20_000 }, time: NOW - 27_000 },
    ]);
  });
});
