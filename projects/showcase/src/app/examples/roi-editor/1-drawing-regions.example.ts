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
import { NeatButton } from '@sima/neat-ui';
import { NeatSegmented, type NeatSegmentedOption } from '@sima/neat-ui/segmented';
import { NeatSwitch } from '@sima/neat-ui/switch';
import {
  NeatRoiEditor,
  type NeatRoiDrawMode,
  type NeatRoiPolygon,
  neatRoiNames,
  NeatRoiSwatch,
  NeatVideoTile,
} from '@sima/neat-ui/video';
import { TestPatternSource } from './test-pattern-source';

const MODES: NeatSegmentedOption<NeatRoiDrawMode>[] = [
  { value: 'off', label: 'Off' },
  { value: 'inclusion', label: 'Inclusion' },
  { value: 'exclusion', label: 'Exclusion' },
];

/**
 * An editor on a tile that plays a test pattern, with the page keeping the regions: draw
 * polygons in either mode, then hover one to highlight it (the readout names it) or right-click
 * it to delete it. Pause the source and the tile stops, and the editor keeps working on the
 * tile's whole box.
 */
@Component({
  selector: 'app-drawing-regions',
  imports: [NeatButton, NeatRoiEditor, NeatRoiSwatch, NeatSegmented, NeatSwitch, NeatVideoTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <neat-segmented label="Drawing mode" [options]="modes" [(value)]="mode" />
      <button neatButton type="button" variant="outlined" (click)="regions.set([])">
        Clear regions
      </button>
      <button neatSwitch (checkedChange)="testPattern.setPaused($event)">Pause the source</button>
      <span class="key"><neat-roi-swatch type="inclusion" />Inclusion</span>
      <span class="key"><neat-roi-swatch type="exclusion" />Exclusion</span>
    </div>
    <p class="showcase-code showcase-muted" aria-live="polite">{{ summary() }}</p>
    <div class="cell">
      <neat-video-tile [source]="testPattern" [bars]="false">
        <neat-roi-editor
          neatTileOverlay
          [regions]="regions()"
          [mode]="mode()"
          [(highlighted)]="highlighted"
          (regionsChange)="regions.set($event)"
        />
      </neat-video-tile>
    </div>
  `,
  styleUrl: './drawing-regions.example.css',
})
export class DrawingRegions {
  protected readonly testPattern = new TestPatternSource();
  protected readonly modes = MODES;
  protected readonly mode = signal<NeatRoiDrawMode>('inclusion');
  protected readonly regions = signal<readonly NeatRoiPolygon[]>([]);
  protected readonly highlighted = signal<number | null>(null);
  protected readonly summary = computed(() => {
    const regions = this.regions();
    const count = (type: NeatRoiPolygon['type']) =>
      regions.filter((region) => region.type === type).length;
    const index = this.highlighted();
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
