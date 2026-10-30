import { ChangeDetectionStrategy, Component, computed, signal, viewChildren } from '@angular/core';
import { NeatButton, NeatIcon, NeatPage, NeatPageToolbar } from '@sima/neat-ui';
import {
  NeatDiagramEdgeTipTemplate,
  NeatDiagramLegend,
  NeatDiagramNoteTemplate,
  NeatDiagramView,
} from '@sima/neat-ui/diagram';
import {
  COMPILE_FLOW,
  COMPILE_LEGEND,
  MODEL_EDGE_TIPS,
  MODEL_GRAPH,
  MODEL_LEGEND,
  PIPELINE,
  PIPELINE_LEGEND,
} from './diagram-examples';

/**
 * The diagram entry: the reference sheet's three examples, each with its legend, and the
 * toolbar's Fit, which fits them all again.
 */
@Component({
  selector: 'app-diagram-page',
  imports: [
    NeatButton,
    NeatDiagramEdgeTipTemplate,
    NeatDiagramLegend,
    NeatDiagramNoteTemplate,
    NeatDiagramView,
    NeatIcon,
    NeatPage,
    NeatPageToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *neatPageToolbar>
      <button neatButton type="button" variant="text" size="small" (click)="fit()">
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
            charts' series colours, which <code>neat-diagram-legend</code> names; chips are the
            kit's status chips (where a part runs: HW success, EV74 highlight, MLA info, A65
            neutral); a note's content is the app's template. Drag, wheel, pinch or double-click to
            pan and zoom, or focus a diagram and use the arrow keys, <kbd>+</kbd>, <kbd>-</kbd> and
            <kbd>0</kbd>; each fits itself to its box until you do, and the toolbar's Fit (their
            <code>fit()</code>) fits them again. Hover a block or an edge to bring it forward. A
            block with "›" opens a level, and the bar over the drawing goes back.
          </p>
        </section>

        <div class="examples">
          <section class="example">
            <h3>Messaging pipeline</h3>
            <p class="showcase-muted">
              Frames for the machines, a band for the cable. The Detector opens a level placed by
              <code>neatDrillDownLevel</code>: its steps inside, what feeds it left, what it feeds
              right.
            </p>
            <neat-diagram-legend [items]="pipelineLegend" />
            <neat-diagram class="diagram" [diagram]="pipeline" label="A messaging pipeline">
              <ng-template neatDiagramNote let-note>
                @if (note.id === 'tracker-rate') {
                  <b>Tracker → Gateway</b><br />30.0 msg/s · 6 kB/s
                }
              </ng-template>
            </neat-diagram>
          </section>

          <section class="example">
            <h3>Compile flow</h3>
            <p class="showcase-muted">
              A muted input beside the column, a ghost for the step that is not run, and a note
              anchored to a block's side.
            </p>
            <neat-diagram-legend [items]="compileLegend" />
            <neat-diagram class="diagram" [diagram]="compileFlow" label="A compile flow">
              <ng-template neatDiagramNote let-note>
                @if (note.id === 'compile-result') {
                  <b>Compile</b><br />2 m 14 s · 41 MB
                }
              </ng-template>
            </neat-diagram>
          </section>

          <section class="example">
            <h3>Model graph</h3>
            <p class="showcase-muted">
              Tensor shapes as edge labels, an edge's tip from the app's
              <code>neatDiagramEdgeTip</code>, and levels two deep: Stages opens its stages, and
              Dark5 opens its layers. <code>[(level)]</code> is the path, here
              <code>{{ levelText() }}</code
              >.
            </p>
            <neat-diagram-legend [items]="modelLegend" />
            <neat-diagram
              class="diagram"
              [diagram]="modelGraph"
              label="A detector’s model graph"
              [(level)]="level"
            >
              <ng-template neatDiagramEdgeTip let-edge>
                @if (edgeTips[edge.id]; as tip) {
                  {{ tip }}
                }
              </ng-template>
            </neat-diagram>
          </section>
        </div>
      </div>
    </neat-page>
  `,
  styleUrl: './diagram.page.css',
})
export class DiagramPage {
  protected readonly pipeline = PIPELINE;
  protected readonly pipelineLegend = PIPELINE_LEGEND;
  protected readonly compileFlow = COMPILE_FLOW;
  protected readonly compileLegend = COMPILE_LEGEND;
  protected readonly modelGraph = MODEL_GRAPH;
  protected readonly modelLegend = MODEL_LEGEND;
  protected readonly edgeTips = MODEL_EDGE_TIPS;
  protected readonly level = signal<string[]>([]);
  protected readonly levelText = computed(() => JSON.stringify(this.level()));
  private readonly diagrams = viewChildren(NeatDiagramView);

  protected fit(): void {
    for (const diagram of this.diagrams()) diagram.fit();
  }
}
