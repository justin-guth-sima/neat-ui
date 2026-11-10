import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NEAT_HIGHLIGHT_BASE, SIMA_PALETTE } from '@sima/neat-ui';
import { NeatBev } from '@sima/neat-ui/bev';
import type { NeatOverlayClassStyle } from '@sima/neat-ui/video';
import { streetFrames } from './scene';

/**
 * Style rows set a label's color, line and width, as a video tile's class rows do: give the same
 * rows to the tiles' settings and to the view, and a class looks the same in both. Here the
 * drivable area takes the brand's blue, the planned path its green, thick, the lane markings a
 * thick dotted line in the kit's purple (the palette's own is too pale to read on the road), and the `default` row draws every other label in orange, so
 * the street reads in the brand's colors instead of the page's class colors.
 */
@Component({
  selector: 'app-shared-styles',
  imports: [NeatBev],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<neat-bev [frame]="frame()" [styles]="styles" [range]="40" />`,
  styleUrl: './bev.example.css',
})
export class SharedStyles {
  protected readonly frame = streetFrames();
  protected readonly styles: readonly NeatOverlayClassStyle[] = [
    { label: 'drivable area', color: SIMA_PALETTE.blue, style: 'solid', width: 1 },
    { label: 'planned path', color: SIMA_PALETTE.green, style: 'solid', width: 3 },
    { label: 'lane marking', color: NEAT_HIGHLIGHT_BASE, style: 'dotted', width: 3 },
    { label: 'default', color: SIMA_PALETTE.orange, style: 'solid', width: 1 },
  ];
}
