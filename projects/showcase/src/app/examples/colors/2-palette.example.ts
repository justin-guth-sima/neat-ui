import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SIMA_PALETTE } from '@sima/neat-ui';

/**
 * Every color of `SIMA_PALETTE`, the brand's fixed palette, with its value under the name.
 */
@Component({
  selector: 'app-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-palette.example.html',
  styleUrl: './swatches.css',
})
export class Palette {
  protected readonly colors = Object.entries(SIMA_PALETTE).map(([name, hex]) => ({ name, hex }));
}
