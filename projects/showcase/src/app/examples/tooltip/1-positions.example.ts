import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton, NeatTooltip, type NeatTooltipPosition } from '@sima/neat-ui';

/**
 * A tooltip on each of the four sides of its button; hover a button or focus it with Tab.
 *
 * @capture hover button
 */
@Component({
  selector: 'app-positions',
  imports: [NeatButton, NeatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      @for (position of positions; track position) {
        <button
          neatButton
          type="button"
          variant="outlined"
          [neatTooltip]="'Tooltip on the ' + position"
          [neatTooltipPosition]="position"
        >
          {{ position }}
        </button>
      }
    </div>
  `,
  styleUrl: './positions.example.css',
})
export class Positions {
  /** Vim's h j k l; the outer tips point away from the row, so no tip covers a neighbor. */
  protected readonly positions: readonly NeatTooltipPosition[] = ['left', 'bottom', 'top', 'right'];
}
