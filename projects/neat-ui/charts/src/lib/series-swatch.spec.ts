import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { stylesheet } from './css.testing';
import plotStyles from './plot.css' with { loader: 'text' };
import { NeatSeriesSwatch } from './series-swatch';
import swatchStyles from './series-swatch.css' with { loader: 'text' };
import stackedStyles from './stacked-chart.css' with { loader: 'text' };
import { NeatStackedChart } from './stacked-chart';
import timeStyles from './time-chart.css' with { loader: 'text' };
import { NeatTimeChart } from './time-chart';
import type { NeatSeries } from './types';

const SERIES: readonly NeatSeries[] = [
  { key: 'a', label: 'Run A', values: [10, 20] },
  { key: 'b', label: 'Run B', values: [30, 40] },
  { key: 'c', label: 'Run C', values: [50, 60] },
];

/** Swatches beside the charts that draw the same series, as a run view's chips sit by its charts. */
@Component({
  imports: [NeatSeriesSwatch, NeatTimeChart, NeatStackedChart],
  template: `
    @for (entry of series; track entry.key) {
      <neat-series-swatch class="chip" [index]="$index" />
    }
    <neat-series-swatch class="moving" [index]="index()" />
    <neat-time-chart label="Latency" [series]="series" [times]="[0, 1000]" [domain]="[0, 100]" />
    <neat-stacked-chart label="Power" [series]="series" [times]="[0, 1000]" [domain]="[0, 200]" />
  `,
})
class SwatchHost {
  readonly series = SERIES;
  readonly index = signal(0);
}

async function render() {
  const fixture = TestBed.createComponent(SwatchHost);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const all = (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));
  const series = (selector: string) =>
    all(selector).map((element) => element.style.getPropertyValue('--series'));
  return { fixture, host: fixture.componentInstance, all, series };
}

describe('NeatSeriesSwatch', () => {
  it('takes the palette colour of its series index, counted from 0, through the one rule', async () => {
    const { fixture, host, series } = await render();

    expect(series('neat-series-swatch.chip')).toEqual([
      'var(--neat-series-1)',
      'var(--neat-series-2)',
      'var(--neat-series-3)',
    ]);

    host.index.set(7);
    await fixture.whenStable();
    expect(series('neat-series-swatch.moving')).toEqual(['var(--neat-series-8)']);
  });

  it('is hidden from assistive technology: the label beside it names the series', async () => {
    const { all } = await render();

    for (const swatch of all('neat-series-swatch')) {
      expect(swatch.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('has the colour of the chart line, the band and the legend for the same index, in either theme', async () => {
    const { series } = await render();
    const chips = series('neat-series-swatch.chip');

    // The same token: each theme defines --neat-series-<n> once, so equal tokens are equal colours
    // in light and in dark alike.
    expect(series('neat-time-chart .series')).toEqual(chips);
    expect(series('neat-stacked-chart .band')).toEqual(chips);
    expect(series('neat-time-chart .legend neat-series-swatch')).toEqual(chips);
    expect(series('neat-stacked-chart .legend neat-series-swatch')).toEqual(chips);

    // And each reads it the same way: the token itself, at full strength.
    expect(stylesheet(swatchStyles).declared(':host', 'background')).toBe('var(--series)');
    expect(stylesheet(timeStyles).declared('.line', 'stroke')).toBe('var(--series)');
    expect(stylesheet(stackedStyles).declared('.band', 'fill')).toBe('var(--series)');
  });

  it('states its look once: a 0.625rem square with 2px corners, which the charts do not restate', () => {
    const { declared } = stylesheet(swatchStyles);

    expect(declared(':host', 'width')).toBe('0.625rem');
    expect(declared(':host', 'height')).toBe('0.625rem');
    expect(declared(':host', 'border-radius')).toBe('2px');
    expect(declared(':host', 'flex')).toBe('none');
    expect(plotStyles).not.toMatch(/\.swatch\b/);
  });
});
