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
 */
@Component({
  selector: 'app-shared-crosshair',
  imports: [NeatButton, NeatHeatmap, NeatLabelTimeline, NeatStackedChart, NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dashboard">
      <div class="chart-card">
        <neat-time-chart
          label="CPU"
          [series]="cpu"
          [times]="times"
          [domain]="[0, 100]"
          [format]="percent"
          [(hovered)]="moment"
          (activated)="clicked.set('CPU at ' + when($event.time))"
        />
      </div>
      <div class="chart-card">
        <neat-stacked-chart
          label="Clusters"
          [series]="clusters"
          [times]="times"
          [domain]="[0, 220]"
          [format]="percent"
          [(hovered)]="moment"
          (activated)="clicked.set('Clusters at ' + when($event.time))"
        />
      </div>
      <div class="chart-card">
        <neat-heatmap
          label="Cores"
          [rows]="rows"
          [times]="times"
          [format]="percent"
          [hovered]="cell()"
          (hoveredChange)="onCell($event)"
          (activated)="clicked.set($event.row + ' at ' + when($event.time))"
        />
      </div>
      <div class="chart-card">
        <neat-label-timeline
          label="Board state"
          [runs]="runs"
          [nowMs]="end"
          [windowMs]="end - start"
          [(hovered)]="moment"
          (activated)="clicked.set(($event.run?.label ?? 'nothing') + ' at ' + when($event.time))"
        />
      </div>
      <div class="chart-card report">
        <dl>
          <dt>Moment</dt>
          <dd>{{ momentText() }}</dd>
          <dt>Last click</dt>
          <dd>{{ clicked() }}</dd>
        </dl>
        <div class="actions">
          <button
            neatButton
            type="button"
            size="small"
            variant="secondary"
            (click)="moment.set(start + 120_000)"
          >
            Show 12:02
          </button>
          <button
            neatButton
            type="button"
            size="small"
            variant="secondary"
            (click)="moment.set(end)"
          >
            Show the newest
          </button>
          <button
            neatButton
            type="button"
            size="small"
            variant="outlined"
            (click)="moment.set(null)"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  `,
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
