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
  isDevMode,
  model,
  output,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { NeatIcon, type NeatTone } from '@sima/neat-ui';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. Colours are the theme's tokens only; select-list.spec holds each pairing to its contrast.
 */

/**
 * The list's own box. It draws the focus ring, as an outline of a pseudo-element laid over the
 * scrolling area: an outline of the area itself, or of the list, paints under the sticky header
 * (a layer of its own), whose fill would hide the ring's top edge. The pseudo-element comes after
 * the area, so it paints over it; it takes no clicks.
 */
const HOST_CLASSES =
  'relative flex h-full min-h-0 flex-col after:pointer-events-none after:absolute after:inset-0 has-[[role=listbox]:focus-visible]:after:outline-2 has-[[role=listbox]:focus-visible]:after:-outline-offset-2 has-[[role=listbox]:focus-visible]:after:outline-ring';

/**
 * The scrolling area, which holds the header and the rows. It isolates what it draws, so that the
 * header's z-index ranks it over the rows' content but not over the ring. While there is a header,
 * the area's top padding is the header's height (`scroll-pt-7`, bound in the template): a row
 * scrolled into view at the top (ArrowUp, Home) stops below the header instead of under it.
 */
const SCROLLER_CLASSES = 'isolate min-h-0 flex-1 overflow-x-hidden overflow-y-auto';

/**
 * The one grid: the columns' tracks, which the header line, the listbox and each row in it take
 * through `grid-cols-subgrid`. Every line sizes the same tracks, so a content-sized track (`auto`,
 * `max-content`) fits the widest of the heading and the cells, and the headings stay over their
 * columns. The lines' inset (the active row's bar and the padding) is the grid's padding: see
 * LINE_CLASSES. The empty note takes that inset as it is, so its text starts where the cells' does.
 */
const GRID_CLASSES =
  'grid grid-cols-(--neat-select-list-columns) gap-x-(--neat-space-3) ps-[calc(var(--neat-space-3)+2px)] pe-(--neat-space-3)';

/** The listbox: a line of the grid that holds the rows, which are lines of it in turn. */
const LISTBOX_CLASSES = 'col-span-full grid grid-cols-subgrid outline-none';

/**
 * A line of cells on every track of the grid, with a 2px inset on the start side that the active
 * row's bar fills (`--primary`, 3:1 against the row's fill and the surface); the bar, not the fill
 * alone, marks it. The active row is the selected one, marked `data-active` rather than by
 * `aria-selected`, which in checked mode says a row is checked.
 *
 * A subgrid's margin, border and padding at an edge are added to the margin of the cells in that
 * edge's track, which would take them out of a fixed track's width (a 1rem box track would leave
 * the box 2px). So a line's negative inline margins cancel its border and padding at both edges,
 * and the grid's padding, which they reach into, makes the room: the cells keep their tracks'
 * widths, and a line's fill and bar still run from edge to edge of the area.
 */
const LINE_CLASSES =
  'col-span-full grid grid-cols-subgrid items-center -ms-[calc(var(--neat-space-3)+2px)] -me-(--neat-space-3) border-s-2 px-(--neat-space-3)';
const ROW_CLASSES = `${LINE_CLASSES} min-h-9 cursor-default border-transparent py-1 text-sm data-active:border-primary`;

/**
 * The header line: the columns' labels, sticky at the top of the scrolling area. Its height is
 * fixed (`h-7`, the area's `scroll-pt-7`) so that the area can keep rows from under it. It fills
 * with `--neat-surface`, the fill of whatever the list sits on (the page, a dialog, a popover), to
 * cover the rows scrolling under it, and its z-index puts it over what they draw (a positioned
 * chip would otherwise paint over it, coming later). Its start edge is transparent: it is the
 * rows' bar inset.
 */
const HEADER_CLASSES = `${LINE_CLASSES} sticky top-0 z-1 h-7 border-b border-s-transparent border-b-border bg-(--neat-surface) text-xs font-medium text-muted-foreground`;

