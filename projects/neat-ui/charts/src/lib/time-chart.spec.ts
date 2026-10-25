import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatTimeChart } from './time-chart';
import type {
  NeatChartAxis,
  NeatChartFormat,
  NeatChartTone,
  NeatReference,
  NeatSeries,
  NeatThreshold,
} from './types';

@Component({
  imports: [NeatTimeChart],
  template: `<neat-time-chart
    label="CPU usage"
    [headline]="headline()"
    [series]="series()"
    [times]="times()"
    [domain]="domain()"
    [thresholds]="thresholds()"
    [reference]="reference()"
    [tone]="tone()"
    [size]="size()"
    [axis]="axis()"
    [headless]="headless()"
    [valueLabels]="valueLabels()"
    [format]="format()"
  />`,
})
class TimeChartHost {
  readonly headline = signal('');
  readonly series = signal<readonly NeatSeries[]>([]);
  readonly times = signal<readonly (number | null)[]>([]);
  readonly domain = signal<readonly [number, number]>([0, 100]);
  readonly thresholds = signal<readonly NeatThreshold[]>([]);
  readonly reference = signal<NeatReference | null>(null);
  readonly tone = signal<NeatChartTone>('default');
  readonly size = signal<'compact' | 'medium' | 'large'>('medium');
  readonly axis = signal<NeatChartAxis>('recent');
  readonly headless = signal(false);
  readonly valueLabels = signal(true);
  readonly format = signal<NeatChartFormat>((value) => `${value}%`);
}

/** Times in ms for samples taken at these many seconds. */
const seconds = (...offsets: number[]): number[] => offsets.map((offset) => offset * 1000);
/** Five samples two minutes apart: an eight-minute window. */
const WINDOW = seconds(0, 120, 240, 360, 480);

const cpu = (...values: (number | null)[]): NeatSeries => ({ key: 'cpu', label: 'CPU', values });

