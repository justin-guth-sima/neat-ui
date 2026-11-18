import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton, NeatStale } from '@sima/neat-ui';

/** A readout from before a connection dropped. Press Stale to switch it between stale and fresh. */
@Component({
  selector: 'app-lost-connection',
  imports: [NeatButton, NeatStale],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-lost-connection.example.html',
})
export class LostConnection {
  protected readonly stale = signal(true);
}
