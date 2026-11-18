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
  templateUrl: './2-sizes-and-labels.example.html',
  styleUrl: './sizes-and-labels.example.css',
})
export class SizesAndLabels {
  protected readonly sizes = [16, 20, 24] as const;
}
