import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NeatSlider } from '@sima/neat-ui/slider';
import { NeatTileGrid, type NeatTileLayout } from '@sima/neat-ui/video';

const TILE_COUNT = 48;
const TILES = Array.from({ length: TILE_COUNT }, (_, index) => index + 1);

/**
 * Forty-eight numbered tiles in a box of a fixed height. The slider sets the tile width, and the
 * readout is the layout the grid reported: the page shows only the tiles that fit. Resize the
 * window to repack.
 */
@Component({
  selector: 'app-packing',
  imports: [NeatSlider, NeatTileGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="width">
      <span>Tile width</span>
      <neat-slider label="Tile width" [min]="120" [max]="480" [step]="10" [(value)]="tileWidth" />
      <span class="showcase-code showcase-muted">{{ tileWidth() }} px</span>
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
export class Packing {
  protected readonly tileWidth = signal(240);
  protected readonly layout = signal<NeatTileLayout | null>(null);
  protected readonly visible = computed(() => TILES.slice(0, this.layout()?.perPage ?? TILE_COUNT));
  protected readonly summary = computed(() => {
    const layout = this.layout();
    return layout
      ? `${layout.columns} × ${layout.rows} = ${layout.perPage} per page of ${TILE_COUNT}, gap ${layout.gap} px`
      : 'Measuring';
  });
}
