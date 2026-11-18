import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatDetails } from '@sima/neat-ui/details';

/**
 * Two lists on one term column: `--neat-details-term-width` is set on their common ancestor. The
 * first list's longest term is wider than the column, so it breaks inside the word.
 */
@Component({
  selector: 'app-aligned-lists',
  imports: [NeatDetails],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-aligned-lists.example.html',
  styleUrls: ['./panel.css', './aligned-lists.example.css'],
})
export class AlignedLists {}
