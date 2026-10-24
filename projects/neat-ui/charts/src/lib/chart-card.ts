import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';

/**
 * A card for a metric and its chart:
 *
 * ```html
 * <neat-chart-card heading="MLA temperature" value="62.4" unit="°C" caption="Hottest of 8 sensors"
 *   selectable [selected]="open() === 'mla'" (activate)="open.set('mla')">
 *   <neat-status-chip neatChartCardChip tone="warning">Warning</neat-status-chip>
 *   <neat-sparkline … />
 * </neat-chart-card>
 * ```
 *
 * Top to bottom: the heading with the `[neatChartCardChip]` content beside it at the end, the value
 * (large, with its unit smaller and muted after it), the caption, and the default content, the
 * chart. The value and the caption are left out while they are empty.
 *
 * With `selectable`, the card is one choice among its siblings: the heading is a button (so it is
 * the keyboard's way in, and `aria-current` marks it while `selected`) and a click anywhere on the
 * card emits `activate` as well. A click on something in the content that is a tab stop of its own
 * (a chart's plot, which reads out a sample by pointer and keys) is the chart's and leaves the card
 * alone, so a readout is not lost to a selection. Not selectable, the heading is text and the card
 * handles no clicks.
 *
 * The card is the fill of `--card`, so it sets `--neat-surface` to it for the charts' label halos.
 * It does not clip its content or make a stacking context: a readout can hang below its plot.
 */
@Component({
  selector: 'neat-chart-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-selectable]': 'selectable() ? "" : null',
    '[attr.data-selected]': 'selectable() && selected() ? "" : null',
    // The heading button's click, whether from the pointer, Enter or Space, bubbles to this one.
    '(click)': 'onClick($event)',
  },
  template: `
    <div class="head">
      <span class="heading">
        @if (selectable()) {
          <button type="button" class="activator" [attr.aria-current]="selected() ? 'true' : null">
            {{ heading() }}
          </button>
        } @else {
          {{ heading() }}
        }
      </span>
      <ng-content select="[neatChartCardChip]" />
    </div>
    @if (value()) {
      <div class="value">
        {{ value() }}
        @if (unit()) {
          <span class="unit">{{ unit() }}</span>
        }
      </div>
    }
    @if (caption()) {
      <div class="caption">{{ caption() }}</div>
    }
    <ng-content />
  `,
  styleUrl: './chart-card.css',
})
export class NeatChartCard {
  /** What the card is about: "MLA temperature". */
  readonly heading = input.required<string>();
  /** The current value, already worded: "62.4". */
  readonly value = input('');
  /** The value's unit, after it: "°C". */
  readonly unit = input('');
  /** A line under the value: what it is the value of. */
  readonly caption = input('');
  /** Whether the card can be chosen: the heading is a button, and a click on the card activates it. */
  readonly selectable = input(false, { transform: booleanAttribute });
  /** Whether this is the chosen card; only a selectable card shows it. */
  readonly selected = input(false, { transform: booleanAttribute });
  /** The card was chosen, by its heading or a click on it. */
  readonly activate = output<void>();

  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  protected onClick(event: MouseEvent): void {
    if (!this.selectable() || this.handlesItself(event.target)) {
      return;
    }
    this.activate.emit();
  }

  /**
   * Whether a click landed in something inside the card that is a tab stop of its own, so it
   * handles the pointer and keys itself. The charts' plots mark themselves that way (they are
   * `tabindex="0"` groups), so this follows whatever a chart makes interactive instead of a list
   * of their selectors.
   */
  private handlesItself(target: EventTarget | null): boolean {
    const stop = target instanceof Element ? target.closest('[tabindex]') : null;
    return stop !== null && stop !== this.host && this.host.contains(stop);
  }
}
