import { reflectComponentType } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { App } from '../app';
import { appConfig } from '../app.config';
import { isReexportStub, shownName } from './display';
import { KIT_ENTRIES } from './docs.testing';
import { placedTopics } from './docs-routes';
import type { DocsDeclaredPart, DocsExample } from './model';
import { GROUPS, type TopicConfig } from './topics';

/*
 * What the topics config owes the kit: nothing public goes undocumented or unreachable. The
 * doc text itself (a part or member without a doc) is `docs:emit --check`'s, which the tools'
 * tests and CI run.
 */

/** What an app renders, injects or calls: it needs an example. The rest need their panel entry. */
const NEEDS_EXAMPLE: ReadonlySet<DocsDeclaredPart['kind']> = new Set([
  'component',
  'directive',
  'structural',
  'template',
  'service',
  'class',
  'function',
]);

/**
 * Parts that belong to the app's own root, once, and not to a page: `provideNeatUi` and
 * `provideNeatTitles` configure the app in its `app.config.ts`, before anything renders, and
 * `NeatToastHost` is rendered once beside the shell in the root template. No example can show them
 * without faking their use: a component cannot provide them to the app around it, and a second
 * host would show every toast twice. Their doc comments and API entries carry what they do, and
 * the showcase's `app.config.ts` and `app.ts` (the shell topic's last example) are the uses.
 */
const BELONGS_TO_THE_APP: ReadonlySet<string> = new Set([
  'provideNeatUi',
  'provideNeatTitles',
  'NeatToastHost',
]);

const topics = GROUPS.flatMap((group) =>
  placedTopics(group).map((placed) => ({ group, ...placed })),
);
/**
 * The topics generated from the kit. A hand-made one (`page`) has no examples module and no part,
 * so the rules about examples are not its.
 */
const generated = topics.filter(({ topic }) => topic.load);
const declared = new Map(
  KIT_ENTRIES.flatMap((entry) =>
    entry.parts.flatMap((part) => (isReexportStub(part) ? [] : [[part.name, part] as const])),
  ),
);

