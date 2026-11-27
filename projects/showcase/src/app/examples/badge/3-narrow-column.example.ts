import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatStatusChip } from '@sima/neat-ui/status-chip';

/**
 * A chip in a column narrower than its text. It truncates and keeps the column's width, where a
 * list's cell or a bar would otherwise grow.
 */
@Component({
  selector: 'app-narrow-column',
  imports: [NeatStatusChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-narrow-column.example.html',
  styleUrl: './narrow-column.example.css',
})
export class NarrowColumn {}
