import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatDiagramView, type NeatDiagramSet } from '@sima/neat-ui/diagram';

/** A camera feeding an encoder, and a copy routed by hand round the encoder to the archive. */
const PLACED: NeatDiagramSet = {
  overview: {
    nodes: [
      { id: 'camera', role: 'block', label: 'Camera', x: 0, y: 60, w: 150, h: 46 },
      { id: 'encoder', role: 'block', label: 'Encoder', x: 400, y: 60, w: 150, h: 46 },
      { id: 'archive', role: 'block', label: 'Archive', x: 800, y: 60, w: 150, h: 46 },
    ],
    edges: [
      {
        id: 'frames',
        from: 'camera',
        to: 'encoder',
        series: 1,
        label: 'raw frames, 1080p at 30 fps',
        labelSide: 'below',
      },
      { id: 'stream', from: 'encoder', to: 'archive', series: 2, label: 'H.264' },
      {
        id: 'copy',
        from: 'camera',
        to: 'archive',
        series: 3,
        label: 'untouched copy',
        labelSide: 'above',
        fromSide: 'top',
        toSide: 'top',
        fromAt: 0.75,
        toAt: 0.25,
        via: [
          { x: 112.5, y: 0 },
          { x: 837.5, y: 0 },
        ],
      },
    ],
  },
};

/**
 * What an app places itself, where the kit's routing is not what it wants: - an edge's label beside
 * its line (`labelSide`), here below a long one, so it keeps the line's height free; - an end
 * pinned along its side (`fromAt`, `toAt`); - a route through corners of the app's (`via`), here
 * over the Encoder, from the Camera's top to the Archive's.
 *
 * Labels, the end markers, hover and the messages follow the route, as they do the kit's own.
 */
@Component({
  selector: 'app-placed-by-the-app',
  imports: [NeatDiagramView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<neat-diagram
    class="diagram"
    [diagram]="placed"
    label="Edges placed by the app"
    highlight="edges"
  />`,
  styleUrl: './diagram-box.css',
})
export class PlacedByTheApp {
  protected readonly placed = PLACED;
}
