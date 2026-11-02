import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, type Route, Router, withComponentInputBinding } from '@angular/router';
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
  page: true,
  caption: [],
  shows: ['@sima/neat-ui#NeatThing'],
  files: [{ name: 'whole-page.example.ts', code: [['text', 'export class WholePage {}\n']] }],
};
/** An example of the same topic that sits in its card, and one that is code only. */
const IN_CARD: DocsExample = { ...EXAMPLE, id: 'in-card', title: 'In card', page: undefined };
const CODE_ONLY: DocsExample = { ...EXAMPLE, id: 'app', component: undefined, page: undefined };

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
        load: async () => ({ entries: [], examples: [EXAMPLE, IN_CARD, CODE_ONLY] }),
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
    expect(page.topic()).toMatchObject({
      id: 'thing',
      parts: ['NeatThing'],
      leads: ['NeatThing'],
      fit: true,
    });
    expect(page.tabsLabel()).toBe('Things topics');
    expect(page.tabs().map((tab) => tab.path)).toEqual(['/things/thing', '/things/pages']);
  });

  it('routes a hand-made topic’s component with the group’s tabs, not a docs page', async () => {
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

  it('routes a page example as a page of its own, and its card links there', async () => {
    const harness = await RouterTestingHarness.create();
    const docs = await harness.navigateByUrl('/things/pages', DocsPage);
    await harness.fixture.whenStable();

    expect(docs.topic().fit).toBeUndefined();
    const links = Array.from(
      harness.routeNativeElement?.querySelectorAll('app-example-card a[neatButton]') ?? [],
      (link) => link.getAttribute('href'),
    );
    expect(links).toEqual(['/demo/pages/whole-page']);

    const page = await harness.navigateByUrl('/demo/pages/whole-page', WholePage);

    expect(page).toBeInstanceOf(WholePage);
    expect(harness.routeNativeElement?.querySelector('.whole')?.textContent).toBe(
      'A page of its own',
    );
  });

  it('routes the page examples of each topic and nothing else', async () => {
    const children = async (path: string) => {
      const demo = docsRoutes(GROUPS).find((route) => route.path === path);
      const routes = await (demo?.loadChildren as () => Promise<Route[]>)();
      return routes.map((route) => route.path);
    };

    expect(await children('demo/pages')).toEqual(['whole-page']);
    expect(await children('demo/thing')).toEqual([]);
    expect(await children('demo/one')).toEqual([]);
  });

  it('gives each generated topic a lazy demo route, and a hand-made one none', () => {
    const paths = docsRoutes(GROUPS).map((route) => route.path);

    expect(paths).toEqual([
      'things',
      'things/thing',
      'things/pages',
      'demo/thing',
      'demo/pages',
      'other',
      'other/one',
      'demo/one',
      'hand',
      'hand/made',
    ]);
  });
});
