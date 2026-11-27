import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  effect,
  input,
  linkedSignal,
  model,
  untracked,
  viewChild,
} from '@angular/core';
import { NeatBreadcrumbs, NeatIcon, NeatSearch } from '@sima/neat-ui';
import { NeatBadge } from '@sima/neat-ui/badge';
import { NeatColumn, NeatSelectList } from '@sima/neat-ui/select-list';
import {
  allFilePaths,
  breadcrumbs,
  childTowards,
  listFolder,
  type NeatFileNode,
  nearestExistingFolder,
  parentPath,
  playableCount,
  ROOT,
  searchFolder,
} from './file-tree';

/** `pick` chooses one file; `manage` also has a checkbox on each file, for acting on several. */
export type NeatFileBrowserMode = 'pick' | 'manage';

/** The words the browser says itself; `labels` replaces any of them. */
export interface NeatFileBrowserLabels {
  /** The breadcrumb's accessible name. */
  readonly breadcrumb: string;
  /** The list's accessible name. */
  readonly files: string;
  /** The heading of the name column; shown only when the app adds columns. */
  readonly name: string;
  /** The filter field's accessible name. */
  readonly filter: string;
  /** What a folder with nothing in it says. */
  readonly empty: string;
  /** What a filter with no match says. */
  readonly noMatches: string;
  /** The chevron button's accessible name on a folder row, from the folder's name. */
  readonly open: (folder: string) => string;
  /** Read before a folder's name, which an icon alone tells apart from a file. */
  readonly folder: string;
  /** What a folder's count means, read after the folder's name and shown as its tooltip. */
  readonly folderCount: (folder: string, count: number) => string;
  /** The count while a filter is active: its matches, below the named folder. */
  readonly matches: (folder: string, count: number) => string;
}

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

const DEFAULT_LABELS: NeatFileBrowserLabels = {
  breadcrumb: 'Current folder',
  files: 'Files',
  name: 'Name',
  filter: 'Filter files in the current folder and its subfolders',
  empty: 'This folder is empty.',
  noMatches: 'No files match the filter.',
  open: (folder) => `Open ${folder}`,
  folder: 'Folder',
  folderCount: (folder, count) =>
    `${plural(count, 'file', 'files')} in ${folder} and its subfolders`,
  matches: (folder, count) => `${plural(count, 'match', 'matches')} in ${folder}`,
};

const defaultCountLabel = (_folder: string, count: number): string =>
  plural(count, 'file', 'files');

/** A row of the list: a folder, or a file with its path as listed (relative while filtering). */
interface BrowserRow {
  readonly node: NeatFileNode;
  readonly label: string;
  /** A folder's available files, in it and below; null for a file. */
  readonly count: number | null;
  /** What a folder's count means, in words. */
  readonly countLabel: string;
  /** What the app's column templates get for a file. */
  readonly context: { readonly $implicit: NeatFileNode };
}

/**
 * Types the `let-row` of the browser's own column templates as a `BrowserRow`, so that a mistyped
 * property fails the template check. It adds nothing at run time.
 */
@Directive({ selector: 'ng-template[neatFileRow]' })
class FileRowContext {
  // The parameter is the guard's subject: Angular reads the type predicate, nothing calls it.
  static ngTemplateContextGuard(
    _directive: FileRowContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: unknown,
  ): context is { $implicit: BrowserRow } {
    return true;
  }
}

const rowPath = (row: BrowserRow): string => row.node.path;
const isFile = (row: BrowserRow): boolean => row.node.type === 'file';

