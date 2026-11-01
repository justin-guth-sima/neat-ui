import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NeatButton, neatEased } from '@sima/neat-ui';
import { NeatProgress } from '@sima/neat-ui/progress';

/** The shares the bar moves through, in turn, in percent. */
const SHARES = [20, 85, 40, 100];

/**
 * A progress bar whose value is `neatEased` of a signal: the signal jumps on every press, the bar
 * eases to it, and nothing else in the component deals with the animation.
 */
@Component({
  selector: 'app-eased-signal',
  imports: [NeatButton, NeatProgress],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-progress label="Share" [value]="value()" />
    <button neatButton type="button" variant="outlined" size="small" (click)="next()">
      Next share
    </button>
  `,
  styleUrl: './eased-signal.example.css',
})
export class EasedSignal {
  private readonly share = signal(SHARES[0]);
  private readonly eased = neatEased(this.share);
  protected readonly value = computed(() => this.eased() ?? 0);
  private index = 0;

  protected next(): void {
    this.index = (this.index + 1) % SHARES.length;
    this.share.set(SHARES[this.index]);
  }
}
