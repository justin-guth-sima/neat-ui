import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { LocationStrategy } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  type TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  NeatIcon,
  type NeatIconGlyph,
  type NeatIconName,
  NeatSearch,
  NeatViewport,
  ɵhlm as hlm,
  ɵPANEL_SURFACE_CLASSES as PANEL_SURFACE_CLASSES,
} from '@sima/neat-ui';

/** One result: what it is called, where it is, and the address it opens. */
export interface NeatSearchItem {
  /** Stable across searches, so the list keeps its rows. */
  readonly id: string;
  readonly label: string;
  /** Where it is, shown muted at the row's end ("Components › Forms"). */
  readonly detail?: string;
  /** A name of the kit's icons, or a Lucide glyph, before the label. */
  readonly icon?: NeatIconName | NeatIconGlyph;
  /** The app's address it opens, with any query and fragment (`/components/forms/search#api-NeatSearch`). */
  readonly path: string;
}

/** Results of one kind, under a heading ("Topics", "API"). */
export interface NeatSearchGroup {
  readonly label: string;
  readonly items: readonly NeatSearchItem[];
}

/** What the palette says beside the results; each has a default. */
export interface NeatSearchPaletteLabels {
  /** Before anything is typed. */
  readonly empty: string;
  /** The status when nothing matches. */
  readonly noMatches: string;
  /** The status counting what matched, given the count. */
  readonly matches: (count: number) => string;
  /** The link to the app's page of every result. */
  readonly allResults: string;
  /** The keys, at the palette's foot. */
  readonly keys: string;
}

const LABELS: NeatSearchPaletteLabels = {
  empty: 'Type to search.',
  noMatches: 'Nothing matches',
  matches: (count) => (count === 1 ? '1 result' : `${count} results`),
  allResults: 'See all results',
  keys: '↑↓ to move · Enter to open · Esc to close',
};

/**
 * Helm's dialog backdrop (`lib/ui/dialog/src/lib/hlm-dialog-overlay.ts`), copied because helm keeps
 * it inline, as `NeatDialog` and `NeatConfirm` do; search-palette.spec checks that it is still
 * there, so a helm update that changes it fails until this is reviewed.
 */
export const BACKDROP_HELM_CLASSES =
  'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 isolate bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs';

/**
 * The palette: the overlay's panel surface, as the popover's and the rail menu's, without their
 * padding and width; the dialog's own config sets the width and the panel the height.
 */
const PANEL_CLASSES = hlm(PANEL_SURFACE_CLASSES, 'w-full gap-0 p-0 rounded-xl');

/** How many results of each group the palette shows; the app's page shows them all. */
const DEFAULT_LIMIT = 5;

let nextPaletteId = 0;

/**
 * A search over the whole app: a trigger that looks like a search field, for the top bar, and the
 * palette it opens, a dialog with a field over the results in groups.
 *
 * ```html
 * <neat-search-palette neatTopbarEnd label="Search docs" [search]="search" allResults="/search" />
 * ```
 *
 * `search` is the app's: a function from what was typed to groups of results
 * (`NeatSearchGroup`), each item a label, where it is, an icon and the address it opens. The
 * palette shows the first `limit` of each group. The arrow keys move through them, Enter or a click
 * opens one and closes the palette, and with `allResults` (the address of the app's page of every
 * result, which gets the search as `q`) a link at its foot, and Enter while nothing is picked, go
 * there. Each result is a link, so a middle click or Ctrl-click opens it in a new tab.
 *
 * Ctrl K (⌘K on a Mac) opens it from anywhere on the page, unless `shortcut` is off; the trigger
 * shows the keys. On a narrow screen the trigger is an icon-only button. Escape clears the field,
 * then closes the palette; a click beside it closes it too. Closing puts the focus back where it
 * was.
 *
 * `open` is the palette's state, which the app may also set. `picked` tells which result was
 * opened. The field is a `neat-search` acting as a combobox over the results' listbox, and the
 * count of matches is its status, announced politely.
 */
