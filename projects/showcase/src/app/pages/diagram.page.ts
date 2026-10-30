import { ChangeDetectionStrategy, Component, computed, signal, viewChild } from '@angular/core';
import { NeatButton, NeatIcon, NeatPage, NeatPageToolbar } from '@sima/neat-ui';
import {
  type NeatDiagramSet,
  NeatDiagramEdgeTipTemplate,
  NeatDiagramNoteTemplate,
  NeatDiagramView,
} from '@sima/neat-ui/diagram';

/**
 * A model graph (the reference sheet's third example): a backbone frame holding two blocks, one
 * of which (Stages) opens a level of its own, edges with tensor shapes as labels, a bracket under
 * the post-processing and a note on an edge. The diagram fits each level to its box, so where a
 * level starts does not matter.
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
  levels: {
    stages: {
      nodes: [
        {
          id: 'stages-frame',
          role: 'frame',
          look: 'dashed',
          label: 'Stages',
          detail: 'CSPDarknet, four stages',
          x: 0,
          y: 0,
          w: 1000,
          h: 140,
        },
        ...(['Dark2', 'Dark3', 'Dark4', 'Dark5'] as const).map((label, i) => ({
          id: label.toLowerCase(),
          role: 'block' as const,
          label,
          chips: [{ label: 'MLA', tone: 'info' as const }],
          parent: 'stages-frame',
          x: 20 + i * 270,
          y: 72,
          w: 150,
          h: 44,
        })),
      ],
      edges: [
        { id: 'dark2-dark3', from: 'dark2', to: 'dark3', series: 1, label: '1×128×160²' },
        { id: 'dark3-dark4', from: 'dark3', to: 'dark4', series: 1, label: '1×256×80²' },
        { id: 'dark4-dark5', from: 'dark4', to: 'dark5', series: 1, label: '1×512×40²' },
      ],
    },
  },
};

/** What the tip of an edge says, by its id; an edge without one shows no tip. */
const EDGE_TIPS: Readonly<Record<string, string>> = {
  'input-stem': 'The camera frame, letterboxed to 640 × 640',
  'stages-head': 'Three feature maps, at strides 8, 16 and 32',
  'head-nms': 'Boxes, objectness and 80 class scores per cell',
  'dark4-dark5': 'The deepest stage: the coarsest map, the widest view',
};

@Component({
  selector: 'app-diagram-page',
  imports: [
    NeatButton,
    NeatDiagramEdgeTipTemplate,
    NeatDiagramNoteTemplate,
    NeatDiagramView,
    NeatIcon,
    NeatPage,
    NeatPageToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *neatPageToolbar>
      <button neatButton type="button" variant="text" size="small" (click)="diagram()?.fit()">
        <neat-icon name="fit-all" [size]="16" />
        Fit
      </button>
    </div>
    <neat-page>
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Diagram</h2>
          <p class="showcase-muted">
            <code>neat-diagram</code> draws a hand-placed level: frames and bands behind one SVG of
            routed edges, blocks, brackets, edge labels and notes in front of it. Edges take the
            charts' series colours; chips are the kit's status chips; a note's content is the app's
            template. Drag, wheel, pinch or double-click to pan and zoom, or focus it and use the
            arrow keys, <kbd>+</kbd>, <kbd>-</kbd> and <kbd>0</kbd>; it fits itself to its box until
            you do, and the toolbar's Fit (its <code>fit()</code>) fits it again. Hover a block or
            an edge to bring it forward (an edge with a tip shows the app's
            <code>neatDiagramEdgeTip</code>); Stages opens a level of its own, and the bar over the
            drawing goes back. <code>[(level)]</code> is the path, here
            <code>{{ levelText() }}</code
            >.
          </p>
          <neat-diagram
            class="diagram"
            [diagram]="modelGraph"
            label="A detector's model graph"
            [(level)]="level"
          >
            <ng-template neatDiagramEdgeTip let-edge>
              @if (edgeTips[edge.id]; as tip) {
                {{ tip }}
              }
            </ng-template>
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
  protected readonly edgeTips = EDGE_TIPS;
  protected readonly level = signal<string[]>([]);
  protected readonly levelText = computed(() => JSON.stringify(this.level()));
  protected readonly diagram = viewChild(NeatDiagramView);
}
