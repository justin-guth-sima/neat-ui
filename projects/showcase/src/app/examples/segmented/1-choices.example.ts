import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatSegmented, type NeatSegmentedOption } from '@sima/neat-ui/segmented';

/** A choice for the tile's shape; the kit's tiles are always 16:9, so this is the app's own. */
type Shape = '16:9' | '1:1';

const SHAPES: NeatSegmentedOption<Shape>[] = [
  { value: '16:9', label: '16:9', icon: 'aspect-wide' },
  { value: '1:1', label: '1:1', icon: 'aspect-square' },
];
const OVERLAYS: NeatSegmentedOption<string>[] = [
  { value: 'off', label: 'Off' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'masks', label: 'Masks' },
];

/**
 * A choice with icons, one with labels only, and a disabled one. The button calls `focus()`, which
 * lands on the checked option of the tile shape.
 */
@Component({
  selector: 'app-choices',
  imports: [NeatButton, NeatSegmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <neat-segmented #shapeControl label="Tile shape" [options]="shapes" [(value)]="shape" />
      <neat-segmented label="Overlays" [options]="overlays" [(value)]="overlay" />
      <neat-segmented label="Tile shape, disabled" [options]="shapes" value="1:1" disabled />
      <button
        neatButton
        type="button"
        variant="outlined"
        size="small"
        (click)="shapeControl.focus()"
      >
        Focus the tile shape
      </button>
    </div>
    <p class="showcase-code showcase-muted">Shape {{ shape() }}, overlays {{ overlay() }}</p>
  `,
  styleUrl: './choices.example.css',
})
export class Choices {
  protected readonly shapes = SHAPES;
  protected readonly overlays = OVERLAYS;
  protected readonly shape = signal<Shape>('16:9');
  protected readonly overlay = signal('boxes');
}
