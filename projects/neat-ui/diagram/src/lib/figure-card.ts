import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NeatEasedNumber } from '@sima/neat-ui';
import { NeatSparkline } from '@sima/neat-ui/charts';
import type { NeatChartFormat } from '@sima/neat-ui/charts';

/**
 * A labeled figure for a note of the diagram, such as a count or a time:
 *
 * ```html
 * <ng-template neatDiagramNote let-note>
 *   <neat-diagram-figure-card label="Active tracks" unit="alive" [value]="tracks()"
 *     [history]="trackHistory()" />
 * </ng-template>
 * ```
 *
 * It shows:
 * - the label;
 * - the value with its unit, and the caption at the end of that line;
 * - the history, as a sparkline, when it has one.
 *
 * Use it for a figure that is not an edge's rate. An edge's messages per second go in a
 * `NeatDiagramRateCard`, which looks the same, so a diagram's notes read as one set.
 *
 * The value eases to each new one as `NeatEasedNumber` does, in tabular digits, and "–" stands in
 * while there is none. The caption is words the app has already worded: "237 per second".
 *
 * The sparkline is named by the label and words its samples with the value's digits and unit:
 * "Active tracks: 30 recent samples, 2 alive to 8 alive". An empty history still draws its box, so
 * the card does not jump when the first samples arrive.
 *
 * The note supplies the card's box, with its border, fill and padding, so the card has none. Its
 * content is 11.5 rem wide.
 */
@Component({
  selector: 'neat-diagram-figure-card',
  imports: [NeatEasedNumber, NeatSparkline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="label">{{ label() }}</div>
    <div class="numbers">
      <span
        ><neat-eased-number class="value" [value]="value()" [digits]="digits()" />
        @if (unit()) {
          {{ unit() }}
        }
      </span>
      @if (caption()) {
        <span>{{ caption() }}</span>
      }
    </div>
    @if (history(); as history) {
      <neat-sparkline [values]="history" [label]="label()" [format]="format()" />
    }
  `,
  styleUrl: './figure-card.css',
})
export class NeatDiagramFigureCard {
  /** What the figure is: "Active tracks", "MLA benchmark". */
  readonly label = input.required<string>();
  /** The figure; null or undefined while there is none, which shows as "–". */
  readonly value = input.required<number | null | undefined>();
  /** Digits after the decimal point, for the value and the sparkline's words. */
  readonly digits = input(0);
  /** The value's unit, after it: "alive", "ms per call". None by default. */
  readonly unit = input('');
  /** Words at the end of the value's line, muted: "237 per second". None by default. */
  readonly caption = input('');
  /**
   * The figure's recent values, oldest first, for a sparkline under the value; `null` for one that
   * was not taken. Without a history the card has no sparkline.
   */
  readonly history = input<readonly (number | null)[] | null | undefined>(undefined);

  /** A sample in the sparkline's words: the value's digits and its unit. */
  protected readonly format = computed<NeatChartFormat>(() => {
    const digits = this.digits();
    const unit = this.unit();
    return (value) => (unit ? `${value.toFixed(digits)} ${unit}` : value.toFixed(digits));
  });
}
