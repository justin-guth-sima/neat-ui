import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatLiveDot } from '@sima/neat-ui';

/**
 * A still dot, a pulsing one before "Recording 0:34", and a pulsing one in a badge on the video
 * scrim.
 */
@Component({
  selector: 'app-badges',
  imports: [NeatLiveDot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <span class="showcase-row"><neat-live-dot /> Still</span>
      <span class="showcase-row"><neat-live-dot pulse /> Recording 0:34</span>
      <span class="showcase-row badge"><neat-live-dot pulse /> Live</span>
    </div>
  `,
  styleUrl: './badges.example.css',
})
export class Badges {}
