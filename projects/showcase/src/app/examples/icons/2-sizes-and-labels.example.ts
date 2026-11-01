import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatIcon } from '@sima/neat-ui';

/**
 * An icon at 16, 20 (the default) and 24 px. Without a `label` it is decorative and hidden from
 * assistive technology; with one it is exposed as an image with that name.
 */
@Component({
  selector: 'app-sizes-and-labels',
  imports: [NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      @for (size of sizes; track size) {
        <div class="sample">
          <neat-icon name="board" [size]="size" />
          <span class="showcase-code showcase-muted">{{ size }} px</span>
        </div>
      }
    </div>
    <div class="showcase-row">
      @for (size of sizes; track size) {
        <div class="sample">
          <neat-icon name="board" [size]="size" label="Board" />
          <span class="showcase-code showcase-muted">{{ size }} px, label</span>
        </div>
      }
    </div>
  `,
  styleUrl: './sizes-and-labels.example.css',
})
export class SizesAndLabels {
  protected readonly sizes = [16, 20, 24] as const;
}
