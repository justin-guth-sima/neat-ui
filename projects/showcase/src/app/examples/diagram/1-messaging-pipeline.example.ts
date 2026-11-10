import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import {
  NeatDiagramBlockTemplate,
  NeatDiagramLegend,
  NeatDiagramNoteTemplate,
  NeatDiagramView,
} from '@sima/neat-ui/diagram';
import { PIPELINE, PIPELINE_LEGEND } from './pipeline-data';

/**
 * A pipeline over two machines: groups for the machines, a band for the cable, and a figure line in
 * Decode from the app's `NeatDiagramBlockTemplate`. Every chip says where its part runs, in the
 * kit's tones.
 *
 * The Detector opens a level that `neatDrillDownLevel` placed: its steps inside, what feeds it on
 * the left, and what it feeds on the right.
 *
 * The Browser has stopped reporting. Its node is `stale`, so the whole card is grayed out, and the
 * same template says why in words, since gray alone tells no one what happened.
 *
 * The notes are the app's `NeatDiagramNoteTemplate`. Here they hold fixed text, where a live
 * pipeline would draw `NeatDiagramRateCard`s of its edges' rates.
 *
 * The top bar's Fit calls `NeatDiagramView.fit` on each diagram of the page. It fits the diagram to
 * its box again after it was panned or zoomed.
 */
@Component({
  selector: 'app-messaging-pipeline',
  imports: [NeatDiagramBlockTemplate, NeatDiagramLegend, NeatDiagramNoteTemplate, NeatDiagramView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-diagram-legend [items]="legend" />
    <neat-diagram class="diagram" [diagram]="pipeline" label="A messaging pipeline">
      <ng-template neatDiagramBlock let-node>
        @if (node.id === 'decode') {
          <span class="figure">30.0 fps · 1080p</span>
        }
        @if (node.id === 'browser') {
          <span class="figure">No data for 5 s</span>
        }
      </ng-template>
      <ng-template neatDiagramNote let-note>
        @switch (note.id) {
          @case ('camera-rate') {
            <b>Camera → Decode</b><br />30 frames/s
          }
          @case ('tracker-rate') {
            <b>Tracker → Gateway</b><br />10 results/s
          }
          @case ('yolox-rate') {
            <b>YOLOX → NMS</b><br />14.8 ms
          }
        }
      </ng-template>
    </neat-diagram>
  `,
  styleUrls: ['./diagram-box.css', './messaging-pipeline.example.css'],
})
export class MessagingPipeline {
  protected readonly pipeline = PIPELINE;
  protected readonly legend = PIPELINE_LEGEND;
  private readonly diagram = viewChild.required(NeatDiagramView);

  /** Fits the drawing to its box again, as a toolbar's Fit button does. */
  fit(): void {
    this.diagram().fit();
  }
}
