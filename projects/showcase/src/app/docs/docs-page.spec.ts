import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  withComponentInputBinding,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NeatViewport } from '@sima/neat-ui';
import { DOCS_TOPIC_OF, type DocsPageNav, type DocsTopic } from './docs-context';
import { DOCS_ASIDE_OPEN_KEY, DOCS_ASIDE_WIDTH_KEY, DocsPage, topicParts } from './docs-page';
import type { DocBlock, DocsEntry } from './model';

const words = (text: string): DocBlock[] => [
  { kind: 'paragraph', spans: [{ kind: 'text', text }] },
];
const SOURCE = 'projects/neat-ui/diagram/src/lib/diagram.ts';

const DIAGRAM: DocsEntry = {
  entry: 'diagram',
  import: '@sima/neat-ui/diagram',
  parts: [
    {
      name: 'NeatDiagramBlockTemplate',
      kind: 'template',
      selector: 'ng-template[neatDiagramBlock]',
      doc: words('The body of the blocks.'),
      source: SOURCE,
    },
    {
      name: 'NeatDiagramRole',
      kind: 'type',
      definition: "'frame' | 'block'",
      doc: words('What a node is.'),
      source: SOURCE,
    },
    {
      name: 'NeatDiagramSet',
      kind: 'interface',
      members: [],
      doc: words('A diagram with its levels.'),
      source: SOURCE,
    },
    {
      name: 'NeatDiagramView',
      kind: 'component',
      selector: 'neat-diagram',
      doc: [
        {
          kind: 'paragraph',
          spans: [
            { kind: 'text', text: 'A hand-placed diagram of a ' },
            { kind: 'ref', text: 'NeatDiagramSet', name: 'NeatDiagramSet' },
            { kind: 'text', text: '.' },
          ],
        },
      ],
      source: SOURCE,
    },
    { name: 'NeatSeriesSwatch', kind: 'reexport', from: '@sima/neat-ui', note: [] },
  ],
};

@Component({ selector: 'app-pipeline', template: '<p class="pipeline">Pipeline</p>' })
class Pipeline {}

const TOPIC: DocsTopic = {
  id: 'diagram',
  parts: ['NeatDiagramView', 'NeatDiagramBlockTemplate', 'NeatDiagramRole', 'NeatDiagramSet'],
  leads: ['NeatDiagramView'],
  entries: [DIAGRAM],
  examples: [
    {
      id: 'pipeline',
      title: 'Pipeline',
      component: Pipeline,
      caption: words('A pipeline.'),
      shows: [
        '@sima/neat-ui/diagram#NeatDiagramRole',
        '@sima/neat-ui/diagram#NeatDiagramLegend',
        '@sima/neat-ui/diagram#NeatDiagramView',
      ],
      files: [{ name: 'pipeline.example.ts', code: [['text', 'export class Pipeline {}\n']] }],
    },
  ],
};
const TOPICS: Record<string, DocsTopic> = {
  short: { ...TOPIC, parts: ['NeatDiagramView'] },
  full: TOPIC,
};
/** A category's topics, which its pages show in their page nav. */
const PAGE_NAV: DocsPageNav = {
  label: 'Diagram topics',
  groups: [
    {
      items: [
        { label: 'Diagram', path: '/diagram' },
        { label: 'Listed', path: '/listed' },
      ],
    },
  ],
};

class NoopResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('DocsPage', () => {
  let scrolled: Element[];

  async function open(url = '/diagram', narrow = false) {
    TestBed.configureTestingModule({
      providers: [
        // The routes as the topics config gives them: the topic and its page nav as route data.
        provideRouter(
          [
            {
              path: 'diagram',
              component: DocsPage,
              data: { topic: TOPIC, pageNav: null },
            },
            { path: 'legend', children: [] },
            {
              path: 'listed',
              title: 'Listed',
              component: DocsPage,
              data: { topic: TOPIC, pageNav: PAGE_NAV },
            },
            {
              path: 'pages',
              component: DocsPage,
              data: {
                topic: { ...TOPIC, examples: [{ ...TOPIC.examples[0], page: true }] },
                pageNav: null,
              },
            },
          ],
          withComponentInputBinding(),
        ),
        { provide: NeatViewport, useValue: { narrow: signal(narrow) } },
        {
          provide: DOCS_TOPIC_OF,
          useValue: (name: string) => (name === 'NeatDiagramLegend' ? '/legend' : null),
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, DocsPage);
    await harness.fixture.whenStable();
    return { harness, host: harness.routeNativeElement as HTMLElement };
  }

  beforeEach(() => {
    localStorage.clear();
    scrolled = [];
    vi.stubGlobal('ResizeObserver', NoopResizeObserver);
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it('shows a category’s topics in the page nav, with a filter, and no tabs', async () => {
    const { host } = await open('/listed');
    const page = host.querySelector('neat-page') as HTMLElement;
    const nav = page.querySelector(':scope > nav[neatPageNav]') as HTMLElement;

    expect(nav.getAttribute('aria-label')).toBe('Diagram topics');
    expect(nav.getAttribute('data-layout')).toBe('column');
    expect(
      Array.from(nav.querySelectorAll('a'), (a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([
      ['Diagram', '/diagram'],
      ['Listed', '/listed'],
    ]);
    expect(nav.querySelector('a[aria-current="page"]')?.textContent).toBe('Listed');
    expect(nav.querySelector('input[type="search"]')?.getAttribute('aria-label')).toBe(
      'Filter topics',
    );
    expect(host.querySelector('[neatPageTabs]')).toBeNull();
    // The API stays the page's own panel.
    expect(page.querySelector('aside app-api-panel')).not.toBeNull();
  });

  it('collapses the page nav above the topic on a narrow screen', async () => {
    const { host } = await open('/listed', true);
    const nav = host.querySelector('neat-page > nav[neatPageNav]') as HTMLElement;
    const trigger = nav.querySelector('button[aria-expanded]') as HTMLElement;

    expect(nav.getAttribute('data-layout')).toBe('collapsible');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.textContent).toContain('Diagram topics');
    expect(trigger.textContent).toContain('Listed');
  });

  it('shows no page nav, and no tabs, for a topic without one', async () => {
    const { host } = await open();

    expect(host.querySelector('nav[neatPageNav]')).toBeNull();
    expect(host.querySelector('[neatPageTabs]')).toBeNull();
  });

  it('introduces the topic’s lead parts, then the examples', async () => {
    const { host } = await open();

    expect(
      Array.from(host.querySelectorAll('app-part-intro h2'), (h) => h.textContent?.trim()),
    ).toEqual(['NeatDiagramView']);
    expect(host.querySelector('#examples')?.textContent).toBe('Examples');
    expect(host.querySelector('app-example-card .pipeline')?.textContent).toBe('Pipeline');
  });

  it('lists the lead parts first in the panel, and leaves their intro out of it', async () => {
    const { host } = await open();
    const sections = Array.from(host.querySelectorAll('aside app-api-part'));

    expect(sections.map((section) => section.id)).toEqual([
      'api-NeatDiagramView',
      'api-NeatDiagramBlockTemplate',
      'api-NeatDiagramRole',
      'api-NeatDiagramSet',
    ]);
    expect(sections[0].textContent).not.toContain('A hand-placed diagram');
    expect(sections[2].textContent).toContain('What a node is.');
  });

  it('links its parts to the panel, others to their topic, the rest not at all', async () => {
    const { host } = await open();
    const shows = Array.from(host.querySelectorAll('.shows app-part-ref a'));

    expect(shows.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['NeatDiagramRole', '/diagram#api-NeatDiagramRole'],
      ['NeatDiagramLegend', '/legend#api-NeatDiagramLegend'],
      ['NeatDiagramView', '/diagram#api-NeatDiagramView'],
    ]);
  });

  it('opens the panel at its default width, both kept in storage once changed', async () => {
    const { harness, host } = await open();
    const aside = host.querySelector('aside') as HTMLElement;

    expect(aside.style.getPropertyValue('--neat-aside-width')).toBe('480px');

    const separator = host.querySelector('[role="separator"]') as HTMLElement;
    separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await harness.fixture.whenStable();

    expect(aside.style.getPropertyValue('--neat-aside-width')).toBe('496px');
    expect(localStorage.getItem(DOCS_ASIDE_WIDTH_KEY)).toBe('496');
  });

  it('reveals the part the URL names, opening the panel a reader closed', async () => {
    localStorage.setItem(DOCS_ASIDE_OPEN_KEY, 'false');
    const { host } = await open('/diagram#api-NeatDiagramSet');
    const section = host.querySelector('#api-NeatDiagramSet') as HTMLElement;

    expect(host.querySelector('aside')).not.toBeNull();
    expect(localStorage.getItem(DOCS_ASIDE_OPEN_KEY)).toBe('true');
    expect(scrolled).toEqual([section]);
    expect(document.activeElement).toBe(section.querySelector('h3'));
  });

  it('stays closed as the reader left it, and opens on a part a link names', async () => {
    localStorage.setItem(DOCS_ASIDE_OPEN_KEY, 'false');
    const { harness, host } = await open();

    expect(host.querySelector('aside')).toBeNull();

    (host.querySelector('app-part-intro p a') as HTMLElement).click();
    await harness.fixture.whenStable();

    const section = host.querySelector('#api-NeatDiagramSet') as HTMLElement;
    expect(section).not.toBeNull();
    expect(scrolled.at(-1)).toBe(section);
    expect(document.activeElement).toBe(section.querySelector('h3'));
  });

  it('scrolls to the example the URL names, and to none that the topic lacks', async () => {
    const { harness, host } = await open('/diagram#example-pipeline');

    expect(scrolled).toEqual([host.querySelector('#example-pipeline')]);
    expect(document.activeElement).toBe(document.body);

    await harness.navigateByUrl('/diagram#example-missing');
    await harness.fixture.whenStable();

    expect(scrolled).toHaveLength(1);
  });

  it('reveals a part again each time the fragment changes, back and forward included', async () => {
    const { harness, host } = await open('/diagram#api-NeatDiagramSet');
    const section = (name: string) => host.querySelector(`#api-${name}`) as HTMLElement;
    expect(scrolled).toEqual([section('NeatDiagramSet')]);

    await harness.navigateByUrl('/diagram#api-NeatDiagramRole');
    await harness.fixture.whenStable();

    expect(scrolled.at(-1)).toBe(section('NeatDiagramRole'));
    expect(document.activeElement).toBe(section('NeatDiagramRole').querySelector('h3'));

    // Back is the same navigation as any other, to the earlier fragment.
    await harness.navigateByUrl('/diagram#api-NeatDiagramSet');
    await harness.fixture.whenStable();

    expect(scrolled.at(-1)).toBe(section('NeatDiagramSet'));
    expect(scrolled).toHaveLength(3);
  });

  it('reveals the part a link from another topic names when the route reuses the page', async () => {
    TestBed.configureTestingModule({
      providers: [
        // One route for several topics: the page is the same instance, with another topic.
        provideRouter(
          [
            {
              path: 'topic/:id',
              component: DocsPage,
              data: { pageNav: null },
              resolve: { topic: (route: ActivatedRouteSnapshot) => TOPICS[route.params['id']] },
            },
          ],
          withComponentInputBinding(),
        ),
        { provide: NeatViewport, useValue: { narrow: signal(false) } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/topic/short', DocsPage);
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('#api-NeatDiagramRole')).toBeNull();

    expect(await harness.navigateByUrl('/topic/full#api-NeatDiagramRole', DocsPage)).toBe(page);
    await harness.fixture.whenStable();

    const section = harness.routeNativeElement?.querySelector('#api-NeatDiagramRole');
    expect(section).not.toBeNull();
    expect(scrolled.at(-1)).toBe(section);
  });

  it('reveals a part itself when the link is to the fragment the URL has, after scrolling away', async () => {
    const { harness, host } = await open('/diagram#api-NeatDiagramSet');
    scrolled.length = 0;

    (host.querySelector('app-part-intro p a') as HTMLElement).click();
    await harness.fixture.whenStable();

    expect(scrolled).toEqual([host.querySelector('#api-NeatDiagramSet')]);
  });

  it('shows a page example’s code and a link to its demo route, not the example', async () => {
    const { host } = await open('/pages');

    expect(host.querySelector('.pipeline')).toBeNull();
    expect(host.querySelector('app-example-card a[neatButton]')?.getAttribute('href')).toBe(
      '/demo/diagram/pipeline',
    );
    expect(host.querySelector('app-snippet')).not.toBeNull();
  });

  it('reveals a part once on a click of a link of the page, the panel open already', async () => {
    const { harness, host } = await open();
    expect(host.querySelector('aside')).not.toBeNull();

    (host.querySelector('app-part-intro p a') as HTMLElement).click();
    await harness.fixture.whenStable();

    const section = host.querySelector('#api-NeatDiagramSet') as HTMLElement;
    expect(scrolled).toEqual([section]);
    expect(document.activeElement).toBe(section.querySelector('h3'));
  });
});

describe('topicParts', () => {
  it("finds each part in the entry that declares it, with that entry's import", () => {
    expect(topicParts(TOPIC).map((item) => [item.part.name, item.import])).toEqual([
      ['NeatDiagramView', '@sima/neat-ui/diagram'],
      ['NeatDiagramBlockTemplate', '@sima/neat-ui/diagram'],
      ['NeatDiagramRole', '@sima/neat-ui/diagram'],
      ['NeatDiagramSet', '@sima/neat-ui/diagram'],
    ]);
  });

  it('fails a name no entry declares, a re-export stub included', () => {
    expect(() => topicParts({ ...TOPIC, parts: ['NeatSeriesSwatch'] })).toThrow(
      'The docs topic names NeatSeriesSwatch, which none of its entries declares.',
    );
  });
});
