import type { Route, Routes } from '@angular/router';
import type { NeatNavItem } from '@sima/neat-ui';
import type { DocsSideList, DocsTopic } from './docs-context';
import type { LoadTopic, TopicCategory, TopicConfig, TopicGroup } from './topics';

/** A topic with the address it is routed at, and the category it is filed under, if any. */
export interface PlacedTopic {
  readonly topic: TopicConfig;
  /** `/<group>/<topic>`, or `/<group>/<category>/<topic>` for a topic filed under a category. */
  readonly path: string;
  readonly category?: TopicCategory;
}

/** Where a category is routed: `/<group>/<category>`, its rail child's path. */
const categoryPath = (group: TopicGroup, category: TopicCategory): string =>
  `/${group.id}/${category.id}`;

/** A group's topics in order, with their addresses; a group with categories files them there. */
export function placedTopics(group: TopicGroup): PlacedTopic[] {
  if (group.topics) {
    return group.topics.map((topic) => ({ topic, path: `/${group.id}/${topic.id}` }));
  }
  return group.categories.flatMap((category) =>
    category.topics.map((topic) => ({
      topic,
      path: `${categoryPath(group, category)}/${topic.id}`,
      category,
    })),
  );
}

/** Where a page example is routed: `/demo/<topic>/<example>`, a page of its own. */
export const demoPath = (topic: string, example: string): string => `/demo/${topic}/${example}`;

/**
 * The shell's rail items, one per group, with the group's sub-pages as the item's children: its
 * topics, or its categories, whose topics are then the side list of each category's pages.
 */
export function groupNavItems(groups: readonly TopicGroup[]): NeatNavItem[] {
  return groups.map((group) => ({
    label: group.label,
    icon: group.icon,
    path: `/${group.id}`,
    children: group.topics
      ? placedTopics(group).map(({ topic, path }) => ({ label: topic.label, path }))
      : group.categories.map((category) => ({
          label: category.label,
          path: categoryPath(group, category),
        })),
  }));
}

/** The path of the topic that documents a part, for the links between topics. */
export function partTopicPath(groups: readonly TopicGroup[]): (name: string) => string | null {
  const paths = new Map(
    groups.flatMap((group) =>
      placedTopics(group).flatMap(({ topic, path }) =>
        topic.parts.map((name) => [name, path] as const),
      ),
    ),
  );
  return (name) => paths.get(name) ?? null;
}

/** What a topic's route hands the docs page (`withComponentInputBinding` binds it to inputs). */
async function resolveTopic(topic: TopicConfig & { load: LoadTopic }): Promise<DocsTopic> {
  const { entries, examples } = await topic.load();
  return {
    id: topic.id,
    parts: topic.parts,
    leads: topic.leads,
    entries,
    examples,
    ...(topic.fit ? { fit: true as const } : {}),
  };
}

/**
 * The routes of the docs: `/<group>` to its first topic, `/<group>/<category>` to the category's
 * first topic, a page for every topic at its address (`placedTopics`), and
 * `/demo/<topic>/<example>` for each page example (`DocsExample.page`), its own route with the
 * example as the page (it sits in the shell like any page, and may declare the toolbar, side list
 * or shell a docs page keeps for itself).
 *
 * The group's and the categories' routes are where the rail's item and children go. An earlier
 * address (`/data/select-list`, `/components/select-list`) has no route: the app's catch-all
 * takes it, since the showcase keeps no redirects for addresses that changed.
 */
export function docsRoutes(groups: readonly TopicGroup[]): Routes {
  return groups.flatMap((group): Route[] => {
    const placed = placedTopics(group);
    const pages = group.topics
      ? placed.map((each) => topicRoute(each, null))
      : group.categories.flatMap((category) => categoryRoutes(group, category, placed));
    return [
      { path: group.id, pathMatch: 'full', redirectTo: placed[0].path },
      ...pages,
      ...placed.flatMap(({ topic }) => (topic.load ? [demoRoute(topic.id, topic.load)] : [])),
    ];
  });
}

/**
 * A category's route, to its first topic, and its topics' pages, each with the category's topics
 * as its side list, under no heading since the rail names the category.
 */
function categoryRoutes(
  group: TopicGroup,
  category: TopicCategory,
  placed: readonly PlacedTopic[],
): Route[] {
  const filed = placed.filter((each) => each.category === category);
  const list: DocsSideList = {
    label: `${category.label} topics`,
    groups: [{ items: filed.map(({ topic, path }) => ({ label: topic.label, path })) }],
  };
  return [
    {
      path: categoryPath(group, category).slice(1),
      pathMatch: 'full',
      redirectTo: filed[0].path,
    },
    ...filed.map((each) => topicRoute(each, list)),
  ];
}

/**
 * A topic's page: the docs page with the topic resolved and its side list, if any, or the topic's
 * own component, which takes no inputs.
 */
function topicRoute({ topic, path }: PlacedTopic, sideList: DocsSideList | null): Route {
  const route = { path: path.slice(1), title: topic.label };
  if (topic.page) return { ...route, loadComponent: topic.page };
  return {
    ...route,
    // Every input the page takes, since the router binds one the data leaves out to undefined.
    data: { sideList },
    loadComponent: () => import('./docs-page').then((m) => m.DocsPage),
    resolve: { topic: () => resolveTopic(topic) },
  };
}

/**
 * The page examples of a topic, each routed at `/demo/<topic>/<example>`. Which examples are pages
 * is known only once the topic's examples module is loaded, so every generated topic has this
 * lazy parent, and its children are its page examples alone.
 */
function demoRoute(id: string, load: LoadTopic): Route {
  return {
    path: `demo/${id}`,
    loadChildren: async () =>
      (await load()).examples.flatMap((example): Route[] =>
        example.page && example.component
          ? [
              {
                path: example.id,
                title: example.title,
                component: example.component,
                // The example's own sub-paths (a shell example's sub-pages) keep it rendered.
                children: [{ path: '**', children: [] }],
              },
            ]
          : [],
      ),
  };
}
