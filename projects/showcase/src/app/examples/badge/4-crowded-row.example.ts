import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBadge } from '@sima/neat-ui/badge';

/**
 * Badges in a row narrower than they are, as in a video tile's bar beside the stream's name. Each
 * badge gives up width and cuts its text, so the row keeps its width.
 */
@Component({
  selector: 'app-crowded-row',
  imports: [NeatBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './4-crowded-row.example.html',
  styleUrl: './crowded-row.example.css',
})
export class CrowdedRow {}
