import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { evenFractions, linePaths } from './geometry';
import { lineToken } from './line-token';
import type { NeatChartFormat, NeatChartTone } from './types';

/**
 * A metric's recent samples as a small line, for a card:
 *
 * ```html
 * <neat-sparkline [values]="temperatures" label="MLA RTSN-0" [format]="celsius" tone="warning" />
 * ```
 *
 * The samples are spread evenly, the lowest at the bottom of the box and the highest at the top.
 * So the line shows the shape of the last minutes, not a level: the card says the value. A `null`
 * is a sample that was not taken, and splits the line. Fewer than two numbers draw nothing
 * but the box keeps its size, so a card does not jump when its first samples arrive.
 *
 * The box fills the width it is given and is 1.75 rem high. The host is an image named by
 * `label` and, in words, by how many samples there are and their range, worded by `format`.
 * The stroke is `--neat-line`, or `--neat-line-warning` and `--neat-line-danger` by `tone`.
 */
@Component({
  selector: 'neat-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    '[attr.aria-label]': 'description()',
    '[style.--sparkline-stroke]': 'stroke()',
  },
  template: `
    <svg viewBox="0 0 600 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      @if (path(); as d) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styleUrl: './sparkline.css',
})
export class NeatSparkline {
  /** The samples, oldest first; `null` for one that was not taken. */
  readonly values = input.required<readonly (number | null)[]>();
  /** What the samples measure, for the image's name: "MLA RTSN-0". */
  readonly label = input.required<string>();
  /** Words a value for the description, with its unit. */
  readonly format = input<NeatChartFormat>(String);
  /** The stroke: the line color, or a threshold's. */
  readonly tone = input<NeatChartTone>('default');

  /** The numbers among the samples; a sparkline needs two of them to draw anything. */
  private readonly numbers = computed(() =>
    this.values().filter((value): value is number => value !== null && Number.isFinite(value)),
  );

  protected readonly stroke = computed(() => lineToken(this.tone()));

  protected readonly path = computed(() => {
    const numbers = this.numbers();
    if (numbers.length < 2) return '';
    const values = this.values();
    return linePaths(values, evenFractions(values.length), [
      Math.min(...numbers),
      Math.max(...numbers),
    ]).line;
  });

  protected readonly description = computed(() => {
    const numbers = this.numbers();
    if (numbers.length < 2) return `${this.label()}: no recent samples`;
    const format = this.format();
    return `${this.label()}: ${numbers.length} recent samples, ${format(Math.min(...numbers))} to ${format(Math.max(...numbers))}`;
  });
}
