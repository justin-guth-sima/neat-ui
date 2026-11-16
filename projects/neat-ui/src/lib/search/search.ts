import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  model,
  viewChild,
} from '@angular/core';
import { INPUT_CLASSES } from '../form/input-classes';
import { NeatIcon } from '../icon/icon';
import { hlm } from '../ui/utils/src';

/** The field's height: `medium` (2.25rem) and `small` (2rem), the heights of `neatInput`. */
export type NeatSearchSize = 'small' | 'medium';

/**
 * The field with room for the search glyph at its start and the clear button at its end. Literals,
 * so Tailwind finds them; `hlm` lets the start and end padding replace the field's own `px`.
 */
const FIELD_CLASSES = {
  medium: hlm(INPUT_CLASSES.medium, 'ps-8 pe-9'),
  small: hlm(INPUT_CLASSES.small, 'ps-8 pe-8'),
} as const;

let nextSearchId = 0;

/**
 * A search field, for filtering what a page shows.
 *
 * ```html
 * <neat-search label="Filter streams" [(value)]="query" [status]="matches() + ' streams'" />
 * ```
 *
 * The search glyph sits at its start. While the field holds text, a clear button sits at its end,
 * and Escape clears it too. Escape in an empty field is left alone, so a dialog or a page's own
 * handling still gets it. Clearing puts the focus back in the field.
 *
 * `label` is the field's accessible name, and a `placeholder` is only a hint beside it. `status`
 * is a short line under the field, such as "12 streams" or "Nothing matches", repeated politely to
 * a screen reader as it changes. Without `status` there is no line.
 *
 * It filters as the user types: the app reads `value` and decides what matches. It is a native
 * `input type="search"`, with the browser's own clear button hidden so there is one, and without
 * the browser's suggestions or spell checking, which a filter has no use for.
 */
@Component({
  selector: 'neat-search',
  imports: [NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-size]': 'size()' },
  template: `
    <div class="field">
      <neat-icon class="glyph" name="search" [size]="16" />
      <input
        #field
        type="search"
        autocomplete="off"
        spellcheck="false"
        [id]="id"
        [class]="fieldClasses()"
        [attr.aria-label]="label()"
        [attr.aria-describedby]="status() === undefined ? null : id + '-status'"
        [placeholder]="placeholder()"
        [value]="value()"
        (input)="value.set($any($event.target).value)"
        (keydown.escape)="escape($event)"
      />
      @if (value()) {
        <button type="button" class="clear" [attr.aria-label]="clearLabel()" (click)="clear()">
          <neat-icon name="close" [size]="16" />
        </button>
      }
    </div>
    @if (status() !== undefined) {
      <p class="status" [id]="id + '-status'" aria-live="polite">{{ status() }}</p>
    }
  `,
  styleUrl: './search.css',
})
export class NeatSearch {
  /** The field's accessible name ("Filter streams"); required, since a hint is no name. */
  readonly label = input.required<string>();
  /** What the field holds; the app filters by it. */
  readonly value = model('');
  /** A hint inside the empty field; none by default. */
  readonly placeholder = input('');
  /** The field's height, `medium` (2.25rem) or `small` (2rem). */
  readonly size = input<NeatSearchSize>('medium');
  /** The clear button's accessible name. */
  readonly clearLabel = input('Clear search');
  /**
   * A short line under the field about what the search found ("12 streams", "Nothing matches"),
   * announced politely as it changes; no line while it is undefined.
   */
  readonly status = input<string>();

  protected readonly id = `neat-search-${++nextSearchId}`;
  protected readonly fieldClasses = computed(() => FIELD_CLASSES[this.size()]);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  /** Empties the field and puts the focus back in it. */
  protected clear(): void {
    this.value.set('');
    this.field().nativeElement.focus();
  }

  /** Escape clears a field that holds text, and stops there; an empty field lets it pass. */
  protected escape(event: Event): void {
    if (!this.value()) return;
    event.preventDefault();
    event.stopPropagation();
    this.value.set('');
  }
}
