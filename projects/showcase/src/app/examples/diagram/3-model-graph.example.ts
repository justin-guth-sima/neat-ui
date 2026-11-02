import { ChangeDetectionStrategy, Component, computed, signal, viewChild } from '@angular/core';
import {
  NeatDiagramBlockTemplate,
  NeatDiagramEdgeTipTemplate,
  NeatDiagramLegend,
  NeatDiagramView,
} from '@sima/neat-ui/diagram';
import { MODEL_EDGE_TIPS, MODEL_GRAPH, MODEL_LEGEND } from './model-graph-data';

/**
 * Tensor shapes as edge labels, a figure after a brace's label from the app's
 * `NeatDiagramBlockTemplate` (`node.role` tells a bracket from a block), the tip of an edge from
 * the app's `NeatDiagramEdgeTipTemplate`, and levels two deep: Stages opens its stages, and Dark5
 * opens its layers. `NeatDiagramView.level` is the path of open levels, shown below the drawing.
 */
@Component({
  selector: 'app-model-graph',
  imports: [
    NeatDiagramBlockTemplate,
    NeatDiagramEdgeTipTemplate,
    NeatDiagramLegend,
    NeatDiagramView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-diagram-legend [items]="legend" />
    <neat-diagram
      class="diagram"
      [diagram]="graph"
      label="A detector’s model graph"
      [(level)]="level"
    >
      <ng-template neatDiagramBlock let-node>
        @if (node.role === 'bracket') {
          <span class="bracket-figure">3 tensors</span>
        }
      </ng-template>
      <ng-template neatDiagramEdgeTip let-edge>
        @if (tips[edge.id]; as tip) {
          {{ tip }}
        }
      </ng-template>
    </neat-diagram>
    <span class="showcase-muted">Open levels: {{ levelText() }}</span>
  `,
  styleUrl: './diagram-box.css',
})
export class ModelGraph {
  protected readonly graph = MODEL_GRAPH;
  protected readonly legend = MODEL_LEGEND;
  protected readonly tips = MODEL_EDGE_TIPS;
  protected readonly level = signal<string[]>([]);
  protected readonly levelText = computed(() => JSON.stringify(this.level()));
  private readonly diagram = viewChild.required(NeatDiagramView);

  /** Fits the drawing to its box again, as a toolbar's Fit button does. */
  fit(): void {
    this.diagram().fit();
  }
}
