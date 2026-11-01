import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatStatusChip } from '@sima/neat-ui/status-chip';

/**
 * A chip in a column narrower than its text: it truncates and keeps the column's width, where a
 * list's cell or a bar would otherwise grow.
 */
@Component({
  selector: 'app-narrow-column',
  imports: [NeatStatusChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="column">
      <neat-status-chip tone="highlight"
        >External publisher on a very narrow column</neat-status-chip
      >
    </div>
  `,
  styleUrl: './narrow-column.example.css',
})
export class NarrowColumn {}
