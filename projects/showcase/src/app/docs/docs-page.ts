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
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  NeatAsidePanel,
  neatAsideOpen,
  NeatAsideToggle,
  NeatButton,
  NeatIcon,
  NeatPage,
  NeatPageTab,
  NeatPageTabs,
  NeatPageToolbar,
  neatStoredSignal,
} from '@sima/neat-ui';
import { ApiPanel } from './api-panel';
import {
  DOCS_TOPIC_OF,
  DocsContext,
  type DocsTab,
  type DocsTarget,
  type DocsTopic,
  type DocsTopicPart,
} from './docs-context';
import { ExampleCard } from './example-card';
import type { DocsExample } from './model';
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
      if (part && part.kind !== 'reexport') return [{ part, import: entry.import }];
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
 * One topic of the docs: its group's topics as page tabs, a body that introduces the parts its
 * examples show and then the examples, and the topic's API in the page's side panel, open by
 * default on a wide screen, resizable, both remembered for every topic. The topic may ask for a Fit
 * button in the top bar (`DocsTopic.fit`), the page's one toolbar.
 *
 * The URL's fragment `#api-<Name>`, as the page opens and each time it changes (a link to another
 * topic, a shared link, back and forward), opens the panel on the part's section; `#example-<id>`
 * scrolls to the example. The router's own anchor scrolling moves the window, and the page scrolls
 * inside the shell, so the page does both itself.
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
    NeatPageTab,
    NeatPageTabs,
    NeatPageToolbar,
    PartIntro,
    RouterLink,
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
      @if (tabs().length) {
        <nav neatPageTabs [attr.aria-label]="tabsLabel()">
          @for (tab of tabs(); track tab.path) {
            <a neatPageTab [routerLink]="tab.path">{{ tab.label }}</a>
          }
        </nav>
      }
      <div class="showcase-page">
        @for (item of intros(); track item.part.name) {
          <app-part-intro [part]="item.part" [import]="item.import" />
        }
        @if (topic().examples.length) {
          <section class="examples" aria-labelledby="examples">
            <h2 id="examples">Examples</h2>
            @for (example of topic().examples; track example.id) {
              <app-example-card [example]="example" [open]="openPath(example)" />
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
  /** The topics of the page's group, as page tabs; none shows no row. */
  readonly tabs = input<readonly DocsTab[]>([]);
  /** The tabs' landmark name: "Diagram topics". */
  readonly tabsLabel = input('Topics');

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
      const fragment = this.fragment() ?? '';
      const part = /^api-(.+)$/.exec(fragment)?.[1];
      const example = /^example-(.+)$/.exec(fragment)?.[1];
      if (part && this.names().has(part)) untracked(() => this.reveal(part));
      else if (example && this.topic().examples.some((e) => e.id === example)) {
        untracked(() => this.scrollTo(`example-${example}`));
      }
    });
  }

  /**
   * Where a full-page example is routed, for a topic whose examples are not in the cards. None for
   * an example with no component: it is code only and has no route (`demoRoute`), so its card says
   * so instead of linking.
   */
  protected openPath(example: DocsExample): string | null {
    const base = this.topic().openBase;
    return base && example.component ? `${base}/${example.id}` : null;
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
    this.scrollTo(`api-${name}`, (section) =>
      section.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true }),
    );
  }

  /** Scrolls the element with `id` to the top once the page has rendered, then `after` it. */
  private scrollTo(id: string, after?: (element: Element) => void): void {
    afterNextRender(
      () => {
        const element = this.host.nativeElement.querySelector(`[id="${id}"]`);
        // At once, not smoothly: a jump the reader asked for, with no motion to reduce.
        element?.scrollIntoView({ block: 'start' });
        if (element) after?.(element);
      },
      { injector: this.injector },
    );
  }
}
