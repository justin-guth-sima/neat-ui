import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import { NeatDiagramLegend, NeatDiagramNoteTemplate, NeatDiagramView } from '@sima/neat-ui/diagram';
import { COMPILE_FLOW, COMPILE_LEGEND } from './compile-flow-data';

/**
 * A column of steps, with a muted input beside it and a ghost for the step that is not run. A note
 * is anchored to a block's side rather than to an edge.
 */
@Component({
  selector: 'app-compile-flow',
  imports: [NeatDiagramLegend, NeatDiagramNoteTemplate, NeatDiagramView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-compile-flow.example.html',
  styleUrl: './diagram-box.css',
})
export class CompileFlow {
  protected readonly flow = COMPILE_FLOW;
  protected readonly legend = COMPILE_LEGEND;
  private readonly diagram = viewChild.required(NeatDiagramView);

  /** Fits the drawing to its box again, as a toolbar's Fit button does. */
  fit(): void {
    this.diagram().fit();
  }
}
