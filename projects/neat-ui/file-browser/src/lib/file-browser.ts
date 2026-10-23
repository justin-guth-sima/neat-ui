import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  effect,
  input,
  linkedSignal,
  model,
  untracked,
  viewChild,
} from '@angular/core';
import { NeatIcon, NeatInlineButton } from '@sima/neat-ui';
import { NeatInput } from '@sima/neat-ui/input';
import { NeatColumn, NeatSelectList } from '@sima/neat-ui/select-list';
import {
  allFilePaths,
  breadcrumbs,
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
  /** Read before a folder's name, which an icon alone tells apart from a file. */
  readonly folder: string;
  /** Read before the name of a checked file. */
  readonly checked: string;
  /** The accessible name of a file's checkbox. */
  readonly selectFile: (path: string) => string;
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
  folder: 'Folder',
  checked: 'Checked',
  selectFile: (path) => `Select ${path}`,
  matches: (folder, count) => `${plural(count, 'match', 'matches')} in ${folder}`,
};

const defaultCountLabel = (_folder: string, count: number): string =>
  plural(count, 'file', 'files');

/** A row of the list: a folder, or a file with its path as listed (relative while filtering). */
interface BrowserRow {
  readonly node: NeatFileNode;
  readonly label: string;
  /** A folder's enabled files, in it and below; null for a file. */
  readonly count: number | null;
  /** The checkbox's accessible name, for a file in `manage` mode. */
  readonly checkLabel: string;
  /** What the app's column templates get for a file. */
  readonly context: { readonly $implicit: NeatFileNode };
}

/**
 * The file checkbox: a native input drawn by the kit, since the browser's own box in dark is a grey
 * square that does not reach 3:1 on a card. The unchecked boundary is `--input`, the theme's
 * form-control boundary (3:1 on every surface, as on `neatInput`); checked fills with `--primary`,
 * and the tick, which is an icon beside the input, is `--primary-foreground` on it.
 */
const CHECKBOX_CLASSES =
  'size-4 cursor-pointer appearance-none rounded-sm border border-input bg-transparent outline-none checked:border-primary checked:bg-primary focus-visible:ring-3 focus-visible:ring-ring';

const rowPath = (row: BrowserRow): string => row.node.path;

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
 * It shows the breadcrumb of the current `folder` (a path; '' is the root, named `rootLabel`), a
 * count, a filter field and the folder's rows in a `neat-select-list`: folders first, then files,
 * each by name ignoring case. A folder row shows the number of enabled files in it and below.
 *
 * - **Filter.** Typing lists every file below the current folder whose path, relative to it,
 *   contains the text, ignoring case; the rows show those relative paths, and the count says how
 *   many matched. Navigating, by any means, empties the filter.
 * - **Navigating.** A click, or Enter on the row the keyboard is on, opens a folder; a click on a
 *   breadcrumb, or Backspace in the list, goes up. When the folder is gone from `root` (after a
 *   reload), `folder` becomes its nearest ancestor that exists. Pass `root` once it is loaded: an
 *   empty tree has no folders, so the browser goes back to the root.
 * - **Selecting.** `selected` is a file's path. Moving the list's selection with the arrow keys
 *   onto a file selects it, as a click does; onto a folder leaves `selected` as it is (the
 *   preview of a file stays while the keyboard passes folders) and highlights the folder. A
 *   selected file in another folder stays selected. The list's keys are `neat-select-list`'s.
 * - **`manage` mode** adds a checkbox to each file, for the paths in `checked`. A click on the box
 *   toggles it and nothing else. From the keyboard, Space toggles the file the list is on; the
 *   boxes are not tab stops, so the arrow keys keep moving the selection. Paths that are no
 *   longer in `root` leave `checked`.
 * - **Disabled and tagged nodes** are greyed (`disabled`) and carry their `tag` after the name;
 *   they can still be selected, opened and checked.
 * - **Columns.** `neatColumn` templates (from `@sima/neat-ui/select-list`) add columns after the
 *   name, filled for files only; the template gets the `NeatFileNode`. Setting any adds a header
 *   row, the name's heading being `labels.name`.
 *
 * Everything the browser says is a default in `labels` (a partial, merged over them) except
 * `rootLabel`, which is required, and `filterPlaceholder`. `countLabel` words the count under the
 * breadcrumb from the name of the current folder (`rootLabel` at the root) and the number of
 * enabled files in it and below.
 *
 * It fills its container, whose height it needs, and scrolls its rows inside. A folder of a
 * thousand files is one pass over the folder's nodes when the folder, filter or tree changes; a
 * selection or a check changes only the rows concerned.
 */
