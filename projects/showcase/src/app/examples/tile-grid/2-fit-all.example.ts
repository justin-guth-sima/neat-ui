import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatSlider } from '@sima/neat-ui/slider';
import {
  fitAllTileWidth,
  NEAT_MIN_TILE_WIDTH,
  NeatTileGrid,
  type NeatTileLayout,
} from '@sima/neat-ui/video';

const TILE_COUNT = 12;
const TILES = Array.from({ length: TILE_COUNT }, (_, index) => index + 1);

/**
 * Twelve numbered tiles, and a button that sets the tile width to the widest one at which all
 * twelve fit the box. It works from the area and the gap the grid reported. Try resizing the window
 * and pressing it again.
 */
@Component({
  selector: 'app-fit-all',
  imports: [NeatButton, NeatSlider, NeatTileGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="width">
      <span>Tile width</span>
      <neat-slider
        label="Tile width"
        [min]="minWidth"
        [max]="480"
        [step]="1"
        [(value)]="tileWidth"
      />
      <span class="showcase-code showcase-muted">{{ tileWidth() }} px</span>
      <button neatButton type="button" variant="outlined" size="small" (click)="fitAll()">
        Fit all
      </button>
    </div>
    <p class="showcase-code showcase-muted" aria-live="polite">{{ summary() }}</p>
    <div class="box">
      <neat-tile-grid
        [tileWidth]="tileWidth()"
        [count]="visible().length"
        (layout)="layout.set($event)"
      >
        @for (tile of visible(); track tile) {
          <div class="tile">{{ tile }}</div>
        }
      </neat-tile-grid>
    </div>
  `,
  styleUrl: './tile-box.css',
})
export class FitAll {
  protected readonly minWidth = NEAT_MIN_TILE_WIDTH;
  protected readonly tileWidth = signal(240);
  protected readonly layout = signal<NeatTileLayout | null>(null);
  protected readonly visible = computed(() => TILES.slice(0, this.layout()?.perPage ?? TILE_COUNT));
  protected readonly summary = computed(() => {
    const layout = this.layout();
    return layout
      ? `${this.visible().length} of ${TILE_COUNT} tiles on the page, ${layout.columns} × ${layout.rows}`
      : 'Measuring';
  });

  protected fitAll(): void {
    const layout = this.layout();
    if (layout === null) return;
    const area = { width: layout.areaWidth, height: layout.areaHeight };
    this.tileWidth.set(fitAllTileWidth(area, TILE_COUNT, layout.gap));
  }
}
