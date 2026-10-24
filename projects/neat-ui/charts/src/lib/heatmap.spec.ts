import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatHeatmap, type NeatHeatmapRow } from './heatmap';
import type { NeatChartFormat } from './types';

@Component({
  imports: [NeatHeatmap],
  template: `<neat-heatmap
    label="Per-core CPU"
    [headline]="headline()"
    [rows]="rows()"
    [times]="times()"
    [domain]="domain()"
    [format]="format()"
  />`,
})
class HeatmapHost {
  readonly headline = signal('');
  readonly rows = signal<readonly NeatHeatmapRow[]>([]);
  readonly times = signal<readonly (number | null)[]>([]);
  readonly domain = signal<readonly [number, number]>([0, 100]);
  readonly format = signal<NeatChartFormat>((value) => `${value}%`);
}

/** Times in ms for samples taken at these many seconds. */
const seconds = (...offsets: number[]): number[] => offsets.map((offset) => offset * 1000);

const core = (
  index: number,
  values: (number | null)[],
  endTone: NeatHeatmapRow['endTone'] = 'default',
): NeatHeatmapRow => ({
  key: `c${index}`,
  label: `Core ${index}`,
  values,
  end: `${index * 10}%`,
  endTone,
});

/** Three samples a minute apart: three columns, "2 min ago" to "just now". */
const MINUTES = seconds(0, 60, 120);

async function render(setup: (host: HeatmapHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(HeatmapHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const all = (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));
  const text = (selector: string) => all(selector).map((element) => element.textContent?.trim());
  const grid = () => root.querySelector('.grid') as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    root,
    all,
    text,
    grid,
    /** The cell of row `row`, column `column`. */
    cell: (row: number, column: number) => all('.cells')[row].querySelectorAll('.cell')[column],
    readout: () => root.querySelector<HTMLElement>('.readout'),
    live: () => root.querySelector('[aria-live]') as HTMLElement,
    cursor: () => all('.cell[data-cursor]'),
    async key(key: string) {
      grid().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await fixture.whenStable();
    },
    async focus() {
      grid().dispatchEvent(new FocusEvent('focus'));
      await fixture.whenStable();
    },
    /** Moves the pointer to `fraction` of row `row`'s width. */
    async point(row: number, fraction: number) {
      const cells = all('.cells')[row];
      // jsdom lays nothing out; the pointer maths needs a box, so give the row one 480 px wide.
      cells.getBoundingClientRect = () =>
        ({ left: 100, top: 0, width: 480, height: 24, right: 580, bottom: 24 }) as DOMRect;
      cells.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 100 + fraction * 480, bubbles: true }),
      );
      await fixture.whenStable();
    },
  };
}

const fillOf = (cell: Element) => (cell as HTMLElement).style.getPropertyValue('--cell');

