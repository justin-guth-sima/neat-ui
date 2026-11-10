import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import {
  NeatDiagramLegend,
  NeatDiagramView,
  type NeatDiagramHighlight,
} from '@sima/neat-ui/diagram';
import { NeatSegmented, type NeatSegmentedOption } from '@sima/neat-ui/segmented';
import { COMPILE_FLOW, COMPILE_LEGEND } from './compile-flow-data';

const MODES: NeatSegmentedOption<NeatDiagramHighlight>[] = [
  { value: 'none', label: 'None' },
  { value: 'edges', label: 'Edges' },
  { value: 'all', label: 'All' },
];

/**
 * What dims the rest of the drawing while the pointer is on a part, set by
 * `NeatDiagramView.highlight`. The default is `none`: dimming without a reason to look is noise
 * every time the pointer crosses the drawing. `edges` suits a drawing read by its links, where
 * hovering one shows which blocks it joins; `all` also traces a block's links, for a dense
 * drawing in which they are hard to follow by eye. An edge's tooltip shows in every mode.
 */
@Component({
  selector: 'app-highlight',
  imports: [NeatDiagramLegend, NeatDiagramView, NeatSegmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-segmented label="Highlight" [options]="modes" [(value)]="mode" />
    <neat-diagram-legend [items]="legend" />
    <neat-diagram
      class="diagram"
      [diagram]="flow"
      label="A compile flow to hover"
      [highlight]="mode()"
    />
  `,
  styleUrl: './diagram-box.css',
})
export class Highlight {
  protected readonly modes = MODES;
  protected readonly mode = signal<NeatDiagramHighlight>('edges');
  protected readonly flow = COMPILE_FLOW;
  protected readonly legend = COMPILE_LEGEND;
  private readonly diagram = viewChild.required(NeatDiagramView);

  /** Fits the drawing to its box again, as a toolbar's Fit button does. */
  fit(): void {
    this.diagram().fit();
  }
}
