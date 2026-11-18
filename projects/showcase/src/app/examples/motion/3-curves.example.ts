import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NEAT_EASINGS, NeatButton, type NeatEasingName, neatEased } from '@sima/neat-ui';
import { NeatProgress } from '@sima/neat-ui/progress';

/** The shares the bars move through, in turn, in percent. */
const SHARES = [0, 100];

/** The catalog's names, in the order the bars stand. */
const CURVES = Object.keys(NEAT_EASINGS) as NeatEasingName[];

/**
 * One bar per curve of the catalog, each fed `neatEased` of the same share with its own `easing`.
 * So a single press moves all four side by side: - ease-in-out, the default, starts and settles
 * gently; - ease-out starts fast; - ease-in starts slow; - linear keeps one pace.
 *
 * @animated
 * @hide button
 * @play click button
 * @play wait 500
 * @play click button
 * @play wait 500
 * @play click button
 * @play wait 500
 */
@Component({
  selector: 'app-curves',
  imports: [NeatButton, NeatProgress],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-curves.example.html',
  styleUrl: './curves.example.css',
})
export class Curves {
  private readonly share = signal(SHARES[0]);
  protected readonly bars = CURVES.map((curve) => {
    const eased = neatEased(this.share, { easing: curve });
    return { curve, value: computed(() => eased() ?? 0) };
  });
  private index = 0;

  protected next(): void {
    this.index = (this.index + 1) % SHARES.length;
    this.share.set(SHARES[this.index]);
  }
}
