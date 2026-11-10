import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { isNumber } from './geometry';
import { neatLabelColor } from './label-color';

/** One class and the score a classifier gave it, 0 to 1. */
export interface NeatScore {
  readonly label: string;
  /** Clamped to 0..1 for the bar; anything that is not a finite number draws an empty bar. */
  readonly value: number;
}

/** A row as drawn: the clamped score for the bar, the figure beside it, the color of the fill. */
interface Row {
  readonly label: string;
  /** The score clamped to 0..1, `0` for a value that is not a number. */
  readonly clamped: number;
  readonly text: string;
  /** Whether the value was a number; a row that was not reads "no value", not 0. */
  readonly numeric: boolean;
  readonly color: string;
}

/**
 * A classifier's live output, one bar per class:
 *
 * ```html
 * <neat-score-bars
 *   label="Gesture probabilities"
 *   [scores]="scores"
 *   [labels]="classes"
 *   [quiet]="['No gesture']"
 * />
 * ```
 *
 * Rows keep the order of `scores`, so a bar does not jump about as the scores change. Each row is
 * the label, a bar filled to its score, and the score with two decimals. The score is clamped to
 * 0..1. A value that is not a number draws an empty bar and "–".
 *
 * The fill takes its color from `neatLabelColor`, by the label's place in `labels`. An empty
 * `labels` means the order of `scores`. `quiet` names the labels that stay muted.
 *
 * The row with the highest score has `data-top` and its label in bold. In a tie it is the first,
 * and when no score is a number there is none.
 *
 * `size` says how tall the list is. `auto`, the default, gives each row the height of its text.
 * `fill` makes the host at least as tall as its container (`min-height: 100%`). So the container
 * needs a height of its own, such as a card a grid row stretches.
 *
 * With `fill`, the rows share that height evenly. Each row grows, its label and figure stay
 * centered in it, and its bar thickens with it, up to twice its usual thickness. A container
 * shorter than the rows' natural height does not squeeze them. The list keeps that height and
 * overflows, as it does without `fill`.
 *
 * The host is a group named by `label`. Each bar is a `role="meter"` from 0 to 1, named by its
 * class, so a screen reader gets every value. The top row has no state of its own for it.
 */
@Component({
  selector: 'neat-score-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[attr.aria-label]': 'label()',
    '[attr.data-fill]': "size() === 'fill' ? '' : null",
  },
  template: `
    @for (row of rows(); track $index) {
      <div class="row" data-slot="score-bars-row" [attr.data-top]="$index === top() ? '' : null">
        <span class="name">{{ row.label }}</span>
        <span
          class="track"
          role="meter"
          aria-valuemin="0"
          aria-valuemax="1"
          [attr.aria-valuenow]="row.clamped"
          [attr.aria-valuetext]="row.numeric ? null : 'no value'"
          [attr.aria-label]="row.label"
        >
          <span class="fill" [style.width.%]="row.clamped * 100" [style.--fill]="row.color"></span>
        </span>
        <span class="value">{{ row.text }}</span>
      </div>
    }
  `,
  styleUrl: './score-bars.css',
})
export class NeatScoreBars {
  /** The classes and their scores, in the order the rows are drawn. */
  readonly scores = input.required<readonly NeatScore[]>();
  /** The color order of the labels; empty means the order of `scores`. */
  readonly labels = input<readonly string[]>([]);
  /** Labels drawn in the muted color, such as "No gesture". */
  readonly quiet = input<readonly string[]>([]);
  /** Names the group of bars. */
  readonly label = input.required<string>();
  /** `auto` sizes the rows to their text; `fill` shares the container's height among them. */
  readonly size = input<'auto' | 'fill'>('auto');

  protected readonly rows = computed<readonly Row[]>(() => {
    const scores = this.scores();
    // Distinct, so a repeated label does not push the next one's place in the palette on.
    const order =
      this.labels().length > 0 ? this.labels() : [...new Set(scores.map((score) => score.label))];
    return scores.map(({ label, value }) => {
      const clamped = isNumber(value) ? Math.min(1, Math.max(0, value)) : 0;
      return {
        label,
        clamped,
        numeric: isNumber(value),
        text: isNumber(value) ? clamped.toFixed(2) : '–',
        color: neatLabelColor(label, order, this.quiet()),
      };
    });
  });

  /** The index of the first row with the highest score, or -1 when no score is a number. */
  protected readonly top = computed(() => {
    let best = -1;
    this.scores().forEach(({ value }, index) => {
      if (isNumber(value) && (best < 0 || value > this.scores()[best].value)) best = index;
    });
    return best;
  });
}
