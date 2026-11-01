import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NeatSeriesSwatch } from '@sima/neat-ui';
import { lineColour, seriesIndex } from './drawing';
import type { NeatDiagramLine } from './model';

/** One entry of a diagram's legend: what a series colour or a line look stands for. */
export interface NeatDiagramLegendItem {
  /** The series (1 to 8) whose colour it names, as an edge's `series`; unset, muted. */
  readonly series?: number;
  /** The line look it names, as an edge's `line`; unset, the series' swatch instead. */
  readonly line?: NeatDiagramLine;
  readonly label: string;
}

/**
 * What a diagram's colours and lines stand for, as the Autoware demo's legend chip:
 *
 * ```html
 * <neat-diagram-legend [items]="[
 *   { series: 1, label: 'image' },
 *   { series: 4, label: 'results' },
 *   { line: 'ghost', label: 'not run here' },
 * ]" />
 * ```
 *
 * A series without a `line` shows the kit's `NeatSeriesSwatch` for it, as the charts' legends do.
 * Any other item shows a short sample of its line (solid when unset), drawn by the edges' own
 * rules in the colour its edges take: muted for a ghost, without a series, or for a
 * series that is not 1 to 8. Samples and swatches are `aria-hidden`: the label
 * names what they stand for, and a colour alone is not a name.
 */
@Component({
  selector: 'neat-diagram-legend',
  imports: [NeatSeriesSwatch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul aria-label="Legend">
      @for (item of drawn(); track $index) {
        <li [style.--edge]="item.colour">
          @if (item.swatch !== null) {
            <neat-series-swatch [index]="item.swatch" />
          } @else {
            <svg
              class="sample"
              [attr.data-line]="item.line"
              viewBox="0 0 24 4"
              aria-hidden="true"
              focusable="false"
            >
              <line class="line" x1="0" y1="2" x2="24" y2="2" />
            </svg>
          }
          {{ item.label }}
        </li>
      }
    </ul>
  `,
  styleUrls: ['./lines.css', './legend.css'],
})
export class NeatDiagramLegend {
  /** The entries, in the order shown. */
  readonly items = input.required<readonly NeatDiagramLegendItem[]>();

  protected readonly drawn = computed(() =>
    this.items().map((item) => {
      const part = `legend item "${item.label}"`;
      const swatch =
        item.line === undefined && item.series !== undefined
          ? seriesIndex(item.series, part)
          : null;
      return {
        label: item.label,
        swatch,
        line: item.line ?? 'solid',
        colour: swatch === null ? lineColour(item.series, item.line, part) : null,
      };
    }),
  );
}
