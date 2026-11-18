import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { type NeatBreadcrumb, NeatBreadcrumbs, NeatInlineButton, NeatNote } from '@sima/neat-ui';

const PLACES: readonly NeatBreadcrumb[] = [
  { label: 'Overview' },
  { label: 'Detector', detail: 'YOLOX' },
  { label: 'Backbone', detail: 'CSPDarknet' },
  { label: 'Stages', detail: 'four stages' },
];

/**
 * A model's levels as a path. `go` emits the index of the crumb pressed, and the app cuts the path
 * there; press Deeper to walk it forward again. The last crumb shows its detail, muted.
 *
 * @gallery
 */
@Component({
  selector: 'app-walking-a-path',
  imports: [NeatBreadcrumbs, NeatInlineButton, NeatNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-walking-a-path.example.html',
  styleUrl: './walking-a-path.example.css',
})
export class WalkingAPath {
  protected readonly places = PLACES;
  /** How many of the places the path has walked. */
  protected readonly depth = signal(3);
  protected readonly path = computed(() => PLACES.slice(0, this.depth()));
}
