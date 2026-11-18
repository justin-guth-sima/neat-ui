import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import { NeatDiagramLegend, NeatDiagramView } from '@sima/neat-ui/diagram';
import { PIPELINE, PIPELINE_LEGEND } from './pipeline-data';

/**
 * The pipeline filling its card to the edges, as a page like the demo's System page shows it.
 *
 * The box rule is the other examples', so the drawing takes the card's whole width. The app lays
 * `NeatDiagramLegend` over the drawing's bottom left corner instead of above it. There it gives up
 * no height, and stays clear of the bar a level opens in the top left.
 *
 * The card clips the drawing to its rounded corners. The top bar's Fit still fits it
 * (`NeatDiagramView.fit`).
 *
 * @unpadded
 * @gallery
 */
@Component({
  selector: 'app-filling-its-card',
  imports: [NeatDiagramLegend, NeatDiagramView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './5-filling-its-card.example.html',
  styleUrls: ['./diagram-box.css', './filling-its-card.example.css'],
})
export class FillingItsCard {
  protected readonly pipeline = PIPELINE;
  protected readonly legend = PIPELINE_LEGEND;
  private readonly diagram = viewChild.required(NeatDiagramView);

  /** Fits the drawing to its box again, as a toolbar's Fit button does. */
  fit(): void {
    this.diagram().fit();
  }
}
