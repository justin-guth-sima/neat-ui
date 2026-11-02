import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, type Route, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NeatViewport } from '@sima/neat-ui';
import { DocsPage } from './docs-page';
import { docsRoutes, groupNavItems, partTopicPath, placedTopics } from './docs-routes';
import type { DocsEntry, DocsExample } from './model';
import type { TopicGroup } from './topics';

@Component({ selector: 'app-whole-page', template: '<p class="whole">A page of its own</p>' })
class WholePage {}

/** A hand-made topic's page, a component of its own with no inputs. */
@Component({ selector: 'app-made-page', template: '<p class="made">Made by hand</p>' })
class MadePage {}

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
/** The entry of a listed group's part. */
const BOLTS: DocsEntry = {
  ...ENTRY,
  parts: [
    {
      name: 'NeatBolt',
      kind: 'component',
      selector: 'neat-bolt',
      doc: [{ kind: 'paragraph', spans: [{ kind: 'text', text: 'A bolt.' }] }],
      source: 'projects/neat-ui/src/lib/bolt.ts',
    },
  ],
};

const THINGS = {
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
} satisfies TopicGroup;

/** A group whose sub-pages are categories, each with its topics in a side list beside its pages. */
const PARTS = {
  id: 'parts',
  label: 'Parts',
  icon: 'shapes',
  categories: [
    {
      id: 'small',
      label: 'Small',
      topics: [
        {
          id: 'bolt',
          label: 'Bolt',
          parts: ['NeatBolt'],
          leads: [],
          load: async () => ({ entries: [BOLTS], examples: [] }),
        },
        {
          id: 'nut',
          label: 'Nut',
          parts: [],
          leads: [],
          load: async () => ({ entries: [], examples: [] }),
        },
      ],
    },
    {
      id: 'large',
      label: 'Large',
      topics: [
        {
          id: 'beam',
          label: 'Beam',
          parts: [],
          leads: [],
          load: async () => ({ entries: [], examples: [] }),
        },
      ],
    },
  ],
} satisfies TopicGroup;

const GROUPS: TopicGroup[] = [
  THINGS,
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
  PARTS,
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

  it('names a topic /<group>/<topic>, and one filed under a category /<group>/<category>/<topic>', () => {
    expect(placedTopics(THINGS).map(({ topic, path }) => [topic.id, path])).toEqual([
      ['thing', '/things/thing'],
      ['pages', '/things/pages'],
    ]);
    expect(
      placedTopics(PARTS).map(({ topic, path, category }) => [topic.id, path, category?.id]),
    ).toEqual([
      ['bolt', '/parts/small/bolt', 'small'],
      ['nut', '/parts/small/nut', 'small'],
      ['beam', '/parts/large/beam', 'large'],
    ]);
  });

  it('gives each group a rail item, with its topics or its categories as the item’s children', () => {
    expect(groupNavItems(GROUPS)).toEqual([
      {
        label: 'Things',
        icon: 'info',
        path: '/things',
        children: [
          { label: 'Thing', path: '/things/thing' },
          { label: 'Pages', path: '/things/pages' },
        ],
      },
      {
        label: 'Other',
        icon: 'stats',
        path: '/other',
        children: [{ label: 'One', path: '/other/one' }],
      },
      {
        label: 'Hand',
        icon: 'document',
        path: '/hand',
        children: [{ label: 'Made', path: '/hand/made' }],
      },
      {
        label: 'Parts',
        icon: 'shapes',
        path: '/parts',
        children: [
          { label: 'Small', path: '/parts/small' },
          { label: 'Large', path: '/parts/large' },
        ],
      },
    ]);
  });

  it('finds the topic of a part, and none for a part no topic documents', () => {
    const topicOf = partTopicPath(GROUPS);

    expect(topicOf('NeatThing')).toBe('/things/thing');
    expect(topicOf('NeatOne')).toBe('/other/one');
    expect(topicOf('NeatBolt')).toBe('/parts/small/bolt');
    expect(topicOf('NeatUnknown')).toBeNull();
  });

  it('opens a group on its first topic', async () => {
    await RouterTestingHarness.create().then((harness) => harness.navigateByUrl('/things'));

    expect(router.url).toBe('/things/thing');
  });

  it('titles a page with its topic, and hands the docs page its topic and no side list', async () => {
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
    expect(page.sideList()).toBeNull();
  });

  it('routes a hand-made topic’s component, not a docs page', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/hand/made', MadePage);
    await harness.fixture.whenStable();
    const route = docsRoutes(GROUPS).find((candidate) => candidate.path === 'hand/made');

    expect(route?.title).toBe('Made');
    expect(route?.resolve).toBeUndefined();
    expect(harness.routeNativeElement?.querySelector('.made')?.textContent).toBe('Made by hand');
    expect(harness.routeNativeElement?.querySelector('app-docs-page')).toBeNull();
  });

  it('opens a hand-made group on its topic', async () => {
    await RouterTestingHarness.create().then((harness) => harness.navigateByUrl('/hand'));

    expect(router.url).toBe('/hand/made');
  });

  it('hands the pages of a category its topics as their side list', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/parts/small/nut', DocsPage);
    await harness.fixture.whenStable();

    expect(docsRoutes(GROUPS).find((route) => route.path === 'parts/small/nut')?.title).toBe('Nut');
    expect(page.sideList()).toEqual({
      label: 'Small topics',
      groups: [
        {
          items: [
            { label: 'Bolt', path: '/parts/small/bolt' },
            { label: 'Nut', path: '/parts/small/nut' },
          ],
        },
      ],
    });
  });

  it('opens a group with categories on its first category’s first topic, a category on its first', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/parts');
    expect(router.url).toBe('/parts/small/bolt');

    await harness.navigateByUrl('/parts/large');
    expect(router.url).toBe('/parts/large/beam');
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

  it('keeps a page example rendered on its own sub-paths', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/demo/pages/whole-page', WholePage);

    const same = await harness.navigateByUrl('/demo/pages/whole-page/devices', WholePage);

    expect(same).toBe(page);
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
    expect(await children('demo/nut')).toEqual([]);
  });

  // No redirect from an earlier address (a category's own, `/small/nut`, or a topic's straight
  // under its group, `/parts/nut`): the app's one catch-all sends those to Getting started.
  it('routes each group, category and topic and a demo per generated topic, and no old address', () => {
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
      'parts',
      'parts/small',
      'parts/small/bolt',
      'parts/small/nut',
      'parts/large',
      'parts/large/beam',
      'demo/bolt',
      'demo/nut',
      'demo/beam',
    ]);
  });
});
