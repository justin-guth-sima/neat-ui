import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBadge } from '@sima/neat-ui/badge';

/**
 * A badge in a column narrower than its text. It cuts its text and keeps the column's width, where
 * a list's cell or a bar would otherwise grow.
 */
@Component({
  selector: 'app-narrow-column',
  imports: [NeatBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-narrow-column.example.html',
  styleUrl: './narrow-column.example.css',
})
export class NarrowColumn {}
