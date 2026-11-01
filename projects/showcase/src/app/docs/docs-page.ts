import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  isDevMode,
  type OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  NeatAsidePanel,
  neatAsideOpen,
  NeatAsideToggle,
  NeatPage,
  NeatPageTab,
  NeatPageTabs,
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
import { isTypeKind, shownName } from './display';
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
      if (part && part.kind !== 'reexport') return [{ part, import: entry.import }];
    }
    if (isDevMode()) {
      throw new Error(`The docs topic names ${name}, which none of its entries declares.`);
    }
    return [];
  });
}

/**
 * One topic of the docs: its group's topics as page tabs, a body that introduces the parts its
 * examples show and then the examples, and the topic's API in the page's side panel, open by
 * default on a wide screen, resizable, both remembered for every topic. It leaves the top bar's
 * toolbar to the topic's examples (one may have tools there, as the diagram's Fit).
 *
 * A link to a part of the page, from anywhere on it, or the URL's `#api-<Name>` as the page opens,
 * opens the panel on the part's section.
 */
@Component({
  selector: 'app-docs-page',
  imports: [
    ApiPanel,
    ExampleCard,
    NeatAsidePanel,
    NeatAsideToggle,
    NeatPage,
    NeatPageTab,
    NeatPageTabs,
    PartIntro,
    RouterLink,
  ],
  providers: [{ provide: DocsContext, useExisting: DocsPage }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
              <app-example-card [example]="example" />
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
export class DocsPage extends DocsContext implements OnInit {
  readonly topic = input.required<DocsTopic>();
  /** The topics of the page's group, as page tabs; none shows no row. */
  readonly tabs = input<readonly DocsTab[]>([]);
  /** The tabs' landmark name: "Diagram topics". */
  readonly tabsLabel = input('Topics');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly topicOf = inject(DOCS_TOPIC_OF);
  private readonly route = inject(ActivatedRoute);

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
  /** The parts some example shows. */
  private readonly leads = computed(
    () => new Set(this.topic().examples.flatMap((example) => example.shows.map(shownName))),
  );
  protected readonly panelParts = computed(() => {
    const leads = this.leads();
    const parts = this.parts();
    return [
      ...parts.filter((item) => leads.has(item.part.name)),
      ...parts.filter((item) => !leads.has(item.part.name)),
    ];
  });
  /** The lead parts an app renders or calls, introduced in the body; types are the panel's. */
  protected readonly intros = computed(() =>
    this.panelParts().filter((item) => this.leads().has(item.part.name) && !isTypeKind(item.part)),
  );
  protected readonly introduced = computed(
    () => new Set(this.intros().map((item) => item.part.name)),
  );

  /**
   * A part the URL names when the page opens (a link from another topic, a shared link). On the
   * page itself a link reveals its part on click (`PartRef`), the one path for that.
   */
  ngOnInit(): void {
    const name = /^api-(.+)$/.exec(this.route.snapshot.fragment ?? '')?.[1];
    if (name && this.names().has(name)) this.reveal(name);
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
    afterNextRender(
      () => {
        const section = this.host.nativeElement.querySelector(`[id="api-${name}"]`);
        // At once, not smoothly: a jump the reader asked for, with no motion to reduce.
        section?.scrollIntoView({ block: 'start' });
        section?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }
}
