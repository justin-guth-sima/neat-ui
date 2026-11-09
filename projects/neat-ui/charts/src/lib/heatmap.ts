import { ɵREADOUT_CLASSES } from '@sima/neat-ui';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { chartName, timeAxis } from './frame';
import { isNumber } from './geometry';
import { columnMeans, NEAT_HEATMAP_COLUMNS, newestInColumn } from './heatmap-columns';
import { textToken } from './line-token';
import { describe, fractionAcross, ReadoutCursor, whenText } from './readout';
import type { NeatChartFormat, NeatChartTone } from './types';

/** One row of a heatmap: its samples become the cells, and `end` is the figure beside them. */
export interface NeatHeatmapRow {
  readonly key: string;
  /** Names the row on screen and in the readout. */
  readonly label: string;
  /** The row's samples, oldest first, each as long as `times`; `null` for one that was not taken. */
  readonly values: readonly (number | null)[];
  /** The figure at the row's end as the app words it, such as a one-minute average. */
  readonly end: string;
  /** The colour of `end`: the foreground, or the warning or danger line colour (text strength in both). */
  readonly endTone: NeatChartTone;
}

/** A cell the cursor can be on: a row, and a column of that row's cells. */
interface Cell {
  readonly row: number;
  readonly column: number;
}

/** The cell under the pointer, kept as the row it is over and a place across it, not a column. */
interface Pointer {
  readonly row: number;
  readonly fraction: number;
}

/** What a cell reads out: its row, how long ago, and its mean, as the readout shows and says them. */
interface CellReadout extends Cell {
  /** The cell's place across its row, 0 to 1, for the readout to stand beside. */
  readonly at: number;
  readonly head: string;
  readonly value: string;
}

/**
 * Several metrics over time as rows of coloured cells, such as the load of each core:
 *
 * ```html
 * <neat-heatmap
 *   label="Per-core CPU"
 *   headline="34%"
 *   [rows]="cores"
 *   [times]="times"
 *   [format]="percent"
 * />
 * ```
 *
 * A row's samples are split into at most 48 columns of time, each cell the mean of its samples;
 * `times` (ms, oldest first) place them, so a pause in the polling stays an empty stretch, and a
 * history shorter than the columns gets one column per sampling interval. A cell mixes
 * `--neat-heat-low` and `--neat-heat-high` by where its value lies in `domain` (0 to 100 by
 * default, clamped); an empty cell is transparent. A ramp in the head shows the domain's two
 * ends, worded by `format`. A row is 1.5 rem tall, with its label before the cells and `end`,
 * in the colour of its tone, after them.
 *
 * The grid is one tab stop named "<label>: <headline>, over the last <window>". Its readout,
 * which the pointer shows over a cell and the keys over the cursor's, reads "<row label> · <how
 * long ago the column's newest sample was>: <mean> average". The arrow keys move the cursor
 * (Left and Right by column, Up and Down by row), Home and End go to the ends of its row, and
 * Escape hides the readout. Like the time chart's, each key press, and only a key press, is
 * repeated in a polite live region.
 */