/**
 * A browser for a tree of folders and files:
 *
 * ```html
 * <neat-file-browser rootLabel="Media Root" [root]="tree()" [(folder)]="folder"
 *   [(selected)]="file" mode="manage" [(checked)]="checkedFiles" filterPlaceholder="Filter files…">
 *   <ng-template neatColumn="size" header="Size" width="6rem" let-file>…</ng-template>
 * </neat-file-browser>
 * ```
 *
 * It shows the breadcrumb of the current `folder`, a count, a filter field and the folder's rows.
 * `folder` is a path, and '' is the root, named `rootLabel`. The rows are a `neat-select-list`:
 * folders first, then files, each by name ignoring case. A folder row shows the number of
 * available files in it and below.
 *
 * **Filter.** Typing lists every file below the current folder whose path, relative to it, contains
 * the text, ignoring case. The rows show those relative paths, and the count says how many matched.
 * Navigating, by any means, empties the filter. `filter` is a model, so the app can read it and set
 * it. A note under the list about what the folder leaves out, say, should show only while the
 * filter is empty.
 *
 * **Navigating.**
 * - A double click on a folder row, a click on the chevron that ends it, or Enter on the row the
 *   keyboard is on, opens the folder. A single click only highlights it. A double click on a file
 *   opens nothing.
 * - A click on a breadcrumb, or Backspace in the list, goes up.
 * - When the folder is gone from `root`, after a reload say, `folder` becomes its nearest ancestor
 *   that exists.
 * - The list takes the focus after any navigation, and going up highlights the folder just left.
 *   Every listing starts at the top.
 *
 * Pass `root` once it is loaded: an empty tree has no folders, so the browser goes back to the
 * root.
 *
 * **Selecting.** `selected` is a file's path. A click on a file, or moving the list's selection
 * onto it with the arrow keys, selects it. A click on a folder, or an arrow key onto it, highlights
 * the folder and leaves `selected` as it is. So the preview of a file stays while the keyboard or
 * the pointer passes folders. A selected file in another folder stays selected. The list's keys are
 * `neat-select-list`'s.
 *
 * **`manage` mode** is the list's checked mode. Each file has a box, folders have none, and the
 * checked boxes are the paths in `checked`, which hold files of other folders too.
 * - A click on the box toggles it, and nothing else.
 * - From the keyboard, Space toggles the file the list is on. The boxes are not tab stops, so the
 *   arrow keys keep moving the selection.
 * - Ctrl-click or Cmd-click, Shift-click and Ctrl+A or Cmd+A check as they do in the list, without
 *   opening a folder.
 * - A click on the selected file again checks or unchecks it, as Space does. The first click on a
 *   file only selects it.
 * - A double click on a file not yet selected checks nothing, and a double click opens no file. On
 *   the already selected file, a double click checks it once, with its first click.
 *
 * The listbox is multi-selectable, and a file is `aria-selected` while checked, which says what
 * checking is. The browser adds no hint of its own. Paths that are no longer in `root` leave
 * `checked`. `selected` is not pruned, since an app may select a file before the tree that holds it
 * has loaded.
 *
 * **Unavailable and tagged nodes.** An `unavailable` node is grayed, and a `tag` shows after the
 * name as a neutral `neat-badge`. Such nodes can still be selected, opened and checked.
 *
 * **Columns.** `neatColumn` templates, from `@sima/neat-ui/select-list`, add columns after the
 * name, filled for files only. The template gets the `NeatFileNode`, and `align` and `hideBelow`
 * work as on the list. Setting any adds a header row, with `labels.name` as the name's heading. It
 * also moves a folder's count from the end of the name cell to just after the name. So the count
 * reads as the folder's, rather than as a value in the next column.
 *
 * **Words.** Everything the browser says is a default in `labels`, a partial merged over them. Only
 * `rootLabel`, which is required, and `filterPlaceholder` are not. `countLabel` words the count
 * under the breadcrumb, from the name of the current folder (`rootLabel` at the root) and the
 * number of available files in it and below.
 *
 * It fills its container, whose height it needs, and scrolls its rows inside. A folder of a
 * thousand files is one pass over the folder's nodes when the folder, filter or tree changes. A
 * selection or a check changes only the rows concerned.
 */
