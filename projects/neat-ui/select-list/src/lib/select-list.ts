import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  ElementRef,
  inject,
  input,
  model,
  output,
  TemplateRef,
  viewChild,
} from '@angular/core';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. Colours are the theme's tokens only; select-list.spec holds each pairing to its contrast.
 */

/** The header: the columns' labels over the rows, in the rows' columns and with their inset. */
const HEADER_CLASSES =
  'shrink-0 overflow-y-hidden border-b border-border text-xs font-medium text-muted-foreground [scrollbar-gutter:stable]';

/**
 * The scrolling area under the header. `scrollbar-gutter: stable` on both reserves the same width
 * for a scrollbar, so the header's columns stay over the rows' whether or not the rows scroll. The
 * ring is an outline, drawn over the content, so a header above the area cannot cover its top edge.
 */
const SCROLLER_CLASSES =
  'min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable] has-[[role=listbox]:focus-visible]:outline-2 has-[[role=listbox]:focus-visible]:-outline-offset-2 has-[[role=listbox]:focus-visible]:outline-ring';

/**
 * A line of cells on the columns' widths, with a 2px inset on the start side that the selected
 * row's bar fills (`--primary`, 3:1 against the row's fill and the surface). A row is `--accent` when
 * hovered or selected; the bar, not the fill alone, marks the selection.
 */
const LINE_CLASSES =
  'grid grid-cols-(--neat-select-list-columns) items-center gap-x-(--neat-space-3) border-s-2 border-transparent px-(--neat-space-3)';
const ROW_CLASSES = `${LINE_CLASSES} min-h-9 cursor-default py-1 text-sm hover:bg-accent aria-selected:border-primary aria-selected:bg-accent`;
const HEADER_LINE_CLASSES = `${LINE_CLASSES} py-1`;

/** The keys that move the selection: the new index from the current one (-1: none), of `count`. */
const MOVES: Record<string, (index: number, count: number) => number> = {
  ArrowDown: (index, count) => Math.min(index + 1, count - 1),
  ArrowUp: (index, count) => (index < 0 ? count - 1 : Math.max(index - 1, 0)),
  Home: () => 0,
  End: (_, count) => count - 1,
};

/** What a click on one of these inside a row is for, not for the row. */
const INTERACTIVE =
  'button, a[href], input, select, textarea, summary, [role="button"], [contenteditable], [tabindex]';

/** Stands for "no selection" in key comparisons; no item's key can be it. */
const NONE = Symbol('none');

/**
 * One column of a `neat-select-list`, as a template for the cells in it:
 *
 * ```html
 * <ng-template neatColumn="state" header="State" width="6rem" let-slot>{{ slot.state }}</ng-template>
 * ```
 *
 * The key names the column, `header` is the label over it (no label on any column: no header row),
 * and `width` is its CSS track size in the row's grid, `1fr` by default. The template gets the
 * item as its implicit context. A cell is a block that may shrink to nothing, so a long text
 * truncates in the cell rather than pushing the next column out.
 */
@Directive({ selector: 'ng-template[neatColumn]' })
export class NeatColumn {
  readonly key = input.required<string>({ alias: 'neatColumn' });
  readonly header = input('');
  readonly width = input('1fr');
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/** A row: the item, its key, the element id the listbox points at, and its cells' context. */
interface Row<T> {
  readonly item: T;
  readonly key: unknown;
  readonly id: string;
  readonly context: { readonly $implicit: T };
}

/** Numbers each list, for the element ids its options and empty message get. */
let nextListId = 0;

/**
 * A list of items, one row each, in columns that the app lays out with templates; one row is
 * selected:
 *
 * ```html
 * <neat-select-list label="Streaming slots" [items]="slots()" [trackBy]="slotId" [(selected)]="slot">
 *   <ng-template neatColumn="name" header="Slot" let-slot>{{ slot.name }}</ng-template>
 *   <ng-template neatColumn="state" header="State" width="6rem" let-slot>…</ng-template>
 * </neat-select-list>
 * ```
 *
 * It fills its container (the container needs a height) and scrolls its rows inside, under a header
 * that stays put. `trackBy` gives an item's identity, unique in the list: the selection follows
 * the item with the same key when `items` is replaced by new objects (a poll's answer), and rows,
 * with the state in their cells, are kept rather than rebuilt. It is called once per item whenever
 * `items` changes, never while the list is only checked or the selection moves.
 *
 * It is a single-select `listbox` named by `label`, whose `option` rows are `aria-selected`.
 * Selection follows focus: the listbox is the one tab stop, holds the focus, and names the
 * selected row in `aria-activedescendant`; ArrowDown and ArrowUp move the selection (the first
 * press picks the first or last row when nothing is selected), Home and End jump to the ends, and
 * the selected row scrolls into view. Enter, and a click on a row, tell `activated` with the row's
 * item. A click on a control in a cell, and every key pressed while one has the focus, are that
 * control's: they neither select nor activate. Controls in cells are ordinary tab stops after
 * the listbox.
 *
 * The header repeats the columns' labels for the eye and is hidden from assistive technology: the
 * rows read as the text of their cells in order, as a listbox's options do (a listbox cannot
 * name its columns).
 *
 * Typing a letter to jump to a row, Page Up and Page Down, a selection of several rows and a
 * disabled row are not offered; none is needed yet.
 */
@Component({
  selector: 'neat-select-list',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex h-full min-h-0 flex-col',
    '[style.--neat-select-list-columns]': 'gridColumns()',
  },
  template: `
    @if (hasHeader()) {
      <div data-slot="select-list-header" aria-hidden="true" [class]="headerClasses">
        <div [class]="headerLineClasses">
          @for (column of columns(); track column) {
            <span class="min-w-0 truncate">{{ column.header() }}</span>
          }
        </div>
      </div>
    }
    <div [class]="scrollerClasses">
      <div
        #listbox
        role="listbox"
        tabindex="0"
        class="outline-none"
        [attr.aria-label]="label()"
        [attr.aria-activedescendant]="activeId()"
        [attr.aria-describedby]="isEmpty() ? emptyId : null"
        (keydown)="onKeydown($event)"
        (click)="onClick($event)"
      >
        @for (row of rows(); track row.key) {
          <div
            role="option"
            [id]="row.id"
            [class]="rowClasses"
            [attr.aria-selected]="row.key === selectedKey()"
          >
            @for (column of columns(); track column) {
              <div class="min-w-0">
                <ng-container
                  [ngTemplateOutlet]="column.template"
                  [ngTemplateOutletContext]="row.context"
                />
              </div>
            }
          </div>
        }
      </div>
      @if (isEmpty()) {
        <p
          data-slot="select-list-empty"
          class="px-(--neat-space-3) py-(--neat-space-2) text-sm text-muted-foreground"
          [id]="emptyId"
        >
          {{ emptyLabel() }}
        </p>
      }
    </div>
  `,
})
export class NeatSelectList<T> {
  /** The accessible name of the list. */
  readonly label = input.required<string>();
  readonly items = input.required<readonly T[]>();
  /** An item's identity, unique in the list. */
  readonly trackBy = input.required<(item: T) => unknown>();
  /** The selected item; `null` while there is none. */
  readonly selected = model<T | null>(null);
  /** What to say, in place of rows, while there are no items. */
  readonly emptyLabel = input('');
  /** The item of the row that was clicked or that had Enter pressed on it. */
  readonly activated = output<T>();

