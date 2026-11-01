import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton, neatStoredSignal } from '@sima/neat-ui';

/** A count kept in localStorage: press, then reload the page, and the count stays. */
@Component({
  selector: 'app-press-counter',
  imports: [NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <span>Pressed {{ presses() }} times</span>
      <button
        neatButton
        type="button"
        variant="outlined"
        size="small"
        (click)="presses.set(presses() + 1)"
      >
        Press
      </button>
      <button neatButton type="button" variant="text" size="small" (click)="presses.set(0)">
        Reset
      </button>
    </div>
  `,
})
export class PressCounter {
  protected readonly presses = neatStoredSignal('neat-ui-showcase:presses', 0, (stored) =>
    typeof stored === 'number' && Number.isInteger(stored) && stored >= 0 ? stored : undefined,
  );
}
