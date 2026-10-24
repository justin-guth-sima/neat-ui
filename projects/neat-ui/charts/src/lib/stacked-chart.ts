import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { chartName, FLIP_BELOW, gridMarks, PLOT_REM, timeAxis } from './frame';
import { foldSeries, isNumber, stackedPaths, timeFractions } from './geometry';
import { seriesToken } from './line-token';
import {
  agoText,
  describe,
  fractionAcross,
  MISSING,
  type Readout,
  readoutAt,
  sampleCursor,
} from './readout';
import type { NeatChartFormat, NeatSeries } from './types';

/**
 * A total split into its parts over time, as bands stacked into one area:
 *
 * ```html
 * <neat-stacked-chart
 *   label="Board power"
 *   headline="11.4 W"
 *   [series]="rails"
 *   [times]="times"
 *   [domain]="[0, 16]"
 *   [format]="watts"
 * />
 * ```
 *
 * The series stack bottom first in the order given, each band in `--neat-series-1` to `-8` at
 * 0.85 opacity with a hairline in `--neat-surface` between them, so inside a card set that to the
 * card's fill. More than eight fold into "Other", as on the time chart. A sample where any band is
 * missing breaks the whole stack: a partial sum would draw a total that was never measured.
 * `times`, `domain`, `format`, `size` and `headless` are as on the time chart, and `domain` must
 * reach the largest total or the top of the stack is cut off.
 *
 * The legend lists each band with its current value and its share of the current total, as a
 * whole percent; the share is "—" while the total is unknown (a band has no current sample) or
 * nothing. The colours alone do not tell eight bands apart, which is what the legend is for.
 *
 * The plot is a tab stop that reads out like the time chart's: "Total", then each band, at the
 * sample the pointer or the keys chose, with the same keys and the same announcements.
 */
@Component({
  selector: 'neat-stacked-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--plot-height]': 'plotHeight()',
  },
  template: `
    @if (!headless()) {
      <div class="head">
        <span class="title">{{ label() }}</span>
        @if (headline()) {
          <span class="headline">{{ headline() }}</span>
        }
      </div>
    }
    @if (legend().length) {
      <ul class="legend">
        @for (item of legend(); track item.key) {
          <li>
            <span class="swatch" [style.--series]="item.color"></span>
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <span class="share">{{ item.share }}</span>
          </li>
        }
      </ul>
    }
    <div
      #plot
      class="plot"
      tabindex="0"
      role="group"
      aria-roledescription="chart"
      [attr.aria-label]="name()"
      (pointermove)="onPointerMove($event)"
      (pointerleave)="cursor.pointerLeave()"
      (focus)="cursor.focus()"
      (blur)="cursor.blur()"
      (keydown)="cursor.keydown($event)"
    >
      <svg viewBox="0 0 600 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        @for (tick of grid(); track tick.value) {
          <line class="grid" x1="0" x2="600" [attr.y1]="tick.y" [attr.y2]="tick.y" />
        }
        @for (band of bands(); track band.key) {
          <path class="band" [attr.d]="band.path" [style.--series]="band.color" />
        }
      </svg>
      @if (labelled()) {
        @for (tick of grid(); track tick.value) {
          <span
            class="tag grid-label"
            data-side="start"
            aria-hidden="true"
            [style.top.%]="tick.y"
            [attr.data-below]="tick.y < flipBelow ? '' : null"
            >{{ tick.text }}</span
          >
        }
      }
      @if (readout(); as readout) {
        <span class="crosshair" aria-hidden="true" [style.left.%]="readout.at * 100"></span>
        <span
          class="readout"
          aria-hidden="true"
          [attr.data-flip]="readout.at > 0.5 ? '' : null"
          [style.--at]="readout.at"
        >
          @if (readout.ago) {
            <span class="ago">{{ readout.ago }}</span>
          }
          @for (row of readout.rows; track $index) {
            <span class="row">
              @if (row.color) {
                <span class="swatch" [style.--series]="row.color"></span>
              }
              {{ row.label }} {{ row.value }}
            </span>
          }
        </span>
      }
    </div>
    @if (labelled()) {
      <div class="axis" aria-hidden="true">
        @for (tick of axis(); track tick.at) {
          <span [style.--at]="tick.at">{{ tick.text }}</span>
        }
      </div>
    }
    <span class="sr-only" aria-live="polite">{{ cursor.announcement() }}</span>
  `,
  styleUrls: ['./chart-frame.css', './plot.css', './stacked-chart.css'],
})
export class NeatStackedChart {
  /** The chart's title, which also names it for assistive technology. */
  readonly label = input.required<string>();
  /** The current total as the app words it, beside the title and in the accessible name. */
  readonly headline = input('');
  /** The bands, bottom first, each as long as `times`; more than eight fold into "Other". */
  readonly series = input.required<readonly NeatSeries[]>();
  /** When each sample was taken, in ms, oldest first; `null` for one without a time. */
  readonly times = input.required<readonly (number | null)[]>();
  /** The values the box spans, bottom and top: fixed by the app, so the stack never rescales. */
  readonly domain = input.required<readonly [number, number]>();
  /** The plot's height: 3.5, 6 or 9.5 rem. Compact also leaves out the labels and the time axis. */
  readonly size = input<'compact' | 'medium' | 'large'>('large');
  /** Leaves out the title row, for a chart under a heading of its own. */
  readonly headless = input(false, { transform: booleanAttribute });
  /** Words a value with its unit, for the legend, the readout and the accessible name. */
  readonly format = input<NeatChartFormat>(String);

