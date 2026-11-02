import type { Route, Routes } from '@angular/router';
import type { NeatNavItem } from '@sima/neat-ui';
import type { DocsTab, DocsTopic, DocsTopicList } from './docs-context';
import {
  type LoadTopic,
  type TopicCategory,
  type TopicConfig,
  type TopicGroup,
  topicsOf,
} from './topics';

/** Where a topic is routed: `/<group>/<topic>`. */
export const topicPath = (group: TopicGroup, topic: TopicConfig): string =>
  `/${group.id}/${topic.id}`;

/** Where a page example is routed: `/demo/<topic>/<example>`, a page of its own. */
export const demoPath = (topic: string, example: string): string => `/demo/${topic}/${example}`;

/** Topics of a group as links: its page tabs, or the rows of its topic list. */
function topicLinks(group: TopicGroup, topics: readonly TopicConfig[]): DocsTab[] {
  return topics.map((topic) => ({ label: topic.label, path: topicPath(group, topic) }));
}

/** The page tabs of a group's topics. */
export function groupTabs(
  group: TopicGroup & { readonly topics: readonly TopicConfig[] },
): DocsTab[] {
  return topicLinks(group, group.topics);
}

/** The topic list of a group with categories, which its pages show beside them. */
export function groupList(
  group: TopicGroup & { readonly categories: readonly TopicCategory[] },
): DocsTopicList {
  return {
    label: group.label,
    categories: group.categories.map((category) => ({
      label: category.label,
      topics: topicLinks(group, category.topics),
    })),
  };
}

/** The shell's rail items, one per group; each stays open on the group's topics. */
export function groupNavItems(groups: readonly TopicGroup[]): NeatNavItem[] {
  return groups.map((group) => ({ label: group.label, icon: group.icon, path: `/${group.id}` }));
}

/** The path of the topic that documents a part, for the links between topics. */
export function partTopicPath(groups: readonly TopicGroup[]): (name: string) => string | null {
  const paths = new Map(
    groups.flatMap((group) =>
      topicsOf(group).flatMap((topic) =>
        topic.parts.map((name) => [name, topicPath(group, topic)] as const),
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
 * The routes of the docs: `/<group>` to its first topic, `/<group>/<topic>` for every topic, and
 * `/demo/<topic>/<example>` for each page example (`DocsExample.page`), its own route with the
 * example as the page (it sits in the shell like any page, and may declare the toolbar, tabs or
 * shell a docs page keeps for itself).
 *
 * A group's pages get its topics as their tabs or, for a group with categories, as the topic list
 * beside them. A category's addresses from when it was a rail item of its own
 * (`/data/select-list`, `/charts`) redirect to its topics in the group, so old links still land.
 */
export function docsRoutes(groups: readonly TopicGroup[]): Routes {
  return groups.flatMap((group): Route[] => {
    const topics = topicsOf(group);
    // Every input the page takes, since the router binds one the data leaves out to undefined.
    const data = group.topics
      ? { tabs: groupTabs(group), tabsLabel: `${group.label} topics`, list: null }
      : { tabs: [], list: groupList(group) };
    return [
      { path: group.id, pathMatch: 'full', redirectTo: `${group.id}/${topics[0].id}` },
      ...topics.map((topic) => topicRoute(group, topic, data)),
      ...topics.flatMap((topic) => (topic.load ? [demoRoute(topic.id, topic.load)] : [])),
      ...(group.categories ?? []).flatMap((category) => categoryRedirects(group, category)),
    ];
  });
}

/**
 * A topic's page: the docs page with the topic resolved, or the topic's own component. Either kind
 * gets the group's topics from `data`, as its tabs or as its topic list.
 */
function topicRoute(group: TopicGroup, topic: TopicConfig, data: Route['data']): Route {
  const route = { path: `${group.id}/${topic.id}`, title: topic.label, data };
  if (topic.page) return { ...route, loadComponent: topic.page };
  return {
    ...route,
    loadComponent: () => import('./docs-page').then((m) => m.DocsPage),
    resolve: { topic: () => resolveTopic(topic) },
  };
}

/** A category's old addresses: its own, to its first topic, and each of its topics'. */
function categoryRedirects(group: TopicGroup, category: TopicCategory): Route[] {
  return [
    { path: category.id, pathMatch: 'full', redirectTo: topicPath(group, category.topics[0]) },
    ...category.topics.map((topic) => ({
      path: `${category.id}/${topic.id}`,
      redirectTo: topicPath(group, topic),
    })),
  ];
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
