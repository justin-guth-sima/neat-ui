import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { lineColour } from './drawing';
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
 * An item with a `line` shows a short sample of that line in its colour, drawn by the edges' own
 * rules (lines.css); one without shows its series' swatch, the charts' `NeatSeriesSwatch` look.
 * The colour comes from the rule the edges' does (`lineColour`), so an item and its edges match
 * (a ghost and an item without a series are muted). Samples and swatches are `aria-hidden`: the
 * label names what they stand for, and a colour alone is not a name.
 */
@Component({
  selector: 'neat-diagram-legend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul aria-label="Legend">
      @for (item of drawn(); track $index) {
        <li [style.--edge]="item.colour">
          @if (item.line; as line) {
            <svg
              class="sample"
              [attr.data-line]="line"
              viewBox="0 0 24 4"
              aria-hidden="true"
              focusable="false"
            >
              <line class="line" x1="0" y1="2" x2="24" y2="2" />
            </svg>
          } @else {
            <span class="swatch" aria-hidden="true"></span>
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
    this.items().map((item) => ({
      label: item.label,
      line: item.line,
      colour: lineColour(item.series, item.line, `legend item "${item.label}"`),
    })),
  );
}
