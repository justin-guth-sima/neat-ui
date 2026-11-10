import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev, type NeatBevBounds } from '@sima/neat-ui/bev';
import { streetFrames } from './scene';

/**
 * The same two views with `zoom`, starting closer in, at a 25 m range.
 *
 * `panBounds` reaches 60 m all around, so dragging reaches the whole street, the far end of the
 * road ahead too. `zoomExtent` lets the view zoom out to half the default, as well as in to four
 * times it.
 *
 * Try scrolling or pinching to zoom, then reset with the button that shows.
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
        [panBounds]="reach"
        [zoomExtent]="[0.5, 4]"
        [outline]="false"
        [range]="25"
        [spokes]="0"
        [frame]="frame()"
      />
      <neat-bev
        class="wide"
        overflow="visible"
        zoom
        [panBounds]="reach"
        [zoomExtent]="[0.5, 4]"
        [outline]="false"
        [range]="25"
        [frame]="frame()"
      />
    </div>
  `,
  styleUrl: './bev.example.css',
})
export class OverflowZoom {
  protected readonly frame = streetFrames();
  protected readonly reach: NeatBevBounds = { x: [-60, 60], y: [-60, 60] };
}