async function render(setup: (host: TimeChartHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(TimeChartHost);
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
    /** Moves the pointer to `fraction` of the plot's width, then lets the page render. */
    async point(fraction: number) {
      plot.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 100 + fraction * 600, bubbles: true }),
      );
      await fixture.whenStable();
    },
    async leave() {
      plot.dispatchEvent(new MouseEvent('pointerleave'));
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

const line = (path: Element) => path.getAttribute('d') ?? '';

describe('NeatTimeChart', () => {
  it('draws one series in the line token of its tone, and several in series 1… with a legend of current values', async () => {
    const one = await render((host) => {
      host.series.set([cpu(10, 20, 30)]);
      host.tone.set('warning');
    });
    expect(one.all('.series')).toHaveLength(1);
    expect(one.all('.series')[0].style.getPropertyValue('--series')).toBe(
      'var(--neat-line-warning)',
    );
    expect(one.all('.area'), 'the area under one series').toHaveLength(1);
    expect(one.all('.legend'), 'no legend for one series').toHaveLength(0);

    for (const [tone, token] of [
      ['default', '--neat-line'],
      ['danger', '--neat-line-danger'],
    ] as const) {
      one.host.tone.set(tone);
      await one.fixture.whenStable();
      expect(one.all('.series')[0].style.getPropertyValue('--series'), tone).toBe(`var(${token})`);
    }

    const several = await render((host) => {
      host.series.set([
        cpu(10, 20, 30),
        { key: 'gpu', label: 'GPU', values: [1, 2, null] },
        { key: 'mem', label: 'Memory', values: [50, 55, 60] },
      ]);
      host.tone.set('danger');
    });
    expect(
      several.all('.series').map((series) => series.style.getPropertyValue('--series')),
      'a tone is for one series only',
    ).toEqual(['var(--neat-series-1)', 'var(--neat-series-2)', 'var(--neat-series-3)']);
    expect(several.all('.area'), 'no area under several series').toHaveLength(0);
    await several.point(1);
    expect(
      several
        .all('.readout neat-series-swatch')
        .map((swatch) => swatch.style.getPropertyValue('--series')),
      'the readout shows each line by its swatch',
    ).toEqual(['var(--neat-series-1)', 'var(--neat-series-2)', 'var(--neat-series-3)']);
    await one.point(1);
    expect(one.readout(), 'one line').not.toBeNull();
    expect(one.all('.readout neat-series-swatch'), 'needs no swatch').toHaveLength(0);
    expect(several.text('.legend li')).toEqual(['CPU30%', 'GPU—', 'Memory60%']);
    expect(
      several
        .all('.legend neat-series-swatch')
        .map((swatch) => swatch.style.getPropertyValue('--series')),
    ).toEqual(['var(--neat-series-1)', 'var(--neat-series-2)', 'var(--neat-series-3)']);
  });

  it('folds a tenth series into Other in the legend and the lines', async () => {
    const { all, text } = await render((host) =>
      host.series.set(
        Array.from({ length: 10 }, (_, index) => ({
          key: `s${index}`,
          label: `Series ${index}`,
          values: [index, index + 1],
        })),
      ),
    );
    expect(all('.series')).toHaveLength(8);
    // The three smallest means (series 0 to 2) fold into one whose newest sample is 1 + 2 + 3.
    expect(text('.legend li')).toEqual([
      'Series 34%',
      'Series 45%',
      'Series 56%',
      'Series 67%',
      'Series 78%',
      'Series 89%',
      'Series 910%',
      'Other6%',
    ]);
    expect(all('.series')[7].style.getPropertyValue('--series')).toBe('var(--neat-series-8)');
  });

  it('draws thresholds and the reference dashed, an edge threshold included, and hides threshold labels when compact', async () => {
    const chart = await render((host) => {
      host.series.set([cpu(10, 20, 30)]);
      host.thresholds.set([
        { value: 0, tone: 'warning', label: 'Floor 0%' },
        { value: 70, tone: 'warning', label: 'Warning 70%' },
        { value: 100, tone: 'danger', label: 'Critical 100%' },
        { value: 101, tone: 'danger', label: 'Out of range' },
        { value: -1, tone: 'warning', label: 'Below range' },
      ]);
      host.reference.set({ value: 40, label: 'Average 40%' });
    });
    const levels = chart.all('.level');
    expect(levels).toHaveLength(4);
    expect(levels.map((level) => level.getAttribute('y1'))).toEqual(['100', '30', '0', '60']);
    expect(levels.map((level) => level.style.getPropertyValue('--level'))).toEqual([
      'var(--neat-line-warning)',
      'var(--neat-line-warning)',
      'var(--neat-line-danger)',
      'var(--muted-foreground)',
    ]);
    for (const level of levels)
      expect(level.getAttribute('stroke-dasharray'), 'dashed').toBeTruthy();
    expect(chart.text('.tag.level-tag')).toEqual([
      'Floor 0%',
      'Warning 70%',
      'Critical 100%',
      'Average 40%',
    ]);
    const sides = chart.all('.tag.level-tag').map((tag) => tag.dataset['side']);
    expect(sides, 'warning at the start, danger at the end, the reference at the start').toEqual([
      'start',
      'start',
      'end',
      'start',
    ]);

    chart.host.size.set('compact');
    await chart.fixture.whenStable();
    expect(chart.all('.level'), 'the lines stay').toHaveLength(4);
    expect(chart.all('.level-tag'), 'the labels go').toHaveLength(0);
  });

  it('labels the grid at its ticks and the x axis −8 min, −4 min, now', async () => {
    const chart = await render((host) => {
      host.series.set([cpu(10, 20, 30, 40, 50)]);
      host.times.set(WINDOW);
    });
    expect(chart.text('.grid-label')).toEqual(['0', '50', '100']);
    expect(chart.all('line.grid').map((grid) => grid.getAttribute('y1'))).toEqual([
      '100',
      '50',
      '0',
    ]);
    expect(chart.text('.axis span')).toEqual(['−8 min', '−4 min', 'now']);

    chart.host.size.set('compact');
    await chart.fixture.whenStable();
    expect(chart.all('line.grid'), 'the grid stays').toHaveLength(3);
    expect(chart.all('.grid-label'), 'its labels go').toHaveLength(0);
    expect(chart.all('.axis'), 'and the time axis').toHaveLength(0);
  });

  it('leaves out a grid label that a threshold or reference label would sit on, and keeps the others', async () => {
    // Medium is 6 rem high, so a label (0.75 rem) spans about 12 units of the box's 100.
    const chart = await render((host) => {
      host.series.set([cpu(10, 20, 30)]);
      host.thresholds.set([{ value: 80, tone: 'warning', label: 'Warning 80%' }]);
    });
    // "100" would sit below the top line at 2 to 14 units, the warning label above 80 at 5 to 17.
    expect(chart.text('.grid-label')).toEqual(['0', '50']);
    expect(chart.all('line.grid'), 'the grid lines all stay').toHaveLength(3);

    // A label at the end does not meet the start's grid labels.
    chart.host.thresholds.set([{ value: 80, tone: 'danger', label: 'Critical 80%' }]);
    await chart.fixture.whenStable();
    expect(chart.text('.grid-label')).toEqual(['0', '50', '100']);

    // The reference is at the start too: 52 sits where "50" would be.
    chart.host.thresholds.set([]);
    chart.host.reference.set({ value: 52, label: 'Average 52%' });
    await chart.fixture.whenStable();
    expect(chart.text('.grid-label')).toEqual(['0', '100']);

    // Taller, the same labels take less of the box and the same levels clear them.
    chart.host.size.set('large');
    chart.host.reference.set({ value: 80, label: 'Average 80%' });
    await chart.fixture.whenStable();
    expect(chart.text('.grid-label')).toEqual(['0', '50', '100']);
  });

  it('leaves out a grid label that would sit on the one kept below it', async () => {
    // 0 to 20 has a tick every 5. Medium, "20" sits below the top line at 2 to 15 units and "15"
    // above its line at 10 to 23: the higher one goes, its grid line stays.
    const chart = await render((host) => {
      host.series.set([cpu(4, 8, 12)]);
      host.domain.set([0, 20]);
    });
    expect(chart.all('line.grid')).toHaveLength(5);
    expect(chart.text('.grid-label')).toEqual(['0', '5', '10', '15']);

    // Large has the room for all five.
    chart.host.size.set('large');
    await chart.fixture.whenStable();
    expect(chart.text('.grid-label')).toEqual(['0', '5', '10', '15', '20']);
  });

  it('without value labels keeps the grid and level lines, the time axis, the readout and the name', async () => {
    const chart = await render((host) => {
      host.headline.set('30%');
      host.series.set([cpu(10, 20, 30)]);
      host.times.set(seconds(0, 120, 240));
      host.thresholds.set([{ value: 80, tone: 'warning', label: 'Warning 80%' }]);
      host.reference.set({ value: 30, label: 'Average 30%' });
      host.valueLabels.set(false);
    });
    expect(chart.all('line.grid')).toHaveLength(3);
    expect(chart.all('.level')).toHaveLength(2);
    expect(chart.all('.grid-label'), 'no grid values').toHaveLength(0);
    expect(chart.all('.level-tag'), 'no threshold or reference labels').toHaveLength(0);
    expect(chart.text('.axis span')).toEqual(['−4 min', '−2 min', 'now']);
    expect(chart.plot.getAttribute('aria-label')).toBe('CPU usage: 30%, over the last 4 min');
    await chart.point(1);
    expect(chart.readout()?.textContent).toContain('CPU 30%');

    chart.host.valueLabels.set(true);
    await chart.fixture.whenStable();
    expect(chart.text('.grid-label')).toEqual(['0', '50']);
    expect(chart.text('.level-tag')).toEqual(['Warning 80%', 'Average 30%']);
  });

  it('sets the plot height by size', async () => {
    const chart = await render();
    const height = () =>
      chart.root
        .querySelector<HTMLElement>('neat-time-chart')!
        .style.getPropertyValue('--plot-height');
    expect(height()).toBe('6rem');
    chart.host.size.set('compact');
    await chart.fixture.whenStable();
    expect(height()).toBe('3.5rem');
    chart.host.size.set('large');
    await chart.fixture.whenStable();
    expect(height()).toBe('9.5rem');
  });

  it('a null breaks the line and the newest point gets a dot only when it has a value', async () => {
    const chart = await render((host) => host.series.set([cpu(10, 20, null, 40, 50)]));
    const [path] = chart.all('.line');
    expect(line(path).match(/M/g)).toHaveLength(2);
    expect(chart.all('.dot')).toHaveLength(1);
    expect(chart.all('.dot')[0].style.left).toBe('100%');
    expect(chart.all('.dot')[0].style.top).toBe('50%');

    chart.host.series.set([cpu(10, 20, 30, 40, null)]);
    await chart.fixture.whenStable();
    expect(chart.all('.dot')).toHaveLength(0);
  });

  it('a single sample draws its dot and no line or area, and the x axis reads now', async () => {
    const chart = await render((host) => {
      host.series.set([cpu(30)]);
      host.times.set(seconds(5));
    });
    expect(chart.all('.line')).toHaveLength(0);
    expect(chart.all('.area')).toHaveLength(0);
    expect(chart.all('.dot')).toHaveLength(1);
    expect(chart.text('.axis span')).toEqual(['now']);
  });

  it('the readout follows the pointer and the arrow keys, Home and End move it, Escape hides it', async () => {
    const chart = await render((host) => {
      host.series.set([
        cpu(10, 20, null, 40, 50),
        { key: 'gpu', label: 'GPU', values: [1, 2, 3, 4, 5] },
      ]);
      host.times.set(WINDOW);
    });
    expect(chart.readout(), 'hidden until the pointer or a key').toBeNull();
    expect(chart.plot.getAttribute('tabindex')).toBe('0');
    expect(chart.plot.getAttribute('role')).toBe('group');
    expect(chart.plot.getAttribute('aria-roledescription')).toBe('chart');

    await chart.point(0.5);
    expect(chart.text('.readout > *')).toEqual(['4 min ago', 'CPU —', 'GPU 3%']);
    expect(chart.all('.crosshair')[0].style.left).toBe('50%');
    expect(chart.readout()?.hasAttribute('data-flip'), 'at the midpoint').toBe(false);

    await chart.point(0.8);
    expect(chart.readout()?.textContent).toContain('2 min ago');
    expect(chart.readout()?.textContent).toContain('CPU 40%');
    expect(chart.readout()?.hasAttribute('data-flip'), 'past the midpoint').toBe(true);

    await chart.leave();
    expect(chart.readout()).toBeNull();

    await chart.focus();
    expect(chart.readout()?.textContent).toContain('just now');
    await chart.key('ArrowLeft');
    expect(chart.readout()?.textContent).toContain('2 min ago');
    await chart.key('ArrowRight');
    await chart.key('ArrowRight');
    expect(chart.readout()?.textContent, 'stays at the newest').toContain('just now');
    await chart.key('Home');
    expect(chart.readout()?.textContent).toContain('8 min ago');
    await chart.key('ArrowLeft');
    expect(chart.readout()?.textContent, 'stays at the oldest').toContain('8 min ago');
    await chart.key('End');
    expect(chart.readout()?.textContent).toContain('just now');
    await chart.key('Escape');
    expect(chart.readout()).toBeNull();
    await chart.key('ArrowLeft');
    expect(chart.readout()?.textContent, 'a key brings it back at the newest').toContain(
      'just now',
    );
  });

  it('takes over from the pointer when a key is pressed, and gives it back when the pointer moves', async () => {
    const chart = await render((host) => {
      host.series.set([cpu(10, 20, 30, 40, 50)]);
      host.times.set(WINDOW);
    });
    await chart.point(0.5);
    await chart.key('ArrowLeft');
    expect(chart.readout()?.textContent).toContain('6 min ago');
    await chart.point(1);
    expect(chart.readout()?.textContent).toContain('just now');
    await chart.key('Escape');
    expect(chart.readout()).toBeNull();
  });

  it('a pointer leaving does not hide what the keys show, and blur hides it', async () => {
    const chart = await render((host) => {
      host.series.set([cpu(10, 20, 30)]);
      host.times.set(seconds(0, 60, 120));
    });
    await chart.focus();
    await chart.leave();
    expect(chart.readout()).not.toBeNull();
    chart.plot.dispatchEvent(new FocusEvent('blur'));
    await chart.fixture.whenStable();
    expect(chart.readout()).toBeNull();
  });

  it('leaves a handled key from reaching the page and lets other keys through', async () => {
    const chart = await render((host) => host.series.set([cpu(10, 20, 30)]));
    const handled = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });
    chart.plot.dispatchEvent(handled);
    expect(handled.defaultPrevented, 'the page does not scroll').toBe(true);
    const other = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    chart.plot.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
  });

  it('leaves Escape to whatever holds the chart unless a readout is there to close', async () => {
    const chart = await render((host) => host.series.set([cpu(10, 20, 30)]));
    const bubbled = vi.fn();
    chart.root.addEventListener('keydown', bubbled);
    const hidden = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    chart.plot.dispatchEvent(hidden);
    expect(
      bubbled,
      'nothing to hide: a dialog around the chart still closes',
    ).toHaveBeenCalledTimes(1);

    await chart.focus();
    const shown = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    chart.plot.dispatchEvent(shown);
    expect(shown.defaultPrevented).toBe(true);
    expect(bubbled, 'closing the readout is all that Escape does').toHaveBeenCalledTimes(1);
  });

  it('announces the readout after a key and never on pointer moves', async () => {
    const chart = await render((host) => {
      host.series.set([cpu(10, 20, 30)]);
      host.times.set(seconds(0, 60, 120));
    });
    expect(chart.live().getAttribute('aria-live')).toBe('polite');
    expect(chart.live().textContent?.trim()).toBe('');

    await chart.point(0.5);
    expect(chart.live().textContent?.trim(), 'pointer moves are silent').toBe('');
    await chart.leave();

    await chart.focus();
    expect(chart.live().textContent?.trim(), 'so is the readout that focus shows').toBe('');
    await chart.key('ArrowLeft');
    expect(chart.live().textContent?.trim()).toBe('1 min ago, CPU 20%');
    await chart.key('Home');
    expect(chart.live().textContent?.trim()).toBe('2 min ago, CPU 10%');
    await chart.point(1);
    expect(chart.live().textContent?.trim(), 'a pointer move leaves it as it was').toBe(
      '2 min ago, CPU 10%',
    );
  });

  describe('with the elapsed axis', () => {
    /** One series over 33.9 s: the offsets the compare overlay plots a run at. */
    const elapsed = (host: TimeChartHost) => {
      host.axis.set('elapsed');
      host.series.set([cpu(10, 20, 30)]);
      host.times.set([1_000_000, 1_017_000, 1_033_900]);
    };

    it('labels the x axis from 0 s to the window', async () => {
      const chart = await render(elapsed);
      expect(chart.text('.axis span')).toEqual(['0 s', '17 s', '33.9 s']);
    });

    it('names the offset of a sample in the readout where recent says how long ago', async () => {
      const chart = await render(elapsed);
      await chart.point(0.5);
      expect(chart.text('.readout > *')[0]).toBe('at 17 s');

      chart.host.axis.set('recent');
      await chart.fixture.whenStable();
      expect(chart.text('.readout > *')[0]).toBe('17 s ago');
    });

    it('states the span in its accessible name', async () => {
      const chart = await render(elapsed);
      expect(chart.plot.getAttribute('aria-label')).toBe('CPU usage: 30%, over 33.9 s');
    });

    it('speaks the offset when a key moves the readout', async () => {
      const chart = await render(elapsed);
      await chart.focus();
      await chart.key('Home');
      expect(chart.live().textContent?.trim()).toBe('at 0 s, CPU 10%');
    });

    it('starts at 0 s without usable times and counts the samples in the name', async () => {
      const chart = await render((host) => {
        host.axis.set('elapsed');
        host.series.set([cpu(10, 20, 30)]);
      });
      expect(chart.text('.axis span')).toEqual(['0 s']);
      expect(chart.plot.getAttribute('aria-label')).toBe('CPU usage: 30%, over 3 samples');
    });
  });

  it('keeps the recent axis without the input: −N s to now', async () => {
    const chart = await render((host) => {
      host.series.set([cpu(10, 20, 30)]);
      host.times.set([0, 17_000, 33_900]);
    });
    expect(chart.text('.axis span')).toEqual(['−34 s', '−17 s', 'now']);
    await chart.point(0.5);
    expect(chart.text('.readout > *')[0]).toBe('17 s ago');
    expect(chart.plot.getAttribute('aria-label')).toBe('CPU usage: 30%, over the last 34 s');
  });

  it('its accessible name has the title, the headline and the window: "CPU usage: 34%, over the last 8 min"', async () => {
    const chart = await render((host) => {
      host.headline.set('34%');
      host.series.set([cpu(10, 20, 30, 40, 50)]);
      host.times.set(WINDOW);
    });
    expect(chart.plot.getAttribute('aria-label')).toBe('CPU usage: 34%, over the last 8 min');

    chart.host.headline.set('');
    await chart.fixture.whenStable();
    expect(chart.plot.getAttribute('aria-label'), 'the current value without a headline').toBe(
      'CPU usage: 50%, over the last 8 min',
    );

    chart.host.series.set([
      cpu(10, 20, 30, 40, 50),
      { key: 'gpu', label: 'GPU', values: [1, 2, 3, 4, null] },
    ]);
    await chart.fixture.whenStable();
    expect(chart.plot.getAttribute('aria-label'), 'each series, in order').toBe(
      'CPU usage: 50%, —, over the last 8 min',
    );

    chart.host.times.set([]);
    await chart.fixture.whenStable();
    expect(chart.plot.getAttribute('aria-label'), 'without times, how many samples').toBe(
      'CPU usage: 50%, —, over the last 5 samples',
    );
  });

  it('shows the title and the headline, and headless leaves the title row out but keeps the accessible name', async () => {
    const chart = await render((host) => {
      host.headline.set('34%');
      host.series.set([cpu(10, 20, 30)]);
      host.times.set(seconds(0, 60, 120));
    });
    expect(chart.text('.head > *')).toEqual(['CPU usage', '34%']);

    chart.host.headless.set(true);
    await chart.fixture.whenStable();
    expect(chart.all('.head')).toHaveLength(0);
    expect(chart.root.textContent).not.toContain('CPU usage');
    expect(chart.plot.getAttribute('aria-label')).toBe('CPU usage: 34%, over the last 2 min');
  });

  it('draws nothing but its box and grid while it has no samples', async () => {
    const chart = await render();
    expect(chart.all('.series')).toHaveLength(0);
    expect(chart.all('.dot')).toHaveLength(0);
    expect(chart.all('.axis span')).toHaveLength(0);
    expect(chart.plot.getAttribute('aria-label')).toBe('CPU usage, over the last 0 samples');
    await chart.focus();
    await chart.key('ArrowLeft');
    expect(chart.readout(), 'no sample to read').toBeNull();
  });
});
