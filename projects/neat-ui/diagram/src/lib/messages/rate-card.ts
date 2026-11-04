import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NeatSparkline } from '@sima/neat-ui/charts';
import type { NeatDiagramEdgeRate } from './messages';

const perSecond = (value: number) => `${Math.round(value)} msg/s`;

/**
 * An edge's live numbers, for a note of the diagram:
 *
 * ```html
 * <ng-template neatDiagramNote let-note>
 *   <neat-diagram-rate-card label="Tracker → Gateway" [rate]="messages.rate('tracker-gateway')()"
 *   />
 * </ng-template>
 * ```
 *
 * `showBytes` false leaves the megabytes out, for an app that pushes no sizes (its messages all
 * count 0 bytes, which would read "0.00 MB/s"); the messages and the sparkline stay.
 *
 * Give it `rate(['a', 'b'])` for a note over several edges: the card shows their sum. It shows the
 * label, the messages per second (whole) and the megabytes per second (two decimals,
 * from the bytes in units of 10 kB), and the history as a sparkline named for its messages per
 * second. `stageMs`, a block step's stage time, swaps the megabytes and the sparkline for the time
 * in milliseconds to a tenth: the dots of a step are made up, so they have no sizes. Anything an
 * app wants between the label and the numbers (the latest image of a camera, say) goes in the
 * `[neatRateCardThumbnails]` slot, which the app lays out itself.
 *
 * The note supplies the card's box (its border, fill and padding), so the card has none; its
 * content is 11.5 rem wide, or as wide as its stage line needs when it shows one. The stage line
 * says "Stage"; an app that wants the stage's name in it puts the name in `label`.
 */
@Component({
  selector: 'neat-diagram-rate-card',
  imports: [NeatSparkline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.timed]': 'stage() !== null' },
  template: `
    <div class="label">{{ label() }}</div>
    <ng-content select="[neatRateCardThumbnails]" />
    <div class="numbers">
      <span
        ><span class="value">{{ msgs() }}</span> msg/s</span
      >
      @if (stage() === null && showBytes()) {
        <span
          ><span class="value">{{ megabytes() }}</span> MB/s</span
        >
      }
    </div>
    @if (stage(); as ms) {
      <div class="stage">
        Stage <span class="value">{{ ms }}</span> ms
      </div>
    } @else {
      <neat-sparkline
        [values]="rate().history"
        [label]="label() + ', messages per second'"
        [format]="perSecond"
      />
    }
  `,
  styleUrl: './rate-card.css',
})
export class NeatDiagramRateCard {
  /** What the numbers are of: the edge's or the step's name. */
  readonly label = input.required<string>();
  /** The edge's rate, or the sum over several: `NeatDiagramMessages.rate(edgeIds)`'s value. */
  readonly rate = input.required<NeatDiagramEdgeRate>();
  /**
   * The stage time of a step, in ms: the card then shows it in place of the megabytes and the
   * sparkline. A value that is not a number, or below 0, is no stage time.
   */
  readonly stageMs = input<number | undefined>(undefined);

  /**
   * Whether the megabytes per second show. False for an app that pushes no sizes, so the card
   * does not say "0.00 MB/s". A step's stage time shows in place of the megabytes either way.
   */
  readonly showBytes = input(true);

  protected readonly perSecond = perSecond;
  protected readonly msgs = computed(() => String(Math.round(this.rate().msgsPerSec)));
  /** Bytes per second as megabytes, in hundredths: units of 10 kB, as the demo shows them. */
  protected readonly megabytes = computed(() =>
    (Math.round(this.rate().bytesPerSec / 1e4) / 100).toFixed(2),
  );
  /** The stage time as shown, or null while the card has none. */
  protected readonly stage = computed(() => {
    const ms = this.stageMs();
    return ms !== undefined && Number.isFinite(ms) && ms >= 0 ? ms.toFixed(1) : null;
  });
}
