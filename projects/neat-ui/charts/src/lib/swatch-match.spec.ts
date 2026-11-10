import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatSeriesSwatch } from '@sima/neat-ui';
import { stylesheet } from './css.testing';
import plotStyles from './plot.css' with { loader: 'text' };
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

/**
 * Swatches beside the charts that draw the same series, as a run view's chips sit by its charts.
 */
@Component({
  imports: [NeatSeriesSwatch, NeatTimeChart, NeatStackedChart],
  template: `
    @for (entry of series; track entry.key) {
      <neat-series-swatch class="chip" [index]="$index" />
    }
    <neat-time-chart label="Latency" [series]="series" [times]="[0, 1000]" [domain]="[0, 100]" />
    <neat-stacked-chart label="Power" [series]="series" [times]="[0, 1000]" [domain]="[0, 200]" />
  `,
})
class SwatchHost {
  readonly series = SERIES;
}

async function render() {
  const fixture = TestBed.createComponent(SwatchHost);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const all = (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));
  // A line or a band holds its colour in `--series`, a swatch in `--swatch`.
  const series = (selector: string) =>
    all(selector).map(
      (element) =>
        element.style.getPropertyValue('--series') || element.style.getPropertyValue('--swatch'),
    );
  return { series };
}

describe('the charts’ series swatches (NeatSeriesSwatch, from the primary)', () => {
  it('have the colour of the chart line, the band and the legend for the same index, in either theme', async () => {
    const { series } = await render();
    const chips = series('neat-series-swatch.chip');

    // The same token: each theme defines --neat-series-<n> once, so equal tokens are equal colours
    // in light and in dark alike.
    expect(chips).toEqual(['var(--neat-series-1)', 'var(--neat-series-2)', 'var(--neat-series-3)']);
    expect(series('neat-time-chart .series')).toEqual(chips);
    expect(series('neat-stacked-chart .band')).toEqual(chips);
    expect(series('neat-time-chart .legend neat-series-swatch')).toEqual(chips);
    expect(series('neat-stacked-chart .legend neat-series-swatch')).toEqual(chips);

    // And each reads it the same way the swatch does: the token itself, at full strength.
    expect(stylesheet(timeStyles).declared('.line', 'stroke')).toBe('var(--series)');
    expect(stylesheet(stackedStyles).declared('.band', 'fill')).toBe('var(--series)');
  });

  it('are not restated by the charts: the swatch’s look is the primary’s alone', () => {
    expect(plotStyles).not.toMatch(/\.swatch\b/);
  });
});
