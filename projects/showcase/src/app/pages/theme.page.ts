import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  buildColorScale,
  buildSurfaceScale,
  contrastRatio,
  NEAT_DANGER_BASE,
  NEAT_PRIMARY_BASE,
  NEAT_WARN_BASE,
  NeatPage,
  SIMA_PALETTE,
} from '@sima/neat-ui';
import { describeRatio } from './contrast';
import { ContrastPanel } from './contrast-panel';
import { Swatch } from './swatch';

interface Chip {
  name: string;
  hex: string;
}

const toChips = (colors: Record<string, string>): Chip[] =>
  Object.entries(colors).map(([name, hex]) => ({ name, hex }));

const SEVERITY_BASES: Record<string, string> = {
  success: SIMA_PALETTE.green,
  info: SIMA_PALETTE.blue,
  warn: NEAT_WARN_BASE,
  danger: NEAT_DANGER_BASE,
};

const WEIGHTS = [400, 500, 700] as const;
const SIZES = [
  { label: '14 px', value: '0.875rem' },
  { label: '16 px', value: '1rem' },
  { label: '20 px', value: '1.25rem' },
  { label: '28 px', value: '1.75rem' },
  { label: '40 px', value: '2.5rem' },
] as const;

@Component({
  selector: 'app-theme-page',
  imports: [ContrastPanel, NeatPage, Swatch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Palette</h2>
          <p class="showcase-muted">The fixed SiMa.ai brand palette, <code>SIMA_PALETTE</code>.</p>
          <div class="showcase-grid">
            @for (chip of palette; track chip.name) {
              <app-swatch [name]="chip.name" [hex]="chip.hex" />
            }
          </div>
        </section>

        <section class="showcase-section">
          <h2>Primary scale</h2>
          <p class="showcase-muted">
            Derived from <code>NEAT_PRIMARY_BASE</code> ({{ primaryBase }}), which is step 500.
          </p>
          <div class="showcase-grid">
            @for (chip of primary; track chip.name) {
              <app-swatch [name]="chip.name" [hex]="chip.hex" />
            }
          </div>
        </section>

        <section class="showcase-section">
          <h2>Surface scale</h2>
          <p class="showcase-muted">
            White, the two palette backgrounds and the palette text, with the steps between them
            interpolated.
          </p>
          <div class="showcase-grid">
            @for (chip of surface; track chip.name) {
              <app-swatch [name]="chip.name" [hex]="chip.hex" />
            }
          </div>
        </section>

        <section class="showcase-section">
          <h2>Severity colours</h2>
          <p class="showcase-muted">Step 500 of each functional scale, with white text on it.</p>
          <div class="showcase-grid severities">
            @for (severity of severities; track severity.name) {
              <div class="severity">
                <div class="tile" [style.background]="severity.hex" [style.color]="white">
                  {{ severity.name }}
                </div>
                <div class="showcase-code showcase-muted">{{ severity.hex }}</div>
                <div class="showcase-code">{{ severity.contrast }}</div>
              </div>
            }
          </div>
        </section>

        <section class="showcase-section">
          <h2>Contrast</h2>
          <p class="showcase-muted">
            WCAG 2.x ratios for the pairs text actually sits on, in both colour schemes. AA for
            normal text is 4.5:1.
          </p>
          <div class="schemes">
            <app-contrast-panel scheme="light" />
            <app-contrast-panel scheme="dark" />
          </div>
        </section>

        <section class="showcase-section">
          <h2>Typography</h2>
          <p class="showcase-muted">Roboto at weights 400, 500 and 700.</p>
          <div class="type-rows">
            @for (weight of weights; track weight) {
              @for (size of sizes; track size.label) {
                <div class="type-row">
                  <span class="showcase-code showcase-muted">{{ weight }} · {{ size.label }}</span>
                  <span [style.font-weight]="weight" [style.font-size]="size.value">
                    The quick brown fox jumps over the lazy dog
                  </span>
                </div>
              }
            }
          </div>
        </section>
      </div>
    </neat-page>
  `,
  styles: `
    .severities {
      grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    }

    .tile {
      display: flex;
      align-items: center;
      height: 4rem;
      padding: 0 0.75rem;
      border-radius: var(--p-content-border-radius);
      font-weight: 500;
    }

    .schemes {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
    }

    .type-rows {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .type-row {
      display: grid;
      align-items: baseline;
      gap: 1rem;
      grid-template-columns: 7rem minmax(0, 1fr);
    }
  `,
})
export class ThemePage {
  protected readonly palette = toChips(SIMA_PALETTE);
  protected readonly primaryBase = NEAT_PRIMARY_BASE;
  protected readonly primary = toChips(buildColorScale(NEAT_PRIMARY_BASE));
  protected readonly surface = toChips(buildSurfaceScale());
  protected readonly white = SIMA_PALETTE.white;
  protected readonly severities = Object.entries(SEVERITY_BASES).map(([name, base]) => {
    const hex = buildColorScale(base)[500];
    return { name, hex, contrast: describeRatio(contrastRatio(hex, SIMA_PALETTE.white)) };
  });
  protected readonly weights = WEIGHTS;
  protected readonly sizes = SIZES;
}
