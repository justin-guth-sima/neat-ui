import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NeatViewport } from '@sima/neat-ui';
import type { DocsTab } from './docs-context';
import { DocsPage } from './docs-page';
import { docsRoutes, groupNavItems, groupTabs, partTopicPath, topicPath } from './docs-routes';
import type { DocsEntry, DocsExample } from './model';
import type { TopicGroup } from './topics';

@Component({ selector: 'app-whole-page', template: '<p class="whole">A page of its own</p>' })
class WholePage {}

/** A hand-made topic's page: it takes its group's tabs as a docs page does. */
@Component({ selector: 'app-made-page', template: '<p class="made">{{ tabs().length }} tab</p>' })
class MadePage {
  readonly tabs = input<readonly DocsTab[]>([]);
  readonly tabsLabel = input('Topics');
}

const ENTRY: DocsEntry = {
  entry: 'primary',
  import: '@sima/neat-ui',
  parts: [
    {
      name: 'NeatThing',
      kind: 'component',
      selector: 'neat-thing',
      doc: [{ kind: 'paragraph', spans: [{ kind: 'text', text: 'A thing.' }] }],
      source: 'projects/neat-ui/src/lib/thing.ts',
    },
  ],
};
const EXAMPLE: DocsExample = {
  id: 'whole-page',
  title: 'Whole page',
  component: WholePage,
  caption: [],
  shows: ['@sima/neat-ui#NeatThing'],
  files: [{ name: 'whole-page.example.ts', code: [['text', 'export class WholePage {}\n']] }],
};

const GROUPS: TopicGroup[] = [
  {
    id: 'things',
    label: 'Things',
    icon: 'info',
    topics: [
      {
        id: 'thing',
        label: 'Thing',
        parts: ['NeatThing'],
        leads: ['NeatThing'],
        fit: true,
        load: async () => ({ entries: [ENTRY], examples: [] }),
      },
      {
        id: 'pages',
        label: 'Pages',
        parts: [],
        leads: [],
        fullPage: true,
        load: async () => ({ entries: [], examples: [EXAMPLE] }),
      },
    ],
  },
  {
    id: 'other',
    label: 'Other',
    icon: 'stats',
    topics: [
      {
        id: 'one',
        label: 'One',
        parts: ['NeatOne'],
        leads: [],
        load: async () => ({ entries: [], examples: [] }),
      },
    ],
  },
  {
    id: 'hand',
    label: 'Hand',
    icon: 'document',
    topics: [{ id: 'made', label: 'Made', parts: [], leads: [], page: async () => MadePage }],
  },
];

