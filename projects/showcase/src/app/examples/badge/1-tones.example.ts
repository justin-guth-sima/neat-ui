import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatStatusChip, NeatStatusChipButton } from '@sima/neat-ui/status-chip';
import { CHIPS, SURFACES } from './chips';

/**
 * The six tones on the page and on a card, each worded as a stream's slot states are. The words
 * carry the state, and the color repeats it. The gray of `neutral` shows on both surfaces.
 *
 * The last chip is a `NeatStatusChipButton`. It looks the same, and opens more about the status,
 * here a video tile's "Metadata late".
 *
 * @gallery
 */
@Component({
  selector: 'app-tones',
  imports: [NeatStatusChip, NeatStatusChipButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-tones.example.html',
  styleUrl: './surfaces.css',
})
export class Tones {
  protected readonly surfaces = SURFACES;
  protected readonly chips = CHIPS;
  protected readonly opened = signal(false);
}
