import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import { NeatDiagramLegend, NeatDiagramView } from '@sima/neat-ui/diagram';
import { EDGE_SIDES, EDGE_SIDES_LEGEND } from './edge-sides-data';

/**
 * A node's `outSide` and `inSide` say where all of its outgoing and incoming edges meet it. An
 * edge's own `fromSide` and `toSide` override them for that edge alone: here both edges leave the
 * Source on its right, as its `outSide` says, except the archive copy, which leaves on the bottom
 * (`fromSide`). The route and the label follow the side the edge chose.
 */
@Component({
  selector: 'app-edge-sides',
  imports: [NeatDiagramLegend, NeatDiagramView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-diagram-legend [items]="legend" />
    <neat-diagram class="diagram" [diagram]="sides" label="A source with a side chosen by an edge" />
  `,
  styleUrl: './diagram-box.css',
})
export class EdgeSides {
  protected readonly sides = EDGE_SIDES;
  protected readonly legend = EDGE_SIDES_LEGEND;
  private readonly diagram = viewChild.required(NeatDiagramView);

  /** Fits the drawing to its box again, as a toolbar's Fit button does. */
  fit(): void {
    this.diagram().fit();
  }
}
