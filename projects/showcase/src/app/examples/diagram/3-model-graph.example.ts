import { ChangeDetectionStrategy, Component, computed, signal, viewChild } from '@angular/core';
import {
  NeatDiagramBlockTemplate,
  NeatDiagramEdgeTooltipTemplate,
  NeatDiagramLegend,
  NeatDiagramView,
} from '@sima/neat-ui/diagram';
import { MODEL_EDGE_TOOLTIPS, MODEL_GRAPH, MODEL_LEGEND } from './model-graph-data';

/**
 * A model's graph, with tensor shapes as edge labels.
 *
 * A figure follows a brace's label, from the app's `NeatDiagramBlockTemplate`, where `node.role`
 * tells a bracket from a block. The tooltip of an edge comes from the app's
 * `NeatDiagramEdgeTooltipTemplate`.
 *
 * Levels go two deep: Stages opens its stages, and Dark5 opens its layers. `NeatDiagramView.level`
 * is the path of open levels, shown below the drawing.
 */
@Component({
  selector: 'app-model-graph',
  imports: [
    NeatDiagramBlockTemplate,
    NeatDiagramEdgeTooltipTemplate,
    NeatDiagramLegend,
    NeatDiagramView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-model-graph.example.html',
  styleUrl: './diagram-box.css',
})
export class ModelGraph {
  protected readonly graph = MODEL_GRAPH;
  protected readonly legend = MODEL_LEGEND;
  protected readonly tooltips = MODEL_EDGE_TOOLTIPS;
  protected readonly level = signal<string[]>([]);
  protected readonly levelText = computed(() => JSON.stringify(this.level()));
  private readonly diagram = viewChild.required(NeatDiagramView);

  /** Fits the drawing to its box again, as a toolbar's Fit button does. */
  fit(): void {
    this.diagram().fit();
  }
}
