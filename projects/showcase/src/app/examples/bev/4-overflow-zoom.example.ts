import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev } from '@sima/neat-ui/bev';
import { streetFrames } from './scene';

/**
 * The same two views with `zoom`: scroll or pinch to zoom, drag to pan, and reset with the button
 * that then shows. With overflow visible the view pans over the whole box the default view shows,
 * not only the shape's square, so the street beside the range stays in reach.
 */
@Component({
  selector: 'app-overflow-zoom',
  imports: [NeatBev],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <neat-bev
        class="wide"
        shape="rect"
        overflow="visible"
        zoom
        [outline]="false"
        [range]="40"
        [spokes]="0"
        [frame]="frame()"
      />
      <neat-bev
        class="wide"
        overflow="visible"
        zoom
        [outline]="false"
        [range]="30"
        [frame]="frame()"
      />
    </div>
  `,
  styleUrl: './bev.example.css',
})
export class OverflowZoom {
  protected readonly frame = streetFrames();
}
