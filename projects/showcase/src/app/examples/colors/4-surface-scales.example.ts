import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  buildNeutralSurfaceScale,
  buildSurfaceScale,
  NEAT_NEAR_BLACK,
  SIMA_PALETTE,
  type SurfaceScale,
} from '@sima/neat-ui';

interface Ramp {
  readonly name: string;
  /** What the darkest step is made from, and its value. */
  readonly darkest: readonly [name: string, hex: string];
  readonly steps: readonly (readonly [step: string, hex: string])[];
}

const ramp = (name: string, darkest: Ramp['darkest'], scale: SurfaceScale): Ramp => ({
  name,
  darkest,
  steps: Object.entries(scale),
});

/**
 * The two surface ramps, from white at step 0 to the darkest at step 950.
 *
 * `buildSurfaceScale` is the light scheme's: white, the two palette backgrounds and the palette
 * text, with the steps between interpolated. `buildNeutralSurfaceScale` is the dark scheme's, the
 * same construction in grays only, down to the near-black `NEAT_NEAR_BLACK`.
 *
 * They start at 0 because white sits above the brand's off-white 50 and 100. That keeps the step
 * numbers aligned across all the ramps.
 */
@Component({
  selector: 'app-surface-scales',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './4-surface-scales.example.html',
  styleUrls: ['./swatches.css', './ramp-title.css'],
})
export class SurfaceScales {
  protected readonly ramps: readonly Ramp[] = [
    ramp('buildSurfaceScale()', ['SIMA_PALETTE.text', SIMA_PALETTE.text], buildSurfaceScale()),
    ramp(
      'buildNeutralSurfaceScale()',
      ['NEAT_NEAR_BLACK', NEAT_NEAR_BLACK],
      buildNeutralSurfaceScale(),
    ),
  ];
}
