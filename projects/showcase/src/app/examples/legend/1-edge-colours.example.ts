import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatDiagramLegend, type NeatDiagramLegendItem } from '@sima/neat-ui/diagram';

/**
 * One item of each kind: two series colours, a dashed and a ghost line, and an item with neither
 * a series nor a line.
 */
@Component({
  selector: 'app-edge-colours',
  imports: [NeatDiagramLegend],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<neat-diagram-legend [items]="items" />`,
})
export class EdgeColours {
  protected readonly items: readonly NeatDiagramLegendItem[] = [
    { series: 1, label: 'image' },
    { series: 4, label: 'results' },
    { line: 'dashed', label: 'inside the Detector' },
    { line: 'ghost', label: 'not run here' },
    { label: 'unnamed' },
  ];
}
