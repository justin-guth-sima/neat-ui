import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton, NeatStale } from '@sima/neat-ui';

/** A readout from before a connection dropped. Press Stale to switch it between stale and fresh. */
@Component({
  selector: 'app-lost-connection',
  imports: [NeatButton, NeatStale],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <span [neatStale]="stale()">12.4 fps · 3 objects</span>
      @if (stale()) {
        <span class="showcase-muted">Connection lost</span>
      }
      <button
        neatButton
        type="button"
        variant="outlined"
        size="small"
        [pressed]="stale()"
        (click)="stale.set(!stale())"
      >
        Stale
      </button>
    </div>
  `,
})
export class LostConnection {
  protected readonly stale = signal(true);
}
