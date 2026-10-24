import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { NeatIcon } from '@sima/neat-ui';

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
 * A line of cells on the columns' widths, with a 2px inset on the start side that the active
 * row's bar fills (`--primary`, 3:1 against the row's fill and the surface). A row is `--accent` when
 * hovered or active; the bar, not the fill alone, marks it. The active row is the selected one,
 * marked `data-active` rather than by `aria-selected`, which in checked mode says a row is checked.
 */
const LINE_CLASSES =
  'grid grid-cols-(--neat-select-list-columns) items-center gap-x-(--neat-space-3) border-s-2 border-transparent px-(--neat-space-3)';
const ROW_CLASSES = `${LINE_CLASSES} min-h-9 cursor-default py-1 text-sm hover:bg-accent data-active:border-primary data-active:bg-accent`;
const HEADER_LINE_CLASSES = `${LINE_CLASSES} py-1`;

/**
 * A row's box in checked mode, drawn by the kit: unchecked, its boundary is `--input`, the theme's
 * form-control boundary (3:1 on every surface, as on `neatInput`); checked, it fills with
 * `--primary`, and the tick is `--primary-foreground` on it. It is no control of its own (the row
 * says whether it is checked), so it takes neither the focus nor a name.
 */
const CHECK_CLASSES =
  'flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-input data-checked:border-primary data-checked:bg-primary';
/** The box's track in the row's grid: as wide as the box. */
const CHECK_TRACK = '1rem';

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
 *
 * `hideBelow` is a width of the list in CSS pixels: while the list is narrower, the column and its
 * header leave the layout entirely, as if the template were not there. For columns that matter
 * less than the others on a narrow screen: `[hideBelow]="720"`.
 */