describe('the docs routes', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(docsRoutes(GROUPS), withComponentInputBinding()),
        { provide: NeatViewport, useValue: { narrow: signal(false) } },
      ],
    });
    router = TestBed.inject(Router);
  });

  it('names a topic /<group>/<topic>, with the group’s topics as its tabs', () => {
    expect(topicPath(GROUPS[0], GROUPS[0].topics[1])).toBe('/things/pages');
    expect(groupTabs(GROUPS[0])).toEqual([
      { label: 'Thing', path: '/things/thing' },
      { label: 'Pages', path: '/things/pages' },
    ]);
  });

  it('gives each group a rail item, which is open on the group’s topics', () => {
    expect(groupNavItems(GROUPS)).toEqual([
      { label: 'Things', icon: 'info', path: '/things' },
      { label: 'Other', icon: 'stats', path: '/other' },
      { label: 'Hand', icon: 'document', path: '/hand' },
    ]);
  });

  it('finds the topic of a part, and none for a part no topic documents', () => {
    const topicOf = partTopicPath(GROUPS);

    expect(topicOf('NeatThing')).toBe('/things/thing');
    expect(topicOf('NeatOne')).toBe('/other/one');
    expect(topicOf('NeatUnknown')).toBeNull();
  });

  it('opens a group on its first topic', async () => {
    await RouterTestingHarness.create().then((harness) => harness.navigateByUrl('/things'));

    expect(router.url).toBe('/things/thing');
  });

  it('titles a page with its topic, and hands the docs page its topic and its group’s tabs', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/things/thing', DocsPage);
    await harness.fixture.whenStable();

    expect(docsRoutes(GROUPS).find((route) => route.path === 'things/thing')?.title).toBe('Thing');
    expect(page.topic()).toMatchObject({ parts: ['NeatThing'], leads: ['NeatThing'], fit: true });
    expect(page.topic().openBase).toBeUndefined();
    expect(page.tabsLabel()).toBe('Things topics');
    expect(page.tabs().map((tab) => tab.path)).toEqual(['/things/thing', '/things/pages']);
  });

  it('routes a hand-made topic’s component with its group’s tabs, and no docs page', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/hand/made', MadePage);
    await harness.fixture.whenStable();
    const route = docsRoutes(GROUPS).find((candidate) => candidate.path === 'hand/made');

    expect(route?.title).toBe('Made');
    expect(route?.resolve).toBeUndefined();
    expect(page.tabs()).toEqual([{ label: 'Made', path: '/hand/made' }]);
    expect(page.tabsLabel()).toBe('Hand topics');
    expect(harness.routeNativeElement?.querySelector('.made')?.textContent).toBe('1 tab');
    expect(harness.routeNativeElement?.querySelector('app-docs-page')).toBeNull();
  });

  it('opens a hand-made group on its topic', async () => {
    await RouterTestingHarness.create().then((harness) => harness.navigateByUrl('/hand'));

    expect(router.url).toBe('/hand/made');
  });

  it('routes the examples of a full-page topic as pages of their own, and links them', async () => {
    const harness = await RouterTestingHarness.create();
    const docs = await harness.navigateByUrl('/things/pages', DocsPage);
    await harness.fixture.whenStable();

    expect(docs.topic().openBase).toBe('/demo/pages');
    expect(docs.topic().fit).toBeUndefined();
    expect(
      harness.routeNativeElement
        ?.querySelector('app-example-card a[neatButton]')
        ?.getAttribute('href'),
    ).toBe('/demo/pages/whole-page');

    const page = await harness.navigateByUrl('/demo/pages/whole-page', WholePage);

    expect(page).toBeInstanceOf(WholePage);
    expect(harness.routeNativeElement?.querySelector('.whole')?.textContent).toBe(
      'A page of its own',
    );
  });

  it('leaves a code-only example out of a full-page topic’s routes', async () => {
    const codeOnly: TopicGroup = {
      id: 'shell',
      label: 'Shell',
      icon: 'info',
      topics: [
        {
          id: 'shell',
          label: 'Shell',
          parts: [],
          leads: [],
          fullPage: true,
          load: async () => ({
            entries: [],
            examples: [EXAMPLE, { ...EXAMPLE, id: 'app', component: undefined }],
          }),
        },
      ],
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(docsRoutes([codeOnly]), withComponentInputBinding()),
        { provide: NeatViewport, useValue: { narrow: signal(false) } },
      ],
    });
    const harness = await RouterTestingHarness.create();

    expect(await harness.navigateByUrl('/demo/shell/whole-page', WholePage)).toBeInstanceOf(
      WholePage,
    );
    const config = TestBed.inject(Router).config;
    const demo = config.find((route) => route.path === 'demo/shell');
    const children = await (demo?.loadChildren as () => Promise<{ path: string }[]>)();
    expect(children.map((route) => route.path)).toEqual(['whole-page']);
  });

  it('routes no example of a topic that is not full-page', () => {
    const paths = docsRoutes(GROUPS).map((route) => route.path);

    expect(paths).toEqual([
      'things',
      'things/thing',
      'things/pages',
      'demo/pages',
      'other',
      'other/one',
      'hand',
      'hand/made',
    ]);
  });
});
