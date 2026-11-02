import {
  afterRenderEffect,
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  isDevMode,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { containsTree, type IsActiveMatchOptions, Router, RouterLink } from '@angular/router';
import {
  BrnCollapsible,
  BrnCollapsibleContent,
  BrnCollapsibleTrigger,
} from '@spartan-ng/brain/collapsible';
import { COLLAPSIBLE_CLASSES } from '../collapsible/collapsible-classes';
import { INPUT_CLASSES } from '../form/input-classes';
import { NeatIcon } from '../icon/icon';
import { NeatViewport } from './viewport';

/** One link of the page's side list. */
export interface NeatPageNavLink {
  /** The link's text, which the filter matches. */
  label: string;
  /**
   * Absolute app path, for example `/settings/network`. The link is the open one on this path and
   * every route nested under it, whatever the query and fragment; where two links match, the one
   * with the longer path is.
   */
  path: string;
}

/** A group of the side list's links, under a heading when it has a `label`. */
export interface NeatPageNavGroup {
  /** The group's heading; a group without one shows its links with no heading above them. */
  label?: string;
  items: readonly NeatPageNavLink[];
}

/** A link is open on its own path and every route nested under it, whatever the query. */
const MATCH: IsActiveMatchOptions = {
  paths: 'subset',
  queryParams: 'ignored',
  matrixParams: 'ignored',
  fragment: 'ignored',
};

let nextNavId = 0;

/**
 * The page's side list, the third level of the kit's navigation: pages are rail items, a page's
 * sub-pages its item's `children`, and anything more (more than a few links, groups of them, or a
 * level below a sub-page) is this list, as a direct child of `neat-page`:
 *
 * ```html
 * <neat-page>
 *   <nav neatPageNav aria-label="Components" [groups]="groups" filterLabel="Filter"></nav>
 *   …
 * </neat-page>
 * ```
 *
 * `groups` is data, not content: each group's links under its heading (none for a group without
 * a `label`). The open link is the one whose `path` the URL is under (the query and fragment are
 * never judged, and the longest such path wins); it carries `aria-current="page"` and has the
 * rail's current-page look in the page's tokens, the accent fill and weight, where the other links
 * are muted until hovered. With `filterLabel`, a search field at the top, named and hinted by that
 * text, keeps the links whose label holds what was typed, ignoring case, and a group's heading
 * while any of its links is kept; when none is, it says "Nothing matches".
 *
 * The landmark is the app's: a screen reader hears a navigation landmark of links, so it needs a
 * name, which only the app knows. A nav without an `aria-label` (or `aria-labelledby`) throws in
 * dev mode. The name is read once, when the list is first drawn.
 *
 * On a wide screen the page draws it as its body's start column, as high as the page, with the
 * side panel at the other end. It scrolls on its own whatever the page's `scroll`, so it stays in
 * view while the body scrolls, with the filter fixed at its top; it scrolls itself, never with
 * `scrollIntoView` (which would scroll the page around it too), to show the open link whenever a
 * navigation leaves that link out of view. On a narrow screen (`NeatViewport`) it is a closed
 * section above the body instead, with the look of `NeatCollapsible`: the landmark's name as its
 * label and the open link as its summary. Opened, its list scrolls inside it up to the page's
 * height, and choosing a link closes it with the focus on its button, as a link followed puts the
 * floating rail away.
 */
@Component({
  // An attribute selector keeps the native `nav` as the host, so the landmark and its name are the
  // app's element, as `button[neatRailItem]` keeps the native button.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'nav[neatPageNav]',
  imports: [
    BrnCollapsible,
    BrnCollapsibleContent,
    BrnCollapsibleTrigger,
    NeatIcon,
    NgTemplateOutlet,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-layout]': "viewport.narrow() ? 'collapsible' : 'column'" },
  template: `
    @if (viewport.narrow()) {
      <div class="section" brnCollapsible [(expanded)]="open">
        <button #trigger brnCollapsibleTrigger [class]="collapsible.trigger">
          <neat-icon
            name="next"
            [size]="16"
            [class]="collapsible.chevron"
            [class.rotate-90]="open()"
          />
          <span [class]="collapsible.label">{{ name() }}</span>
          @if (!open() && current(); as link) {
            <span [class]="collapsible.summary">{{ link.label }}</span>
          }
        </button>
        <div #list brnCollapsibleContent class="list" [class]="collapsible.content">
          <ng-container *ngTemplateOutlet="links" />
        </div>
      </div>
    } @else {
      <ng-container *ngTemplateOutlet="links" />
    }
    <ng-template #links>
      @if (filterLabel(); as label) {
        <div class="filter">
          <input
            type="search"
            [class]="field"
            [attr.aria-label]="label"
            [placeholder]="label"
            [value]="filter()"
            (input)="filter.set($any($event.target).value)"
          />
        </div>
      }
      @for (group of shown(); track $index; let i = $index) {
        @if (group.label) {
          <h2 [id]="id + '-' + i">{{ group.label }}</h2>
        }
        <ul [attr.aria-labelledby]="group.label ? id + '-' + i : null">
          @for (link of group.items; track link.path) {
            <li>
              <a
                [routerLink]="link.path"
                [attr.aria-current]="link === current() ? 'page' : null"
                (click)="chosen()"
                >{{ link.label }}</a
              >
            </li>
          }
        </ul>
      } @empty {
        @if (query()) {
          <p>Nothing matches</p>
        }
      }
    </ng-template>
  `,
  styleUrl: './page-nav.css',
})
export class NeatPageNav implements AfterViewInit {
  /** The links, in groups, in the order they are listed. */
  readonly groups = input.required<readonly NeatPageNavGroup[]>();
  /**
   * The name and placeholder of a filter over the links' labels at the top of the list ("Filter
   * components"); no filter without it.
   */
  readonly filterLabel = input<string>();

  protected readonly viewport = inject(NeatViewport);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly id = `neat-page-nav-${++nextNavId}`;
  protected readonly collapsible = COLLAPSIBLE_CLASSES;
  protected readonly field = INPUT_CLASSES.small;
  /** Whether the narrow screen's section is open. */
  protected readonly open = signal(false);
  /** The landmark's name, the narrow screen's section label. */
  protected readonly name = signal('');
  protected readonly filter = signal('');
  protected readonly query = computed(() => this.filter().trim().toLowerCase());

  /** The groups with the links the filter keeps; a group with none left is left out. */
  protected readonly shown = computed((): readonly NeatPageNavGroup[] => {
    const query = this.query();
    if (!query) return this.groups();
    return this.groups().flatMap((group) => {
      const items = group.items.filter((link) => link.label.toLowerCase().includes(query));
      return items.length ? [{ label: group.label, items }] : [];
    });
  });

  /**
   * The open link: of those whose path the URL is under, the longest. The router's last
   * navigation is a signal, so back and forward move it too.
   */
  protected readonly current = computed((): NeatPageNavLink | undefined => {
    const url = this.router.lastSuccessfulNavigation()?.finalUrl;
    if (!url) return undefined;
    let open: NeatPageNavLink | undefined;
    for (const link of this.groups().flatMap((group) => group.items)) {
      if (
        (!open || link.path.length > open.path.length) &&
        containsTree(url, this.router.parseUrl(link.path), MATCH)
      ) {
        open = link;
      }
    }
    return open;
  });

  constructor() {
    // After the render that marked the open link, so `aria-current` finds it: in the column on a
    // wide screen, in the open section's list on a narrow one (closed, it has nothing to show).
    afterRenderEffect(() => {
      const link = this.current();
      const narrow = this.viewport.narrow();
      const box = narrow ? (this.open() ? this.list()?.nativeElement : undefined) : this.host;
      if (link && box) this.reveal(box);
    });
  }

  // After the first check, so a name the app binds (`[attr.aria-label]`) is on the element.
  ngAfterViewInit(): void {
    const label = this.host.getAttribute('aria-label');
    const labelledBy = this.host.getAttribute('aria-labelledby');
    if (isDevMode() && !label && !labelledBy) {
      throw new Error('nav[neatPageNav] needs an aria-label (or aria-labelledby) naming the list.');
    }
    this.name.set(
      label ??
        (labelledBy ?? '')
          .split(/\s+/)
          .map((id) => this.document.getElementById(id)?.textContent?.trim() ?? '')
          .join(' ')
          .trim(),
    );
  }

  /**
   * A link was chosen. On a narrow screen the open section covers the body, so it closes, and the
   * focus, which was on a link it hides, goes to its button rather than to nothing.
   */
  protected chosen(): void {
    if (!this.viewport.narrow() || !this.open()) return;
    this.open.set(false);
    this.trigger()?.nativeElement.focus();
  }

  /**
   * Scrolls `box` so the open link shows, centred, when it does not already. The box is the links'
   * offset parent (`position: relative` in the stylesheet).
   */
  private reveal(box: HTMLElement): void {
    const link = box.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!link) return;
    const top = link.offsetTop;
    const bottom = top + link.offsetHeight;
    if (top >= box.scrollTop && bottom <= box.scrollTop + box.clientHeight) return;
    box.scrollTop = top - (box.clientHeight - link.offsetHeight) / 2;
  }
}
