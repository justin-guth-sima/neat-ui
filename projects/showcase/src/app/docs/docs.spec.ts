import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { App } from '../app';
import { appConfig } from '../app.config';
import { shownName } from './display';
import { KIT_ENTRIES } from './docs.testing';
import { groupTabs, topicPath } from './docs-routes';
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

const topics = GROUPS.flatMap((group) => group.topics.map((topic) => ({ group, topic })));
/**
 * The topics generated from the kit. A hand-made one (`page`) has no examples module and no part,
 * so the rules about examples are not its.
 */
const generated = topics.filter(({ topic }) => topic.load);
const declared = new Map(
  KIT_ENTRIES.flatMap((entry) =>
    entry.parts.flatMap((part) => (part.kind === 'reexport' ? [] : [[part.name, part] as const])),
  ),
);

describe('the docs topics', () => {
  const loaded = new Map<TopicConfig, readonly DocsExample[]>();

  beforeAll(async () => {
    for (const { topic } of generated) loaded.set(topic, (await topic.load!()).examples);
  });

  it('puts no public part in more than one topic', () => {
    const owners = new Map<string, string[]>();
    for (const { group, topic } of topics) {
      for (const name of topic.parts) {
        owners.set(name, [...(owners.get(name) ?? []), topicPath(group, topic)]);
      }
    }

    expect([...owners].filter(([, paths]) => paths.length > 1)).toEqual([]);
  });

  // Strict once every old page has moved (the second pull request): the parts of the pages that
  // have not are in no topic yet.
  it.todo('puts every public export in a topic');

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
    const paths = topics.map(({ group, topic }) => topicPath(group, topic));
    const groups = GROUPS.map((group) => group.id);

    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(groups).size).toBe(groups.length);
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
    fixture = TestBed.createComponent(App);
    await router.navigateByUrl('/');
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(topics.map(({ group, topic }) => [topicPath(group, topic), group, topic] as const))(
    'renders %s with its group in the rail and its group’s topics as tabs',
    async (path, group, topic) => {
      await router.navigateByUrl(path);
      await fixture.whenStable();

      expect(root().querySelector('nav a.active')?.textContent?.trim()).toBe(group.label);
      const tabs = Array.from(content().querySelectorAll('neat-page > nav a'));
      expect(tabs.map((tab) => [tab.textContent?.trim(), tab.getAttribute('href')])).toEqual(
        groupTabs(group).map((tab) => [tab.label, tab.path]),
      );
      expect(
        tabs.filter((tab) => tab.getAttribute('aria-current') === 'page').map((t) => t.textContent),
      ).toEqual([topic.label]);
      expect(content().querySelector('neat-page > nav')?.getAttribute('aria-label')).toBe(
        `${group.label} topics`,
      );
    },
  );

  it.each(generated.map(({ group, topic }) => [topicPath(group, topic), topic] as const))(
    'renders %s with its intros, examples and API panel',
    async (path, topic) => {
      await router.navigateByUrl(path);
      await fixture.whenStable();
      const examples = (await topic.load!()).examples;

      expect(
        Array.from(content().querySelectorAll('app-part-intro h2'), (h) => h.textContent?.trim()),
      ).toEqual(topic.parts.filter((name) => topic.leads.includes(name)));
      expect(
        Array.from(content().querySelectorAll('app-example-card h3'), (h) => h.textContent),
      ).toEqual(examples.map((example) => example.title));
      // Each part of the topic has its section in the panel, whether or not it is introduced.
      expect(
        Array.from(content().querySelectorAll('aside app-api-part'), (part) => part.id).sort(),
      ).toEqual(topic.parts.map((name) => `api-${name}`).sort());
    },
  );

  it.each(GROUPS)('has a rail item for the $label group', (group) => {
    const items = Array.from(root().querySelectorAll('nav a'), (a) => a.textContent?.trim());

    expect(items).toContain(group.label);
  });
});