@Component({
  selector: 'neat-search-palette',
  imports: [NeatIcon, NeatSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-narrow]': 'viewport.narrow() || null',
    '(document:keydown)': 'onShortcut($event)',
  },
  template: `
    <button
      #trigger
      type="button"
      class="trigger"
      aria-haspopup="dialog"
      [attr.aria-label]="viewport.narrow() ? label() : null"
      [attr.aria-keyshortcuts]="shortcut() ? 'Control+K Meta+K' : null"
      (click)="open.set(true)"
    >
      <neat-icon name="search" [size]="16" />
      @if (!viewport.narrow()) {
        <span class="label">{{ label() }}</span>
        @if (shortcut()) {
          <span class="keys" aria-hidden="true"
            ><kbd>{{ modifier }}</kbd
            ><kbd>K</kbd></span
          >
        }
      }
    </button>
    <ng-template #panel>
      <div [class]="panelClasses" class="panel">
        <div class="head">
          <neat-search
            variant="underlined"
            size="large"
            [label]="label()"
            [placeholder]="label()"
            [listbox]="listboxId"
            [activeOption]="activeId()"
            [status]="status()"
            [(value)]="query"
          />
        </div>
        <div #results class="results">
          @if (!query().trim()) {
            <p class="note">{{ text().empty }}</p>
          }
          <div role="listbox" [id]="listboxId" [attr.aria-label]="label()">
            @for (group of shown(); track group.label) {
              <div role="group" class="group" [attr.aria-labelledby]="listboxId + '-g' + $index">
                <div class="group-label" [id]="listboxId + '-g' + $index">{{ group.label }}</div>
                @for (row of group.rows; track row.item.id) {
                  <a
                    role="option"
                    class="option"
                    tabindex="-1"
                    [id]="optionId(row.index)"
                    [href]="href(row.item.path)"
                    [attr.aria-selected]="row.index === active()"
                    (pointermove)="active.set(row.index)"
                    (click)="onClick($event, row.item)"
                  >
                    @if (row.item.icon; as icon) {
                      <neat-icon [name]="icon" [size]="16" />
                    }
                    <span class="option-label">{{ row.item.label }}</span>
                    @if (row.item.detail) {
                      <span class="option-detail">{{ row.item.detail }}</span>
                    }
                  </a>
                }
              </div>
            }
          </div>
        </div>
        <div class="foot">
          <span aria-hidden="true">{{ text().keys }}</span>
          @if (allResultsUrl(); as url) {
            <a [href]="href(url)" (click)="onAllResults($event, url)">{{ text().allResults }}</a>
          }
        </div>
      </div>
    </ng-template>
  `,
  styleUrl: './search-palette.css',
})
export class NeatSearchPalette {
  /** The search's name: the trigger's text, and the field's name and hint ("Search docs"). */
  readonly label = input.required<string>();
  /** The app's search: what was typed, to groups of results. Called as the user types. */
  readonly search = input.required<(query: string) => readonly NeatSearchGroup[]>();
  /**
   * The address of the app's page of every result, which gets the search as its `q` query
   * parameter (`/search`); no such link without it.
   */
  readonly allResults = input<string>();
  /** How many results of each group the palette shows. */
  readonly limit = input(DEFAULT_LIMIT);
  /** Whether Ctrl K (⌘K on a Mac) opens the palette from anywhere on the page. */
  readonly shortcut = input(true, { transform: booleanAttribute });
  /** What the palette says beside the results, where an app words it differently. */
  readonly labels = input<Partial<NeatSearchPaletteLabels>>({});
  /** Whether the palette is open; the trigger and the shortcut open it, the app may too. */
  readonly open = model(false);
  /** The result that was opened, by a click, a tap or Enter. */
  readonly picked = output<NeatSearchItem>();

  protected readonly viewport = inject(NeatViewport);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly router = inject(Router);
  private readonly location = inject(LocationStrategy);
  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');
  private readonly results = viewChild<ElementRef<HTMLElement>>('results');
  private ref: DialogRef<unknown, unknown> | undefined;

  protected readonly listboxId = `neat-search-palette-${++nextPaletteId}`;
  protected readonly panelClasses = PANEL_CLASSES;
  protected readonly modifier = isMac() ? '⌘' : 'Ctrl';
  protected readonly text = computed(() => ({ ...LABELS, ...this.labels() }));

