import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { neatSecondsAgo } from '@sima/neat-ui';
import {
  axisLabel,
  axisTimeLabel,
  foldSeries,
  gridTicks,
  indexAt,
  linePaths,
  timeFractions,
  timeSpan,
  windowText,
  yAt,
} from './geometry';
import { lineToken } from './line-token';
import type {
  NeatChartFormat,
  NeatChartTone,
  NeatReference,
  NeatSeries,
  NeatThreshold,
} from './types';

/** The reference line is neither a warning nor a danger, so it is the quiet colour. */
const REFERENCE_TOKEN = 'var(--muted-foreground)';
/** A label whose line is within this much of the top (in the box's 0 to 100) sits below the line. */
const FLIP_BELOW = 14;
/** The plot's height in rem by size, set as `--plot-height` so the labels' room is worked out from it. */
const PLOT_REM = { compact: 3.5, medium: 6, large: 9.5 } as const;
/** A label's height (the text-xs line) and its gap to its line, in rem. */
const LABEL_REM = 0.75;
const LABEL_GAP_REM = 0.125;
/** What a readout shows for a sample that was not taken. */
const MISSING = '—';

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** A line across the plot at `y` (0 to 100 from the top) and, when the chart has room, its label. */
interface Level {
  readonly y: number;
  readonly color: string;
  readonly label: string;
  readonly side: 'start' | 'end';
}

