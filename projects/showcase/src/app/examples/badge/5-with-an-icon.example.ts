import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatIcon } from '@sima/neat-ui';
import { NeatBadge } from '@sima/neat-ui/badge';

/**
 * A `NeatIcon` before the words, at Spartan's badge icon size, `[size]="12"`. The badge lays the
 * icon and the words out in a row with a small gap. The icon repeats the words; the words still
 * say the state.
 */
@Component({
  selector: 'app-with-an-icon',
  imports: [NeatBadge, NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './5-with-an-icon.example.html',
})
export class WithAnIcon {}
