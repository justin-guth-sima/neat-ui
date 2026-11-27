import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  model,
  viewChild,
} from '@angular/core';
import { FIELD_WIDTH_CLASSES, type NeatFieldWidth } from '../form/field-width';
import { INPUT_CLASSES } from '../form/input-classes';
import { NeatIcon } from '../icon/icon';
import { hlm } from '../ui/utils/src';

/**
 * The field's look:
 * - `'filled'` (the default): a tint of the text color with round ends, quiet on the page, a card
 *   or a panel. The search glyph and the hint mark it as a field.
 * - `'outlined'`: the kit's text field (`neatInput`), for a search among a form's fields.
 * - `'underlined'`: no box, a line under it, the quietest.
 * - `'raised'`: a card's fill and border with a soft shadow, for a page whose main job is
 *   searching.
 */
export type NeatSearchVariant = 'filled' | 'outlined' | 'underlined' | 'raised';

/**
 * The field's height: `small` (2rem) and `medium` (2.25rem), the heights of `neatInput`, and
 * `large` (3rem, with 1rem text), for a page whose main job is searching.
 */
export type NeatSearchSize = 'small' | 'medium' | 'large';

/**
 * Each height on the kit's field. The start and end padding, which make room for the glyph and
 * the clear button, are the stylesheet's, beside the parts they make room for.
 */
const SIZE_CLASSES = {
  small: INPUT_CLASSES.small,
  medium: INPUT_CLASSES.medium,
  large: hlm(INPUT_CLASSES.medium, 'h-12 text-base md:text-base'),
} as const;

/**
 * Each look over the field. The tint is the text color at 8% (12% on hover), so it shows on any
 * surface in both schemes, where `--muted` is a dark card's own fill; it keeps the hint at 5.9:1
 * or more (search.spec). Focused, the filled field takes its surface's color under the ring.
 * `dark:` repeats what the field's own dark override would undo.
 */
const VARIANT_CLASSES = {
  filled:
    'rounded-full border-transparent bg-foreground/8 shadow-none hover:bg-foreground/12 focus-visible:bg-(--neat-surface) dark:bg-foreground/8 dark:hover:bg-foreground/12 dark:focus-visible:bg-(--neat-surface)',
  outlined: '',
  underlined:
    'rounded-none border-x-0 border-t-0 shadow-none focus-visible:border-b-2 focus-visible:ring-0',
  raised: 'rounded-xl border-border bg-card shadow-sm dark:bg-card',
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
 * `variant` is its look: `'filled'` by default, `'outlined'` among a form's fields,
 * `'underlined'`, or `'raised'` with `size="large"` for a page whose main job is searching.
 *
 * It fills its container's width. `width="content"` makes it as wide as the browser makes its
 * input, for a search in a toolbar.
 *
 * With `listbox`, it drives a list of results as a combobox (the search palette's field).
 *
 * It filters as the user types: the app reads `value` and decides what matches. It is a native
 * `input type="search"`, with the browser's own clear button hidden so there is one, and without
 * the browser's suggestions or spell checking, which a filter has no use for.
 */
@Component({
  selector: 'neat-search',
  imports: [NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-variant]': 'variant()',
    '[class]': 'widthClasses()',
  },
  template: `
    <div class="field">
      <neat-icon class="glyph" name="search" [size]="size() === 'large' ? 20 : 16" />
      <input
        #field
        type="search"
        autocomplete="off"
        spellcheck="false"
        [id]="id"
        [class]="fieldClasses()"
        [attr.aria-label]="label()"
        [attr.aria-describedby]="status() === undefined ? null : id + '-status'"
        [attr.role]="listbox() ? 'combobox' : null"
        [attr.aria-controls]="listbox() ?? null"
        [attr.aria-expanded]="listbox() ? 'true' : null"
        [attr.aria-autocomplete]="listbox() ? 'list' : null"
        [attr.aria-activedescendant]="listbox() ? activeOption() : null"
        [placeholder]="placeholder()"
        [value]="value()"
        (input)="value.set($any($event.target).value)"
        (keydown.escape)="escape($event)"
      />
      @if (value()) {
        <button type="button" class="clear" [attr.aria-label]="clearLabel()" (click)="clear()">
          <neat-icon name="close" [size]="size() === 'large' ? 18 : 16" />
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
  /** The field's look: `'filled'`, `'outlined'`, `'underlined'` or `'raised'`. */
  readonly variant = input<NeatSearchVariant>('filled');
  /** The field's height, `small` (2rem), `medium` (2.25rem) or `large` (3rem). */
  readonly size = input<NeatSearchSize>('medium');
  /** How wide it is: `fill` (the default), its container's width, or `content`, its input's. */
  readonly width = input<NeatFieldWidth>('fill');
  /** The clear button's accessible name. */
  readonly clearLabel = input('Clear search');
  /**
   * A short line under the field about what the search found ("12 streams", "Nothing matches"),
   * announced politely as it changes; no line while it is undefined.
   */
  readonly status = input<string>();
  /**
   * The id of a listbox of results the field drives, as the search palette's: the field is then a
   * combobox over it, whose `activeOption` the keys move. Unset for a field that filters a page.
   */
  readonly listbox = input<string>();
  /** The id of the listbox's option the keys are on, while `listbox` is set; null for none. */
  readonly activeOption = input<string | null>(null);

  protected readonly id = `neat-search-${++nextSearchId}`;
  protected readonly widthClasses = computed(() => FIELD_WIDTH_CLASSES[this.width()]);
  protected readonly fieldClasses = computed(() =>
    hlm(SIZE_CLASSES[this.size()], VARIANT_CLASSES[this.variant()]),
  );
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
