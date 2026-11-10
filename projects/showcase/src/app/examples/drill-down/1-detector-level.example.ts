import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type NeatDiagramSet, neatDrillDownLevel, NeatDiagramView } from '@sima/neat-ui/diagram';
import { OVERVIEW, WITH_STEPS } from './pipeline-data';

/**
 * A three-block pipeline whose Detector opens a level that `neatDrillDownLevel` placed: its
 * steps inside, the Camera that feeds it in a column on the left and the Tracker it feeds in one
 * on the right. Open the Detector to see it.
 *
 * @gallery
 */
@Component({
  selector: 'app-detector-level',
  imports: [NeatDiagramView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<neat-diagram class="diagram" [diagram]="pipeline" label="A pipeline" />`,
  styleUrl: './detector-level.example.css',
})
export class DetectorLevel {
  /** The level the Detector opens is placed from the diagram that holds its steps. */
  protected readonly pipeline: NeatDiagramSet = {
    overview: OVERVIEW,
    levels: { detector: neatDrillDownLevel(WITH_STEPS, 'detector') },
  };
}
