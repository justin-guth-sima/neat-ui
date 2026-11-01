import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatNumberField } from '@sima/neat-ui/number-field';

/** A field without `accept`: type 0 or 4096 and it commits, as any whole number does. */
@Component({
  selector: 'app-any-whole-number',
  imports: [NeatNumberField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-number-field label="Draw on channel" [value]="channel()" (commit)="channel.set($event)" />
    <p class="showcase-code showcase-muted">Channel {{ channel() }}</p>
  `,
})
export class AnyWholeNumber {
  protected readonly channel = signal(2);
}
