import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatDiagramView, type NeatDiagramSet } from '@sima/neat-ui/diagram';

/** Two blocks on a row, joined twice over their tops, and twice back behind the first. */
const LOOPS: NeatDiagramSet = {
  overview: {
    nodes: [
      { id: 'camera', role: 'block', label: 'Camera', x: 0, y: 80, w: 150, h: 46 },
      { id: 'encoder', role: 'block', label: 'Encoder', x: 300, y: 80, w: 150, h: 46 },
      { id: 'recorder', role: 'block', label: 'Recorder', x: 0, y: 240, w: 150, h: 46 },
    ],
    edges: [
      { id: 'frames', from: 'camera', to: 'encoder', series: 1, fromSide: 'top', toSide: 'top' },
      { id: 'stats', from: 'camera', to: 'encoder', series: 2, fromSide: 'top', toSide: 'top' },
      {
        id: 'video',
        from: 'encoder',
        to: 'recorder',
        series: 3,
        fromSide: 'right',
        toSide: 'left',
      },
      {
        id: 'index',
        from: 'encoder',
        to: 'recorder',
        series: 4,
        fromSide: 'right',
        toSide: 'left',
      },
    ],
  },
};

/**
 * Edges that share a loop are drawn as parallel offsets of one another, so their runs never lie
 * on one another and none crosses another. Above, two edges leave the Camera's top and enter the
 * Encoder's top: their ports nest, and the outer one turns higher. Below, two edges leave the
 * Encoder's right side for the Recorder's left, which lies behind it: each takes the longer stub
 * at one end and the shorter at the other, and their runs back across lie apart.
 */
@Component({
  selector: 'app-parallel-loops',
  imports: [NeatDiagramView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<neat-diagram class="diagram" [diagram]="loops" label="Edges that share a loop" />`,
  styleUrl: './diagram-box.css',
})
export class ParallelLoops {
  protected readonly loops = LOOPS;
}
