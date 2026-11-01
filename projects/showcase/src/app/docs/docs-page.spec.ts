import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NeatViewport } from '@sima/neat-ui';
import { DOCS_TOPIC_OF, type DocsTab, type DocsTopic } from './docs-context';
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
  parts: ['NeatDiagramView', 'NeatDiagramBlockTemplate', 'NeatDiagramRole', 'NeatDiagramSet'],
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
const TABS: DocsTab[] = [
  { label: 'Diagram', path: '/diagram' },
  { label: 'Legend', path: '/legend' },
];

class NoopResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('DocsPage', () => {
  let scrolled: Element[];

  async function open(url = '/diagram') {
    TestBed.configureTestingModule({
      providers: [
        // The routes as the topics config gives them: the topic and its tabs as route data.
        provideRouter(
          [
            {
              path: 'diagram',
              component: DocsPage,
              data: { topic: TOPIC, tabs: TABS, tabsLabel: 'Diagram topics' },
            },
            { path: 'legend', children: [] },
          ],
          withComponentInputBinding(),
        ),
        { provide: NeatViewport, useValue: { narrow: signal(false) } },
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

  it("shows the group's topics as page tabs", async () => {
    const { host } = await open();
    const nav = host.querySelector('nav[neatPageTabs]') as HTMLElement;

    expect(nav.getAttribute('aria-label')).toBe('Diagram topics');
    expect(
      Array.from(nav.querySelectorAll('a'), (a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([
      ['Diagram', '/diagram'],
      ['Legend', '/legend'],
    ]);
  });

  it('introduces the parts the examples show, then the examples', async () => {
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
      'api-NeatDiagramRole',
      'api-NeatDiagramBlockTemplate',
      'api-NeatDiagramSet',
    ]);
    expect(sections[0].textContent).not.toContain('A hand-placed diagram');
    expect(sections[1].textContent).toContain('What a node is.');
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