/** Where the readout reads: where the pointer is, or the sample a key chose. */
interface Readout {
  /** The sample's place across the plot, 0 to 1. */
  readonly at: number;
  /** How long before the newest sample it was taken, when the times say. */
  readonly ago: string | null;
  readonly rows: readonly { key: string; label: string; value: string; color: string }[];
  /** The readout as one sentence, for the live region. */
  readonly spoken: string;
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
 * axis, which suits a row among others; `headless` leaves out the title and headline, for a chart
 * that sits under a heading of its own. Neither changes the accessible name.
 *
 * The plot is a group in the tab order named "<label>: <headline, or the current values>, over
 * the last <window>". The readout follows the pointer; with focus it shows the newest sample, and
 * the arrow keys, Home and End move it and Escape hides it. Each key press is repeated in a polite
 * live region, so a screen reader hears the sample; pointer moves are not.
 */
@Component({
  selector: 'neat-time-chart',
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
      (pointerleave)="onPointerLeave()"
      (focus)="onFocus()"
      (blur)="onBlur()"
      (keydown)="onKeydown($event)"
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
      @if (labelled()) {
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
          @if (readout.ago) {
            <span class="ago">{{ readout.ago }}</span>
          }
          @for (row of readout.rows; track row.key) {
            <span class="row">
              @if (drawn().length > 1) {
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
    <span class="sr-only" aria-live="polite">{{ announcement() }}</span>
  `,
  styleUrl: './time-chart.css',
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
  /** The plot's height: 3.5, 6 or 9.5 rem. Compact also leaves out the labels and the time axis. */
  readonly size = input<'compact' | 'medium' | 'large'>('medium');
  /** Leaves out the title row, for a chart under a heading of its own. */
  readonly headless = input(false, { transform: booleanAttribute });
  /** Words a value with its unit, for the legend, the readout and the accessible name. */
  readonly format = input<NeatChartFormat>(String);

  private readonly plot = viewChild.required<ElementRef<HTMLElement>>('plot');

  /** Fraction of the plot's width the pointer is at, while it is over the plot. */
  private readonly pointerAt = signal<number | null>(null);
  /** The sample a key chose. A key takes the readout over from the pointer, and a move gives it back. */
  private readonly keyIndex = signal<number | null>(null);
  /** The readout as of the last key press: the live region's text. Pointer moves never write it. */
  protected readonly announcement = signal('');

  protected readonly flipBelow = FLIP_BELOW;

  /** Compact leaves the labels out: a row of charts has no room for them. */
  protected readonly labelled = computed(() => this.size() !== 'compact');

  private readonly lines = computed(() => foldSeries(this.series()));
  private readonly length = computed(() =>
    Math.max(0, ...this.lines().map((entry) => entry.values.length)),
  );
  private readonly fractions = computed(() => timeFractions(this.times(), this.length()));

  /** Each line's colour: its tone when it is alone, else its place in the palette. */
  private readonly colors = computed(() => {
    const lines = this.lines();
    return lines.length === 1
      ? [lineToken(this.tone())]
      : lines.map((_, index) => `var(--neat-series-${index + 1})`);
  });

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
        area: lines.length === 1 ? paths.area : '',
        last: paths.last,
      };
    });
  });

  protected readonly legend = computed(() => {
    const lines = this.lines();
    if (lines.length < 2) return [];
    const format = this.format();
    return lines.map((entry, index) => ({
      key: entry.key,
      label: entry.label,
      color: this.colors()[index],
      value: this.describe(entry.values.at(-1), format),
    }));
  });

  protected readonly plotHeight = computed(() => `${PLOT_REM[this.size()]}rem`);

  protected readonly grid = computed(() =>
    gridTicks(this.domain()).map((value) => ({
      value,
      y: yAt(value, this.domain()),
      text: axisLabel(value),
    })),
  );

  /**
   * The grid labels that do not sit on a threshold or reference label. Both start at the plot's
   * left edge, so a level near a grid line (a warning at 80 under the top label) would print one
   * over the other; the level's label stays, since it says more, and the grid line stays too.
   * Labels at the end do not meet them.
   */
  protected readonly gridLabels = computed(() => {
    const unit = 100 / PLOT_REM[this.size()];
    const [height, gap] = [LABEL_REM * unit, LABEL_GAP_REM * unit];
    /** The label's stretch of the box: above its line, or below it near the top. */
    const span = (y: number): [number, number] =>
      y < FLIP_BELOW ? [y + gap, y + gap + height] : [y - gap - height, y - gap];
    const taken = this.levels()
      .filter((level) => level.side === 'start')
      .map((level) => span(level.y));
    return this.grid().filter((tick) => {
      const [top, bottom] = span(tick.y);
      return !taken.some(([from, to]) => top < to && from < bottom);
    });
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

  /** The time axis: the start, middle and end of the span, or only "now" without a span. */
  protected readonly axis = computed(() => {
    const length = this.length();
    if (!length) return [];
    const span = timeSpan(this.times(), length);
    // Without a span there is nothing to count back from; the newest sample sits at the end,
    // except a lone one, which sits at the start.
    if (span === null) return [{ at: length > 1 ? 1 : 0, text: axisTimeLabel(0) }];
    return [0, 0.5, 1].map((at) => ({ at, text: axisTimeLabel(span * (1 - at)) }));
  });

  protected readonly name = computed(() => {
    const format = this.format();
    const current =
      this.headline() ||
      this.lines()
        .map((entry) => this.describe(entry.values.at(-1), format))
        .join(', ');
    const window = windowText(this.times(), this.length());
    return `${this.label()}${current ? `: ${current}` : ''}, over the last ${window}`;
  });

  /** The sample the readout reads, or -1 while it is hidden. */
  private readonly activeIndex = computed(() => {
    const length = this.length();
    if (!length) return -1;
    const key = this.keyIndex();
    if (key !== null) return Math.min(key, length - 1);
    const pointer = this.pointerAt();
    // The pointer is kept as a place, not a sample, so the readout follows data that shifts under it.
    return pointer === null ? -1 : indexAt(pointer, length, this.fractions());
  });

  protected readonly readout = computed((): Readout | null => {
    const index = this.activeIndex();
    if (index < 0) return null;
    const times = this.times();
    const newest = times[this.length() - 1];
    const taken = times[index];
    const ago =
      isNumber(newest) && isNumber(taken) && newest >= taken
        ? neatSecondsAgo((newest - taken) / 1000)
        : null;
    const format = this.format();
    const colors = this.colors();
    const rows = this.lines().map((entry, line) => ({
      key: entry.key,
      label: entry.label,
      value: this.describe(entry.values[index], format),
      color: colors[line],
    }));
    return {
      at: this.fractions()[index],
      ago,
      rows,
      spoken: [ago, ...rows.map((row) => `${row.label} ${row.value}`)].filter(Boolean).join(', '),
    };
  });

  private describe(value: number | null | undefined, format: NeatChartFormat): string {
    return isNumber(value) ? format(value) : MISSING;
  }

  protected onPointerMove(event: MouseEvent): void {
    const box = this.plot().nativeElement.getBoundingClientRect();
    if (!box.width) return;
    this.keyIndex.set(null);
    this.pointerAt.set(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)));
  }

  /** The pointer leaving hides what the pointer showed; a sample a key chose stays. */
  protected onPointerLeave(): void {
    this.pointerAt.set(null);
  }

  protected onFocus(): void {
    // A click focuses too, after the pointer has chosen; the pointer's sample is the one to keep.
    if (this.activeIndex() < 0 && this.length()) this.keyIndex.set(this.length() - 1);
  }

  protected onBlur(): void {
    this.keyIndex.set(null);
    this.announcement.set('');
  }

  protected onKeydown(event: KeyboardEvent): void {
    const current = this.activeIndex();
    if (event.key === 'Escape') {
      // Only a visible readout is Escape's to close; otherwise it belongs to whatever holds the chart.
      if (current < 0) return;
      event.preventDefault();
      event.stopPropagation();
      this.pointerAt.set(null);
      this.keyIndex.set(null);
      this.announcement.set('');
      return;
    }
    const next = this.sampleFor(event.key, current);
    if (next === null) return;
    event.preventDefault();
    this.keyIndex.set(next);
    this.announcement.set(this.readout()?.spoken ?? '');
  }

  /** The sample a key moves the readout to, or null for a key the chart does not use. */
  private sampleFor(key: string, current: number): number | null {
    const last = this.length() - 1;
    if (last < 0) return null;
    switch (key) {
      case 'ArrowLeft':
        return current < 0 ? last : Math.max(0, current - 1);
      case 'ArrowRight':
        return current < 0 ? last : Math.min(last, current + 1);
      case 'Home':
        return 0;
      case 'End':
        return last;
      default:
        return null;
    }
  }
}
