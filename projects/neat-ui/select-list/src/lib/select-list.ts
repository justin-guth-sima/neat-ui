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
import { NeatIcon, type NeatTone, NeatTooltip } from '@sima/neat-ui';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. Colors are the theme's tokens only; select-list.spec holds each pairing to its contrast.
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
 * scrolled into view at the top (ArrowUp, Home) stops below the header instead of under it. It is
 * the containing block of what the rows position (a cell's visually hidden text): the list's box
 * lies outside the scrolling area, so a row scrolled past the bottom would otherwise make the page
 * scroll.
 */
const SCROLLER_CLASSES = 'relative isolate min-h-0 flex-1 overflow-x-hidden overflow-y-auto';

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
 * The rule before the rows of a group the app did not list (production only): an empty strip
 * between two border lines, from edge to edge of the area as a heading's band is. Without it those
 * rows would sit straight under the last group's heading and read as its members, which for a
 * device list is a misreported device. It is not a band: after a muted, empty last group it would
 * run together with that heading's.
 */
const GROUP_SEPARATOR_CLASSES =
  'col-span-full -ms-[calc(var(--neat-space-3)+2px)] -me-(--neat-space-3) h-(--neat-space-2) border-y border-border';

/**
 * A group's heading, across every track, on a `--muted` band: small uppercase medium text in the
 * body color or, for a group the app mutes (nothing found, not looked for yet), the muted one;
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
 * more of the same tone, when hovered or active: the plain `--accent` would be a gray about as light
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
 * says whether it is checked), so it takes neither the focus nor a name. A blocked box (see
 * `checkBlocked`) is dimmed as a disabled button is, with a not-allowed cursor; each box takes
 * exactly one of the two sets.
 */
const CHECK_BASE =
  'flex size-4 shrink-0 items-center justify-center rounded-sm border border-input data-checked:border-primary data-checked:bg-primary';
const CHECK_CLASSES = {
  open: `${CHECK_BASE} cursor-pointer`,
  blocked: `${CHECK_BASE} cursor-not-allowed opacity-50`,
} as const;
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

/**
 * What a pointer does to a row: `click` or `double-click`.
 *
 * With `click`, a click selects the row and tells `activated`. With `double-click`, a click only
 * selects it, and a double click tells `activated`. Enter tells it in both.
 */
export type NeatActivateOn = 'click' | 'double-click';

/** Stands for "no selection" in key comparisons; no item's key can be it. */
const NONE = Symbol('none');

/** A key that types one Latin letter. */
const LATIN_LETTER = /^[a-z]$/i;

/**
 * Ctrl+A, or Cmd+A on a Mac, with no other modifier. The A is the letter the layout types, so
 * AZERTY's A counts though it sits where QWERTY has Q. A layout that types no Latin letter on the
 * key (Cyrillic, Greek) is read by the key's place, `code` KeyA, as shortcuts are on such layouts;
 * reading the place alone would take AZERTY's Q for A.
 */
const isSelectAll = (event: KeyboardEvent): boolean =>
  (event.ctrlKey || event.metaKey) &&
  !event.altKey &&
  !event.shiftKey &&
  (LATIN_LETTER.test(event.key) ? event.key.toLowerCase() === 'a' : event.code === 'KeyA');

/**
 * One column of a `neat-select-list`, as a template for the cells in it:
 *
 * ```html
 * <ng-template neatColumn="state" header="State" width="6rem" let-slot>{{ slot.state }}</ng-template>
 * ```
 *
 * The key names the column. `header` is the label over it. With no label on any column, there is
 * no header row. The template gets the item as its implicit context.
 *
 * `width` is the column's CSS track size in the list's grid, `1fr` by default. The header and the
 * rows share the grid's tracks. So a content-sized width (`auto`, `max-content`) fits the widest
 * of the label and the cells. `align="end"` puts the label and the cells' text at the end of the
 * column, as numbers read best.
 *
 * A cell is a block that may shrink to nothing (`min-width: 0`), so it does not push the next
 * column out. It does not cut its content, though. A long text wraps, and an unbroken one
 * overflows into the next cell, unless the template truncates it. Truncate with an element that
 * has `overflow: hidden`, `text-overflow: ellipsis` and `white-space: nowrap`.
 *
 * `hideBelow` is a width of the list in CSS pixels, such as `[hideBelow]="720"`. While the list is
 * narrower, the column and its header leave the layout entirely, as if the template were not
 * there. Use it for columns that matter less than the others on a narrow screen.
 */
@Directive({ selector: 'ng-template[neatColumn]' })
export class NeatColumn {
  /** The column's name, written as the directive's own attribute: `neatColumn="state"`. */
  readonly key = input.required<string>({ alias: 'neatColumn' });
  /** The label over the column; empty by default, and no header row while no column has one. */
  readonly header = input('');
  /** The column's track size in the list's grid, any CSS grid track size (`6rem`, `auto`). */
  readonly width = input('1fr');
  /** Where the label and the cells' text sit in the column. */
  readonly align = input<'start' | 'end'>('start');
  /** The list's width in CSS pixels below which the column is not shown; always shown if unset. */
  readonly hideBelow = input<number>();
  /**
   * @internal The template the list renders in each row; apps never read it.
   */
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/**
 * A group of a `neat-select-list`'s rows, under a heading.
 *
 * `key` is what `groupOf` returns for its items. `label` is the heading's text, the app's own, a
 * count included if it wants one. `muted` grays the heading, for a group with nothing in it.
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
 * `separated` is that last case, set off from the groups before it. `views` are its rows as the
 * row template's contexts, made once with the rows rather than as a literal per row on every
 * check.
 */
interface Section<T, K> {
  readonly key: string | null;
  readonly group: NeatSelectListGroup | null;
  readonly headingId: string;
  readonly headingClasses: string;
  readonly separated: boolean;
  readonly views: readonly { readonly $implicit: Row<T, K> }[];
}

/** Whether two lists hold the same columns in the same order. */
const sameColumns = (a: readonly NeatColumn[], b: readonly NeatColumn[]): boolean =>
  a.length === b.length && a.every((column, index) => column === b[index]);

/** Numbers each list, for the element ids its options and empty message get. */
let nextListId = 0;

/**
 * A list of items in columns, one row each, with one row selected.
 *
 * ```html
 * <neat-select-list label="Streaming slots" [items]="slots()" [trackBy]="slotId" [(selected)]="slot">
 *   <ng-template neatColumn="name" header="Slot" let-slot>{{ slot.name }}</ng-template>
 *   <ng-template neatColumn="state" header="State" width="6rem" let-slot>…</ng-template>
 * </neat-select-list>
 * ```
 *
 * The app lays out the columns with `neatColumn` templates. The list fills its container, which
 * needs a height, and scrolls its rows inside, under a header that stays put.
 *
 * The header sits in the scrolling area, sticky at its top, and filled with `--neat-surface`. That
 * is the page's background, or the surface a dialog, a popover or an app's card sets.
 *
 * `trackBy` gives an item's identity, unique in the list. When `items` is replaced by new objects,
 * such as a poll's answer, the selection follows the item with the same key. Rows, with the state
 * in their cells, are kept rather than rebuilt. `trackBy` is called once per item whenever `items`
 * changes, never while the list is only checked or the selection moves.
 *
 * It is a single-select `listbox` named by `label`, whose `option` rows are `aria-selected`.
 * Selection follows focus. The listbox is the one tab stop, holds the focus, and names the selected
 * row in `aria-activedescendant`.
 * - ArrowDown and ArrowUp move the selection. When nothing is selected, the first press picks the
 *   first or last row.
 * - Home and End jump to the ends.
 * - The selected row scrolls into view, within the list's own area only. The page around it stays
 *   where it is.
 * - Enter, and a click on a row, tell `activated` with the row's item. With
 *   `activateOn="double-click"`, a click only selects, and a double click tells it. Enter still
 *   does.
 *
 * A double click does not select a row's text. A click on a control in a cell, and every key
 * pressed while one has the focus, are that control's: they neither select nor activate. Controls
 * in cells are ordinary tab stops after the listbox.
 *
 * The header repeats the columns' labels for the eye, and is hidden from assistive technology. The
 * rows read as the text of their cells in order, as a listbox's options do, since a listbox cannot
 * name its columns.
 *
 * `hint` is read as the listbox's description, for keys the app adds on top of these.
 *
 * **Checked mode** (`checkable`) is for acting on several rows. Each row that `canCheck` allows
 * has a box before its cells, and `checked` holds the keys (`trackBy`'s) of the checked rows.
 *
 * `checked` holds keys rather than items. It keeps the keys of rows it does not list, such as a
 * file in another folder or a type a filter hides. A newly checked key is appended and an
 * unchecked one removed. The rest are left as they are.
 *
 * The listbox is then multi-selectable, as the WAI-ARIA multi-select listbox has it. A checkable
 * row is `aria-selected` while it is checked. A row that cannot be checked has no `aria-selected`.
 *
 * The selection that follows the arrow keys (`selected`) stays. It is the row the keyboard is on,
 * named in `aria-activedescendant` and drawn with the bar. In checked mode:
 * - Space checks or unchecks that row.
 * - A click on a row's box checks or unchecks it, and does nothing else.
 * - A click elsewhere on the row selects and activates it, as in the single mode. On the selected
 *   row it checks or unchecks it instead, as Space does. A row that cannot be checked is activated
 *   again, as before.
 * - The second click of a double click never checks. A double click on the already selected
 *   checkable row checks it once, with its first click. With `activateOn="double-click"`, the
 *   `dblclick` then only activates.
 * - Ctrl-click or Cmd-click on a row checks or unchecks it, and selects it without activating it.
 * - Shift-click checks the rows from the anchor to the clicked one, inclusive, and selects the
 *   clicked one. The anchor is the row last clicked plainly, with Ctrl or Cmd, or checked by Space
 *   or its box. Without one, it is the selected row, else the clicked row alone.
 * - A range only checks, never unchecks. Ctrl+A or Cmd+A checks every row.
 *
 * None of these checks a row without a box or a blocked one, and a row they do not check stays as
 * it is. The boxes are not tab stops. The multi-selectable listbox says what checking is, so a
 * checked list needs no `hint` of its own.
 *
 * **Blocked checks** (`checkBlocked`) hold a row's box as it is while the app gives a reason, such
 * as a cap: "At most 8 runs can be compared." The box is drawn disabled. Neither Space nor a click
 * on it checks or unchecks the row.
 *
 * Everything else about the row stays, since only its box is blocked. The keys still land on it,
 * and a click and Enter still select and activate it.
 *
 * Its option keeps `aria-selected`, false while unchecked, and is `aria-disabled`. In this listbox
 * selecting is checking. So a disabled option says that Space will not check it, where an enabled
 * one would promise a check that silently fails. `aria-disabled` blocks no events, and the row
 * stays the active descendant, so it is still reached and activated.
 *
 * The reason describes the option (`aria-describedby`), so a screen reader says it as the keys
 * land on the row. A tooltip on the box shows it on hover. A tooltip never opens on touch, so an
 * app with a cap says it in its own text too.
 *
 * Any reason but null blocks, so give a non-empty one: it is what is announced. `canCheck` still
 * means whether a row has a box at all.
 *
 * **Row tones** (`rowTone`) tint a row with a soft fill of a status color, the tone its badge has
 * (`NeatTone`). So a state reads along the whole row: the app gives both the same tone. A soft
 * badge's fill is the toned row's selected fill, so the badge on a toned row is
 * `variant="solid"`.
 *
 * A `neutral` row is untinted. A toned row still shows hover and selection, with more of its tone,
 * and the selected one keeps its bar. The tints are mixed over the content background
 * (`--background`), so a toned list belongs on it, not on a card. The words in the row still carry
 * the state, and the tint repeats them.
 *
 * **Groups** (`groups`, with `groupOf` naming an item's group by its key) put the rows under
 * headings. The groups come in their order, and each item keeps its order within its group.
 *
 * A group is a `group` named by its heading, which spans the columns. An empty group shows its
 * heading alone, and a `muted` one grays it. The arrow keys, Home and End move over the rows as
 * shown, never onto a heading. A click on a heading does nothing.
 *
 * An item whose group is not listed is a mistake in the app. It throws in dev mode. In production
 * it shows after the groups, under no heading and set off from the last group by a rule, rather
 * than going missing.
 *
 * Typing a letter to jump to a row, Page Up and Page Down, and a disabled row are not offered: none
 * is needed yet.
 */
@Component({
  selector: 'neat-select-list',
  imports: [NeatIcon, NeatTooltip, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: HOST_CLASSES,
    '[style.--neat-select-list-columns]': 'gridColumns()',
  },
  template: `
    <!-- The columns, read once for the header and every row: a read in each row collected them
         anew from the content query, which every row added marks changed (each row is a view of
         a column template), so a thousand rows walked the rows a thousand times. -->
    @let shownColumns = visibleColumns();
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
            @for (column of shownColumns; track column) {
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
          (dblclick)="onDoubleClick($event)"
          (mousedown)="onMousedown($event)"
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
              @if (section.separated) {
                <div
                  data-slot="select-list-group-separator"
                  aria-hidden="true"
                  [class]="separatorClasses"
                ></div>
              }
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
        [attr.aria-disabled]="blocked().has(row.key) || null"
        [attr.aria-describedby]="blocked().has(row.key) ? row.id + '-blocked' : null"
      >
        @if (checkable()) {
          <div class="flex">
            @if (row.checkable) {
              <!-- Two boxes rather than one with a disabled tooltip: a tooltip is a brain
                   primitive, so only a blocked box carries one, never the open boxes of a
                   thousand-file folder. -->
              @let reason = blocked().get(row.key);
              @if (reason !== undefined) {
                <span
                  data-slot="select-list-check"
                  aria-hidden="true"
                  data-blocked
                  [class]="checkClasses.blocked"
                  [attr.data-checked]="checkedKeys().has(row.key) ? '' : null"
                  [neatTooltip]="reason"
                >
                  <ng-container
                    [ngTemplateOutlet]="tick"
                    [ngTemplateOutletContext]="{ $implicit: row }"
                  />
                </span>
                <!-- Hidden: it describes the option without becoming part of the option's name. -->
                <span hidden [id]="row.id + '-blocked'">{{ reason }}</span>
              } @else {
                <span
                  data-slot="select-list-check"
                  aria-hidden="true"
                  [class]="checkClasses.open"
                  [attr.data-checked]="checkedKeys().has(row.key) ? '' : null"
                >
                  <ng-container
                    [ngTemplateOutlet]="tick"
                    [ngTemplateOutletContext]="{ $implicit: row }"
                  />
                </span>
              }
            }
          </div>
        }
        @for (column of shownColumns; track column) {
          <div [class]="cellClasses[column.align()]">
            <ng-container
              [ngTemplateOutlet]="column.template"
              [ngTemplateOutletContext]="row.context"
            />
          </div>
        }
      </div>
    </ng-template>
    <!-- A box's tick, while its row is checked; context { $implicit: Row<T, K> }. -->
    <ng-template #tick let-row>
      @if (checkedKeys().has(row.key)) {
        <neat-icon name="check" [size]="12" class="text-primary-foreground" />
      }
    </ng-template>
  `,
})
export class NeatSelectList<T, K = unknown> {
  /** The accessible name of the list. */
  readonly label = input.required<string>();
  /** The items, one row each, in the order given (within its group, with `groups`). */
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
  /**
   * In checked mode, why a row with a box cannot be ticked or unticked now (a cap that is
   * reached), or null while it can. Any string blocks, so make it a sentence: it is the row's
   * description and its box's tooltip. Called for each row with a box as `items` or `checked`
   * change.
   */
  readonly checkBlocked = input<(item: T) => string | null>(() => null);
  /**
   * An item's row tone, `neutral` (untinted) by default; called once per item as `items` change.
   * A badge on a toned row is `variant="solid"`: a soft badge's fill is the row's selected fill.
   */
  readonly rowTone = input<(item: T) => NeatTone>(() => 'neutral');
  /** The groups to show the rows under, in order; `null` (the default) for no headings. */
  readonly groups = input<readonly NeatSelectListGroup[] | null>(null);
  /**
   * With `groups`, the key of an item's group.
   *
   * It is called once per item as the inputs that shape the rows change: `items`, `groups` and the
   * other per-item functions. It is never called as the selection moves.
   */
  readonly groupOf = input<(item: T) => string>(() => '');
  /** What to say, in place of rows, while there are no items. */
  readonly emptyLabel = input('');
  /**
   * Text for assistive technology that says what keys an app adds beyond the listbox's own.
   *
   * Delete on a row is one. The text describes the listbox, and is not shown.
   */
  readonly hint = input('');
  /**
   * What the pointer does to a row: `click` (the default) or `double-click`.
   *
   * With `click`, a click selects the row and tells `activated`. With `double-click`, a click only
   * selects it, and a double click tells `activated`, as a file manager opens a folder. Enter tells
   * it in both.
   */
  readonly activateOn = input<NeatActivateOn>('click');
  /**
   * The item of the row that was activated: by a click or double click (`activateOn`), or Enter.
   */
  readonly activated = output<T>();

  protected readonly scrollerClasses = SCROLLER_CLASSES;
  protected readonly gridClasses = GRID_CLASSES;
  protected readonly listboxClasses = LISTBOX_CLASSES;
  protected readonly headerClasses = HEADER_CLASSES;
  protected readonly headerLabelClasses = HEADER_LABEL_CLASSES;
  protected readonly cellClasses = CELL_CLASSES;
  protected readonly groupClasses = GROUP_CLASSES;
  protected readonly separatorClasses = GROUP_SEPARATOR_CLASSES;
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
      separated = false,
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
        separated,
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
    if (unlisted.length) sections.push(section(null, null, unlisted, listed.length, true));
    const last = sections.at(-1);
    const trailingHeading = last?.group && last.views.length === 0 ? last.headingId : null;
    return { rows, sections, trailingHeading };
  });

  /** The rows in the order they are shown, which the keys move through. */
  protected readonly rows = computed<readonly Row<T, K>[]>(() => this.layout().rows);
  protected readonly sections = computed<readonly Section<T, K>[]>(() => this.layout().sections);

  protected readonly checkedKeys = computed(() => new Set<unknown>(this.checked()));

  /**
   * The reasons the rows with a box cannot be checked now, by key. A block such as a cap depends on
   * the checks, so this reads `checked` and asks again whenever they change, even when the app's
   * function reads them from somewhere the list cannot see; never as the selection moves.
   */
  protected readonly blocked = computed(() => {
    const reasons = new Map<unknown, string>();
    if (!this.checkable()) return reasons;
    const reasonOf = this.checkBlocked();
    this.checked();
    for (const row of this.rows()) {
      const reason = row.checkable ? reasonOf(row.item) : null;
      if (reason !== null) reasons.set(row.key, reason);
    }
    return reasons;
  });

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

  /**
   * The key of the row a Shift-click's range starts from: the one last clicked plainly, clicked
   * with Ctrl or Cmd, or checked by Space or its box. The arrow keys do not move it.
   */
  private anchor: unknown = NONE;

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
    this.reveal(listbox.querySelector(`[role="option"][data-index="${index}"]`));
    // Then the headings that belong with it, nearest again, so that only a move up scrolls for
    // them: a group's first row brings its heading (it would stop under the sticky header, its kind
    // out of view), and the last row the empty groups after it, whose "none found" is content.
    if (row.heading) this.reveal(listbox.querySelector(`#${row.heading}`));
    if (trailingHeading && index === rows.length - 1) {
      this.reveal(listbox.querySelector(`#${trailingHeading}`));
    }
  }

  /**
   * Scrolls the list's own area, and nothing else, by the least that brings the element in view,
   * below the sticky header. `scrollIntoView` would scroll every scrollable ancestor too, so a list
   * in a page, even one below the fold, would take the page along with it. The area is the
   * element's offset parent (it is positioned), so `offsetTop` is the element's place in it.
   */
  private reveal(element: HTMLElement | null): void {
    if (!element) return;
    const scroller = this.scroller().nativeElement;
    const header = scroller.querySelector<HTMLElement>('[data-slot="select-list-header"]');
    const covered = header?.offsetHeight ?? 0;
    const top = element.offsetTop;
    const bottom = top + element.offsetHeight;
    if (top < scroller.scrollTop + covered) {
      scroller.scrollTop = top - covered;
    } else if (bottom > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = bottom - scroller.clientHeight;
    }
  }

  /**
   * Scrolls back to the top, or to the selected row when there is one in the list.
   *
   * A different set of rows, such as another folder, needs it. Call it once the new rows are
   * rendered.
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
    // Ctrl+A or Cmd+A checks every row that can be checked in checked mode; otherwise it stays the
    // browser's.
    if (this.checkable() && isSelectAll(event)) {
      event.preventDefault();
      this.checkAll(this.rows());
      return;
    }
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
    const index = Number(option.getAttribute('data-index'));
    const row = this.rows()[index];
    if (target.closest('[data-slot="select-list-check"]')) {
      this.toggle(row);
      return;
    }
    if (this.checkable()) {
      if (event.shiftKey) {
        // The range runs from the anchor, which a range does not move, so that the next Shift-click
        // redraws it from the same row. The browser extends a text selection on Shift-click too,
        // which would paint the rows' text, so it is cleared.
        window.getSelection()?.removeAllRanges();
        this.checkAll(this.rangeTo(index));
        this.selected.set(row.item);
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        this.toggle(row);
        this.selected.set(row.item);
        return;
      }
      // A second, separate click on the row the keyboard is on checks it, as Space does. A row that
      // cannot be checked has nothing to toggle, so the click keeps its meaning of opening it.
      // The second click of a double click (`detail` 2 or more) never toggles. In double-click mode
      // the first click of a double click on the already selected checkable row still toggles it
      // once, as a click cannot know a second one follows; the `dblclick` then only activates.
      if (event.detail < 2 && index === this.selectedIndex() && this.canToggle(row)) {
        this.toggle(row);
        return;
      }
      this.anchor = row.key;
    }
    this.selected.set(row.item);
    if (this.activateOn() === 'click') this.activated.emit(row.item);
  }

  /**
   * A double click on a row tells `activated` in `double-click` mode. A click on a box or a control
   * is theirs, and a Ctrl, Cmd or Shift double click is the checking gestures' (see `onClick`),
   * which activate nothing.
   */
  protected onDoubleClick(event: MouseEvent): void {
    if (this.activateOn() !== 'double-click') return;
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    const row = this.rowOf(event.target as Element);
    if (row) this.activated.emit(row.item);
  }

  /** The second press of a double click would select the row's text; the row is not text. */
  protected onMousedown(event: MouseEvent): void {
    if (event.detail >= 2 && this.rowOf(event.target as Element)) event.preventDefault();
  }

  /** The row a pointer event on `target` is for, or null for a box, a control or no row. */
  private rowOf(target: Element): Row<T, K> | null {
    const option = target.closest('[role="option"]');
    if (!option || target.closest('[data-slot="select-list-check"]')) return null;
    const control = target.closest(INTERACTIVE);
    if (control && control !== option && option.contains(control)) return null;
    return this.rows()[Number(option.getAttribute('data-index'))] ?? null;
  }

  private canToggle(row: Row<T, K>): boolean {
    return row.checkable && !this.blocked().has(row.key);
  }

  /** Checks or unchecks a row that has a box; does nothing for one that has none or is blocked. */
  private toggle(row: Row<T, K>): void {
    this.anchor = row.key;
    if (!this.canToggle(row)) return;
    this.checked.update((keys) =>
      keys.includes(row.key) ? keys.filter((key) => key !== row.key) : [...keys, row.key],
    );
  }

  /**
   * Checks the rows among these that have a box and are not blocked, and leaves the rest as they
   * are: no gesture over many rows unchecks one, or checks what a single click could not. The
   * blocks are those of now, asked once: a cap that the checks this makes would reach is not seen
   * until the app's `checkBlocked` changes, so a cap is also the app's to enforce on `checked`.
   */
  private checkAll(rows: readonly Row<T, K>[]): void {
    const blocked = this.blocked();
    this.checked.update((keys) => {
      const held = new Set(keys);
      const fresh = rows.filter(
        (row) => row.checkable && !blocked.has(row.key) && !held.has(row.key),
      );
      return fresh.length ? [...keys, ...fresh.map((row) => row.key)] : keys;
    });
  }

  /**
   * The rows from the anchor to the row at `index`, both included, in the order shown. The anchor
   * is the row last clicked or checked, else the selected row, else the clicked row alone.
   */
  private rangeTo(index: number): readonly Row<T, K>[] {
    const rows = this.rows();
    let from = rows.findIndex((row) => row.key === this.anchor);
    if (from < 0) from = this.selectedIndex();
    if (from < 0) from = index;
    return rows.slice(Math.min(from, index), Math.max(from, index) + 1);
  }
}
