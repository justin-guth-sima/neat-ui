import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatLiveDot } from '@sima/neat-ui';

/**
 * A still dot, a pulsing one before "Recording 0:34", and a pulsing one in a badge on the video
 * scrim.
 *
 * @gallery
 * @animated
 */
@Component({
  selector: 'app-badges',
  imports: [NeatLiveDot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-badges.example.html',
  styleUrl: './badges.example.css',
})
export class Badges {}