/** A group: a line of the grid that holds its heading and its rows, which stay lines of it. */
const GROUP_CLASSES = 'col-span-full grid grid-cols-subgrid';

/**
 * A group's heading, across every track, on a `--muted` band: small uppercase medium text in the
 * body colour or, for a group the app mutes (nothing found, not looked for yet), the muted one;
 * select-list.spec holds both to 4.5:1 on the band. The band runs from edge to edge of the area as
 * a row's fill does, reaching into the grid's padding with the rows' negative margins (see
 * LINE_CLASSES), and pads its text back by as much, so the text starts where the cells' does. It
 * stays in the flow, so the sticky header (z-1) covers it as it scrolls under.
 */
const GROUP_HEADING_BASE =
  'col-span-full -ms-[calc(var(--neat-space-3)+2px)] -me-(--neat-space-3) bg-muted py-1.5 ps-[calc(var(--neat-space-3)+2px)] pe-(--neat-space-3) text-xs font-medium uppercase';
const GROUP_HEADING_CLASSES = {
  plain: `${GROUP_HEADING_BASE} text-foreground`,
  muted: `${GROUP_HEADING_BASE} text-muted-foreground`,
} as const;

/** A column's header label and its cells by the column's `align`. */
const HEADER_LABEL_CLASSES: Record<'start' | 'end', string> = {
  start: 'min-w-0 truncate',
  end: 'min-w-0 truncate text-end',
};
const CELL_CLASSES: Record<'start' | 'end', string> = {
  start: 'min-w-0',
  end: 'min-w-0 text-end',
};

/**
 * A row's fills by its tone, each row taking exactly one set. A neutral row has none at rest and is
 * `--accent` when hovered or active. A toned row is its tone's tint at rest and the tint's accent,
 * more of the same tone, when hovered or active: the plain `--accent` would be a grey about as light
 * as the tint, which hardly shows on it, and would hide the tone of the row it marks. The theme
 * holds each accent to MIN_FILL_CONTRAST on its tint, and body and muted text to 4.5:1 on both.
 */
const ROW_FILL_CLASSES: Record<NeatTone, string> = {
  neutral: 'hover:bg-accent data-active:bg-accent',
  success:
    'bg-neat-tint-success hover:bg-neat-tint-success-accent data-active:bg-neat-tint-success-accent',
  warning:
    'bg-neat-tint-warning hover:bg-neat-tint-warning-accent data-active:bg-neat-tint-warning-accent',
  danger:
    'bg-neat-tint-danger hover:bg-neat-tint-danger-accent data-active:bg-neat-tint-danger-accent',
  info: 'bg-neat-tint-info hover:bg-neat-tint-info-accent data-active:bg-neat-tint-info-accent',
  highlight:
    'bg-neat-tint-highlight hover:bg-neat-tint-highlight-accent data-active:bg-neat-tint-highlight-accent',
};

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
 * and `width` is its CSS track size in the list's grid, `1fr` by default. The header and the rows
 * share the grid's tracks, so a content-sized width (`auto`, `max-content`) fits the widest of the
 * label and the cells. `align="end"` puts the label and the cells' text at the end of the column,
 * as numbers read best. The template gets the item as its implicit context. A cell is a block
 * that may shrink to nothing (`min-width: 0`), so it does not push the next column out; it does not
 * cut its content, though. A long text wraps, and an unbroken one overflows into the next cell,
 * unless the template truncates it (an element with `overflow: hidden`, `text-overflow: ellipsis`
 * and `white-space: nowrap`).
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
  /** Where the label and the cells' text sit in the column. */
  readonly align = input<'start' | 'end'>('start');
  /** The list's width in CSS pixels below which the column is not shown; always shown if unset. */
  readonly hideBelow = input<number>();
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/**
 * A group of a `neat-select-list`'s rows under a heading: `key` is what `groupOf` returns for its
 * items, `label` the heading's text (the app's own, a count included if it wants one), and `muted`
 * greys the heading, for a group with nothing in it.
 */