@Component({
  selector: 'neat-file-browser',
  imports: [NeatIcon, NeatInlineButton, NeatInput, NeatSelectList, NeatColumn, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full min-h-0 flex-col gap-(--neat-space-2)' },
  template: `
    <nav [attr.aria-label]="text().breadcrumb">
      <ol class="m-0 flex list-none flex-wrap items-center gap-x-(--neat-space-2) p-0 text-sm">
        @for (crumb of crumbs(); track crumb.path; let first = $first; let last = $last) {
          <li class="flex items-center gap-(--neat-space-2)">
            @if (!first) {
              <span aria-hidden="true" class="text-muted-foreground">›</span>
            }
            @if (last) {
              <span aria-current="location" class="font-medium">{{ crumb.name }}</span>
            } @else {
              <button neatInlineButton type="button" (click)="navigate(crumb.path)">
                {{ crumb.name }}
              </button>
            }
          </li>
        }
      </ol>
    </nav>
    <p data-slot="file-browser-count" aria-live="polite" class="m-0 text-sm text-muted-foreground">
      {{ countText() }}
    </p>
    <input
      neatInput
      size="small"
      type="text"
      autocomplete="off"
      spellcheck="false"
      [attr.aria-label]="text().filter"
      [placeholder]="filterPlaceholder()"
      [value]="filter()"
      (input)="onFilter($event)"
    />
    <neat-select-list
      class="min-h-0 flex-1"
      [label]="text().files"
      [items]="rows()"
      [trackBy]="rowPath"
      [selected]="highlighted()"
      [emptyLabel]="query() ? text().noMatches : text().empty"
      (selectedChange)="moveCursor($event)"
      (activated)="open($event)"
      (keydown)="onKeydown($event)"
    >
      <ng-template neatColumn="name" [header]="columns().length ? text().name : ''" let-row>
        <span
          data-slot="file-name"
          class="flex min-w-0 items-center gap-(--neat-space-2)"
          [class.text-muted-foreground]="row.node.disabled"
        >
          @if (mode() === 'manage') {
            @if (row.node.type === 'file') {
              <span class="relative inline-flex size-4 shrink-0">
                <input
                  type="checkbox"
                  tabindex="-1"
                  [class]="checkboxClasses"
                  [checked]="checkedSet().has(row.node.path)"
                  [attr.aria-label]="row.checkLabel"
                  (change)="toggle(row.node.path)"
                />
                @if (checkedSet().has(row.node.path)) {
                  <neat-icon
                    name="check"
                    [size]="12"
                    class="pointer-events-none absolute inset-0 m-auto text-primary-foreground"
                  />
                }
              </span>
            } @else {
              <span aria-hidden="true" class="size-4 shrink-0"></span>
            }
          }
          @if (row.node.type === 'folder') {
            <neat-icon name="folder" [size]="16" class="shrink-0" />
            <span class="sr-only">{{ text().folder }}</span>
          } @else {
            <neat-icon name="file" [size]="16" class="shrink-0" />
            @if (checkedSet().has(row.node.path)) {
              <span class="sr-only">{{ text().checked }}</span>
            }
          }
          <span class="truncate">{{ row.label }}</span>
          @if (row.node.tag) {
            <span
              data-slot="file-tag"
              class="shrink-0 rounded-sm border border-border px-1 text-xs text-muted-foreground"
              >{{ row.node.tag }}</span
            >
          }
          @if (row.count !== null) {
            <span class="ms-auto shrink-0 text-muted-foreground tabular-nums">{{ row.count }}</span>
          }
        </span>
      </ng-template>
      @for (column of columns(); track column) {
        <ng-template
          [neatColumn]="column.key()"
          [header]="column.header()"
          [width]="column.width()"
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
  readonly mode = input<NeatFileBrowserMode>('pick');
  /** The checked files' paths, in `manage` mode. */
  readonly checked = model<readonly string[]>([]);
  readonly filterPlaceholder = input('');
  /** Words the count under the breadcrumb: the current folder's name, and its enabled files. */
  readonly countLabel = input<(folder: string, count: number) => string>(defaultCountLabel);
  readonly labels = input<Partial<NeatFileBrowserLabels>>({});

  protected readonly rowPath = rowPath;
  protected readonly checkboxClasses = CHECKBOX_CLASSES;
  protected readonly text = computed<NeatFileBrowserLabels>(() => ({
    ...DEFAULT_LABELS,
    ...this.labels(),
  }));

  /** The folder shown: `folder`, or its nearest ancestor that exists. */
  private readonly current = computed(() => nearestExistingFolder(this.root(), this.folder()));
  protected readonly crumbs = computed(() => breadcrumbs(this.current(), this.rootLabel()));
  private readonly folderName = computed(() => this.crumbs().at(-1)?.name ?? this.rootLabel());

  /** The filter text; empty again whenever the folder changes. */
  protected readonly filter = linkedSignal({ source: this.current, computation: () => '' });
  protected readonly query = computed(() => this.filter().trim());

  protected readonly columns = contentChildren(NeatColumn);
  private readonly list = viewChild.required(NeatSelectList);

  private readonly matches = computed(() =>
    this.query() ? searchFolder(this.root(), this.current(), this.query()) : [],
  );

  /**
   * The list's rows, worked out when the folder, filter, tree or mode changes: the sort, the
   * folders' counts, the label texts. Nothing in the template computes per row.
   */
  protected readonly rows = computed<readonly BrowserRow[]>(() => {
    const manage = this.mode() === 'manage';
    const text = this.text();
    const fileRow = (node: NeatFileNode, label: string): BrowserRow => ({
      node,
      label,
      count: null,
      checkLabel: manage ? text.selectFile(node.path) : '',
      context: { $implicit: node },
    });
    if (this.query()) return this.matches().map(({ node, relative }) => fileRow(node, relative));
    const { folders, files } = listFolder(this.root(), this.current());
    return [
      ...folders.map(({ node, name, count }): BrowserRow => ({
        node,
        label: name,
        count,
        checkLabel: '',
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

  protected readonly checkedSet = computed(() => new Set(this.checked()));

  constructor() {
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

  protected onFilter(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  protected navigate(path: string): void {
    this.folder.set(path);
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

  /** Enter, or a click, on a row: a folder opens. */
  protected open(row: BrowserRow): void {
    if (row.node.type === 'folder') this.navigate(row.node.path);
  }

  protected toggle(path: string): void {
    this.checked.update((checked) =>
      checked.includes(path) ? checked.filter((p) => p !== path) : [...checked, path],
    );
    // The box took the focus; the arrow keys belong to the list.
    this.list().focus();
  }

  /**
   * Keys that are the browser's rather than the list's, pressed on the list itself (not on the
   * filter field or a control in a cell): Backspace goes up a folder, and Space, in `manage`
   * mode, checks or unchecks the highlighted file.
   */
  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as Element;
    if (target.getAttribute('role') !== 'listbox') return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (this.current() !== ROOT) this.navigate(parentPath(this.current()));
    } else if (event.key === ' ' && this.mode() === 'manage') {
      event.preventDefault();
      const node = this.highlighted()?.node;
      if (node?.type === 'file') this.toggle(node.path);
    }
  }
}
