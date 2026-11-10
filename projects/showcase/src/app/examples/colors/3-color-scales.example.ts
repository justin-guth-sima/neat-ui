import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  buildColorScale,
  NEAT_DANGER_BASE,
  NEAT_HIGHLIGHT_BASE,
  NEAT_PRIMARY_BASE,
  NEAT_SERIES_TEAL_BASE,
  NEAT_WARN_BASE,
} from '@sima/neat-ui';

interface Ramp {
  readonly name: string;
  readonly base: string;
  readonly steps: readonly (readonly [step: string, hex: string])[];
}

const BASES = [
  ['NEAT_PRIMARY_BASE', NEAT_PRIMARY_BASE],
  ['NEAT_DANGER_BASE', NEAT_DANGER_BASE],
  ['NEAT_WARN_BASE', NEAT_WARN_BASE],
  ['NEAT_HIGHLIGHT_BASE', NEAT_HIGHLIGHT_BASE],
  ['NEAT_SERIES_TEAL_BASE', NEAT_SERIES_TEAL_BASE],
] as const;

/**
 * A ramp from step 50 to 950 for each base color the theme names, made with `buildColorScale`:
 * the base is step 500 unchanged, the lighter steps move from it in OKLCH towards near-white and
 * the darker towards near-black, with the chroma pulled back into sRGB. The primary ramp is the
 * accent's; the others are the functional colors the palette lacks and the chart series' teal.
 */
@Component({
  selector: 'app-color-scales',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (ramp of ramps; track ramp.name) {
      <section>
        <h4>
          <span class="showcase-code">{{ ramp.name }}</span>
          <span class="showcase-code showcase-muted">{{ ramp.base }}</span>
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
  styleUrls: ['./swatches.css', './ramp-title.css'],
})
export class ColorScales {
  protected readonly ramps: readonly Ramp[] = BASES.map(([name, base]) => ({
    name,
    base,
    steps: Object.entries(buildColorScale(base)),
  }));
}
