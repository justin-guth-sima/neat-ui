import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatPage } from '@sima/neat-ui';
import {
  type NeatDiagramSet,
  NeatDiagramNoteTemplate,
  NeatDiagramView,
} from '@sima/neat-ui/diagram';

/**
 * A model graph (the reference sheet's third example): a backbone frame holding two blocks, one
 * of which opens a level, edges with tensor shapes as labels, a bracket under the post-processing
 * and a note on an edge. Placed with a margin, as the diagram draws at zoom 1 from its origin.
 */
const MODEL_GRAPH: NeatDiagramSet = {
  overview: {
    nodes: [
      {
        id: 'input',
        role: 'block',
        label: 'Input',
        outSide: 'bottom',
        x: 204,
        y: 24,
        w: 140,
        h: 44,
      },
      {
        id: 'backbone',
        role: 'frame',
        look: 'dashed',
        label: 'Backbone',
        detail: 'CSPDarknet',
        x: 24,
        y: 120,
        w: 380,
        h: 150,
      },
      {
        id: 'stem',
        role: 'block',
        label: 'Stem',
        chips: [{ label: 'MLA', tone: 'info' }],
        inSide: 'top',
        parent: 'backbone',
        x: 20,
        y: 84,
        w: 140,
        h: 44,
      },
      {
        id: 'stages',
        role: 'block',
        label: 'Stages',
        chips: [{ label: 'MLA', tone: 'info' }],
        opens: 'stages',
        outSide: 'bottom',
        parent: 'backbone',
        x: 210,
        y: 84,
        w: 150,
        h: 44,
      },
      {
        id: 'head',
        role: 'block',
        label: 'Head',
        chips: [{ label: 'MLA', tone: 'info' }],
        inSide: 'top',
        x: 24,
        y: 330,
        w: 150,
        h: 44,
      },
      {
        id: 'nms',
        role: 'block',
        label: 'Decode + NMS',
        chips: [{ label: 'EV74', tone: 'highlight' }],
        x: 340,
        y: 330,
        w: 190,
        h: 44,
      },
      {
        id: 'boxes',
        role: 'block',
        label: 'Boxes',
        detail: 'to the tracker',
        x: 640,
        y: 330,
        w: 140,
        h: 44,
      },
      {
        id: 'post',
        role: 'bracket',
        label: 'Post-process',
        detail: '3.1 ms',
        x: 24,
        y: 384,
        w: 506,
        h: 44,
      },
    ],
    edges: [
      { id: 'input-stem', from: 'input', to: 'stem', series: 1, label: '1×3×640×640' },
      { id: 'stem-stages', from: 'stem', to: 'stages', series: 1 },
      { id: 'stages-head', from: 'stages', to: 'head', series: 1 },
      { id: 'head-nms', from: 'head', to: 'nms', series: 4, label: '3 × 1×85×80²' },
      { id: 'nms-boxes', from: 'nms', to: 'boxes', series: 3, line: 'dashed', start: 'dot' },
    ],
    notes: [{ id: 'stages-time', edges: ['stages-head'], dx: 250, dy: 8 }],
  },
  levels: { stages: { nodes: [], edges: [] } },
};

@Component({
  selector: 'app-diagram-page',
  imports: [NeatDiagramNoteTemplate, NeatDiagramView, NeatPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Diagram</h2>
          <p class="showcase-muted">
            <code>neat-diagram</code> draws a hand-placed level: frames and bands behind one SVG of
            routed edges, blocks, brackets, edge labels and notes in front of it. Edges take the
            charts' series colours; chips are the kit's status chips; a note's content is the app's
            template.
          </p>
          <neat-diagram class="diagram" [diagram]="modelGraph" label="A detector's model graph">
            <ng-template neatDiagramNote let-note>
              @if (note.id === 'stages-time') {
                <b>Stages → Head</b><br />24.0 ms · 3 outputs
              }
            </ng-template>
          </neat-diagram>
        </section>
      </div>
    </neat-page>
  `,
  styleUrl: './diagram.page.css',
})
export class DiagramPage {
  protected readonly modelGraph = MODEL_GRAPH;
}