@Directive({ selector: 'ng-template[neatColumn]' })
export class NeatColumn {
  readonly key = input.required<string>({ alias: 'neatColumn' });
  readonly header = input('');
  readonly width = input('1fr');
  /** The list's width in CSS pixels below which the column is not shown; always shown if unset. */
  readonly hideBelow = input<number>();
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/**
 * A row: the item, its key, whether it can be checked, the element id the listbox points at, and
 * its cells' context.
 */
interface Row<T, K> {
  readonly item: T;
  readonly key: K;
  readonly checkable: boolean;
  readonly id: string;
  readonly context: { readonly $implicit: T };
}

/** Whether two lists hold the same columns in the same order. */
const sameColumns = (a: readonly NeatColumn[], b: readonly NeatColumn[]): boolean =>
  a.length === b.length && a.every((column, index) => column === b[index]);

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
 * `hint` is read as the listbox's description, for keys the app adds on top of these.
 *
 * **Checked mode** (`checkable`) is for acting on several rows: each row that `canCheck` allows
 * has a box before its cells, and `checked` holds the keys (`trackBy`'s) of the checked rows. It
 * holds keys rather than items, and keeps the keys of rows it does not list (a file in another
 * folder, a type a filter hides): a newly checked key is appended, an unchecked one removed, the
 * rest left as they are. The listbox is then multi-selectable, and a checkable row is
 * `aria-selected` while it is checked (as the WAI-ARIA multi-select listbox has it); a row that
 * cannot be checked has no `aria-selected`. The selection that follows the arrow keys (`selected`)
 * stays: it is the row the keyboard is on, named in `aria-activedescendant` and drawn with the bar.
 * Space checks or unchecks that row; a click on a row's box checks or unchecks it and does nothing
 * else, and a click elsewhere on the row selects and activates it as in the single mode. The boxes
 * are not tab stops. Say how to check from the keyboard in `hint` ("Press Space to check or
 * uncheck a file."), which the list leaves to the app.
 *
 * Typing a letter to jump to a row, Page Up and Page Down, a range of rows checked with Shift and
 * a disabled row are not offered; none is needed yet.
 */
@Component({
  selector: 'neat-select-list',
  imports: [NeatIcon, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex h-full min-h-0 flex-col',
    '[style.--neat-select-list-columns]': 'gridColumns()',
  },
  template: `
    @if (hasHeader()) {
      <div data-slot="select-list-header" aria-hidden="true" [class]="headerClasses">
        <div [class]="headerLineClasses">
          @if (checkable()) {
            <span></span>
          }
          @for (column of visibleColumns(); track column) {
            <span class="min-w-0 truncate">{{ column.header() }}</span>
          }
        </div>
      </div>
    }
    <div #scroller [class]="scrollerClasses">
      @if (hint()) {
        <span class="sr-only" [id]="hintId">{{ hint() }}</span>
      }
      <div
        #listbox
        role="listbox"
        tabindex="0"
        class="outline-none"
        [attr.aria-label]="label()"
        [attr.aria-multiselectable]="checkable() || null"
        [attr.aria-activedescendant]="activeId()"
        [attr.aria-describedby]="describedBy()"
        (keydown)="onKeydown($event)"
        (click)="onClick($event)"
      >
        @for (row of rows(); track row.key) {
          <div
            role="option"
            [id]="row.id"
            [class]="rowClasses"
            [attr.data-active]="row.key === selectedKey() ? '' : null"
            [attr.aria-selected]="
              checkable()
                ? row.checkable
                  ? checkedKeys().has(row.key)
                  : null
                : row.key === selectedKey()
            "
          >
            @if (checkable()) {
              <div class="flex">
                @if (row.checkable) {
                  <span
                    data-slot="select-list-check"
                    aria-hidden="true"
                    [class]="checkClasses"
                    [attr.data-checked]="checkedKeys().has(row.key) ? '' : null"
                  >
                    @if (checkedKeys().has(row.key)) {
                      <neat-icon name="check" [size]="12" class="text-primary-foreground" />
                    }
                  </span>
                }
              </div>
            }
            @for (column of visibleColumns(); track column) {
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
export class NeatSelectList<T, K = unknown> {
  /** The accessible name of the list. */
  readonly label = input.required<string>();
  readonly items = input.required<readonly T[]>();
  /** An item's identity, unique in the list. */
  readonly trackBy = input.required<(item: T) => K>();
  /** The selected item: the row the keyboard is on; `null` while there is none. */
  readonly selected = model<T | null>(null);
  /** Checked mode: a box on each row that `canCheck` allows, for acting on several rows. */
  readonly checkable = input(false, { transform: booleanAttribute });
  /** In checked mode, the keys of the checked rows, including rows the list does not show. */
  readonly checked = model<readonly K[]>([]);
  /** In checked mode, whether an item's row has a box; called once per item as `items` change. */
  readonly canCheck = input<(item: T) => boolean>(() => true);
  /** What to say, in place of rows, while there are no items. */
  readonly emptyLabel = input('');
  /**
   * Text for assistive technology that says what the keys do beyond the listbox's own, such as
   * "Press Space to check a file"; it describes the listbox, and is not shown.
   */
  readonly hint = input('');
  /** The item of the row that was clicked or that had Enter pressed on it. */
  readonly activated = output<T>();

  protected readonly headerClasses = HEADER_CLASSES;
  protected readonly headerLineClasses = HEADER_LINE_CLASSES;
  protected readonly scrollerClasses = SCROLLER_CLASSES;
  protected readonly rowClasses = ROW_CLASSES;
  protected readonly checkClasses = CHECK_CLASSES;

  private readonly id = ++nextListId;
  protected readonly emptyId = `neat-select-list-${this.id}-empty`;
  protected readonly hintId = `neat-select-list-${this.id}-hint`;

  private readonly columns = contentChildren(NeatColumn, { descendants: true });
  private readonly listbox = viewChild.required<ElementRef<HTMLElement>>('listbox');
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  /**
   * The list's own width in CSS pixels, watched only while a column has `hideBelow`; `null` until
   * then and while the list has no width (not laid out: hidden, or not in a document), when every
   * column shows.
   */
  private readonly width = signal<number | null>(null);
  private readonly hidesColumns = computed(() =>
    this.columns().some((column) => column.hideBelow() !== undefined),
  );
  /** The columns shown at the list's width; a new list only when one comes or goes. */
  protected readonly visibleColumns = computed(
    () => {
      const width = this.width();
      return this.columns().filter((column) => {
        const hideBelow = column.hideBelow();
        return hideBelow === undefined || width === null || width >= hideBelow;
      });
    },
    { equal: sameColumns },
  );

  protected readonly hasHeader = computed(() =>
    this.visibleColumns().some((column) => column.header()),
  );
  protected readonly gridColumns = computed(() =>
    [
      ...(this.checkable() ? [CHECK_TRACK] : []),
      ...this.visibleColumns().map((column) => column.width()),
    ].join(' '),
  );

  /**
   * Everything a row needs, worked out once per `items`: the key and, in checked mode, whether it
   * has a box (calls of the app's functions), the id and the cells' context. Change detection then
   * reads these and calls nothing.
   */
  protected readonly rows = computed<readonly Row<T, K>[]>(() => {
    const keyOf = this.trackBy();
    const canCheck = this.checkable() ? this.canCheck() : () => false;
    return this.items().map((item, index) => ({
      item,
      key: keyOf(item),
      checkable: canCheck(item),
      id: `neat-select-list-${this.id}-${index}`,
      context: { $implicit: item },
    }));
  });

  protected readonly checkedKeys = computed(() => new Set<unknown>(this.checked()));

  protected readonly isEmpty = computed(() => this.rows().length === 0 && !!this.emptyLabel());
  protected readonly describedBy = computed(
    () =>
      [this.isEmpty() ? this.emptyId : '', this.hint() ? this.hintId : '']
        .filter(Boolean)
        .join(' ') || null,
  );

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
    afterRenderEffect(() => this.revealSelected());
    this.watchWidthWhileNeeded();
  }

  /**
   * Watches the list's width once a column has `hideBelow`, and never for a list without one. The
   * first width is read as soon as the list is rendered, so the first frame is laid out at it; a
   * resize then reports each change. The list is zoneless: setting the signal schedules the
   * render, and only a column coming or going changes what is drawn.
   */
  private watchWidthWhileNeeded(): void {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    const setWidth = (width: number) => this.width.set(width > 0 ? width : null);
    let observer: ResizeObserver | undefined;
    afterRenderEffect(() => {
      if (observer || !this.hidesColumns()) return;
      setWidth(host.getBoundingClientRect().width);
      observer = new ResizeObserver((entries) =>
        setWidth(entries[entries.length - 1].contentRect.width),
      );
      observer.observe(host);
    });
    destroyRef.onDestroy(() => observer?.disconnect());
  }

  /** Scrolls the selected row into view unless that row was the last one scrolled to. */
  private revealSelected(): void {
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
  }

  /**
   * Scrolls back to the top, as a different set of rows (another folder) needs, or to the selected
   * row when there is one in the list. Call it once the new rows are rendered.
   */
  resetScroll(): void {
    this.scroller().nativeElement.scrollTop = 0;
    this.revealed = NONE;
    this.revealSelected();
  }

  /** Puts the keyboard focus on the list, where the arrow keys work. */
  focus(): void {
    this.listbox().nativeElement.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    // A key pressed on a control in a cell bubbles up to here; it is the control's.
    if (event.target !== event.currentTarget) return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    // Space checks the row the keyboard is on in checked mode; either way it must not scroll the
    // area.
    if (event.key === ' ') {
      event.preventDefault();
      const row = this.rows()[this.selectedIndex()];
      if (row) this.toggle(row);
      return;
    }
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
    if (target.closest('[data-slot="select-list-check"]')) {
      this.toggle(row);
      return;
    }
    this.selected.set(row.item);
    this.activated.emit(row.item);
  }

  /** Checks or unchecks a row that has a box; does nothing for one that has none. */
  private toggle(row: Row<T, K>): void {
    if (!row.checkable) return;
    this.checked.update((keys) =>
      keys.includes(row.key) ? keys.filter((key) => key !== row.key) : [...keys, row.key],
    );
  }
}
