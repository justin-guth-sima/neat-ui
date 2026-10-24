import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatStackedChart } from './stacked-chart';
import type { NeatChartFormat, NeatSeries } from './types';

@Component({
  imports: [NeatStackedChart],
  template: `<neat-stacked-chart
    label="Board power"
    [headline]="headline()"
    [series]="series()"
    [times]="times()"
    [domain]="domain()"
    [size]="size()"
    [headless]="headless()"
    [format]="format()"
  />`,
})
class StackedChartHost {
  readonly headline = signal('');
  readonly series = signal<readonly NeatSeries[]>([]);
  readonly times = signal<readonly (number | null)[]>([]);
  readonly domain = signal<readonly [number, number]>([0, 4]);
  readonly size = signal<'compact' | 'medium' | 'large'>('large');
  readonly headless = signal(false);
  readonly format = signal<NeatChartFormat>((value) => `${value} W`);
}

/** Times in ms for samples taken at these many seconds. */
const seconds = (...offsets: number[]): number[] => offsets.map((offset) => offset * 1000);

const rail = (key: string, ...values: (number | null)[]): NeatSeries => ({
  key,
  label: `Rail ${key.toUpperCase()}`,
  values,
});

async function render(setup: (host: StackedChartHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(StackedChartHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const plot = root.querySelector('.plot') as HTMLElement;
  // jsdom lays nothing out; the pointer maths needs a box, so give the plot one 600 px wide.
  plot.getBoundingClientRect = () =>
    ({ left: 100, top: 0, width: 600, height: 100, right: 700, bottom: 100 }) as DOMRect;
  const all = (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));
  const text = (selector: string) => all(selector).map((element) => element.textContent?.trim());
  return {
    fixture,
    host: fixture.componentInstance,
    root,
    plot,
    all,
    text,
    readout: () => root.querySelector<HTMLElement>('.readout'),
    live: () => root.querySelector('[aria-live]') as HTMLElement,
    async point(fraction: number) {
      plot.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 100 + fraction * 600, bubbles: true }),
      );
      await fixture.whenStable();
    },
    async key(key: string) {
      plot.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await fixture.whenStable();
    },
    async focus() {
      plot.dispatchEvent(new FocusEvent('focus'));
      await fixture.whenStable();
    },
  };
}

