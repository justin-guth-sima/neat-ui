import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  isDevMode,
  untracked,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  NeatAsidePanel,
  neatAsideOpen,
  NeatAsideToggle,
  NeatButton,
  NeatIcon,
  NeatPage,
  NeatPageNav,
  NeatPageToolbar,
  neatStoredSignal,
} from '@sima/neat-ui';
import { ApiPanel } from './api-panel';
import { isReexportStub } from './display';
import {
  DOCS_TOPIC_OF,
  DocsContext,
  type DocsPageNav,
  type DocsTarget,
  type DocsTopic,
  type DocsTopicPart,
} from './docs-context';
import { ExampleCard } from './example-card';
import { PartIntro } from './part-intro';

/** Whether the API panel is open on a wide screen, for every topic alike. */
export const DOCS_ASIDE_OPEN_KEY = 'neat-ui-showcase:docs-aside-open';
/** The API panel's width in pixels, null for the default; for every topic alike. */
export const DOCS_ASIDE_WIDTH_KEY = 'neat-ui-showcase:docs-aside-width';
/** Wider than the kit's 22rem: member rows with their types and defaults need the room. */
const DEFAULT_ASIDE_WIDTH = 480;

/**
 * The topic's parts in its order, each found in the entry that declares it (a re-export stub
 * never stands for a part). A name no entry declares is a mistake in the topics config, said in
 * dev mode; the docs spec fails it too.
 */
export function topicParts(topic: DocsTopic): DocsTopicPart[] {
  return topic.parts.flatMap((name) => {
    for (const entry of topic.entries) {
      const part = entry.parts.find((candidate) => candidate.name === name);
      if (part && !isReexportStub(part)) return [{ part, import: entry.import }];
    }
    if (isDevMode()) {
      throw new Error(`The docs topic names ${name}, which none of its entries declares.`);
    }
    return [];
  });
}

/** An example whose component can be fit by the toolbar's Fit button. */
function hasFit(instance: unknown): instance is { fit(): void } {
  return typeof (instance as { fit?: unknown } | null)?.fit === 'function';
}

/**
 * One topic of the docs: a category's topics in the page nav (`pageNav`, Components'),
 * a body that introduces the parts its examples show and then the examples, and the topic's API in
 * the page's aside, open by default on a wide screen, resizable, both remembered for every
 * topic. The topic may ask for a Fit button in the top bar (`DocsTopic.fit`), the page's one
 * toolbar. A group's own topics have no page nav: the rail lists them under the group's item.
 *
 * The URL's fragment `#api-<Name>`, as the page opens and each time it changes (a link to another
 * topic, a shared link, back and forward), opens the panel and focuses the part's section's
 * heading; `neat-page` scrolls the panel to it, as it scrolls the body to `#example-<id>`.
 */
@Component({
  selector: 'app-docs-page',
  imports: [
    ApiPanel,
    ExampleCard,
    NeatAsidePanel,
    NeatAsideToggle,
    NeatButton,
    NeatIcon,
    NeatPage,
    NeatPageNav,
    NeatPageToolbar,
    PartIntro,
  ],
  providers: [{ provide: DocsContext, useExisting: DocsPage }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (topic().fit) {
      <div *neatPageToolbar>
        <button neatButton type="button" variant="text" size="small" (click)="fit()">
          <neat-icon name="fit-all" [size]="16" />
          Fit
        </button>
      </div>
    }
    <neat-aside-toggle label="API" [open]="aside.open()" (openChange)="aside.set($event)" />
    <neat-page
      [aside]="aside.open() ? 'open' : 'closed'"
      [asideWidth]="asideWidth() ?? defaultAsideWidth"
      (asideWidthChange)="asideWidth.set($event)"
    >
      @if (pageNav(); as list) {
        <nav
          neatPageNav
          [attr.aria-label]="list.label"
          [groups]="list.groups"
          filterLabel="Filter topics"
        ></nav>
      }
      <div class="showcase-page">
        @for (item of intros(); track item.part.name) {
          <app-part-intro [part]="item.part" [import]="item.import" />
        }
        @if (topic().examples.length) {
          <section class="examples" aria-labelledby="examples">
            <h2 id="examples">Examples</h2>
            @for (example of topic().examples; track example.id) {
              <app-example-card [example]="example" [topic]="topic().id" />
            }
          </section>
        }
      </div>
      <app-api-panel
        neatPageAside
        neatAsidePanel
        [parts]="panelParts()"
        [introduced]="introduced()"
      />
    </neat-page>
  `,
  styleUrl: './docs-page.css',
})
export class DocsPage extends DocsContext {
  readonly topic = input.required<DocsTopic>();
  /** The topics of the page's category, in the page nav; none for a group's own topic. */
  readonly pageNav = input<DocsPageNav | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly topicOf = inject(DOCS_TOPIC_OF);
  private readonly route = inject(ActivatedRoute);
  private readonly cards = viewChildren(ExampleCard);

  private readonly openStored = neatStoredSignal(DOCS_ASIDE_OPEN_KEY, true, (stored) =>
    typeof stored === 'boolean' ? stored : undefined,
  );
  protected readonly aside = neatAsideOpen(this.openStored, (open) => this.openStored.set(open));
  protected readonly asideWidth = neatStoredSignal<number | null>(
    DOCS_ASIDE_WIDTH_KEY,
    null,
    (stored) =>
      stored === null || (typeof stored === 'number' && stored > 0) ? stored : undefined,
  );
  protected readonly defaultAsideWidth = DEFAULT_ASIDE_WIDTH;

  private readonly parts = computed(() => topicParts(this.topic()));
  private readonly names = computed(() => new Set(this.parts().map((item) => item.part.name)));
  /** The topic's lead parts, in the topic's order. */
  protected readonly intros = computed(() => {
    const leads = new Set(this.topic().leads);
    return this.parts().filter((item) => leads.has(item.part.name));
  });
  protected readonly panelParts = computed(() => {
    const intros = this.intros();
    return [...intros, ...this.parts().filter((item) => !intros.includes(item))];
  });
  protected readonly introduced = computed(
    () => new Set(this.intros().map((item) => item.part.name)),
  );

  /**
   * What the URL's fragment names, now and after every change of it. The router announces a
   * fragment only when it changes, which the page's own links see to themselves (`PartRef`). A
   * topic that replaces this page's (one route serving several) changes `names()` and
   * `topic()`, and so goes there again.
   */
  private readonly fragment = toSignal(this.route.fragment, {
    initialValue: this.route.snapshot.fragment,
  });

  constructor() {
    super();
    effect(() => {
      const part = /^api-(.+)$/.exec(this.fragment() ?? '')?.[1];
      if (part && this.names().has(part)) untracked(() => this.reveal(part));
    });
  }

  /** Fits every example that can, as the top bar's Fit button asks. */
  protected fit(): void {
    for (const card of this.cards()) {
      const instance = card.instance();
      if (hasFit(instance)) instance.fit();
    }
  }

  target(name: string): DocsTarget | null {
    const fragment = `api-${name}`;
    if (this.names().has(name)) return { commands: [], fragment, here: true };
    const path = this.topicOf(name);
    return path === null ? null : { commands: path, fragment, here: false };
  }

  reveal(name: string): void {
    this.aside.set(true);
    // Once the panel is rendered, since it may have been closed (on a phone it always starts so).
    // The page scrolls to the section (the URL names it); the focus must not scroll as well.
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>(`[id="api-${name}"] h3`)
          ?.focus({ preventScroll: true }),
      { injector: this.injector },
    );
  }
}
