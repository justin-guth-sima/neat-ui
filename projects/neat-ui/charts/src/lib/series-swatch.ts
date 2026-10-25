import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { seriesToken } from './line-token';

/**
 * The colour of a chart series as a small square, for a label that stands for that series outside
 * the chart (a run's chip, a summary row, a heading over a per-metric chart):
 *
 * ```html
 * <neat-series-swatch [index]="i" /> {{ run.name }}
 * ```
 *
 * `index` is the series' place in the chart's `series`, from 0, and the swatch takes the colour the
 * chart draws that series in when it has several (`--neat-series-1` to `-8`, through the charts'
 * one rule, `seriesToken`), so a label and its line match in either theme. A chart folds a ninth
 * series and beyond into "Other" (index 7), so an index past 7 names no colour. A lone series is
 * drawn in its tone's colour instead and needs no swatch.
 *
 * The time and stacked charts draw their own legends' and readouts' swatches with it, so its size,
 * shape and colour are stated here once. It is `aria-hidden`: the text beside it names the series,
 * and a colour alone is not a name.
 */
@Component({
  selector: 'neat-series-swatch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.--series]': 'color()',
  },
  template: '',
  styleUrl: './series-swatch.css',
})
export class NeatSeriesSwatch {
  /** The series' place in the chart's `series`, from 0. */
  readonly index = input.required<number>();

  protected readonly color = computed(() => seriesToken(this.index()));
}
