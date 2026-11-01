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
import { NeatButton, NeatPage } from '@sima/neat-ui';
import { NeatSegmented, type NeatSegmentedOption } from '@sima/neat-ui/segmented';
import { NeatSlider } from '@sima/neat-ui/slider';
import { NeatSwitch } from '@sima/neat-ui/switch';
import {
  NeatRoiEditor,
  type NeatRoiDrawMode,
  type NeatRoiPolygon,
  neatRoiNames,
  NeatRoiSwatch,
  NeatTileGrid,
  type NeatTileLayout,
  type NeatTileState,
  NeatVideoTile,
} from '@sima/neat-ui/video';
import { TestPatternSource } from './test-pattern-source';

const TILE_COUNT = 48;
const PLACEHOLDER_TILES = Array.from({ length: TILE_COUNT }, (_, index) => index + 1);

const ROI_MODES: NeatSegmentedOption<NeatRoiDrawMode>[] = [
  { value: 'off', label: 'Off' },
  { value: 'inclusion', label: 'Inclusion' },
  { value: 'exclusion', label: 'Exclusion' },
];

@Component({
  selector: 'app-components-page',
  imports: [
    NeatButton,
    NeatPage,
    NeatRoiEditor,
    NeatRoiSwatch,
    NeatSegmented,
    NeatSlider,
    NeatSwitch,
    NeatTileGrid,
    NeatVideoTile,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Tile grid</h2>
          <p class="showcase-muted">
            <code>neat-tile-grid</code> packs tiles of a chosen width into its own box with no
            overflow and no scrolling, centring what is left over. The count per page follows from
            the width (<code>layout</code>), so the page slices its items to <code>perPage</code>.
            The box below is fixed in height; resize the window to repack.
          </p>
          <div class="slider-field">
            <span>Tile width</span>
            <neat-slider
              label="Tile width"
              [min]="120"
              [max]="480"
              [step]="10"
              [(value)]="tileWidth"
            />
            <span class="showcase-code showcase-muted">{{ tileWidth() }} px</span>
          </div>
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
          <div class="showcase-row">
            <button neatSwitch [(checked)]="tileBars">Bars</button>
            <button neatSwitch [(checked)]="tileSelected">Selected</button>
            <button neatSwitch (checkedChange)="testPattern.setPaused($event)">
              Pause the source
            </button>
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

        <section class="showcase-section">
          <h2>ROI editor</h2>
          <p class="showcase-muted">
            <code>neat-roi-editor</code> draws regions of interest on a tile's image and adds
            polygons by clicks: one per point, a click on the first point or a double-click to close
            it (three points at least), Escape to cancel. It is placed in the tile with
            <code>neatTileOverlay</code> and follows the image, not the letterbox, so the points
            stay on the picture when the tile resizes. It owns no regions: the page keeps them and
            takes each closed polygon from <code>regionsChange</code>. In every mode, Off included,
            hovering a region highlights it (<code>highlighted</code>, two-way, for the app's list)
            and a right-click on one offers Delete. The tile plays the same test pattern as the one
            above: pause that source and the tile stops, and the editor keeps working on the tile's
            full box. <code>neat-roi-swatch</code> is the dot a region list puts before each name.
          </p>
          <div class="showcase-row">
            <neat-segmented label="Drawing mode" [options]="roiModes" [(value)]="roiMode" />
            <button neatButton type="button" variant="outlined" (click)="roiRegions.set([])">
              Clear regions
            </button>
            <span class="roi-key"><neat-roi-swatch type="inclusion" />Inclusion</span>
            <span class="roi-key"><neat-roi-swatch type="exclusion" />Exclusion</span>
          </div>
          <p class="showcase-code showcase-muted" aria-live="polite">{{ roiSummary() }}</p>
          <div class="video-demo">
            <div class="video-demo-cell">
              <neat-video-tile [source]="testPattern" [bars]="false">
                <neat-roi-editor
                  neatTileOverlay
                  [regions]="roiRegions()"
                  [mode]="roiMode()"
                  [(highlighted)]="roiHighlighted"
                  (regionsChange)="roiRegions.set($event)"
                />
              </neat-video-tile>
            </div>
          </div>
        </section>
      </div>
    </neat-page>
  `,
  styleUrl: './components.page.css',
})
export class ComponentsPage {
  protected readonly tileWidth = signal(240);
  protected readonly layout = signal<NeatTileLayout | null>(null);
  protected readonly visibleTiles = computed(() =>
    PLACEHOLDER_TILES.slice(0, this.layout()?.perPage ?? TILE_COUNT),
  );
  protected readonly layoutSummary = computed(() => {
    const layout = this.layout();
    return layout
      ? `${layout.columns} × ${layout.rows} = ${layout.perPage} per page of ${TILE_COUNT}, gap ${layout.gap} px`
      : 'Measuring';
  });

  protected readonly testPattern = new TestPatternSource();
  protected readonly tileBars = signal(true);
  protected readonly tileSelected = signal(false);
  protected readonly tileState = signal<NeatTileState>('empty');
  protected readonly tileSummary = computed(() => `First tile: ${this.tileState()}`);

  protected readonly roiModes = ROI_MODES;
  protected readonly roiMode = signal<NeatRoiDrawMode>('inclusion');
  protected readonly roiRegions = signal<readonly NeatRoiPolygon[]>([]);
  protected readonly roiHighlighted = signal<number | null>(null);
  protected readonly roiSummary = computed(() => {
    const regions = this.roiRegions();
    const count = (type: NeatRoiPolygon['type']) =>
      regions.filter((region) => region.type === type).length;
    const index = this.roiHighlighted();
    // Named as the editor's Delete and an app's region list name it.
    const highlighted = (index === null ? undefined : neatRoiNames(regions)[index]) ?? 'none';
    return `Regions: ${regions.length} (${count('inclusion')} inclusion, ${count('exclusion')} exclusion) · highlighted: ${highlighted}`;
  });

  constructor() {
    const document = inject(DOCUMENT);
    afterNextRender(() => this.testPattern.start(document));
    inject(DestroyRef).onDestroy(() => this.testPattern.stop());
  }
}
