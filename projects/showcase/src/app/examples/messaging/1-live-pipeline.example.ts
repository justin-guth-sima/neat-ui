import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NeatButton, neatStoredSignal } from '@sima/neat-ui';
import {
  NEAT_DIAGRAM_MESSAGE_DEFAULTS,
  neatBatchTimes,
  NeatDiagramAnimationSettings,
  NeatDiagramBlockTemplate,
  NeatDiagramLegend,
  NeatDiagramMessages,
  NeatDiagramNoteTemplate,
  NeatDiagramRateCard,
  NeatDiagramView,
  neatParseMessageSettings,
} from '@sima/neat-ui/diagram';
import { PIPELINE_MESSAGE_STEPS } from './message-steps';
import { PIPELINE, PIPELINE_LEGEND } from './pipeline-data';

/**
 * The pipeline's feed: a camera frame every 33 ms (30 Hz) and a result for every third (10 Hz),
 * delivered as a transport would, in a batch of three frames every 99 ms.
 */
const FRAME_MS = 33;
const BATCH_FRAMES = 3;
/** When each frame of a batch was made, relative to the first: what `neatBatchTimes` spreads by. */
const FRAME_OFFSETS_MS = Array.from({ length: BATCH_FRAMES }, (_, i) => i * FRAME_MS);
/** The Detector's stage time shown on its card, refreshed once a second so it reads. */
const STAGE_SHOWN_EVERY = 10;
/** The edges each kind of message travels, on the overview and in the Detector's level. */
const FRAME_EDGES = ['camera-decode', 'decode-detector', 'decode-resize'];
const RESULT_EDGES = ['detector-tracker', 'nms-tracker', 'tracker-gateway', 'gateway-browser'];
/**
 * The Burst button's messages, in one tick: about three seconds of this example's traffic (some 130
 * pushes a second over its seven edges), as a tab back from a few seconds in the background
 * delivers it.
 */
const BURST_MESSAGES = 400;

/**
 * A timer feeds camera frames at 30 Hz and results at 10 Hz, in batches of three frames that
 * `neatBatchTimes` spreads. Decode's figure line comes from the example's
 * `NeatDiagramBlockTemplate`. Open the Detector: inside it, the dots wait out its stage times. The
 * notes are rate cards of an edge's `rate()` (the Tracker's of the two edges into it, summed by
 * `rate(['detector-tracker', 'nms-tracker'])`, and with `showBytes` off, since results are a few
 * kilobytes and not worth a megabyte figure), the Detector's with its stage time in place of the
 * megabytes.
 * The Animation panel tunes the dots, its choice kept per browser with `neatStoredSignal`, and
 * Burst pushes 400 messages in one tick, about three seconds of this traffic, as a tab returning
 * from a few seconds in the background would.
 *
 * The top bar's Fit calls `NeatDiagramView.fit`, which fits the drawing to its box again after it
 * was panned or zoomed.
 *
 * @gallery
 */
@Component({
  selector: 'app-live-pipeline',
  imports: [
    NeatButton,
    NeatDiagramAnimationSettings,
    NeatDiagramBlockTemplate,
    NeatDiagramLegend,
    NeatDiagramMessages,
    NeatDiagramNoteTemplate,
    NeatDiagramRateCard,
    NeatDiagramView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="controls">
      <button neatButton type="button" variant="outlined" size="small" (click)="burst()">
        Burst
      </button>
      <neat-diagram-animation-settings [(settings)]="dots" />
    </div>
    <neat-diagram-legend [items]="legend" />
    <neat-diagram class="diagram" [diagram]="pipeline" label="A live messaging pipeline">
      <neat-diagram-messages #messages [steps]="steps" [settings]="dots()" />
      <ng-template neatDiagramBlock let-node>
        @if (node.id === 'decode') {
          <span class="figure">30.0 fps · 1080p</span>
        }
      </ng-template>
      <ng-template neatDiagramNote let-note>
        @switch (note.id) {
          @case ('tracker-rate') {
            <neat-diagram-rate-card
              label="Into Tracker"
              [rate]="messages.rate(['detector-tracker', 'nms-tracker'])()"
              [showBytes]="false"
            />
          }
          @case ('yolox-rate') {
            <neat-diagram-rate-card
              label="YOLOX → NMS"
              [rate]="messages.rate('yolox-nms')()"
              [stageMs]="yoloxMs()"
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
  `,
  styleUrl: './live-pipeline.example.css',
})
export class LivePipeline {
  protected readonly pipeline = PIPELINE;
  protected readonly legend = PIPELINE_LEGEND;
  protected readonly steps = PIPELINE_MESSAGE_STEPS;
  /** The dots' tuning, kept per browser: what `neatParseMessageSettings` reads back clamped. */
  protected readonly dots = neatStoredSignal(
    'showcase.diagram.dots',
    NEAT_DIAGRAM_MESSAGE_DEFAULTS,
    neatParseMessageSettings,
  );
  /** The YOLOX stage time the Detector's card shows, in ms. */
  protected readonly yoloxMs = signal<number | undefined>(undefined);
  private readonly diagram = viewChild.required(NeatDiagramView);
  private readonly messages = viewChild.required(NeatDiagramMessages);

  constructor() {
    const destroyRef = inject(DestroyRef);
    // The feed needs the browser's clock, so it starts once the page has rendered.
    afterNextRender(() => {
      let batch = 0;
      const feed = setInterval(() => {
        const messages = this.messages();
        // The batch arrives now; its frames start as far apart as they were made.
        const starts = neatBatchTimes(FRAME_OFFSETS_MS, performance.now());
        for (const atMs of starts) {
          // A frame of about 150 kB, a result of about 2 kB, give or take, as a real feed varies.
          for (const edge of FRAME_EDGES) {
            messages.push(edge, 140_000 + Math.random() * 20_000, atMs);
          }
        }
        for (const edge of RESULT_EDGES) messages.push(edge, 1_500 + Math.random() * 1_000);
        const yolox = 14 + 2 * Math.random();
        messages.stageMs('detector', 'resize', 3 + Math.random());
        messages.stageMs('detector', 'yolox', yolox);
        if (batch++ % STAGE_SHOWN_EVERY === 0) this.yoloxMs.set(yolox);
      }, FRAME_MS * BATCH_FRAMES);
      destroyRef.onDestroy(() => clearInterval(feed));
    });
  }

  /** Fits the drawing to its box again, as a toolbar's Fit button does. */
  fit(): void {
    this.diagram().fit();
  }

  /** Pushes a burst of messages at once, as a tab returning from the background would. */
  protected burst(): void {
    const messages = this.messages();
    const edges = [...FRAME_EDGES, ...RESULT_EDGES];
    for (let i = 0; i < BURST_MESSAGES; i++) {
      messages.push(edges[i % edges.length], 1_500 + Math.random() * 150_000);
    }
  }
}