describe('NeatStackedChart', () => {
  it('stacks bands bottom first in series order and breaks the stack where any band is missing', async () => {
    // Domain 0 to 4: the first band spans 0 to 1 (y 100 to 75), the second 1 to 2 (y 75 to 50).
    const whole = await render((host) => host.series.set([rail('a', 1, 1, 1), rail('b', 1, 1, 1)]));
    expect(whole.all('.band').map((band) => band.getAttribute('d'))).toEqual([
      'M0,75L300,75L600,75L600,100L300,100L0,100Z',
      'M0,50L300,50L600,50L600,75L300,75L0,75Z',
    ]);
    expect(
      whole.all('.band').map((band) => band.style.getPropertyValue('--series')),
      'a band takes its place in the palette',
    ).toEqual(['var(--neat-series-1)', 'var(--neat-series-2)']);

    // The second band lacks the third of four samples, which breaks both bands there; the lone
    // sample after the gap draws nothing.
    const broken = await render((host) =>
      host.series.set([rail('a', 1, 1, 1, 1), rail('b', 1, 1, null, 1)]),
    );
    const paths = broken.all('.band').map((band) => band.getAttribute('d') ?? '');
    for (const path of paths) {
      expect(path.match(/M/g), 'one run').toHaveLength(1);
      expect(path).toContain('200');
      expect(path, 'nothing past the gap').not.toMatch(/400|600/);
    }
  });

  it('the legend gives each band its current value and its share of the current total', async () => {
    const chart = await render((host) =>
      host.series.set([rail('a', 1, 6), rail('b', 1, 3), rail('c', 1, 1)]),
    );
    expect(chart.text('.legend li')).toEqual(['Rail A6 W60%', 'Rail B3 W30%', 'Rail C1 W10%']);
    expect(
      chart.all('.legend .swatch').map((swatch) => swatch.style.getPropertyValue('--series')),
    ).toEqual(['var(--neat-series-1)', 'var(--neat-series-2)', 'var(--neat-series-3)']);

    // A band without a current sample leaves no total, so no share to give.
    chart.host.series.set([rail('a', 1, 6), rail('b', 1, null), rail('c', 1, 1)]);
    await chart.fixture.whenStable();
    expect(chart.text('.legend li')).toEqual(['Rail A6 W—', 'Rail B——', 'Rail C1 W—']);

    // A total of nothing has no shares either.
    chart.host.series.set([rail('a', 1, 0), rail('b', 1, 0)]);
    await chart.fixture.whenStable();
    expect(chart.text('.legend li')).toEqual(['Rail A0 W—', 'Rail B0 W—']);
  });

  it('nine rails show as seven and Other', async () => {
    const chart = await render((host) => {
      host.domain.set([0, 100]);
      host.series.set(Array.from({ length: 9 }, (_, index) => rail(`r${index}`, index, index + 1)));
    });
    expect(chart.all('.band')).toHaveLength(8);
    // The two smallest means (rails 0 and 1) fold into one whose newest sample is 1 + 2.
    expect(chart.text('.legend li > span:nth-child(2)')).toEqual([
      'Rail R2',
      'Rail R3',
      'Rail R4',
      'Rail R5',
      'Rail R6',
      'Rail R7',
      'Rail R8',
      'Other',
    ]);
    expect(chart.text('.legend li > strong').at(-1)).toBe('3 W');
    expect(chart.all('.band')[7].style.getPropertyValue('--series')).toBe('var(--neat-series-8)');
  });

  it('reads "Total" and then each band at the sample the pointer or a key chose', async () => {
    const chart = await render((host) => {
      host.series.set([rail('a', 1, 2, 3), rail('b', 1, null, 1)]);
      host.times.set(seconds(0, 60, 120));
    });
    expect(chart.readout(), 'hidden until the pointer or a key').toBeNull();

    await chart.point(0);
    expect(chart.text('.readout > *')).toEqual([
      '2 min ago',
      'Total 2 W',
      'Rail A 1 W',
      'Rail B 1 W',
    ]);
    expect(chart.all('.crosshair')[0].style.left).toBe('0%');

    await chart.point(0.5);
    expect(chart.text('.readout > *'), 'a missing band leaves no total').toEqual([
      '1 min ago',
      'Total —',
      'Rail A 2 W',
      'Rail B —',
    ]);

    await chart.focus();
    expect(chart.readout()?.textContent, 'a pointer sample stays when focus follows').toContain(
      '1 min ago',
    );
  });

  it("moves the readout with the time chart's keys and announces it after a key only", async () => {
    const chart = await render((host) => {
      host.series.set([rail('a', 1, 2, 3), rail('b', 1, 1, 1)]);
      host.times.set(seconds(0, 60, 120));
    });
    expect(chart.plot.getAttribute('tabindex')).toBe('0');
    expect(chart.live().getAttribute('aria-live')).toBe('polite');

    await chart.focus();
    expect(chart.readout()?.textContent).toContain('just now');
    expect(chart.live().textContent?.trim(), 'focus is silent').toBe('');

    await chart.key('ArrowLeft');
    expect(chart.live().textContent?.trim()).toBe('1 min ago, Total 3 W, Rail A 2 W, Rail B 1 W');
    await chart.key('Home');
    expect(chart.live().textContent?.trim()).toBe('2 min ago, Total 2 W, Rail A 1 W, Rail B 1 W');
    await chart.point(1);
    expect(chart.live().textContent?.trim(), 'a pointer move leaves it as it was').toBe(
      '2 min ago, Total 2 W, Rail A 1 W, Rail B 1 W',
    );
    await chart.key('Escape');
    expect(chart.readout()).toBeNull();
    expect(chart.live().textContent?.trim()).toBe('');
  });

  it('its accessible name has the title, the headline and the window', async () => {
    const chart = await render((host) => {
      host.headline.set('9.5 W');
      host.series.set([rail('a', 1, 2, 3)]);
      host.times.set(seconds(0, 240, 480));
    });
    expect(chart.plot.getAttribute('aria-label')).toBe('Board power: 9.5 W, over the last 8 min');
    expect(chart.plot.getAttribute('role')).toBe('group');
    expect(chart.plot.getAttribute('aria-roledescription')).toBe('chart');
  });

  it('is large by default, and size, headless and compact work as on the time chart', async () => {
    const chart = await render((host) => {
      host.headline.set('9.5 W');
      host.series.set([rail('a', 1, 2, 3)]);
      host.times.set(seconds(0, 240, 480));
    });
    const height = () =>
      chart.root
        .querySelector<HTMLElement>('neat-stacked-chart')!
        .style.getPropertyValue('--plot-height');
    expect(height()).toBe('9.5rem');
    expect(chart.text('.head > *')).toEqual(['Board power', '9.5 W']);
    expect(chart.text('.grid-label')).toEqual(['0', '1', '2', '3', '4']);
    expect(chart.text('.axis span')).toEqual(['−8 min', '−4 min', 'now']);

    chart.host.size.set('medium');
    await chart.fixture.whenStable();
    expect(height()).toBe('6rem');

    chart.host.size.set('compact');
    chart.host.headless.set(true);
    await chart.fixture.whenStable();
    expect(height()).toBe('3.5rem');
    expect(chart.all('.head')).toHaveLength(0);
    expect(chart.all('.grid-label')).toHaveLength(0);
    expect(chart.all('.axis')).toHaveLength(0);
    expect(chart.plot.getAttribute('aria-label'), 'the name stays').toBe(
      'Board power: 9.5 W, over the last 8 min',
    );
  });
});
