import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SIMA_PALETTE } from '@sima/neat-ui';

/**
 * Every colour of `SIMA_PALETTE`, the brand's fixed palette, with its value under the name.
 */
@Component({
  selector: 'app-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ramp">
      @for (colour of colours; track colour.name) {
        <div>
          <div class="chip" [style.background]="colour.hex"></div>
          <div class="name">{{ colour.name }}</div>
          <div class="showcase-code showcase-muted">{{ colour.hex }}</div>
        </div>
      }
    </div>
  `,
  styleUrl: './swatches.css',
})
export class Palette {
  protected readonly colours = Object.entries(SIMA_PALETTE).map(([name, hex]) => ({ name, hex }));
}
