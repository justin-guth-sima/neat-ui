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
 * Decode from the app's `NeatDiagramBlockTemplate`. Every badge says where its part runs, in the
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
  templateUrl: './1-messaging-pipeline.example.html',
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
