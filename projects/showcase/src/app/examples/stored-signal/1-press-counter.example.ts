import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton, neatStoredSignal } from '@sima/neat-ui';

/**
 * A count kept in localStorage: press, then reload the page, and the count stays.
 *
 * @unpictured
 */
@Component({
  selector: 'app-press-counter',
  imports: [NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-press-counter.example.html',
})
export class PressCounter {
  protected readonly presses = neatStoredSignal('neat-ui-showcase:presses', 0, (stored) =>
    typeof stored === 'number' && Number.isInteger(stored) && stored >= 0 ? stored : undefined,
  );
}
