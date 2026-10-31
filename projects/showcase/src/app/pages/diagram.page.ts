import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { NeatButton, NeatIcon, NeatPage, NeatPageToolbar, neatStoredSignal } from '@sima/neat-ui';
import {
  NEAT_DIAGRAM_MESSAGE_DEFAULTS,
  NeatDiagramAnimationSettings,
  NeatDiagramBlockTemplate,
  NeatDiagramEdgeTipTemplate,
  NeatDiagramLegend,
  NeatDiagramMessages,
  neatDiagramMessageSettings,
  NeatDiagramNoteTemplate,
  NeatDiagramRateCard,
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
  PIPELINE_MESSAGE_STEPS,
} from './diagram-examples';

/** The pipeline's feed: a camera frame every 33 ms (30 Hz) and a result every third (10 Hz). */
const FRAME_MS = 33;
const RESULT_EVERY = 3;
/** The edges each kind of message travels, on the overview and in the Detector's level. */
const FRAME_EDGES = ['camera-decode', 'decode-detector', 'decode-resize'];
const RESULT_EDGES = ['detector-tracker', 'nms-tracker', 'tracker-gateway', 'gateway-browser'];

/**
 * The diagram entry: the reference sheet's three examples, each with its legend, and the
 * toolbar's Fit, which fits them all again and
 * the Animation panel for the messaging example's dots.
 */
@Component({
  selector: 'app-diagram-page',
  imports: [
    NeatButton,
    NeatDiagramAnimationSettings,
    NeatDiagramBlockTemplate,
    NeatDiagramEdgeTipTemplate,
    NeatDiagramLegend,
    NeatDiagramMessages,
    NeatDiagramNoteTemplate,
    NeatDiagramRateCard,
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
      <neat-diagram-animation-settings [(settings)]="dots" />
    </div>
    <neat-page>
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Diagram</h2>
          <p class="showcase-muted">
            <code>neat-diagram</code> draws a hand-placed level: frames and bands behind one SVG of
            routed edges, blocks, brackets, edge labels and notes in front of it. Edges take the
            charts' series colours, which <code>neat-diagram-legend</code> names; chips are the
            kit's status chips, tinted (where a part runs: HW success, EV74 highlight, MLA info, A65
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
              Frames for the machines, a band for the cable, and a figure line in Decode from the
              app's <code>neatDiagramBlock</code>. The Detector opens a level placed by
              <code>neatDrillDownLevel</code>: its steps inside, what feeds it left, what it feeds
              right. A timer feeds <code>neat-diagram-messages</code> camera frames at 30 Hz and
              results at 10 Hz; inside the Detector, the dots wait out its stage times. The two
              notes are <code>neat-diagram-rate-card</code>s of an edge's <code>rate()</code>, and
              the toolbar's Animation panel (<code>neat-diagram-animation-settings</code>) tunes the
              dots; this page keeps its choice with <code>neatStoredSignal</code>.
            </p>
            <neat-diagram-legend [items]="pipelineLegend" />
            <neat-diagram class="diagram" [diagram]="pipeline" label="A messaging pipeline">
              <neat-diagram-messages #messages [steps]="pipelineSteps" [settings]="dots()" />
              <ng-template neatDiagramBlock let-node>
                @if (node.id === 'decode') {
                  <span class="figure">30.0 fps · 1080p</span>
                }
              </ng-template>
              <ng-template neatDiagramNote let-note>
                @switch (note.id) {
                  @case ('tracker-rate') {
                    <neat-diagram-rate-card
                      label="Tracker → Gateway"
                      [rate]="messages.rate('tracker-gateway')()"
                    />
                  }
                  @case ('camera-rate') {
                    <neat-diagram-rate-card
                      label="Camera → Decode"
                      [rate]="messages.rate('camera-decode')()"
                    />
                  }
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
  protected readonly pipelineSteps = PIPELINE_MESSAGE_STEPS;
  protected readonly compileFlow = COMPILE_FLOW;
  protected readonly compileLegend = COMPILE_LEGEND;
  protected readonly modelGraph = MODEL_GRAPH;
  protected readonly modelLegend = MODEL_LEGEND;
  protected readonly edgeTips = MODEL_EDGE_TIPS;
  protected readonly level = signal<string[]>([]);
  /** The dots' tuning, kept per browser: what `neatDiagramMessageSettings` reads back clamped. */
  protected readonly dots = neatStoredSignal(
    'showcase.diagram.dots',
    NEAT_DIAGRAM_MESSAGE_DEFAULTS,
    neatDiagramMessageSettings,
  );
  protected readonly levelText = computed(() => JSON.stringify(this.level()));
  private readonly diagrams = viewChildren(NeatDiagramView);
  private readonly messages = viewChild.required(NeatDiagramMessages);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      let tick = 0;
      const feed = setInterval(() => {
        const messages = this.messages();
        // A frame of about 150 kB, a result of about 2 kB, give or take, as a real feed varies.
        for (const edge of FRAME_EDGES) messages.push(edge, 140_000 + Math.random() * 20_000);
        if (tick++ % RESULT_EVERY === 0) {
          for (const edge of RESULT_EDGES) messages.push(edge, 1_500 + Math.random() * 1_000);
        }
        messages.stageMs('detector', 'resize', 3 + Math.random());
        messages.stageMs('detector', 'yolox', 14 + 2 * Math.random());
      }, FRAME_MS);
      destroyRef.onDestroy(() => clearInterval(feed));
    });
  }

  protected fit(): void {
    for (const diagram of this.diagrams()) diagram.fit();
  }
}
