import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { type NeatHeatmapCell, type NeatHeatmapPick, NeatHeatmap } from '@sima/neat-ui/charts';
import { CORES, percent, TIMES } from './data';

/** A moment as the card says it: the time of day, in UTC like the demo's data. */
const clock = (time: number) => new Date(time).toISOString().slice(11, 19);

/**
 * The app reads the heatmap and sets it.
 *
 * - `hovered` is the cell the readout is on, by its row's key and its column's time: the pointer's
 *   or the keys' cell, or one the app sets.
 * - `activated` reports a click or Enter, with the cell's row, time and mean.
 *
 * The card shows both. Its button points the heatmap at the saturated core's newest cell.
 *
 * @unpictured
 */
@Component({
  selector: 'app-heatmap-from-the-app',
  imports: [NeatButton, NeatHeatmap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="beside">
      <div class="card">
        <neat-heatmap
          label="Per-core CPU"
          [rows]="rows"
          [times]="times"
          [format]="percent"
          [(hovered)]="cell"
          (activated)="picked.set($event)"
        />
      </div>
      <div class="report">
        <dl>
          <dt>Hovered</dt>
          <dd>{{ cellText() }}</dd>
          <dt>Last click</dt>
          <dd>{{ pickedText() }}</dd>
        </dl>
        <div class="actions">
          <button neatButton type="button" size="small" variant="secondary" (click)="showBusiest()">
            Show core 15 now
          </button>
          <button neatButton type="button" size="small" variant="outlined" (click)="cell.set(null)">
            Clear
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./core-load.example.css', './report.example.css'],
})
export class HeatmapFromTheApp {
  protected readonly rows = CORES;
  protected readonly times = TIMES;
  protected readonly percent = percent;
  protected readonly cell = signal<NeatHeatmapCell | null>(null);
  protected readonly picked = signal<NeatHeatmapPick | null>(null);

  protected readonly cellText = computed(() => {
    const cell = this.cell();
    return cell ? `${cell.row} at ${clock(cell.time)}` : 'None';
  });

  protected readonly pickedText = computed(() => {
    const pick = this.picked();
    if (!pick) return 'None yet';
    const value = pick.value === null ? 'no data' : percent(pick.value);
    return `${pick.row}${pick.time === null ? '' : ` at ${clock(pick.time)}`}: ${value}`;
  });

  protected showBusiest(): void {
    this.cell.set({ row: 'core15', time: TIMES[TIMES.length - 1] });
  }
}