describe('NeatHeatmap', () => {
  it('a heatmap cell mixes the heat tokens by its value and an empty cell stays transparent', async () => {
    const chart = await render((host) => {
      host.rows.set([core(0, [0, 50, 100, null]), core(1, [150, -20, 25, 75])]);
      host.times.set(seconds(0, 60, 120, 180));
    });
    const mix = (percent: number) =>
      `color-mix(in oklab, var(--neat-heat-high) ${percent}%, var(--neat-heat-low))`;
    expect(chart.all('.cells')[0].querySelectorAll('.cell')).toHaveLength(4);
    expect([0, 1, 2, 3].map((column) => fillOf(chart.cell(0, column)))).toEqual([
      mix(0),
      mix(50),
      mix(100),
      'transparent',
    ]);
    expect(
      [0, 1, 2, 3].map((column) => fillOf(chart.cell(1, column))),
      'a value beyond the domain clamps to its end',
    ).toEqual([mix(100), mix(0), mix(25), mix(75)]);

    chart.host.domain.set([40, 100]);
    chart.host.rows.set([core(0, [40, 70, 100, 30])]);
    await chart.fixture.whenStable();
    expect([0, 1, 2, 3].map((column) => fillOf(chart.cell(0, column)))).toEqual([
      mix(0),
      mix(50),
      mix(100),
      mix(0),
    ]);
  });

  it('a short history gets one column per sampling interval, so a pause stays visible', async () => {
    const chart = await render((host) => {
      host.rows.set([core(0, [10, 20, 90])]);
      // Two seconds apart, then thirty: seventeen two-second columns, the middle ones empty.
      host.times.set(seconds(0, 2, 32));
    });
    expect(chart.all('.cell')).toHaveLength(17);
    expect(fillOf(chart.cell(0, 1))).toContain('20%');
    expect(fillOf(chart.cell(0, 2))).toBe('transparent');
    expect(fillOf(chart.cell(0, 15))).toBe('transparent');
    expect(fillOf(chart.cell(0, 16))).toContain('90%');
    expect(chart.grid().style.getPropertyValue('--columns')).toBe('17');
  });

  it('a long history fills 48 columns, each the mean of its samples', async () => {
    const chart = await render((host) => {
      // Five samples to a column, in a pattern of five that averages 50: noise reads flat.
      host.rows.set([
        core(
          0,
          Array.from({ length: 240 }, (_, index) => [30, 70, 40, 60, 50][index % 5]),
        ),
      ]);
      host.times.set(Array.from({ length: 240 }, (_, index) => index * 2000));
    });
    expect(chart.all('.cell')).toHaveLength(48);
    expect(new Set(chart.all('.cell').map(fillOf))).toEqual(
      new Set(['color-mix(in oklab, var(--neat-heat-high) 50%, var(--neat-heat-low))']),
    );
  });

  it("shows each row as 1.5 rem tall: its label, its cells, then its end in the tone's colour", async () => {
    const chart = await render((host) => {
      host.rows.set([
        core(0, [10, 20, 30]),
        core(1, [90, 95, 99], 'danger'),
        core(2, [70, 75, 79], 'warning'),
      ]);
      host.times.set(MINUTES);
    });
    expect(chart.text('.name')).toEqual(['Core 0', 'Core 1', 'Core 2']);
    expect(chart.text('.end')).toEqual(['0%', '10%', '20%']);
    expect(chart.all('.end').map((end) => end.style.getPropertyValue('--tone'))).toEqual([
      'var(--foreground)',
      'var(--neat-line-danger)',
      'var(--neat-line-warning)',
    ]);
    // The grid places the three parts of a row side by side, in this order.
    expect(
      Array.from(chart.grid().children)
        .slice(0, 6)
        .map((child) => child.className.split(' ')[0]),
    ).toEqual(['name', 'cells', 'end', 'name', 'cells', 'end']);
  });

  it("shows a legend ramp from the domain's start to its end", async () => {
    const chart = await render((host) => {
      host.rows.set([core(0, [1, 2, 3])]);
      host.domain.set([0, 16]);
      host.format.set((value) => `${value} W`);
    });
    expect(chart.text('.scale > span:not(.ramp)')).toEqual(['0 W', '16 W']);
    expect(chart.all('.scale .ramp')).toHaveLength(1);
  });

  it('shows the title and headline, and leaves the headline out when there is none', async () => {
    const chart = await render((host) => {
      host.rows.set([core(0, [1, 2, 3])]);
      host.headline.set('42%');
    });
    expect(chart.text('.head > .title')).toEqual(['Per-core CPU']);
    expect(chart.text('.head > .headline')).toEqual(['42%']);
    chart.host.headline.set('');
    await chart.fixture.whenStable();
    expect(chart.all('.headline')).toHaveLength(0);
  });

  it('the grid is one tab stop named with the title, the headline and the window', async () => {
    const chart = await render((host) => {
      host.rows.set([core(0, [1, 2, 3]), core(1, [4, 5, 6])]);
      host.times.set(MINUTES);
      host.headline.set('42%');
    });
    expect(chart.grid().getAttribute('tabindex')).toBe('0');
    expect(chart.grid().getAttribute('role')).toBe('group');
    expect(chart.grid().getAttribute('aria-label')).toBe('Per-core CPU: 42%, over the last 2 min');
    expect(chart.all('.cell[tabindex]'), 'the cells are not tab stops').toHaveLength(0);
  });

  it('arrow keys move the heatmap cursor by column and row and announce the cell', async () => {
    const chart = await render((host) => {
      host.rows.set([core(0, [10, 20, 30]), core(1, [50, null, 70])]);
      host.times.set(MINUTES);
    });
    expect(chart.readout(), 'hidden until the pointer or a key').toBeNull();
    expect(chart.live().getAttribute('aria-live')).toBe('polite');

    await chart.focus();
    expect(chart.cursor()).toEqual([chart.cell(0, 2)]);
    expect(chart.readout()?.textContent).toContain('Core 0 · just now');
    expect(chart.live().textContent?.trim(), 'focus is silent').toBe('');

    await chart.key('ArrowLeft');
    expect(chart.cursor()).toEqual([chart.cell(0, 1)]);
    expect(chart.live().textContent?.trim()).toBe('Core 0 · 1 min ago: 20% average');
    await chart.key('ArrowDown');
    expect(chart.cursor()).toEqual([chart.cell(1, 1)]);
    expect(chart.live().textContent?.trim(), 'an empty cell says so').toBe(
      'Core 1 · 1 min ago: no data',
    );
    await chart.key('ArrowRight');
    await chart.key('ArrowRight');
    expect(chart.live().textContent?.trim(), 'stops at the newest column').toBe(
      'Core 1 · just now: 70% average',
    );
    await chart.key('Home');
    expect(chart.live().textContent?.trim()).toBe('Core 1 · 2 min ago: 50% average');
    await chart.key('ArrowLeft');
    expect(chart.cursor(), 'stops at the oldest column').toEqual([chart.cell(1, 0)]);
    await chart.key('ArrowDown');
    expect(chart.cursor(), 'stops at the last row').toEqual([chart.cell(1, 0)]);
    await chart.key('End');
    expect(chart.live().textContent?.trim()).toBe('Core 1 · just now: 70% average');
    await chart.key('ArrowUp');
    await chart.key('ArrowUp');
    expect(chart.live().textContent?.trim(), 'stops at the first row').toBe(
      'Core 0 · just now: 30% average',
    );
  });

  it('the readout dates a column by its newest sample', async () => {
    const chart = await render((host) => {
      // A hundred samples a minute apart go into 48 columns of about two samples each.
      host.rows.set([
        core(
          0,
          Array.from({ length: 100 }, (_, index) => index),
        ),
      ]);
      host.times.set(Array.from({ length: 100 }, (_, index) => index * 60_000));
    });
    expect(chart.all('.cell')).toHaveLength(48);
    await chart.focus();
    await chart.key('ArrowLeft');
    // The second column from the end holds samples 95 and 96; 96 is three minutes before the newest.
    expect(chart.live().textContent?.trim()).toBe('Core 0 · 3 min ago: 95.5% average');
  });

  it('the pointer shows the cell under it, silently, and a key takes over', async () => {
    const chart = await render((host) => {
      host.rows.set([core(0, [10, 20, 30]), core(1, [50, 60, 70])]);
      host.times.set(MINUTES);
    });
    await chart.point(1, 0.5);
    expect(chart.cursor()).toEqual([chart.cell(1, 1)]);
    expect(chart.readout()?.textContent).toContain('Core 1 · 1 min ago');
    expect(chart.readout()?.textContent).toContain('60% average');
    expect(chart.live().textContent?.trim(), 'pointer moves are silent').toBe('');

    await chart.key('ArrowLeft');
    expect(chart.cursor()).toEqual([chart.cell(1, 0)]);
    expect(chart.live().textContent?.trim()).toBe('Core 1 · 2 min ago: 50% average');

    chart.grid().dispatchEvent(new MouseEvent('pointerleave'));
    await chart.fixture.whenStable();
    expect(chart.cursor(), 'a cell a key chose stays').toEqual([chart.cell(1, 0)]);
  });

  it('Escape hides the readout only when there is one, and blur hides it too', async () => {
    const chart = await render((host) => {
      host.rows.set([core(0, [10, 20, 30])]);
      host.times.set(MINUTES);
    });
    const hidden = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    chart.grid().dispatchEvent(hidden);
    expect(hidden.defaultPrevented, 'nothing to hide: Escape is for whatever holds the chart').toBe(
      false,
    );

    await chart.focus();
    await chart.key('ArrowLeft');
    await chart.key('Escape');
    expect(chart.readout()).toBeNull();
    expect(chart.live().textContent?.trim()).toBe('');

    await chart.focus();
    chart.grid().dispatchEvent(new FocusEvent('blur'));
    await chart.fixture.whenStable();
    expect(chart.readout()).toBeNull();
  });

  it('draws nothing but its frame without rows', async () => {
    const chart = await render();
    expect(chart.all('.cell')).toHaveLength(0);
    await chart.focus();
    await chart.key('ArrowLeft');
    expect(chart.readout()).toBeNull();
  });
});
