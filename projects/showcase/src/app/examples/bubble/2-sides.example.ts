import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBadge } from '@sima/neat-ui/badge';
import { NeatBubble, type NeatBubbleSide } from '@sima/neat-ui/bubble';

/**
 * A bubble on each side of what it points at, by `side`. Where a side has no room, its bubble
 * takes the side across, then another, and its tail keeps pointing at the anchor.
 *
 * @play wait 300
 */
@Component({
  selector: 'app-sides',
  imports: [NeatBubble, NeatBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-sides.example.html',
  styleUrl: './bubble.example.css',
})
export class Sides {
  protected readonly sides: readonly NeatBubbleSide[] = ['top', 'right', 'bottom', 'left'];
}
