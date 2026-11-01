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
 * The two surface ramps, from white at step 0 to the darkest at step 950. `buildSurfaceScale` is
 * the light scheme's: white, the two palette backgrounds and the palette text, with the steps
 * between interpolated. `buildNeutralSurfaceScale` is the dark scheme's, the same construction in
 * greys only, down to the near-black `NEAT_NEAR_BLACK`.
 */
@Component({
  selector: 'app-surface-scales',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (ramp of ramps; track ramp.name) {
      <section>
        <h4>
          <span class="showcase-code">{{ ramp.name }}</span>
          <span class="showcase-code showcase-muted">
            ends at {{ ramp.darkest[0] }}, {{ ramp.darkest[1] }}
          </span>
        </h4>
        <div class="ramp">
          @for (step of ramp.steps; track step[0]) {
            <div>
              <div class="chip" [style.background]="step[1]"></div>
              <div class="name">{{ step[0] }}</div>
              <div class="showcase-code showcase-muted">{{ step[1] }}</div>
            </div>
          }
        </div>
      </section>
    }
  `,
  styleUrl: './swatches.css',
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
