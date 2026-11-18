import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import {
  type NeatHeatmapCell,
  type NeatHeatmapRow,
  NeatHeatmap,
  type NeatLabelRun,
  NeatLabelTimeline,
  NeatStackedChart,
  NeatTimeChart,
} from '@sima/neat-ui/charts';
import { CLUSTERS, CORES, CPU, percent, TIMES } from './data';

/** The board's state over the eight minutes, as a classifier of its own would report it. */
const STATES = ['idle', 'warm-up', 'inference', 'idle', 'inference', 'cool-down'];
const START = TIMES[0];
const END = TIMES[TIMES.length - 1];
const RUNS: readonly NeatLabelRun[] = STATES.map((label, index) => ({
  label,
  startMs: START + ((END - START) * index) / STATES.length,
  endMs: START + ((END - START) * (index + 1)) / STATES.length,
}));

/** Six of the cores as heatmap rows, from the same samples as the chart above them. */
const ROWS: readonly NeatHeatmapRow[] = CORES.slice(0, 6).map((core) => ({
  key: core.key,
  label: core.label,
  values: core.values,
  end: '',
  endTone: 'default',
}));

/** A moment as the card says it: the time of day, in UTC like the demo's data. */
const clock = (time: number) => new Date(time).toISOString().slice(11, 19);

/**
 * One moment, shared between charts.
 *
 * The time chart, the stacked chart and the label timeline bind one signal to `hovered`. So
 * hovering any of them shows the same moment on all three, each at its nearest sample, or the run
 * covering it.
 *
 * The heatmap names a cell: its row and a time. The app keeps the row it was last on, so the
 * heatmap follows the shared moment too.
 *
 * The card shows the moment, and the last click on any of the charts. Its buttons set the moment
 * from outside.
 *
 * @animated
 * @play hover at 20%,50% .plot
 * @play hover at 55%,50% .plot
 * @play hover at 85%,50% .plot
 * @play wait 400
 */
@Component({
  selector: 'app-shared-crosshair',
  imports: [NeatButton, NeatHeatmap, NeatLabelTimeline, NeatStackedChart, NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './8-shared-crosshair.example.html',
  styleUrls: ['./chart-card.css', './shared-crosshair.example.css'],
})
export class SharedCrosshair {
  protected readonly cpu = CPU;
  protected readonly clusters = CLUSTERS;
  protected readonly rows = ROWS;
  protected readonly runs = RUNS;
  protected readonly times = TIMES;
  protected readonly start = START;
  protected readonly end = END;
  protected readonly percent = percent;

  /** The moment every chart shows, or null for none. */
  protected readonly moment = signal<number | null>(null);
  /** The heatmap row the pointer was last on, where the heatmap shows the shared moment. */
  private readonly row = signal(ROWS[0].key);
  protected readonly clicked = signal('None yet');

  protected readonly cell = computed((): NeatHeatmapCell | null => {
    const time = this.moment();
    return time === null ? null : { row: this.row(), time };
  });

  protected readonly momentText = computed(() => {
    const time = this.moment();
    return time === null ? 'None' : clock(time);
  });

  protected onCell(cell: NeatHeatmapCell | null): void {
    if (cell) this.row.set(cell.row);
    this.moment.set(cell?.time ?? null);
  }

  protected when(time: number | null): string {
    return time === null ? 'an unknown time' : clock(time);
  }
}
