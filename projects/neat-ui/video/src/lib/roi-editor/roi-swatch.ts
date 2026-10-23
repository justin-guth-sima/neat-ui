import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { NeatRoiPolygon } from '../overlays/overlay-settings';
import { OVERLAY_ROI_COLORS } from '../theme/overlay-palette';

/**
 * A dot in the outline colour of a region type, as `neat-roi-editor` draws it on the video: put
 * it before a region's name in a list (`<neat-roi-swatch [type]="region.type" />`) so the list
 * and the image read alike. It is decoration, hidden from assistive technology, so the name next
 * to it must say the type.
 */
@Component({
  selector: 'neat-roi-swatch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.background-color]': 'color()',
  },
  template: '',
  styleUrl: './roi-swatch.css',
})
export class NeatRoiSwatch {
  readonly type = input.required<NeatRoiPolygon['type']>();

  protected readonly color = computed(() => OVERLAY_ROI_COLORS[this.type()].stroke);
}
