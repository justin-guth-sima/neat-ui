import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import {
  buildColorScale,
  buildNeutralSurfaceScale,
  buildSurfaceScale,
  NEAT_NEAR_BLACK,
  NEAT_PRIMARY_BASE,
  NeatPage,
  SIMA_PALETTE,
} from '@sima/neat-ui';
import { describeContrast } from './contrast';
import { Swatch } from './swatch';
import { injectThemeVariables } from './theme-variables';

interface Chip {
  name: string;
  hex: string;
}

const toChips = (colors: Record<string, string>): Chip[] =>
  Object.entries(colors).map(([name, hex]) => ({ name, hex }));

/** Spartan's colour variables, as its components use them. */
const SPARTAN_VARIABLES = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'border',
  'input',
  'ring',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
];

/** Variables the kit adds to Spartan's vocabulary. */
const KIT_VARIABLES = [
  'primary-hover',
  'destructive-foreground',
  'success',
  'success-foreground',
  'warning',
  'warning-foreground',
  'info',
  'info-foreground',
  'highlight',
  'highlight-foreground',
  'neat-video-scrim',
  'neat-video-scrim-foreground',
  ...['success', 'warning', 'danger', 'info', 'highlight'].flatMap((tone) => [
    `neat-tint-${tone}`,
    `neat-tint-${tone}-accent`,
  ]),
];

/** The text pairs the kit's components draw, as [text, background]. */
const TEXT_PAIRS: [string, string][] = [
  ['foreground', 'background'],
  ['foreground', 'muted'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'muted'],
  ['muted-foreground', 'card'],
  ['primary', 'background'],
  ['primary-foreground', 'primary'],
  ['primary-foreground', 'primary-hover'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['destructive', 'background'],
  ['destructive-foreground', 'destructive'],
  ['success', 'background'],
  ['success-foreground', 'success'],
  ['warning-foreground', 'warning'],
  ['info', 'background'],
  ['info-foreground', 'info'],
  ['highlight', 'background'],
  ['highlight-foreground', 'highlight'],
  ['muted-foreground', 'accent'],
  ['muted-foreground', 'neat-tint-success'],
  ['muted-foreground', 'neat-tint-warning-accent'],
];

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
  imports: [NeatPage, Swatch],
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
            interpolated. The light scheme's surfaces.
          </p>
          <div class="showcase-grid">
            @for (chip of surface; track chip.name) {
              <app-swatch [name]="chip.name" [hex]="chip.hex" />
            }
          </div>
        </section>

        <section class="showcase-section">
          <h2>Neutral surface scale</h2>
          <p class="showcase-muted">
            The same construction in greys only, down to the near-black
            <code>NEAT_NEAR_BLACK</code> ({{ nearBlack }}). The dark scheme's surfaces.
          </p>
          <div class="showcase-grid">
            @for (chip of neutral; track chip.name) {
              <app-swatch [name]="chip.name" [hex]="chip.hex" />
            }
          </div>
        </section>

        <section class="showcase-section">
          <h2>Theme variables</h2>
          <p class="showcase-muted">
            The CSS variables the kit stylesheet sets, read from this page in the current colour
            scheme. Switch the scheme in the top bar to see the other one.
          </p>
          <h3>Spartan</h3>
          <div class="showcase-grid">
            @for (chip of spartanChips(); track chip.name) {
              <app-swatch [name]="chip.name" [hex]="chip.hex" />
            }
          </div>
          <h3>Kit extensions</h3>
          <div class="showcase-grid">
            @for (chip of kitChips(); track chip.name) {
              <app-swatch [name]="chip.name" [hex]="chip.hex" />
            }
          </div>
        </section>

        <section class="showcase-section">
          <h2>Contrast</h2>
          <p class="showcase-muted">
            WCAG 2.x ratios of the text pairs the components draw, in the current colour scheme. AA
            for normal text is 4.5:1.
          </p>
          <table>
            <thead>
              <tr>
                <th scope="col">Text on background</th>
                <th scope="col">Sample</th>
                <th scope="col">Contrast</th>
              </tr>
            </thead>
            <tbody>
              @for (pair of pairs(); track pair.label) {
                <tr>
                  <th scope="row" class="showcase-code">{{ pair.label }}</th>
                  <td>
                    <span
                      class="sample"
                      [style.color]="'var(--' + pair.foreground + ')'"
                      [style.background]="'var(--' + pair.background + ')'"
                      >Neat Insight</span
                    >
                  </td>
                  <td class="showcase-code">{{ pair.contrast }}</td>
                </tr>
              }
            </tbody>
          </table>
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
  styleUrl: './theme.page.css',
})
export class ThemePage {
  protected readonly palette = toChips(SIMA_PALETTE);
  protected readonly primaryBase = NEAT_PRIMARY_BASE;
  protected readonly primary = toChips(buildColorScale(NEAT_PRIMARY_BASE));
  protected readonly surface = toChips(buildSurfaceScale());
  protected readonly nearBlack = NEAT_NEAR_BLACK;
  protected readonly neutral = toChips(buildNeutralSurfaceScale());
  protected readonly weights = WEIGHTS;
  protected readonly sizes = SIZES;

  private readonly variables = injectThemeVariables([...SPARTAN_VARIABLES, ...KIT_VARIABLES]);
  private readonly chipsOf = (names: string[]) =>
    computed(() => names.map((name) => ({ name: `--${name}`, hex: this.variables()[name] })));
  protected readonly spartanChips = this.chipsOf(SPARTAN_VARIABLES);
  protected readonly kitChips = this.chipsOf(KIT_VARIABLES);
  protected readonly pairs = computed(() => {
    const values = this.variables();
    return TEXT_PAIRS.map(([foreground, background]) => ({
      label: `--${foreground} on --${background}`,
      foreground,
      background,
      contrast: describeContrast(values[foreground], values[background]),
    }));
  });
}
