import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * The name of the custom property that holds the series at `index` (from 0): `--neat-series-1`
 * to `-8`. The kit's one rule from a series to its token: `seriesToken` wraps it for CSS, and code
 * that resolves colors itself (`neatThemeColors`, the diagram's dots on a canvas) takes the name.
 */
export function seriesTokenName(index: number): string {
  return `--neat-series-${index + 1}`;
}

/**
 * The palette color of the series at `index` (from 0), for CSS. The charts color their lines and
 * bands by it and the diagram its edges (whose `series` counts from 1, converted in one place
 * there), so a swatch matches what it names.
 */
export function seriesToken(index: number): string {
  return `var(${seriesTokenName(index)})`;
}

/**
 * The color of a series as a small square, for a label that stands for that series outside the
 * drawing that uses it (a run's chip, a summary row, a chart's or a diagram's legend):
 *
 * ```html
 * <neat-series-swatch [index]="i" /> {{ run.name }}
 * ```
 *
 * `index` is the series' place in the chart's `series`, from 0, and the swatch takes the color
 * that series is drawn in (`--neat-series-1` to `-8`), so a label and its line match in either
 * theme. A chart folds a ninth series and beyond into "Other" (index 7), so
 * an index past 7 names no color. A chart's lone series is drawn in its tone's color instead and
 * needs no swatch.
 *
 * In the primary, not in `charts`, so the diagram's legend shows it without the charts' d3 (and
 * `@sima/neat-ui/charts` still exports it for the apps that import it from there). The time and
 * stacked charts draw their legends' and readouts' swatches with it, and so does
 * `neat-diagram-legend`. Its look is `neat-swatch`'s (the color square for any color): both take
 * that component's sheet, so the size, shape and corners are stated once. It is `aria-hidden`: the
 * text beside it names the series, and a color alone is not a name.
 */
@Component({
  selector: 'neat-series-swatch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.--swatch]': 'color()',
  },
  template: '',
  // The swatch's one look, shared with `neat-swatch`.
  styleUrl: '../swatch/swatch.css',
})
export class NeatSeriesSwatch {
  /** The series' place in the chart's `series`, from 0. */
  readonly index = input.required<number>();

  protected readonly color = computed(() => seriesToken(this.index()));
}