  protected readonly query = signal('');
  /** The groups to show, each cut to `limit`, each row numbered in the order the keys move. */
  protected readonly shown = computed(() => {
    const query = this.query().trim();
    if (!query) return [];
    let index = 0;
    return this.search()(query)
      .filter((group) => group.items.length)
      .map((group) => ({
        label: group.label,
        rows: group.items.slice(0, this.limit()).map((item) => ({ item, index: index++ })),
      }));
  });
  private readonly rows = computed(() => this.shown().flatMap((group) => group.rows));
  /** The row the keys are on: the first, again, whenever the results change. */
  protected readonly active = linkedSignal({ source: this.rows, computation: () => 0 });
  protected readonly activeId = computed(() =>
    this.rows().length ? this.optionId(this.active()) : null,
  );
  protected readonly status = computed(() => {
    if (!this.query().trim()) return '';
    const count = this.rows().length;
    return count ? this.text().matches(count) : this.text().noMatches;
  });
  protected readonly allResultsUrl = computed(() => {
    const path = this.allResults();
    const query = this.query().trim();
    if (!path || !query) return null;
    return this.router.serializeUrl(
      this.router.createUrlTree([path], { queryParams: { q: query } }),
    );
  });

  constructor() {
    effect(() => {
      const open = this.open();
      untracked(() => (open ? this.show() : this.hide()));
    });
    // The row the keys move to is scrolled into view within the results, never the page.
    effect(() => {
      const id = this.activeId();
      const box = this.results()?.nativeElement;
      const row = id ? box?.querySelector<HTMLElement>(`#${CSS.escape(id)}`) : null;
      if (!box || !row) return;
      if (row.offsetTop < box.scrollTop) box.scrollTop = row.offsetTop;
      else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) {
        box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight;
      }
    });
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  protected optionId(index: number): string {
    return `${this.listboxId}-${index}`;
  }

  /** An app address as the link's `href`, with the app's base. */
  protected href(path: string): string {
    return this.location.prepareExternalUrl(path);
  }

  /** Ctrl K or ⌘K, from anywhere on the page. */
  protected onShortcut(event: KeyboardEvent): void {
    if (!this.shortcut() || event.altKey || event.shiftKey) return;
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
    event.preventDefault();
    this.open.set(true);
  }

  /** The arrow keys and Enter, from anywhere in the palette (the field has the focus). */
  private onKeydown(event: KeyboardEvent): void {
    const count = this.rows().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!count) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.active.set((this.active() + step + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = this.rows()[this.active()];
      const all = this.allResultsUrl();
      if (row) this.go(row.item);
      else if (all) this.goTo(all);
    }
  }

  /** A plain click opens the result here; a click that asks for a new tab is the browser's. */
  protected onClick(event: MouseEvent, item: NeatSearchItem): void {
    if (opensElsewhere(event)) return;
    event.preventDefault();
    this.go(item);
  }

  protected onAllResults(event: MouseEvent, url: string): void {
    if (opensElsewhere(event)) return;
    event.preventDefault();
    this.goTo(url);
  }

  private go(item: NeatSearchItem): void {
    this.picked.emit(item);
    this.goTo(item.path);
  }

  private goTo(url: string): void {
    this.open.set(false);
    void this.router.navigateByUrl(url);
  }

  private show(): void {
    if (this.ref) return;
    this.query.set('');
    const ref = this.dialog.open(this.panel(), {
      ariaLabel: this.label(),
      ariaModal: true,
      hasBackdrop: true,
      backdropClass: BACKDROP_HELM_CLASSES.split(' '),
      positionStrategy: this.overlay.position().global().top('12vh').centerHorizontally(),
      width: 'min(40rem, calc(100vw - 2rem))',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      // Escape and the backdrop are handled below: Escape first clears the field (`neat-search`
      // stops it there), and only then closes.
      disableClose: true,
    });
    this.ref = ref;
    ref.backdropClick.subscribe(() => this.open.set(false));
    ref.keydownEvents.subscribe((event) => {
      if (event.key !== 'Escape') return this.onKeydown(event);
      if (event.defaultPrevented) return;
      event.stopPropagation();
      this.open.set(false);
    });
    ref.closed.subscribe(() => {
      if (this.ref === ref) this.ref = undefined;
      this.open.set(false);
    });
  }

  private hide(): void {
    const ref = this.ref;
    this.ref = undefined;
    ref?.close();
  }
}

/** A click with a modifier or another button, which the browser opens elsewhere (a new tab). */
function opensElsewhere(event: MouseEvent): boolean {
  return event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
}

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
}
