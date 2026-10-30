import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { NeatSeriesSwatch } from '@sima/neat-ui';
import {
  chartName,
  FLIP_BELOW,
  gridMarks,
  labelSpan,
  PLOT_REM,
  roomyGridMarks,
  timeAxis,
} from './frame';
import { foldSeries, linePaths, timeFractions, yAt } from './geometry';
import { lineToken, seriesToken } from './line-token';
import {
  describe,
  fractionAcross,
  type Readout,
  readoutAt,
  sampleCursor,
  whenText,
} from './readout';
import type {
  NeatChartAxis,
  NeatChartFormat,
  NeatChartTone,
  NeatReference,
  NeatSeries,
  NeatThreshold,
} from './types';

/** The reference line is neither a warning nor a danger, so it is the quiet colour. */
const REFERENCE_TOKEN = 'var(--muted-foreground)';
/** A line across the plot at `y` (0 to 100 from the top) and, when the chart has room, its label. */
interface Level {
  readonly y: number;
  readonly color: string;
  readonly label: string;
  readonly side: 'start' | 'end';
}

/**
 * A metric over time as a line chart with a hover and keyboard readout:
 *
 * ```html
 * <neat-time-chart
 *   label="CPU usage"
 *   headline="34%"
 *   [series]="[{ key: 'cpu', label: 'CPU', values: cpu }]"
 *   [times]="times"
 *   [domain]="[0, 100]"
 *   [thresholds]="[{ value: 85, tone: 'danger', label: 'Critical 85%' }]"
 *   [format]="percent"
 * />
 * ```
 *
 * `times` (ms, oldest first) place the samples, so a delayed poll shows as a gap; without usable
 * times they are spaced evenly. `domain` is the value range the box shows, and the app picks it
 * (a percentage is 0 to 100, a temperature a fixed range), so the line never rescales under the
 * reader. `format` words a value with its unit; the chart knows no units.
 *
 * One series strokes in `--neat-line`, or `--neat-line-warning` and `--neat-line-danger` by `tone`,
 * with a faint area under it. Several take `--neat-series-1` to `-8` in order, and are listed in a
 * legend with their current values; a ninth series and beyond fold into "Other". A `null` is a
 * sample that was not taken and breaks the line. The newest sample has a dot. Thresholds and the
 * reference are dashed lines, drawn while their value lies in the domain.
 *
 * The labels are drawn over the lines with a halo in `--neat-surface`, so inside a card set that
 * to the card's fill, as the select list's sticky header asks.
 *
 * `size` sets the plot's height (3.5, 6 or 9.5 rem). `compact` leaves out every label and the time
 * axis, which suits a row among others; `fill` is labelled as `medium` and makes the host a flex
 * column whose plot takes the height left after the title, legend and axis, never under medium's
 * 6 rem, so the app gives the host its height (a grid item that a row stretches, say);
 * `[valueLabels]="false"` leaves out only the grid's values and the levels' labels, keeping their
 * lines and the time axis, which suits a card in a grid; `headless` leaves out the title and
 * headline, for a chart that sits under a heading of its own.
 * None changes the accessible name or the readout. A grid label that would sit on a level's label
 * or on the grid label below it is left out.
 *
 * The plot is a group in the tab order named "<label>: <headline, or the current values>, over
 * the last <window>" ("over <span>" on the elapsed axis). The readout follows the pointer; with
 * focus it shows the newest sample, and the arrow keys, Home and End move it and Escape hides it.
 * Each key press is repeated in a polite live region, so a screen reader hears the sample;
 * pointer moves are not.
 */
