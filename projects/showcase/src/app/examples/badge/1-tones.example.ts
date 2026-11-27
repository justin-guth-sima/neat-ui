import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatBadge, NeatBadgeButton } from '@sima/neat-ui/badge';
import { BADGES, SURFACES } from './badges';

/**
 * The six tones on the page and on a card, each worded as a stream's slot states are. The words
 * carry the state, and the color repeats it on a tint of itself. The gray of `neutral` shows on
 * both surfaces.
 *
 * The last badge is a `NeatBadgeButton`. It looks the same, and opens more about the status, here a
 * video tile's "Metadata late".
 *
 * @gallery
 */
@Component({
  selector: 'app-tones',
  imports: [NeatBadge, NeatBadgeButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-tones.example.html',
  styleUrl: './surfaces.css',
})
export class Tones {
  protected readonly surfaces = SURFACES;
  protected readonly badges = BADGES;
  protected readonly opened = signal(false);
}
