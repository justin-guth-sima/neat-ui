import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatField } from '@sima/neat-ui/field';
import { NeatInput } from '@sima/neat-ui/input';
import { NeatNumberField } from '@sima/neat-ui/number-field';
import { NeatSelect, type NeatSelectOption } from '@sima/neat-ui/select';

const SIZES = ['small', 'medium'] as const;

const RESOLUTIONS: NeatSelectOption<string>[] = [
  { value: '1080p30', label: '1920×1080 at 30 fps' },
  { value: '720p30', label: '1280×720 at 30 fps' },
  { value: '480p15', label: '640×480 at 15 fps' },
];
const CLIP_LENGTHS: NeatSelectOption<number>[] = [
  { value: 60, label: '1 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
];

/**
 * A field, two selects and a button, aligned at their bottom edge. In each row, the names share a
 * baseline and the controls their edges.
 *
 * The small row also has a number field, which has no other size.
 */
@Component({
  selector: 'app-a-row-of-controls',
  imports: [NeatButton, NeatField, NeatInput, NeatNumberField, NeatSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (size of sizes; track size) {
      <div class="row">
        <neat-field class="narrow" label="Start Time">
          <input neatInput [size]="size" placeholder="0:00" />
        </neat-field>
        <neat-select
          class="wide"
          label="Target Resolution & FPS"
          showLabel
          [size]="size"
          [options]="resolutions"
          [(value)]="resolution"
        />
        <neat-select
          class="narrow"
          label="Clip Length"
          showLabel
          [size]="size"
          [options]="clipLengths"
          [value]="300"
        />
        @if (size === 'small') {
          <neat-number-field label="Page" [value]="page()" (commit)="page.set($event)" />
        }
        <button neatButton type="button" variant="outlined" [size]="size">Validate</button>
      </div>
    }
  `,
  styleUrl: './a-row-of-controls.example.css',
})
export class ARowOfControls {
  protected readonly sizes = SIZES;
  protected readonly resolutions = RESOLUTIONS;
  protected readonly clipLengths = CLIP_LENGTHS;
  protected readonly resolution = signal<string | null>('1080p30');
  protected readonly page = signal(3);
}
