import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatHeatmap } from '@sima/neat-ui/charts';
import { CORES, percent, TIMES } from './data';

/**
 * The load of sixteen cores over eight minutes. The busiest cores' figures at the ends of their
 * rows are in the warning and danger colors. The card sets `--neat-surface` to its fill, for the
 * labels' halos.
 */
@Component({
  selector: 'app-core-load',
  imports: [NeatHeatmap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <neat-heatmap
        label="Per-core CPU"
        headline="47%"
        [rows]="rows"
        [times]="times"
        [format]="percent"
      />
    </div>
  `,
  styleUrl: './core-load.example.css',
})
export class CoreLoad {
  protected readonly rows = CORES;
  protected readonly times = TIMES;
  protected readonly percent = percent;
}
