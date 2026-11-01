import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  buildColorScale,
  buildNeutralSurfaceScale,
  buildSurfaceScale,
  NEAT_NEAR_BLACK,
  NEAT_PRIMARY_BASE,
  NeatPage,
  NeatPageTab,
  NeatPageTabs,
  type NeatRgb,
  neatThemeColors,
  SIMA_PALETTE,
} from '@sima/neat-ui';
import type { DocsTab } from '../docs/docs-context';
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
  'neat-live',
  ...Array.from({ length: 8 }, (_, i) => `neat-series-${i + 1}`),
  'neat-line',
  'neat-line-warning',
  'neat-line-danger',
  'neat-heat-low',
  'neat-heat-high',
  ...['success', 'warning', 'danger', 'info', 'highlight'].flatMap((tone) => [
    `neat-tint-${tone}`,
    `neat-tint-${tone}-accent`,
  ]),
];

/** The text pairs the kit's components draw, as [text, background]; the row tints are a sample (the theme spec checks all of them). */
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

/** Tokens a WebGL or canvas drawing might take, for the theme colours as numbers. */
const DRAWING_TOKENS = {
  background: '--background',
  foreground: '--foreground',
  primary: '--primary',
  line: '--neat-line',
  series1: '--neat-series-1',
  success: '--success',
} as const;

const formatRgb = (rgb: NeatRgb | null): string =>
  rgb ? rgb.map((channel) => channel.toFixed(3)).join(', ') : 'not a colour';

const WEIGHTS = [400, 500, 700] as const;
const SIZES = [
  { label: '14 px', value: '0.875rem' },
  { label: '16 px', value: '1rem' },
  { label: '20 px', value: '1.25rem' },
  { label: '28 px', value: '1.75rem' },
  { label: '40 px', value: '2.5rem' },
] as const;

/**
 * The theme's tokens, a hand-made topic of the docs (`TopicConfig.page`): the route hands it its
 * group's topics as page tabs, as it does a docs page.
 */
@Component({
  selector: 'app-theme-page',
  imports: [NeatPage, NeatPageTab, NeatPageTabs, RouterLink, Swatch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <!-- DocsPage's tab row, restated: NeatPage projects [neatPageTabs] only from a direct
           child, so a component holding the row could not be shared. -->
      @if (tabs().length) {
        <nav neatPageTabs [attr.aria-label]="tabsLabel()">
          @for (tab of tabs(); track tab.path) {
            <a neatPageTab [routerLink]="tab.path">{{ tab.label }}</a>
          }
        </nav>
      }
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
          <h2>Theme colours as numbers</h2>
          <p class="showcase-muted">
            <code>neatThemeColors</code> answers tokens as sRGB red, green and blue from 0 to 1, for
            code that draws outside CSS (WebGL, a canvas), and reads them again when the scheme
            changes. <code>neatResolveColor</code> resolves any one CSS colour the same way.
          </p>
          <table>
            <thead>
              <tr>
                <th scope="col">Token</th>
                <th scope="col">Sample</th>
                <th scope="col">Red, green, blue</th>
              </tr>
            </thead>
            <tbody>
              @for (row of drawingColors(); track row.token) {
                <tr>
                  <th scope="row" class="showcase-code">{{ row.token }}</th>
                  <td>
                    <span class="rgb-sample" [style.background]="'var(' + row.token + ')'"></span>
                  </td>
                  <td class="showcase-code">{{ row.rgb }}</td>
                </tr>
              }
            </tbody>
          </table>
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
  /** The topics of the page's group, as page tabs; none shows no row. */
  readonly tabs = input<readonly DocsTab[]>([]);
  /** The tabs' landmark name: "Theme topics". */
  readonly tabsLabel = input('Topics');

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
  private readonly drawing = neatThemeColors(DRAWING_TOKENS);
  protected readonly drawingColors = computed(() => {
    const colors = this.drawing();
    return Object.entries(DRAWING_TOKENS).map(([name, token]) => ({
      token,
      rgb: formatRgb(colors[name as keyof typeof DRAWING_TOKENS]),
    }));
  });
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
