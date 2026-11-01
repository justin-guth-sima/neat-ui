import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton, NeatTooltip, type NeatTooltipPosition } from '@sima/neat-ui';

/** A tooltip on each of the four sides of its button; hover a button or focus it with Tab. */
@Component({
  selector: 'app-positions',
  imports: [NeatButton, NeatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
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
})
export class Positions {
  protected readonly positions: readonly NeatTooltipPosition[] = ['top', 'right', 'bottom', 'left'];
}
