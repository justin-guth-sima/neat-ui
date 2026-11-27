import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  NeatAsidePanel,
  NeatAsideTitle,
  NeatAsideHeading,
  NeatAsideToggle,
  NeatCode,
  NeatIcon,
  NeatInlineButton,
  NeatPage,
  NeatSearch,
  neatAsideOpen,
  neatStoredSignal,
} from '@sima/neat-ui';
import { NeatCallout } from '@sima/neat-ui/callout';
import { NeatCodeBlock } from '@sima/neat-ui/code-block';
import { NeatBadgeButton } from '@sima/neat-ui/badge';
import { map } from 'rxjs';
import { type FinderIcon, ICON_INDEX, search, usageOf } from './icon-index';

/** Where the panel's state is kept between visits, as the docs pages keep theirs. */
const ASIDE_OPEN_KEY = 'neat-ui-showcase:icon-finder-aside-open';

/** The sizes the panel draws the picked icon at: the kit's icon sizes, and one larger. */
const PREVIEW_SIZES = [16, 20, 24, 32] as const;

const count = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/**
 * Every icon an app can use, found by name or meaning: the kit's names first, then Lucide's glyphs.
 * Picking one shows it in the side panel with its sizes, how to use it and its tags; the pick is
 * the `icon` query parameter, so a link shows it.
 */
@Component({
  selector: 'app-icon-finder-page',
  imports: [
    NeatAsidePanel,
    NeatAsideHeading,
    NeatAsideTitle,
    NeatAsideToggle,
    NeatCallout,
    NeatCode,
    NeatCodeBlock,
    NeatIcon,
    NeatInlineButton,
    NeatPage,
    NeatSearch,
    NeatBadgeButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-aside-toggle label="Details" [open]="aside.open()" (openChange)="aside.set($event)" />
    <neat-page [aside]="aside.open() ? 'open' : 'closed'">
      <div class="showcase-page finder">
        <p class="showcase-muted intro">
          Every icon an app can use. Take a name of the kit's set where one fits: it says what the
          icon means, and the kit can redraw it in one place. Lucide's glyphs, imported from
          <code neatCode>&#64;sima/neat-ui/lucide</code>, are for the rest.
        </p>
        <neat-search
          label="Search icons"
          placeholder="Name or meaning, such as delete"
          [status]="status()"
          [(value)]="query"
        />
        @if (kitShown().length) {
          <section aria-labelledby="kit-names">
            <h2 id="kit-names">Kit names</h2>
            <div class="tiles">
              @for (icon of kitShown(); track icon.id) {
                <button
                  type="button"
                  class="tile"
                  [attr.aria-pressed]="icon.id === selectedId()"
                  (click)="select(icon)"
                >
                  <neat-icon [name]="icon.name" [size]="24" />
                  <span class="name">{{ icon.name }}</span>
                </button>
              }
            </div>
          </section>
        }
        @if (lucideShown().length) {
          <section aria-labelledby="lucide-glyphs">
            <h2 id="lucide-glyphs">Lucide glyphs</h2>
            <div class="tiles">
              @for (icon of lucideShown(); track icon.id) {
                <button
                  type="button"
                  class="tile"
                  [attr.aria-pressed]="icon.id === selectedId()"
                  (click)="select(icon)"
                >
                  <neat-icon [name]="icon.drawing" [size]="24" />
                  <span class="name">{{ icon.name }}</span>
                </button>
              }
            </div>
          </section>
        }
      </div>
      <div neatPageAside neatAsidePanel>
        @if (selected(); as icon) {
          <h2 neatAsideTitle>{{ icon.name }}</h2>
          <p class="showcase-muted kind">
            {{ icon.kind === 'kit' ? "A name of the kit's set" : 'A Lucide glyph' }}
          </p>
          <div class="previews">
            @for (size of sizes; track size) {
              <figure>
                @if (icon.kind === 'kit') {
                  <neat-icon [name]="icon.name" [size]="size" />
                } @else {
                  <neat-icon [name]="icon.drawing" [size]="size" />
                }
                <figcaption class="showcase-muted">{{ size }} px</figcaption>
              </figure>
            }
          </div>
          @if (icon.kind === 'lucide' && icon.kitNames.length) {
            <neat-callout heading="The kit has a name for it" [headingLevel]="3">
              Take
              @for (name of icon.kitNames; track name; let last = $last) {
                <button neatInlineButton type="button" (click)="selectById('kit:' + name)">
                  {{ name }}</button
                >{{ last ? '' : ' or ' }}
              }
              instead: it says what the icon means.
            </neat-callout>
          }
          <h3 neatAsideHeading>Usage</h3>
          <neat-code-block [code]="usage()" copy="usage" />
          @if (icon.kind === 'kit') {
            <h3 neatAsideHeading>Drawing</h3>
            <p class="detail">
              Lucide's
              <button neatInlineButton type="button" (click)="select(icon.glyph)">
                {{ icon.glyph.name }}
              </button>
            </p>
          }
          @if (tagsOf(icon).length) {
            <h3 neatAsideHeading>Tags</h3>
            <div class="tags">
              @for (tag of tagsOf(icon); track tag) {
                <button neatBadge type="button" (click)="query.set(tag)">{{ tag }}</button>
              }
            </div>
          }
          @if (icon.kind === 'lucide' && icon.aliases.length) {
            <h3 neatAsideHeading>Also exported as</h3>
            <p class="detail">{{ icon.aliases.join(', ') }}</p>
          }
        } @else {
          <h2 neatAsideTitle>Details</h2>
          <p class="showcase-muted">Pick an icon to see its sizes, how to use it and its tags.</p>
        }
      </div>
    </neat-page>
  `,
  styleUrl: './icon-finder.page.css',
})
export class IconFinderPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly openStored = neatStoredSignal(ASIDE_OPEN_KEY, true, (stored) =>
    typeof stored === 'boolean' ? stored : undefined,
  );
  protected readonly aside = neatAsideOpen(this.openStored, (open) => this.openStored.set(open));
  protected readonly sizes = PREVIEW_SIZES;

  protected readonly query = signal('');
  protected readonly kitShown = computed(() => search(ICON_INDEX.kit, this.query()));
  protected readonly lucideShown = computed(() => search(ICON_INDEX.lucide, this.query()));
  protected readonly status = computed(() => {
    const kit = this.kitShown().length;
    const lucide = this.lucideShown().length;
    if (!kit && !lucide) return 'Nothing matches';
    return `${count(kit, 'kit name', 'kit names')}, ${count(lucide, 'Lucide glyph', 'Lucide glyphs')}`;
  });

  protected readonly selectedId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('icon'))),
    { initialValue: null },
  );
  protected readonly selected = computed(() => {
    const id = this.selectedId();
    return (id && ICON_INDEX.byId.get(id)) || null;
  });
  protected readonly usage = computed(() => {
    const icon = this.selected();
    return icon ? usageOf(icon) : '';
  });

  protected tagsOf(icon: FinderIcon): readonly string[] {
    return icon.kind === 'kit' ? icon.glyph.tags : icon.tags;
  }

  protected select(icon: FinderIcon): void {
    this.selectById(icon.id);
  }

  /** Picks the icon by putting it in the address, and opens the panel to show it. */
  protected selectById(id: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { icon: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.aside.set(true);
  }
}
