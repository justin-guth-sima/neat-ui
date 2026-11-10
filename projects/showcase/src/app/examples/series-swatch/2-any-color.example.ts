import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatSwatch, SIMA_PALETTE } from '@sima/neat-ui';

/**
 * `neat-swatch` shows any color, with the series swatch's look: here a legend of the classes an
 * app draws in colors of its own (the same rows it gives the video tiles and the bird's-eye
 * view as `styles`), so the legend matches the boxes.
 */
@Component({
  selector: 'app-any-color',
  imports: [NeatSwatch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="chips" aria-label="Classes">
      @for (row of classes; track row.label) {
        <li><neat-swatch [color]="row.color" />{{ row.label }}</li>
      }
    </ul>
  `,
  styleUrl: './run-chips.example.css',
})
export class AnyColor {
  protected readonly classes = [
    { label: 'car', color: SIMA_PALETTE.blue },
    { label: 'pedestrian', color: SIMA_PALETTE.orange },
    { label: 'bicycle', color: SIMA_PALETTE.green },
  ];
}
