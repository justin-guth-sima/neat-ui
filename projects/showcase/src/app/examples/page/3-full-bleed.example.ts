import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatPage } from '@sima/neat-ui';

/**
 * Content that reaches the page's edges. `padding="none"` drops the page's inset, and
 * `scroll="none"` leaves nothing to scroll. So the grid sizes itself to the page, as a video grid
 * that fits the screen does.
 *
 * @page
 */
@Component({
  selector: 'app-full-bleed',
  imports: [NeatPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page padding="none" scroll="none">
      <div class="grid">
        @for (tile of tiles; track tile) {
          <div class="tile">Tile {{ tile }}</div>
        }
      </div>
    </neat-page>
  `,
  styleUrl: './full-bleed.example.css',
})
export class FullBleed {
  protected readonly tiles = Array.from({ length: 6 }, (_, index) => index + 1);
}