@Component({
  selector: 'neat-heatmap',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let active = cursor.active();
    <div class="head">
      <span class="title">{{ label() }}</span>
      @if (headline()) {
        <span class="headline">{{ headline() }}</span>
      }
      <span class="scale" aria-hidden="true">
        <span>{{ scaleStart() }}</span>
        <span class="ramp"></span>
        <span>{{ scaleEnd() }}</span>
      </span>
    </div>
    <div
      class="grid"
      tabindex="0"
      role="group"
      aria-roledescription="heatmap"
      [attr.aria-label]="name()"
      [style.--rows]="shown().length"
      [style.--columns]="columns()"
      (pointerleave)="cursor.pointerLeave()"
      (focus)="cursor.focus()"
      (blur)="cursor.blur()"
      (keydown)="cursor.keydown($event)"
    >
      @for (row of shown(); track row.key; let r = $index) {
        <span class="name">{{ row.label }}</span>
        <div class="cells" (pointermove)="onPointerMove($event, r)">
          @for (fill of row.fills; track $index; let c = $index) {
            <span
              class="cell"
              [style.--cell]="fill"
              [attr.data-cursor]="active?.row === r && active?.column === c ? '' : null"
            ></span>
          }
          @if (readout(); as readout) {
            @if (readout.row === r) {
              <span
                class="readout"
                [class]="readoutClasses.box"
                aria-hidden="true"
                [attr.data-flip]="readout.at > 0.5 ? '' : null"
                [style.--at]="readout.at"
              >
                <span class="when" [class]="readoutClasses.muted">{{ readout.head }}</span>
                <span class="row" [class]="readoutClasses.row">{{ readout.value }}</span>
              </span>
            }
          }
        </div>
        <span class="end" [style.--tone]="row.tone">{{ row.end }}</span>
      }
      @if (shown().length) {
        <span></span>
        <div class="axis" aria-hidden="true">
          @for (tick of axis(); track tick.at) {
            <span [style.--at]="tick.at">{{ tick.text }}</span>
          }
        </div>
        <span></span>
      }
    </div>
    <span class="sr-only" aria-live="polite">{{ cursor.announcement() }}</span>
  `,
  styleUrls: ['./chart-frame.css', './readout.css', './heatmap.css'],
})
export class NeatHeatmap {
  /** The kit's one readout look, shared with the other charts and the bird's-eye view. */
  protected readonly readoutClasses = ɵREADOUT_CLASSES;

  /** The heatmap's title, which also names it for assistive technology. */
  readonly label = input.required<string>();
  /** The overall value as the app words it, beside the title and in the accessible name. */
  readonly headline = input('');
  /** The rows, top first. */
  readonly rows = input.required<readonly NeatHeatmapRow[]>();
  /** When each sample was taken, in ms, oldest first; `null` for one without a time. */
  readonly times = input<readonly (number | null)[]>([]);
  /** The values the colour ramp spans, lowest and highest: fixed by the app, so a colour keeps its meaning. */
  readonly domain = input<readonly [number, number]>([0, 100]);
  /** Words a value with its unit, for the ramp's ends and the readout. */
  readonly format = input<NeatChartFormat>(String);

  /** Each row's cells: the mean of every column, and the fill that mean's place in the domain gives. */
  private readonly cells = computed(() => {
    const times = this.times();
    return this.rows().map((row) => columnMeans(row.values, NEAT_HEATMAP_COLUMNS, times));
  });

  protected readonly shown = computed(() => {
    const domain = this.domain();
    const cells = this.cells();
    return this.rows().map((row, index) => ({
      key: row.key,
      label: row.label,
      end: row.end,
      tone: textToken(row.endTone),
      fills: cells[index].map((mean) => fillOf(mean, domain)),
    }));
  });

  /** The widest row's columns: the rows share the grid's tracks. */
  protected readonly columns = computed(() =>
    Math.max(0, ...this.cells().map((cells) => cells.length)),
  );

  /** The samples in the longest row, which is how much of `times` the heatmap shows. */
  private readonly length = computed(() =>
    Math.max(0, ...this.rows().map((row) => row.values.length)),
  );

  protected readonly scaleStart = computed(() => this.format()(this.domain()[0]));
  protected readonly scaleEnd = computed(() => this.format()(this.domain()[1]));
  protected readonly axis = computed(() => timeAxis(this.times(), this.length()));

  protected readonly name = computed(() =>
    chartName(this.label(), this.headline(), this.times(), this.length()),
  );

  protected readonly cursor = new ReadoutCursor<Pointer, Cell>({
    under: (pointer) => {
      const row = Math.min(this.rows().length - 1, pointer.row);
      const count = this.cells()[row]?.length ?? 0;
      return count
        ? { row, column: Math.min(count - 1, Math.floor(pointer.fraction * count)) }
        : null;
    },
    fit: (cell) => {
      const row = Math.min(this.rows().length - 1, cell.row);
      const count = this.cells()[row]?.length ?? 0;
      return count ? { row, column: Math.min(count - 1, cell.column) } : null;
    },
    start: () => this.newestOf(0),
    after: (key, current) => this.cellAfter(key, current),
    spoken: (cell) => {
      const { head, value } = this.readoutFor(cell);
      return `${head}: ${value}`;
    },
  });

  protected readonly readout = computed((): CellReadout | null => {
    const cell = this.cursor.active();
    return cell === null ? null : this.readoutFor(cell);
  });

  /** The newest cell of a row, or null while it has none. */
  private newestOf(row: number): Cell | null {
    const count = this.cells()[row]?.length ?? 0;
    return count ? { row, column: count - 1 } : null;
  }

  /**
   * Where a key moves the cursor, or null for a key the heatmap does not use. Hidden, an arrow
   * brings the cursor up at the newest cell of the first row, and Home and End go to that row's ends.
   */
  private cellAfter(key: string, current: Cell | null): Cell | null {
    const cells = this.cells();
    const row = current?.row ?? 0;
    const count = cells[row]?.length ?? 0;
    if (!count) return null;
    switch (key) {
      case 'Home':
        return { row, column: 0 };
      case 'End':
        return { row, column: count - 1 };
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
        return current === null ? this.newestOf(0) : this.step(key, current);
      default:
        return null;
    }
  }

  /** One step of an arrow key from `from`, stopping at the edges. */
  private step(key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown', from: Cell): Cell {
    const cells = this.cells();
    /** The same column of another row, held to that row's columns. */
    const inRow = (row: number): Cell => ({
      row,
      column: Math.min(from.column, Math.max(0, cells[row].length - 1)),
    });
    switch (key) {
      case 'ArrowLeft':
        return { row: from.row, column: Math.max(0, from.column - 1) };
      case 'ArrowRight':
        return { row: from.row, column: Math.min(cells[from.row].length - 1, from.column + 1) };
      case 'ArrowUp':
        return inRow(Math.max(0, from.row - 1));
      case 'ArrowDown':
        return inRow(Math.min(cells.length - 1, from.row + 1));
    }
  }

  private readoutFor({ row, column }: Cell): CellReadout {
    const { label, values } = this.rows()[row];
    const means = this.cells()[row];
    const mean = means[column];
    const newest = newestInColumn(column, values.length, means.length, this.times());
    const when = newest < 0 ? null : whenText(this.times(), values.length, newest);
    return {
      row,
      column,
      at: (column + 0.5) / means.length,
      head: when ? `${label} · ${when}` : label,
      value: isNumber(mean) ? `${describe(mean, this.format())} average` : 'no data',
    };
  }

  protected onPointerMove(event: MouseEvent, row: number): void {
    const fraction = fractionAcross(event, event.currentTarget as HTMLElement);
    if (fraction !== null) this.cursor.pointerTo({ row, fraction });
  }
}

/** The fill of a cell: the heat tokens mixed by the mean's place in the domain, or none for an empty cell. */
function fillOf(mean: number | null, domain: readonly [number, number]): string {
  if (!isNumber(mean)) return 'transparent';
  const [low, high] = domain;
  const place = high > low ? (mean - low) / (high - low) : 0;
  const percent = Number((Math.min(1, Math.max(0, place)) * 100).toFixed(2));
  return `color-mix(in oklab, var(--neat-heat-high) ${percent}%, var(--neat-heat-low))`;
}
