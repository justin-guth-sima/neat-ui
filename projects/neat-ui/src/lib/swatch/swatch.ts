import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A color as a small square, beside a label that stands for something drawn in that color.
 *
 * ```html
 * <neat-swatch [color]="classColor" /> {{ label }}
 * ```
 *
 * Such a label names a class in the video overlays or the bird's-eye view, or an item in an app's
 * own legend. `color` is any CSS color.
 *
 * For a chart's series, `neat-series-swatch` takes the series' index and finds its color by the
 * kit's one rule. The two share one look: size, shape and corners.
 *
 * It is `aria-hidden`: the text beside it names the thing, and a color alone is not a name.
 */
@Component({
  selector: 'neat-swatch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.--swatch]': 'color()',
  },
  template: '',
  styleUrl: './swatch.css',
})
export class NeatSwatch {
  /** The color to show, as CSS. */
  readonly color = input.required<string>();
}
