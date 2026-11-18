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
  NEAT_OVERLAY_DEFAULTS,
  NeatRoiEditor,
  type NeatOverlaySettings,
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
 * The box crosses the middle of the image, which is 640 by 360, with its center at mid height; this
 * exclusion region, an uneven heptagon as a hand would draw it, straddles that line, so the box
 * vanishes as its center enters the region and returns as it leaves.
 */
const STARTING_REGIONS: readonly NeatRoiPolygon[] = [
  {
    type: 'exclusion',
    points: [
      { x: 0.42, y: 0.18 },
      { x: 0.57, y: 0.24 },
      { x: 0.63, y: 0.45 },
      { x: 0.58, y: 0.72 },
      { x: 0.47, y: 0.82 },
      { x: 0.36, y: 0.63 },
      { x: 0.38, y: 0.36 },
    ],
  },
];

/**
 * An editor on a tile that plays a test pattern, with the page keeping the regions.
 *
 * Try drawing polygons in either mode. Then hover one to highlight it, and the readout names it, or
 * right-click it to delete it. While drawing, a right-click or Backspace takes back the last point.
 *
 * The tile gets the same regions to filter with, so a box shows only where the regions let it.
 * Pause the source and the tile stops, and the editor keeps working on the tile's whole box.
 *
 * @gallery
 * @animated 6s
 */
@Component({
  selector: 'app-drawing-regions',
  imports: [NeatButton, NeatRoiEditor, NeatRoiSwatch, NeatSegmented, NeatSwitch, NeatVideoTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-drawing-regions.example.html',
  styleUrl: './drawing-regions.example.css',
})
export class DrawingRegions {
  protected readonly testPattern = new TestPatternSource();
  protected readonly modes = MODES;
  protected readonly mode = signal<NeatRoiDrawMode>('inclusion');
  protected readonly regions = signal<readonly NeatRoiPolygon[]>(STARTING_REGIONS);
  /**
   * The editor draws the regions, so the tile's own outline is off; the tile filters by them all
   * the same, as `applyRoiFiltering` is on in the defaults.
   */
  protected readonly settings = computed<NeatOverlaySettings>(() => ({
    ...NEAT_OVERLAY_DEFAULTS,
    general: { ...NEAT_OVERLAY_DEFAULTS.general, showRoi: false },
    roi: this.regions(),
  }));
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