  private readonly plot = viewChild.required<ElementRef<HTMLElement>>('plot');

  protected readonly flipBelow = FLIP_BELOW;

  /** Compact leaves the labels out: a row of charts has no room for them. */
  protected readonly labelled = computed(() => this.size() !== 'compact');

  private readonly lines = computed(() => foldSeries(this.series()));
  private readonly length = computed(() =>
    Math.max(0, ...this.lines().map((entry) => entry.values.length)),
  );
  private readonly fractions = computed(() => timeFractions(this.times(), this.length()));

  protected readonly bands = computed(() => {
    const lines = this.lines();
    const paths = stackedPaths(
      lines.map((entry) => entry.values),
      this.fractions(),
      this.domain(),
    );
    return lines.map((entry, index) => ({
      key: entry.key,
      color: seriesToken(index),
      path: paths[index],
    }));
  });

  /** The sum of the bands at a sample, or null where any of them has none. */
  private totalAt(index: number): number | null {
    const values = this.lines().map((entry) => entry.values[index]);
    return values.every(isNumber) ? values.reduce((sum, value) => sum + value, 0) : null;
  }

  protected readonly legend = computed(() => {
    const format = this.format();
    const current = this.length() - 1;
    const total = this.totalAt(current);
    return this.lines().map((entry, index) => {
      const value = entry.values[current];
      return {
        key: entry.key,
        label: entry.label,
        color: seriesToken(index),
        value: describe(value, format),
        share: total && isNumber(value) ? `${Math.round((value / total) * 100)}%` : MISSING,
      };
    });
  });

  protected readonly plotHeight = computed(() => `${PLOT_REM[this.size()]}rem`);
  protected readonly grid = computed(() => gridMarks(this.domain()));
  protected readonly axis = computed(() => timeAxis(this.times(), this.length()));

  protected readonly name = computed(() =>
    chartName(this.label(), this.headline(), this.times(), this.length()),
  );

  protected readonly cursor = sampleCursor({
    length: this.length,
    fractions: this.fractions,
    spoken: (index) => this.readoutFor(index).spoken,
  });

  protected readonly readout = computed((): Readout | null => {
    const index = this.cursor.active();
    return index === null ? null : this.readoutFor(index);
  });

  private readoutFor(index: number): Readout {
    const format = this.format();
    return readoutAt(this.fractions()[index], agoText(this.times(), this.length(), index), [
      { key: 'total', label: 'Total', value: describe(this.totalAt(index), format), color: null },
      ...this.lines().map((entry, line) => ({
        key: entry.key,
        label: entry.label,
        value: describe(entry.values[index], format),
        color: seriesToken(line),
      })),
    ]);
  }

  protected onPointerMove(event: MouseEvent): void {
    const fraction = fractionAcross(event, this.plot().nativeElement);
    if (fraction !== null) this.cursor.pointerTo(fraction);
  }
}
