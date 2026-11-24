import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatLiveBadge, NeatLiveDot } from '@sima/neat-ui';

/**
 * A still dot, a pulsing one before "Recording 0:34", and one in a live badge (`NeatLiveBadge`) on
 * the video scrim.
 *
 * @gallery
 * @animated
 */
@Component({
  selector: 'app-badges',
  imports: [NeatLiveBadge, NeatLiveDot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-badges.example.html',
})
export class Badges {}