@Component({
  selector: 'neat-file-browser',
  imports: [
    FileRowContext,
    NeatIcon,
    NeatBreadcrumbs,
    NeatSearch,
    NeatSelectList,
    NeatColumn,
    NeatBadge,
    NgTemplateOutlet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full min-h-0 flex-col gap-(--neat-space-2)' },
  template: `
    <neat-breadcrumbs
      [label]="text().breadcrumb"
      [crumbs]="crumbItems()"
      (go)="navigate(crumbs()[$event].path)"
    />
    <p data-slot="file-browser-count" aria-live="polite" class="m-0 text-sm text-muted-foreground">
      {{ countText() }}
    </p>
    <neat-search
      size="small"
      [label]="text().filter"
      [placeholder]="filterPlaceholder()"
      [(value)]="filter"
    />
    <neat-select-list
      class="min-h-0 flex-1"
      [label]="text().files"
      [items]="rows()"
      [trackBy]="rowPath"
      [selected]="highlighted()"
      [emptyLabel]="query() ? text().noMatches : text().empty"
      [checkable]="mode() === 'manage'"
      [canCheck]="isFile"
      activateOn="double-click"
      [(checked)]="checked"
      (selectedChange)="moveCursor($event)"
      (activated)="open($event)"
      (keydown)="onKeydown($event)"
    >
      <ng-template
        neatColumn="name"
        neatFileRow
        [header]="columns().length ? text().name : ''"
        let-row
      >
        <span
          data-slot="file-name"
          class="flex min-w-0 items-center gap-(--neat-space-2)"
          [class.text-muted-foreground]="row.node.unavailable"
        >
          @if (row.node.type === 'folder') {
            <neat-icon name="folder" [size]="16" class="shrink-0" />
            <span class="sr-only">{{ text().folder }}</span>
          } @else {
            <neat-icon name="file" [size]="16" class="shrink-0" />
          }
          <span class="truncate">{{ row.label }}</span>
          @if (row.node.tag) {
            <neat-badge>{{ row.node.tag }}</neat-badge>
          }
          @if (row.count !== null) {
            <span
              aria-hidden="true"
              class="shrink-0 text-muted-foreground tabular-nums"
              [class.ms-auto]="!columns().length"
              [attr.title]="row.countLabel"
              >{{ row.count }}</span
            >
            <span class="sr-only">{{ row.countLabel }}</span>
          }
          @if (row.node.type === 'folder') {
            <!-- A pointer's way to open a folder, so no tab stop: the keyboard has Enter. The list
                 leaves a click on a control in a row to the control. NeatButton cannot be used:
                 its host binding drops a tabindex. -->
            <button
              type="button"
              tabindex="-1"
              class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
              [attr.aria-label]="text().open(row.label)"
              (click)="openFolder($event, row.node.path)"
            >
              <neat-icon name="next" [size]="16" />
            </button>
          }
        </span>
      </ng-template>
      @for (column of columns(); track column) {
        <ng-template
          [neatColumn]="column.key()"
          [header]="column.header()"
          [width]="column.width()"
          [align]="column.align()"
          [hideBelow]="column.hideBelow()"
          neatFileRow
          let-row
        >
          @if (row.node.type === 'file') {
            <ng-container
              [ngTemplateOutlet]="column.template"
              [ngTemplateOutletContext]="row.context"
            />
          }
        </ng-template>
      }
    </neat-select-list>
  `,
})
export class NeatFileBrowser {
  /** The tree. Pass it once loaded. */
  readonly root = input.required<readonly NeatFileNode[]>();
  /** The name of the root folder, at the start of the breadcrumb. */
  readonly rootLabel = input.required<string>();
  /** The current folder's path; '' is the root. */
  readonly folder = model('');
  /** The selected file's path. */
  readonly selected = model<string | null>(null);
  /**
   * `pick` chooses one file (`selected`); `manage` adds a checkbox on each file, for the paths in
   * `checked`.
   */
  readonly mode = input<NeatFileBrowserMode>('pick');
  /** The checked files' paths, in `manage` mode. */
  readonly checked = model<readonly string[]>([]);
  /** The hint inside the empty filter field; none by default. Its name is `labels.filter`. */
  readonly filterPlaceholder = input('');
  /** Words the count under the breadcrumb: the current folder's name, and its available files. */
  readonly countLabel = input<(folder: string, count: number) => string>(defaultCountLabel);
  /**
   * The words the browser says itself, as far as you replace them, such as to translate them.
   *
   * They are the names for assistive technology, the empty and no-match messages, and the count
   * texts. Any you leave out keep the English default.
   */
  readonly labels = input<Partial<NeatFileBrowserLabels>>({});
  /**
   * The filter field's text, two-way, so an app can tell whether a filter is active, or clear it.
   *
   * A note about the current folder, such as how many files it left out, belongs to the unfiltered
   * listing. The filter is emptied whenever the folder changes. Matching ignores surrounding
   * spaces.
   */
  readonly filter = model('');

  protected readonly rowPath = rowPath;
  protected readonly isFile = isFile;
  protected readonly text = computed<NeatFileBrowserLabels>(() => ({
    ...DEFAULT_LABELS,
    ...this.labels(),
  }));

  /** The folder shown: `folder`, or its nearest ancestor that exists. */
  private readonly current = computed(() => nearestExistingFolder(this.root(), this.folder()));
  protected readonly crumbs = computed(() => breadcrumbs(this.current(), this.rootLabel()));
  protected readonly crumbItems = computed(() =>
    this.crumbs().map(({ name }) => ({ label: name })),
  );
  private readonly folderName = computed(() => this.crumbs().at(-1)?.name ?? this.rootLabel());

  protected readonly query = computed(() => this.filter().trim());

  protected readonly columns = contentChildren(NeatColumn);
  private readonly list = viewChild.required(NeatSelectList);

  private readonly matches = computed(() =>
    this.query() ? searchFolder(this.root(), this.current(), this.query()) : [],
  );

  /**
   * The list's rows, worked out when the folder, filter or tree changes: the sort, the folders'
   * counts, the label texts. Nothing in the template computes per row.
   */
  protected readonly rows = computed<readonly BrowserRow[]>(() => {
    const text = this.text();
    const fileRow = (node: NeatFileNode, label: string): BrowserRow => ({
      node,
      label,
      count: null,
      countLabel: '',
      context: { $implicit: node },
    });
    if (this.query()) return this.matches().map(({ node, relative }) => fileRow(node, relative));
    const { folders, files } = listFolder(this.root(), this.current());
    return [
      ...folders.map(({ node, name, count }): BrowserRow => ({
        node,
        label: name,
        count,
        countLabel: text.folderCount(name, count),
        context: { $implicit: node },
      })),
      ...files.map((node) => fileRow(node, node.name)),
    ];
  });

  protected readonly countText = computed(() =>
    this.query()
      ? this.text().matches(this.folderName(), this.matches().length)
      : this.countLabel()(this.folderName(), playableCount(this.root(), this.current())),
  );

  /**
   * The folder the list's selection is on, if it is on one. Folders are not `selected` (that is a
   * file's path), so the list's highlight moves to the folder and `selected` stays. It is
   * forgotten when the folder or filter changes and when `selected` does.
   */
  private readonly cursorFolder = linkedSignal<
    { folder: string; query: string; selected: string | null },
    string | null
  >({
    source: () => ({
      folder: this.current(),
      query: this.query(),
      selected: this.selected(),
    }),
    computation: () => null,
  });

  /** The row the list highlights: the folder under the keyboard, else the selected file. */
  protected readonly highlighted = computed(() => {
    const path = this.cursorFolder() ?? this.selected();
    return this.rows().find((row) => row.node.path === path) ?? null;
  });

  constructor() {
    // The filter belongs to the folder it was typed in; the first run keeps what the app gave.
    let shown: string | undefined;
    effect(() => {
      const current = this.current();
      if (shown !== undefined && current !== shown) this.filter.set('');
      shown = current;
    });
    // Another folder, or another filter, is another set of rows: they start at the top (or at the
    // selected row, when it is among them), not at the previous listing's offset. `resetScroll`
    // reads the list's signals, which this effect must not depend on.
    afterRenderEffect(() => {
      this.current();
      this.query();
      untracked(() => this.list().resetScroll());
    });
    effect(() => {
      const current = this.current();
      if (untracked(this.folder) !== current) this.folder.set(current);
    });
    effect(() => {
      const present = new Set(allFilePaths(this.root()));
      const checked = untracked(this.checked);
      const kept = checked.filter((path) => present.has(path));
      if (kept.length !== checked.length) this.checked.set(kept);
    });
  }

  /**
   * A chevron's click. The second click of a double click lands on the listing the first one
   * opened, where a folder's chevron may sit at the same spot, so only a first click opens.
   */
  protected openFolder(event: MouseEvent, path: string): void {
    if (event.detail > 1) return;
    this.navigate(path);
  }

  /**
   * Opens a folder. The list takes the focus: a pressed breadcrumb is gone from the page once its
   * folder is the current one (the last crumb is text), and the focus must not fall to the body.
   * Going up lands the highlight on the folder just left, as file managers do.
   */
  protected navigate(path: string): void {
    const from = this.current();
    this.folder.set(path);
    this.cursorFolder.set(childTowards(from, path));
    this.list().focus();
  }

  /** The list's selection moved, by key or click: a file is selected, a folder is highlighted. */
  protected moveCursor(row: BrowserRow | null): void {
    if (row === null) return;
    if (row.node.type === 'folder') {
      this.cursorFolder.set(row.node.path);
    } else {
      this.cursorFolder.set(null);
      this.selected.set(row.node.path);
    }
  }

  /** Enter, or a double click, on a row: a folder opens. */
  protected open(row: BrowserRow): void {
    if (row.node.type === 'folder') this.navigate(row.node.path);
  }

  /**
   * The key that is the browser's rather than the list's, pressed on the list itself (not on the
   * filter field or a control in a cell): Backspace goes up a folder.
   */
  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as Element;
    if (target.getAttribute('role') !== 'listbox') return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (this.current() !== ROOT) this.navigate(parentPath(this.current()));
    }
  }
}
