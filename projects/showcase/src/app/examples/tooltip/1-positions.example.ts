import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton, NeatTooltip, type NeatTooltipPosition } from '@sima/neat-ui';

/**
 * A tooltip on each of the four sides of its button; hover a button or focus it with Tab.
 *
 * @gallery
 * @animated
 * @play hover .row button:nth-child(1)
 * @play hover .row button:nth-child(2)
 * @play hover .row button:nth-child(3)
 * @play hover .row button:nth-child(4)
 * @play wait 400
 */
@Component({
  selector: 'app-positions',
  imports: [NeatButton, NeatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-positions.example.html',
  styleUrl: './positions.example.css',
})
export class Positions {
  /** Vim's h j k l; the outer tips point away from the row, so no tip covers a neighbor. */
  protected readonly positions: readonly NeatTooltipPosition[] = ['left', 'bottom', 'top', 'right'];
}