  protected readonly headerClasses = HEADER_CLASSES;
  protected readonly headerLineClasses = HEADER_LINE_CLASSES;
  protected readonly scrollerClasses = SCROLLER_CLASSES;
  protected readonly rowClasses = ROW_CLASSES;

  private readonly id = ++nextListId;
  protected readonly emptyId = `neat-select-list-${this.id}-empty`;

  protected readonly columns = contentChildren(NeatColumn, { descendants: true });
  private readonly listbox = viewChild.required<ElementRef<HTMLElement>>('listbox');

  protected readonly hasHeader = computed(() => this.columns().some((column) => column.header()));
  protected readonly gridColumns = computed(() =>
    this.columns()
      .map((column) => column.width())
      .join(' '),
  );

  /**
   * Everything a row needs, worked out once per `items`: the key (a call of the app's function),
   * the id and the cells' context. Change detection then reads these and calls nothing.
   */
  protected readonly rows = computed<readonly Row<T>[]>(() => {
    const keyOf = this.trackBy();
    return this.items().map((item, index) => ({
      item,
      key: keyOf(item),
      id: `neat-select-list-${this.id}-${index}`,
      context: { $implicit: item },
    }));
  });

  protected readonly isEmpty = computed(() => this.rows().length === 0 && !!this.emptyLabel());

  protected readonly selectedKey = computed(() => {
    const selected = this.selected();
    return selected === null ? NONE : this.trackBy()(selected);
  });
  private readonly selectedIndex = computed(() => {
    const key = this.selectedKey();
    return this.rows().findIndex((row) => row.key === key);
  });
  protected readonly activeId = computed(() => this.rows()[this.selectedIndex()]?.id ?? null);

  /** The key of the row last scrolled to, so that a row that only moved is not scrolled to again. */
  private revealed: unknown = NONE;

  constructor() {
    afterRenderEffect(() => {
      const index = this.selectedIndex();
      if (index < 0) {
        this.revealed = NONE;
        return;
      }
      const key = this.rows()[index].key;
      if (key === this.revealed) return;
      this.revealed = key;
      // The rows are the listbox's only children. jsdom has no scrollIntoView.
      this.listbox().nativeElement.children[index]?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  /** Puts the keyboard focus on the list, where the arrow keys work. */
  focus(): void {
    this.listbox().nativeElement.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    // A key pressed on a control in a cell bubbles up to here; it is the control's.
    if (event.target !== event.currentTarget) return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    const rows = this.rows();
    if (rows.length === 0) return;
    if (event.key === 'Enter') {
      const row = rows[this.selectedIndex()];
      if (!row) return;
      event.preventDefault();
      this.activated.emit(row.item);
      return;
    }
    const move = MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    this.selected.set(rows[move(this.selectedIndex(), rows.length)].item);
  }

  /** One listener on the listbox serves every row: the rows are found from the event's target. */
  protected onClick(event: MouseEvent): void {
    const target = event.target as Element;
    const option = target.closest('[role="option"]');
    if (!option) return;
    const control = target.closest(INTERACTIVE);
    // The listbox is focusable too, so only a control inside the row is the control's click.
    if (control && control !== option && option.contains(control)) return;
    const row = this.rows()[Array.prototype.indexOf.call(option.parentElement!.children, option)];
    this.selected.set(row.item);
    this.activated.emit(row.item);
  }
}