describe('the docs topics', () => {
  const loaded = new Map<TopicConfig, readonly DocsExample[]>();

  beforeAll(async () => {
    for (const { topic } of generated) loaded.set(topic, (await topic.load!()).examples);
  });

  it('puts no public part in more than one topic', () => {
    const owners = new Map<string, string[]>();
    for (const { topic, path } of topics) {
      for (const name of topic.parts) owners.set(name, [...(owners.get(name) ?? []), path]);
    }

    expect([...owners].filter(([, paths]) => paths.length > 1)).toEqual([]);
  });

  it('puts every public export in a topic', () => {
    const documented = new Set(topics.flatMap(({ topic }) => topic.parts));

    expect([...declared.keys()].filter((name) => !documented.has(name))).toEqual([]);
  });

  it('names only parts the kit declares, its leads among its parts', () => {
    for (const { topic } of topics) {
      expect(
        topic.parts.filter((name) => !declared.has(name)),
        `${topic.id} names parts the kit does not export`,
      ).toEqual([]);
      expect(
        topic.leads.filter((name) => !topic.parts.includes(name)),
        `${topic.id} leads with parts it does not document`,
      ).toEqual([]);
    }
  });

  it('shows each component, directive, service and function of a topic in one of its examples', () => {
    for (const { topic } of generated) {
      const shown = new Set(loaded.get(topic)?.flatMap((example) => example.shows.map(shownName)));
      const unshown = topic.parts.filter((name) => {
        const part = declared.get(name);
        return (
          part &&
          NEEDS_EXAMPLE.has(part.kind) &&
          !part.deprecated &&
          !BELONGS_TO_THE_APP.has(name) &&
          !shown.has(name)
        );
      });

      expect(unshown, `${topic.id} has parts no example shows`).toEqual([]);
    }
  });

  it('has a topic an examples module and no example of a private or deprecated part', () => {
    for (const { topic } of generated) {
      const examples = loaded.get(topic) ?? [];
      expect(examples.length, `${topic.id} has no examples`).toBeGreaterThan(0);
      for (const name of examples.flatMap((example) => example.shows.map(shownName))) {
        expect(name.startsWith('ɵ'), `${topic.id} shows ${name}`).toBe(false);
        expect(declared.get(name)?.deprecated, `${topic.id} shows ${name}`).toBeUndefined();
      }
    }
  });

  it('has a hand-made topic a page and no part, and a generated one a loader and no page', () => {
    const handMade = topics.filter(({ topic }) => topic.page);

    expect(handMade.map(({ topic }) => topic.id)).toContain('tokens');
    for (const { topic } of handMade) {
      expect(topic.load, `${topic.id} has a page and a loader`).toBeUndefined();
      expect([...topic.parts, ...topic.leads], `${topic.id} documents parts`).toEqual([]);
    }
    for (const { topic } of generated) expect(topic.page).toBeUndefined();
  });

  it('has unique group and topic routes', () => {
    const paths = topics.map(({ path }) => path);
    const groups = GROUPS.map((group) => group.id);

    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(groups).size).toBe(groups.length);
  });

  it('has Theme and Layout with their topics as sub-pages, and Components with its eight categories', () => {
    expect(
      GROUPS.map((group) => [group.id, group.topics?.length, group.categories?.length]),
    ).toEqual([
      ['theme', 4, undefined],
      ['layout', 6, undefined],
      ['components', undefined, 8],
    ]);
    expect(GROUPS[2].categories?.map((category) => category.label)).toEqual([
      'Actions',
      'Forms',
      'Status',
      'Data',
      'Charts',
      'Diagram',
      'Chat',
      'Video',
    ]);
    expect(placedTopics(GROUPS[2])).toHaveLength(65);
    expect(topics).toHaveLength(75);
  });

  it("lists each category's topics in alphabetical order, so a reader finds a part by its name", () => {
    for (const category of GROUPS[2].categories ?? []) {
      const labels = category.topics.map((topic) => topic.label);
      expect(labels, category.label).toEqual(
        [...labels].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })),
      );
    }
  });

  // The id is also the examples folder and the `/demo/<id>` path, whichever group the topic is in.
  it('has unique topic ids across groups', () => {
    const ids = topics.map(({ topic }) => topic.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

/** jsdom has no ResizeObserver; the pages' sizes are not what these specs check. */
class NoopResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('every docs topic in the app', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;
  const root = (): HTMLElement => fixture.nativeElement;
  const content = (): HTMLElement => root().querySelector('neat-shell main.content') as HTMLElement;

  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', NoopResizeObserver);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    TestBed.configureTestingModule({ providers: appConfig.providers });
    router = TestBed.inject(Router);
    // The rail starts collapsed whatever an earlier test chose, and is opened to show its labels,
    // the state in which a page's sub-pages unfold under its item.
    localStorage.clear();
    fixture = TestBed.createComponent(App);
    await router.navigateByUrl('/');
    await fixture.whenStable();
    // The rail's control, the last row of its footer.
    const showLabels = root().querySelector<HTMLButtonElement>(
      'neat-shell [data-sidebar="footer"] [data-sidebar="menu"] > button[neatRailItem]:last-child',
    ) as HTMLButtonElement;
    expect(showLabels.textContent?.trim()).toBe('Show labels');
    showLabels.click();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it.each(
    topics.map(({ group, topic, path, category }) => [path, group, topic, category] as const),
  )(
    'renders %s with its page and sub-page in the rail, and a category’s topics in its page nav',
    async (path, group, topic, category) => {
      await router.navigateByUrl(path);
      await fixture.whenStable();
      const linksOf = (links: Iterable<Element>) =>
        Array.from(links, (link) => [link.textContent?.trim(), link.getAttribute('href')]);
      const current = (links: Iterable<Element>) =>
        Array.from(links)
          .filter((link) => link.getAttribute('aria-current') === 'page')
          .map((link) => link.textContent?.trim());

      // The rail: the group's item active, its sub-pages unfolded under it, the open one current.
      const rail = root().querySelector('neat-shell nav') as HTMLElement;
      const children = rail.querySelectorAll('a[data-child]');
      expect(rail.querySelector('a.active:not([data-child])')?.textContent?.trim()).toBe(
        group.label,
      );
      expect(linksOf(children)).toEqual(
        group.categories
          ? group.categories.map((each) => [each.label, `/${group.id}/${each.id}`])
          : group.topics.map((each) => [each.label, `/${group.id}/${each.id}`]),
      );
      expect(current(children)).toEqual([category?.label ?? topic.label]);

      // The page: a category's topics in its page nav, a group's own topics in none.
      const list = content().querySelector('neat-page > nav[neatPageNav]');
      expect(content().querySelector('[neatPageTabs]')).toBeNull();
      if (!category) {
        expect(list).toBeNull();
        return;
      }
      expect(list?.getAttribute('aria-label')).toBe(`${category.label} topics`);
      const links = list?.querySelectorAll('a') ?? [];
      expect(linksOf(links)).toEqual(
        category.topics.map((each) => [each.label, `/${group.id}/${category.id}/${each.id}`]),
      );
      expect(current(links)).toEqual([topic.label]);
    },
  );

  // The smoke test: every topic's page renders in jsdom with its examples live and its API panel,
  // and each page example's own route renders.
  // No example is left out: the stubs above (no `ResizeObserver`, no canvas context) are all the
  // canvas charts, the video tile and the ROI editor need to mount, and what they draw is checked
  // by eye and in their own specs.
  it.each(topics.map(({ topic, path }) => [path, topic] as const))(
    'renders %s with its intros, examples and API panel',
    async (path, topic) => {
      await router.navigateByUrl(path);
      await fixture.whenStable();

      if (!topic.load) {
        // A hand-made page has no parts and no examples; it renders sections of its own.
        expect(content().querySelector('h2')?.textContent?.trim()).toBeTruthy();
        expect(content().querySelector('aside app-api-part')).toBeNull();
        return;
      }
      const examples = (await topic.load()).examples;

      expect(
        Array.from(content().querySelectorAll('app-part-intro h2'), (h) => h.textContent?.trim()),
      ).toEqual(topic.parts.filter((name) => topic.leads.includes(name)));
      // Each card's own title: an example may hold headings of its own (prose).
      expect(
        Array.from(
          content().querySelectorAll('app-example-card > article > h3'),
          (h) => h.textContent,
        ),
      ).toEqual(examples.map((example) => example.title));
      for (const example of examples) {
        const card = content().querySelector(`article[aria-labelledby="example-${example.id}"]`);
        if (example.page) {
          // A page example is a route of its own, which the card links to.
          expect(
            card?.querySelector(`a[href="/demo/${topic.id}/${example.id}"]`),
            `${example.id} has no link`,
          ).not.toBeNull();
        } else if (example.component) {
          expect(
            card?.querySelector('.live')?.childElementCount,
            `${example.id} did not render`,
          ).toBeGreaterThan(0);
        }
      }
      // Each part of the topic has its section in the panel, whether or not it is introduced.
      expect(
        Array.from(content().querySelectorAll('aside app-api-part'), (part) => part.id).sort(),
      ).toEqual(topic.parts.map((name) => `api-${name}`).sort());
      // A page example is a page of its own, which only its route renders.
      for (const example of examples.filter((candidate) => candidate.page)) {
        await router.navigateByUrl(`/demo/${topic.id}/${example.id}`);
        await fixture.whenStable();
        const selector = example.component && reflectComponentType(example.component)?.selector;
        const page = selector ? content().querySelector(selector) : null;

        expect(page?.childElementCount ?? 0, `${example.id} did not render`).toBeGreaterThan(0);
        expect(content().querySelector('[neatPageTabs]'), example.id).toBeNull();
      }
    },
  );

  it.each(GROUPS)('has a rail item for the $label group', (group) => {
    const items = Array.from(root().querySelectorAll('neat-shell nav a'), (a) =>
      a.textContent?.trim(),
    );

    expect(items).toContain(group.label);
  });
});
