import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NeatButton, neatEased } from '@sima/neat-ui';

/** The shares the bar moves through, in turn, as a percent of the track. */
const SHARES = [20, 85, 40, 100];

/**
 * A bar whose width is `neatEased` of a signal: the signal jumps on every press, the bar eases to
 * it, and nothing else in the component deals with the animation.
 */
@Component({
  selector: 'app-eased-signal',
  imports: [NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="track"><div class="fill" [style.width.%]="width()"></div></div>
    <button neatButton type="button" variant="outlined" size="small" (click)="next()">
      Next share
    </button>
  `,
  styleUrl: './eased-signal.example.css',
})
export class EasedSignal {
  private readonly share = signal(SHARES[0]);
  private readonly eased = neatEased(this.share);
  protected readonly width = computed(() => this.eased() ?? 0);
  private index = 0;

  protected next(): void {
    this.index = (this.index + 1) % SHARES.length;
    this.share.set(SHARES[this.index]);
  }
}
