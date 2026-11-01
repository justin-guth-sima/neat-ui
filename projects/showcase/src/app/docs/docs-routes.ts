import type { Route, Routes } from '@angular/router';
import type { NeatNavItem } from '@sima/neat-ui';
import type { DocsTab, DocsTopic } from './docs-context';
import type { LoadTopic, TopicConfig, TopicGroup } from './topics';

/** Where a topic is routed: `/<group>/<topic>`. */
export const topicPath = (group: TopicGroup, topic: TopicConfig): string =>
  `/${group.id}/${topic.id}`;

/** The page tabs of a group's topics. */
export function groupTabs(group: TopicGroup): DocsTab[] {
  return group.topics.map((topic) => ({ label: topic.label, path: topicPath(group, topic) }));
}

/** The shell's rail items, one per group; each stays open on the group's topics. */
export function groupNavItems(groups: readonly TopicGroup[]): NeatNavItem[] {
  return groups.map((group) => ({ label: group.label, icon: group.icon, path: `/${group.id}` }));
}

/** The path of the topic that documents a part, for the links between topics. */
export function partTopicPath(groups: readonly TopicGroup[]): (name: string) => string | null {
  const paths = new Map(
    groups.flatMap((group) =>
      group.topics.flatMap((topic) =>
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
    parts: topic.parts,
    leads: topic.leads,
    entries,
    examples,
    ...(topic.fit ? { fit: true as const } : {}),
    ...(topic.fullPage ? { openBase: `/demo/${topic.id}` } : {}),
  };
}

/**
 * The routes of the docs: `/<group>` to its first topic, `/<group>/<topic>` for every topic, and
 * `/demo/<topic>/<example>` for the examples of a full-page topic, each its own route with the
 * example as the page (it sits in the shell like any page, and may declare the toolbar and tabs a
 * docs page keeps for itself).
 */
export function docsRoutes(groups: readonly TopicGroup[]): Routes {
  return groups.flatMap((group): Route[] => [
    { path: group.id, pathMatch: 'full', redirectTo: `${group.id}/${group.topics[0].id}` },
    ...group.topics.map((topic) => topicRoute(group, topic)),
    ...group.topics.flatMap((topic) =>
      topic.load && topic.fullPage ? [demoRoute(topic.id, topic.load)] : [],
    ),
  ]);
}

/** A topic's page: the docs page with the topic resolved, or the topic's own component. */
function topicRoute(group: TopicGroup, topic: TopicConfig): Route {
  const route = {
    path: `${group.id}/${topic.id}`,
    title: topic.label,
    // A page of either kind shows the group's topics as its page tabs.
    data: { tabs: groupTabs(group), tabsLabel: `${group.label} topics` },
  };
  if (topic.page) return { ...route, loadComponent: topic.page };
  return {
    ...route,
    loadComponent: () => import('./docs-page').then((m) => m.DocsPage),
    resolve: { topic: () => resolveTopic(topic) },
  };
}

/** The examples of a full-page topic, each routed at `/demo/<topic>/<example>`. */
function demoRoute(id: string, load: LoadTopic): Route {
  return {
    path: `demo/${id}`,
    loadChildren: async () =>
      (await load()).examples.flatMap((example): Route[] =>
        // One with no component is code only (the shell's), which a page of its own cannot show.
        example.component
          ? [{ path: example.id, title: example.title, component: example.component }]
          : [],
      ),
  };
}
