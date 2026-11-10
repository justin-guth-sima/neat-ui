import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SIMA_PALETTE } from '@sima/neat-ui';

/**
 * Every color of `SIMA_PALETTE`, the brand's fixed palette, with its value under the name.
 */
@Component({
  selector: 'app-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ramp">
      @for (color of colors; track color.name) {
        <div>
          <div class="chip" [style.background]="color.hex"></div>
          <div class="name">{{ color.name }}</div>
          <div class="showcase-code showcase-muted">{{ color.hex }}</div>
        </div>
      }
    </div>
  `,
  styleUrl: './swatches.css',
})
export class Palette {
  protected readonly colors = Object.entries(SIMA_PALETTE).map(([name, hex]) => ({ name, hex }));
}
