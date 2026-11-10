import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A color as a small square, for a label that stands for something drawn in that color (a class
 * in the video overlays or the bird's-eye view, an item in an app's own legend):
 *
 * ```html
 * <neat-swatch [color]="classColor" /> {{ label }}
 * ```
 *
 * `color` is any CSS color. For a chart's series, `neat-series-swatch` takes the series' index
 * and finds its color by the kit's one rule; the two share one look (size, shape, corners), stated
 * once in this component's sheet. It is `aria-hidden`: the text beside it names the thing, and a
 * color alone is not a name.
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