@Component({
  selector: 'neat-time-chart',
  imports: [NeatSeriesSwatch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--plot-height]': 'plotHeight()',
    '[attr.data-fill]': "size() === 'fill' ? '' : null",
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
            <neat-series-swatch [index]="item.index" />
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
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
        @for (level of levels(); track $index) {
          <line
            class="level"
            x1="0"
            x2="600"
            [attr.y1]="level.y"
            [attr.y2]="level.y"
            stroke-dasharray="6 4"
            [style.--level]="level.color"
          />
        }
        @for (entry of drawn(); track entry.key) {
          <g class="series" [style.--series]="entry.color">
            @if (entry.area) {
              <path class="area" [attr.d]="entry.area" />
            }
            @if (entry.line) {
              <path class="line" [attr.d]="entry.line" />
            }
          </g>
        }
      </svg>
      @if (valueLabelled()) {
        @for (tick of gridLabels(); track tick.value) {
          <span
            class="tag grid-label"
            data-side="start"
            aria-hidden="true"
            [style.top.%]="tick.y"
            [attr.data-below]="tick.y < flipBelow ? '' : null"
            >{{ tick.text }}</span
          >
        }
        @for (level of levels(); track $index) {
          <span
            class="tag level-tag"
            aria-hidden="true"
            [attr.data-side]="level.side"
            [style.top.%]="level.y"
            [style.--level]="level.color"
            [attr.data-below]="level.y < flipBelow ? '' : null"
            >{{ level.label }}</span
          >
        }
      }
      @for (entry of drawn(); track entry.key) {
        @if (entry.last; as last) {
          <span
            class="dot"
            aria-hidden="true"
            [style.left.%]="last.x / 6"
            [style.top.%]="last.y"
            [style.--series]="entry.color"
          ></span>
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
          @if (readout.when) {
            <span class="when">{{ readout.when }}</span>
          }
          @for (row of readout.rows; track row.key) {
            <span class="row">
              @if (row.series !== null) {
                <neat-series-swatch [index]="row.series" />
              }
              {{ row.label }} {{ row.value }}
            </span>
          }
        </span>
      }
    </div>
    @if (labelled()) {
      <div class="axis" aria-hidden="true">
        @for (tick of timeTicks(); track tick.at) {
          <span [style.--at]="tick.at">{{ tick.text }}</span>
        }
      </div>
    }
    <span class="sr-only" aria-live="polite">{{ cursor.announcement() }}</span>
  `,
  styleUrls: ['./chart-frame.css', './plot.css', './time-chart.css'],
})
export class NeatTimeChart {
  /** The chart's title, which also names it for assistive technology. */
  readonly label = input.required<string>();
  /** The current value as the app words it, beside the title and in the accessible name. */
  readonly headline = input('');
  /** The lines, each as long as `times`; more than eight fold into "Other". */
  readonly series = input.required<readonly NeatSeries[]>();
  /** When each sample was taken, in ms, oldest first; `null` for one without a time. */
  readonly times = input.required<readonly (number | null)[]>();
  /** The values the box spans, bottom and top: fixed by the app, so the line never rescales. */
  readonly domain = input.required<readonly [number, number]>();
  /** Levels drawn dashed in a warning or danger colour while they lie inside the domain. */
  readonly thresholds = input<readonly NeatThreshold[]>([]);
  /** A level that is neither, such as an average or a limit. */
  readonly reference = input<NeatReference | null>(null);
  /** The stroke of a single series; several series take the palette's colours instead. */
  readonly tone = input<NeatChartTone>('default');
  /**
   * The plot's height: 3.5, 6 or 9.5 rem. Compact also leaves out the labels and the time axis.
   * `fill` is labelled as medium, with the plot taking the height the app gives the host.
   */
  readonly size = input<'compact' | 'medium' | 'large' | 'fill'>('medium');
  /**
   * What the x axis, the readout and the accessible name count: `recent` back from the newest
   * sample ("−8 min … now", "2 min ago"), for a live window, or `elapsed` forward from the first
   * ("0 s … 33.9 s", "at 17 s"), for a run read from its start or several laid over each other.
   */
  readonly axis = input<NeatChartAxis>('recent');
  /** Leaves out the title row, for a chart under a heading of its own. */
  readonly headless = input(false, { transform: booleanAttribute });
  /**
   * Whether the grid lines and the levels carry their values. Without them the lines, the time
   * axis, the readout and the accessible name stay: for a small chart among others, such as a
   * card's, where the labels would crowd the plot.
   */
  readonly valueLabels = input(true, { transform: booleanAttribute });
  /** Words a value with its unit, for the legend, the readout and the accessible name. */
  readonly format = input<NeatChartFormat>(String);

  private readonly plot = viewChild.required<ElementRef<HTMLElement>>('plot');

  protected readonly flipBelow = FLIP_BELOW;

  /** The size the labels are laid out for: a filling plot is at least medium's, so it is medium. */
  private readonly frameSize = computed(() => {
    const size = this.size();
    return size === 'fill' ? 'medium' : size;
  });

  /** Compact leaves the labels out: a row of charts has no room for them. */
  protected readonly labelled = computed(() => this.size() !== 'compact');
  /** The grid's values and the levels' labels, which `valueLabels` can leave out on their own. */
  protected readonly valueLabelled = computed(() => this.labelled() && this.valueLabels());

  private readonly lines = computed(() => foldSeries(this.series()));
  private readonly length = computed(() =>
    Math.max(0, ...this.lines().map((entry) => entry.values.length)),
  );
  private readonly fractions = computed(() => timeFractions(this.times(), this.length()));

  /**
   * Whether the chart draws several lines, the one rule for what that changes: the palette's
   * colours instead of the tone's, no area, a legend, and a swatch on each readout row.
   */
  private readonly several = computed(() => this.lines().length > 1);

  /** Each line's colour: its tone when it is alone, else its place in the palette. */
  private readonly colors = computed(() =>
    this.several() ? this.lines().map((_, index) => seriesToken(index)) : [lineToken(this.tone())],
  );

  protected readonly drawn = computed(() => {
    const lines = this.lines();
    const fractions = this.fractions();
    const domain = this.domain();
    return lines.map((entry, index) => {
      const paths = linePaths(entry.values, fractions, domain);
      return {
        key: entry.key,
        color: this.colors()[index],
        line: paths.line,
        // One series is shaded; the shades of several would blur into each other.
        area: this.several() ? '' : paths.area,
        last: paths.last,
      };
    });
  });

  protected readonly legend = computed(() => {
    if (!this.several()) return [];
    const format = this.format();
    return this.lines().map((entry, index) => ({
      key: entry.key,
      label: entry.label,
      index,
      value: describe(entry.values.at(-1), format),
    }));
  });

  protected readonly plotHeight = computed(() => `${PLOT_REM[this.frameSize()]}rem`);

  protected readonly grid = computed(() => gridMarks(this.domain()));

  /**
   * The grid labels that do not sit on a threshold or reference label, nor on the grid label below
   * them. Levels and grid labels start at the plot's left edge, so a level near a grid line (a
   * warning at 80 under the top label) would print one over the other; the level's label stays,
   * since it says more, and the grid line stays too. Labels at the end do not meet them.
   */
  protected readonly gridLabels = computed(() => {
    const size = this.frameSize();
    const taken = this.levels()
      .filter((level) => level.side === 'start')
      .map((level) => labelSpan(level.y, size));
    return roomyGridMarks(this.grid(), size, taken);
  });

  /** The thresholds and the reference inside the domain, edges included (Inv-S §13.27). */
  protected readonly levels = computed((): Level[] => {
    const domain = this.domain();
    const inside = (value: number) => domain[0] <= value && value <= domain[1];
    const reference = this.reference();
    return [
      ...this.thresholds()
        .filter((threshold) => inside(threshold.value))
        .map((threshold) => ({
          y: yAt(threshold.value, domain),
          color: lineToken(threshold.tone),
          label: threshold.label,
          // A warning label stays clear of the danger label's corner.
          side: threshold.tone === 'danger' ? ('end' as const) : ('start' as const),
        })),
      ...(reference && inside(reference.value)
        ? [
            {
              y: yAt(reference.value, domain),
              color: REFERENCE_TOKEN,
              label: reference.label,
              side: 'start' as const,
            },
          ]
        : []),
    ];
  });

  protected readonly timeTicks = computed(() => timeAxis(this.times(), this.length(), this.axis()));

  protected readonly name = computed(() => {
    const format = this.format();
    const current =
      this.headline() ||
      this.lines()
        .map((entry) => describe(entry.values.at(-1), format))
        .join(', ');
    return chartName(this.label(), current, this.times(), this.length(), this.axis());
  });

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
    const several = this.several();
    return readoutAt(
      this.fractions()[index],
      whenText(this.times(), this.length(), index, this.axis()),
      this.lines().map((entry, line) => ({
        key: entry.key,
        label: entry.label,
        value: describe(entry.values[index], format),
        // A lone line is in its tone's colour, not the palette's, and needs no swatch.
        series: several ? line : null,
      })),
    );
  }

  protected onPointerMove(event: MouseEvent): void {
    const fraction = fractionAcross(event, this.plot().nativeElement);
    if (fraction !== null) this.cursor.pointerTo(fraction);
  }
}
