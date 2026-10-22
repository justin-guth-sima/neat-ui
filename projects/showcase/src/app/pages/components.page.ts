import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  NeatButton,
  type NeatButtonSize,
  type NeatButtonVariant,
  NeatIcon,
  NeatPage,
  NeatTileGrid,
  type NeatTileLayout,
  type NeatTileState,
  NeatTooltip,
  type NeatTooltipPosition,
  NeatVideoTile,
} from '@sima/neat-ui';
import { TestPatternSource } from './test-pattern-source';

const VARIANTS: NeatButtonVariant[] = ['primary', 'secondary', 'outlined', 'text', 'danger'];
const SIZES: NeatButtonSize[] = ['small', 'medium', 'large', 'touch'];
const ICON_SIZES = [16, 20, 24] as const;
const TOOLTIP_POSITIONS: NeatTooltipPosition[] = ['top', 'right', 'bottom', 'left'];
const TILE_COUNT = 48;
const PLACEHOLDER_TILES = Array.from({ length: TILE_COUNT }, (_, index) => index + 1);

@Component({
  selector: 'app-components-page',
  imports: [NeatButton, NeatIcon, NeatPage, NeatTileGrid, NeatTooltip, NeatVideoTile, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Button</h2>
          <p class="showcase-muted">
            <code>neatButton</code> on a <code>button</code> or <code>a</code>: five variants in
            four sizes, then icon-only and rounded. Primary is the app's accent; secondary is the
            neutral choice; touch is a 48 px target for kiosk and touch screens.
          </p>
          @for (variant of variants; track variant) {
            <h3>{{ variant }}</h3>
            <div class="showcase-row">
              @for (size of sizes; track size) {
                <button neatButton type="button" [variant]="variant" [size]="size">
                  {{ size }}
                </button>
              }
              @for (size of sizes; track size) {
                <button
                  neatButton
                  type="button"
                  [variant]="variant"
                  [size]="size"
                  iconOnly
                  [attr.aria-label]="'Stream, ' + size"
                >
                  <neat-icon name="streaming" />
                </button>
              }
              <button neatButton type="button" [variant]="variant" rounded>rounded</button>
              <button
                neatButton
                type="button"
                [variant]="variant"
                rounded
                iconOnly
                aria-label="Stream, rounded"
              >
                <neat-icon name="streaming" />
              </button>
            </div>
          }
        </section>

        <section class="showcase-section">
          <h2>Button states</h2>
          <p class="showcase-muted">
            With a <code>neat-icon</code> before the label, disabled, and as a link, per variant.
          </p>
          @for (variant of variants; track variant) {
            <div class="showcase-row">
              <button neatButton type="button" [variant]="variant">
                <neat-icon name="streaming" [size]="16" />
                With icon
              </button>
              <button neatButton type="button" [variant]="variant" disabled>Disabled</button>
              <!-- Links back to this page, so trying it navigates nowhere. -->
              <a neatButton [variant]="variant" routerLink="/components">Link</a>
            </div>
          }
        </section>

        <section class="showcase-section">
          <h2>Buttons on a card</h2>
          <p class="showcase-muted">
            On the card surface, which differs from the page background in dark mode. Hover each
            one: the fill must stay visible.
          </p>
          <div class="card showcase-row">
            @for (variant of variants; track variant) {
              <button neatButton type="button" [variant]="variant">{{ variant }}</button>
            }
          </div>
        </section>

        <section class="showcase-section">
          <h2>Tooltip</h2>
          <p class="showcase-muted">
            <code>neatTooltip</code>: on mouse hover and on keyboard focus, never on touch, so it
            repeats the control's accessible name rather than adding to it. In all four positions.
          </p>
          <div class="showcase-row">
            @for (position of tooltipPositions; track position) {
              <button
                neatButton
                type="button"
                variant="outlined"
                [neatTooltip]="'Tooltip on the ' + position"
                [neatTooltipPosition]="position"
              >
                {{ position }}
              </button>
            }
          </div>
        </section>

        <section class="showcase-section">
          <h2>Icon</h2>
          <p class="showcase-muted">
            At 16, 20 and 24 px. Without a label an icon is decorative and hidden from assistive
            technology; with one it is exposed as an image with that name.
          </p>
          <div class="showcase-row">
            @for (size of iconSizes; track size) {
              <div class="icon-sample">
                <neat-icon name="board" [size]="size" />
                <span class="showcase-code showcase-muted">{{ size }} px</span>
              </div>
            }
          </div>
          <div class="showcase-row">
            @for (size of iconSizes; track size) {
              <div class="icon-sample">
                <neat-icon name="board" [size]="size" label="Board" />
                <span class="showcase-code showcase-muted">{{ size }} px, label</span>
              </div>
            }
          </div>
        </section>

        <section class="showcase-section">
          <h2>Tile grid</h2>
          <p class="showcase-muted">
            <code>neat-tile-grid</code> packs tiles of a chosen width into its own box with no
            overflow and no scrolling, centring what is left over. The count per page follows from
            the width (<code>layout</code>), so the page slices its items to <code>perPage</code>.
            The box below is fixed in height; resize the window to repack.
          </p>
          <!-- Task 5 of plan 2a replaces this native range input with neat-slider. -->
          <label class="slider-field">
            <span>Tile width</span>
            <input
              type="range"
              min="120"
              max="480"
              step="10"
              [value]="tileWidth()"
              (input)="setTileWidth($event)"
            />
            <span class="showcase-code showcase-muted">{{ tileWidth() }} px</span>
          </label>
          <p class="showcase-code showcase-muted" aria-live="polite">{{ layoutSummary() }}</p>
          <div class="tile-demo">
            <neat-tile-grid
              [tileWidth]="tileWidth()"
              [count]="visibleTiles().length"
              (layout)="layout.set($event)"
            >
              @for (tile of visibleTiles(); track tile) {
                <div class="demo-tile">{{ tile }}</div>
              }
            </neat-tile-grid>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Video tile</h2>
          <p class="showcase-muted">
            <code>neat-video-tile</code> plays a source's video with its metadata drawn over the
            frames it describes, and fills the box it is given. The first tile plays a canvas test
            pattern with a detection every other frame, held in between; pause it and it goes
            stopped after 1.8 s without a frame. The second has no stream, so it is empty. With bars
            off a tile is only video and overlay.
          </p>
          <!-- Task 5 of plan 2a replaces these native checkboxes with neat-switch. -->
          <div class="showcase-row">
            <label class="check-field">
              <input
                type="checkbox"
                [checked]="tileBars()"
                (change)="tileBars.set(checked($event))"
              />
              Bars
            </label>
            <label class="check-field">
              <input
                type="checkbox"
                [checked]="tileSelected()"
                (change)="tileSelected.set(checked($event))"
              />
              Selected
            </label>
            <label class="check-field">
              <input type="checkbox" (change)="testPattern.setPaused(checked($event))" />
              Pause the source
            </label>
          </div>
          <p class="showcase-code showcase-muted" aria-live="polite">{{ tileSummary() }}</p>
          <div class="video-demo">
            <div class="video-demo-cell">
              <neat-video-tile
                [source]="testPattern"
                label="1"
                status="Test pattern · 640×360 · 30 fps"
                [bars]="tileBars()"
                [selected]="tileSelected()"
                (stateChange)="tileState.set($event)"
              >
                <span neatTileChip class="demo-chip">Demo</span>
              </neat-video-tile>
            </div>
            <div class="video-demo-cell">
              <neat-video-tile label="2" status="Waiting for stream" [bars]="tileBars()" />
            </div>
          </div>
        </section>
      </div>
    </neat-page>
  `,
  styleUrl: './components.page.css',
})
export class ComponentsPage {
  protected readonly variants = VARIANTS;
  protected readonly sizes = SIZES;
  protected readonly iconSizes = ICON_SIZES;
  protected readonly tooltipPositions = TOOLTIP_POSITIONS;

  protected readonly tileWidth = signal(240);
  protected readonly layout = signal<NeatTileLayout | null>(null);
  protected readonly visibleTiles = computed(() =>
    PLACEHOLDER_TILES.slice(0, this.layout()?.perPage ?? TILE_COUNT),
  );
  protected readonly layoutSummary = computed(() => {
    const layout = this.layout();
    return layout
      ? `${layout.columns} × ${layout.rows} = ${layout.perPage} per page of ${TILE_COUNT}`
      : 'Measuring';
  });

  protected readonly testPattern = new TestPatternSource();
  protected readonly tileBars = signal(true);
  protected readonly tileSelected = signal(false);
  protected readonly tileState = signal<NeatTileState>('empty');
  protected readonly tileSummary = computed(() => `First tile: ${this.tileState()}`);

  constructor() {
    const document = inject(DOCUMENT);
    afterNextRender(() => this.testPattern.start(document));
    inject(DestroyRef).onDestroy(() => this.testPattern.stop());
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected setTileWidth(event: Event): void {
    this.tileWidth.set(Number((event.target as HTMLInputElement).value));
  }
}
