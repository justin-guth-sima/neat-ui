import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev } from '@sima/neat-ui/bev';
import { streetFrames } from './scene';

/**
 * The square view: a metric grid that fills a wide box, labelled along its top and left edges.
 * The range is the distance to the nearer edge, here 40 m above and below the vehicle; the wider
 * sides show further. No spokes.
 */
@Component({
  selector: 'app-square',
  imports: [NeatBev],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<neat-bev class="wide" shape="square" [range]="40" [spokes]="0" [frame]="frame()" />`,
  styleUrl: './bev.example.css',
})
export class Square {
  protected readonly frame = streetFrames();
}