export interface NeatSelectListGroup {
  readonly key: string;
  readonly label: string;
  readonly muted?: boolean;
}

/**
 * A row: the item, its key, its place among the rows as shown (`data-index`), whether it can be
 * checked, its classes (by its tone), the element id the listbox points at, and its cells' context.
 */
interface Row<T, K> {
  readonly item: T;
  readonly key: K;
  readonly index: number;
  /** The id of its group's heading if it is the group's first row, which reveals it too. */
  readonly heading: string | null;
  readonly checkable: boolean;
  readonly classes: string;
  readonly id: string;
  readonly context: { readonly $implicit: T };
}

/**
 * Rows as shown together: a group's, under its heading (an element id and its classes), or rows
 * under no heading (`group` null): all rows of a list without groups, or, in production, the items
 * of groups the app did not list. `key` tracks it: the group's key, or null for the one without.
 * `views` are its rows as the row template's contexts, made once with the rows rather than as a
 * literal per row on every check.
 */
interface Section<T, K> {
  readonly key: string | null;
  readonly group: NeatSelectListGroup | null;
  readonly headingId: string;
  readonly headingClasses: string;
  readonly views: readonly { readonly $implicit: Row<T, K> }[];
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
 * that stays put: the header sits in the scrolling area, sticky at its top, filled with
 * `--neat-surface` (the page's background, or a dialog's or popover's surface, which they set; a
 * card of the app's sets it to its own fill). `trackBy` gives an item's identity, unique in the
 * list: the selection follows the item with the same key when `items` is replaced by new objects (a
 * poll's answer), and rows, with the state in their cells, are kept rather than rebuilt. It is
 * called once per item whenever `items` changes, never while the list is only checked or the
 * selection moves.
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
 * are not tab stops. The multi-selectable listbox says what checking is, so a checked list needs
 * no `hint` of its own.
 *
 * **Row tones** (`rowTone`) tint a row with a soft fill of a status colour, the tone its status
 * chip has (`NeatTone`), so that a state reads along the whole row: the app gives both the same
 * tone. A `neutral` row is untinted. A toned row still shows hover and selection, with more of its
 * tone, and the selected one keeps its bar. The tints are mixed over the content background
 * (`--background`), so a toned list belongs on it, not on a card. The words in the row still carry
 * the state; the tint repeats them.
 *
 * **Groups** (`groups`, with `groupOf` naming an item's group by its key) put the rows under
 * headings, in the groups' order, each item keeping its order within its group. A group is a
 * `group` named by its heading, which spans the columns; an empty group shows its heading alone,
 * and a `muted` one greys it. The arrow keys, Home and End move over the rows as shown, never onto
 * a heading, and a click on a heading does nothing. An item whose group is not listed is a mistake
 * in the app: it throws in dev mode, and in production shows after the groups, under no heading,
 * rather than going missing.
 *
 * Typing a letter to jump to a row, Page Up and Page Down, a range of rows checked with Shift and
 * a disabled row are not offered; none is needed yet.
 */
@Component({
  selector: 'neat-select-list',
  imports: [NeatIcon, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: HOST_CLASSES,
    '[style.--neat-select-list-columns]': 'gridColumns()',
  },
  template: `
    <div #scroller [class]="scrollerClasses" [class.scroll-pt-7]="hasHeader()">
      @if (hint()) {
        <span class="sr-only" [id]="hintId">{{ hint() }}</span>
      }
      <div data-slot="select-list-grid" [class]="gridClasses">
        @if (hasHeader()) {
          <div data-slot="select-list-header" aria-hidden="true" [class]="headerClasses">
            @if (checkable()) {
              <span></span>
            }
            @for (column of visibleColumns(); track column) {
              <span [class]="headerLabelClasses[column.align()]">{{ column.header() }}</span>
            }
          </div>
        }
        <div
          #listbox
          role="listbox"
          tabindex="0"
          [class]="listboxClasses"
          [attr.aria-label]="label()"
          [attr.aria-multiselectable]="checkable() || null"
          [attr.aria-activedescendant]="activeId()"
          [attr.aria-describedby]="describedBy()"
          (keydown)="onKeydown($event)"
          (click)="onClick($event)"
        >
          @for (section of sections(); track section.key) {
            @if (section.group; as group) {
              <div role="group" [attr.aria-labelledby]="section.headingId" [class]="groupClasses">
                <div
                  role="presentation"
                  data-slot="select-list-group-heading"
                  [id]="section.headingId"
                  [class]="section.headingClasses"
                >
                  {{ group.label }}
                </div>
                @for (view of section.views; track view.$implicit.key) {
                  <ng-container [ngTemplateOutlet]="rowTemplate" [ngTemplateOutletContext]="view" />
                }
              </div>
            } @else {
              @for (view of section.views; track view.$implicit.key) {
                <ng-container [ngTemplateOutlet]="rowTemplate" [ngTemplateOutletContext]="view" />
              }
            }
          }
        </div>
        @if (isEmpty()) {
          <p
            data-slot="select-list-empty"
            class="col-span-full py-(--neat-space-2) text-sm text-muted-foreground"
            [id]="emptyId"
          >
            {{ emptyLabel() }}
          </p>
        }
      </div>
    </div>
    <!--
      One row, as a listbox option; written once for rows inside a group and outside one. Its
      context is { $implicit: Row<T, K> }, which Angular cannot check in a local template.
    -->
    <ng-template #rowTemplate let-row>
      <div
        role="option"
        [id]="row.id"
        [attr.data-index]="row.index"
        [class]="row.classes"
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
          <div [class]="cellClasses[column.align()]">
            <ng-container
              [ngTemplateOutlet]="column.template"
              [ngTemplateOutletContext]="row.context"
            />
          </div>
        }
      </div>
    </ng-template>
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
  /** An item's row tone, `neutral` (untinted) by default; called once per item as `items` change. */
  readonly rowTone = input<(item: T) => NeatTone>(() => 'neutral');
  /** The groups to show the rows under, in order; `null` (the default) for no headings. */
  readonly groups = input<readonly NeatSelectListGroup[] | null>(null);
  /**
   * With `groups`, the key of an item's group; called once per item as the inputs that shape the
   * rows change (`items`, `groups` and the other per-item functions), never as the selection moves.
   */
  readonly groupOf = input<(item: T) => string>(() => '');
  /** What to say, in place of rows, while there are no items. */
  readonly emptyLabel = input('');
  /**
   * Text for assistive technology that says what keys an app adds beyond the listbox's own (such
   * as Delete on a row); it describes the listbox, and is not shown.
   */
  readonly hint = input('');
  /** The item of the row that was clicked or that had Enter pressed on it. */
  readonly activated = output<T>();

  protected readonly scrollerClasses = SCROLLER_CLASSES;
  protected readonly gridClasses = GRID_CLASSES;
  protected readonly listboxClasses = LISTBOX_CLASSES;
  protected readonly headerClasses = HEADER_CLASSES;
  protected readonly headerLabelClasses = HEADER_LABEL_CLASSES;
  protected readonly cellClasses = CELL_CLASSES;
  protected readonly groupClasses = GROUP_CLASSES;
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
   * The rows as shown and the sections they sit in, worked out as the inputs that shape them
   * change: each row's key, its tone's classes, in checked mode whether it has a box, and with
   * groups its group (calls of the app's functions), its index as shown, its id, its cells' context
   * and the heading it reveals. `trailingHeading` is the last empty group's heading, which End
   * reveals with the last row. Change detection then reads these and calls nothing.
   */
  private readonly layout = computed(() => {
    const keyOf = this.trackBy();
    const canCheck = this.checkable() ? this.canCheck() : () => false;
    const toneOf = this.rowTone();
    const rows: Row<T, K>[] = [];
    const section = (
      key: string | null,
      group: NeatSelectListGroup | null,
      items: readonly T[],
      position: number,
    ): Section<T, K> => {
      // Numbered, not named by the key, which is the app's text and may hold spaces.
      const headingId = `neat-select-list-${this.id}-group-${position}`;
      const start = rows.length;
      for (const item of items) {
        const index = rows.length;
        rows.push({
          item,
          key: keyOf(item),
          index,
          heading: group && index === start ? headingId : null,
          checkable: canCheck(item),
          classes: `${ROW_CLASSES} ${ROW_FILL_CLASSES[toneOf(item)]}`,
          id: `neat-select-list-${this.id}-${index}`,
          context: { $implicit: item },
        });
      }
      return {
        key,
        group,
        headingId,
        headingClasses: GROUP_HEADING_CLASSES[group?.muted ? 'muted' : 'plain'],
        views: rows.slice(start).map((row) => ({ $implicit: row })),
      };
    };
    const groups = this.groups();
    if (groups === null) {
      return {
        rows,
        sections: [section(null, null, this.items(), 0)],
        trailingHeading: null,
      };
    }
    // A group listed twice is the app's mistake, as an unlisted one is: in production the first
    // listing stands, so that no row shows twice.
    const listed: NeatSelectListGroup[] = [];
    const members = new Map<string, T[]>();
    for (const group of groups) {
      if (members.has(group.key)) {
        if (isDevMode()) {
          throw new Error(`neat-select-list: the group "${group.key}" is listed twice`);
        }
        continue;
      }
      members.set(group.key, []);
      listed.push(group);
    }
    const groupOf = this.groupOf();
    const unlisted: T[] = [];
    for (const item of this.items()) {
      const key = groupOf(item);
      const bucket = members.get(key);
      if (bucket) {
        bucket.push(item);
      } else if (isDevMode()) {
        throw new Error(`neat-select-list: an item is in the unlisted group "${key}"`);
      } else {
        unlisted.push(item);
      }
    }
    const sections = listed.map((group, position) =>
      section(group.key, group, members.get(group.key)!, position),
    );
    if (unlisted.length) sections.push(section(null, null, unlisted, listed.length));
    const last = sections.at(-1);
    const trailingHeading = last?.group && last.views.length === 0 ? last.headingId : null;
    return { rows, sections, trailingHeading };
  });

  /** The rows in the order they are shown, which the keys move through. */
  protected readonly rows = computed<readonly Row<T, K>[]>(() => this.layout().rows);
  protected readonly sections = computed<readonly Section<T, K>[]>(() => this.layout().sections);

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
    const { rows, trailingHeading } = this.layout();
    const row = rows[index];
    if (row.key === this.revealed) return;
    this.revealed = row.key;
    const listbox = this.listbox().nativeElement;
    // A row is found by its index as shown (with groups, not its place among its parent's
    // children), and as an option, since a cell's content may carry a data-index of its own.
    // jsdom has no scrollIntoView.
    const reveal = (element: Element | null) => element?.scrollIntoView?.({ block: 'nearest' });
    reveal(listbox.querySelector(`[role="option"][data-index="${index}"]`));
    // Then the headings that belong with it, nearest again, so that only a move up scrolls for
    // them: a group's first row brings its heading (it would stop under the sticky header, its kind
    // out of view), and the last row the empty groups after it, whose "none found" is content.
    if (row.heading) reveal(listbox.querySelector(`#${row.heading}`));
    if (trailingHeading && index === rows.length - 1) {
      reveal(listbox.querySelector(`#${trailingHeading}`));
    }
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
    const row = this.rows()[Number(option.getAttribute('data-index'))];
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
