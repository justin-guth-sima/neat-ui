import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import type { NeatIconName } from '@sima/neat-ui';
import type { NeatSearchGroup, NeatSearchItem } from '@sima/neat-ui/search-palette';
import type { DocsSearchEntry } from '../docs/model';
import { partTopicPath, placedTopics } from '../docs/docs-routes';
import { GROUPS, type TopicGroup } from '../docs/topics';
import { type Haystack, haystack, rank, wordsOf } from './match';

/** One result of the docs' search: what the palette shows, and the sentence the page adds. */
export interface DocsHit {
  readonly item: NeatSearchItem;
  /** The first sentence of its doc or caption; empty for a topic. */
  readonly text: string;
}

/** The results of one kind, in the order the groups are shown. */
export interface DocsHitGroup {
  readonly label: string;
  readonly hits: readonly DocsHit[];
}

interface Candidate extends DocsHit {
  readonly hay: Haystack;
}

const GROUP_LABELS = { topics: 'Topics', api: 'API', members: 'Members', examples: 'Examples' };
type GroupKey = keyof typeof GROUP_LABELS;

const ICONS: Readonly<Record<GroupKey, NeatIconName>> = {
  topics: 'document',
  api: 'blocks',
  members: 'next',
  examples: 'shapes',
};

/** The showcase's own guide, beside the topics. */
export const GUIDES: readonly { label: string; path: string }[] = [
  { label: 'Getting started', path: '/getting-started' },
];

/**
 * The topics, by their name and where they are filed, and the guides; what the search finds before
 * the index has loaded.
 */
export function topicCandidates(groups: readonly TopicGroup[]): Candidate[] {
  const topics = groups.flatMap((group) =>
    placedTopics(group).map(({ topic, path, category }) => {
      const detail = category ? `${group.label} › ${category.label}` : group.label;
      return candidate('topics', topic.id, topic.label, detail, path, '', wordsOf(detail));
    }),
  );
  const guides = GUIDES.map((guide) =>
    candidate('topics', guide.path, guide.label, 'Guide', guide.path, '', []),
  );
  return [...guides, ...topics];
}

/**
 * The index's parts, members and examples, each placed on the page of the topic that documents
 * it: a part and its members at `#api-<Name>`, an example at `#example-<id>`. One no topic places
 * is left out (docs.spec fails a public part in no topic).
 */
export function indexCandidates(
  index: readonly DocsSearchEntry[],
  groups: readonly TopicGroup[],
): Record<'api' | 'members' | 'examples', Candidate[]> {
  const partPath = partTopicPath(groups);
  const placed = groups.flatMap((group) => placedTopics(group));
  const topics = new Map(placed.map((topic) => [topic.topic.id, topic]));
  const labels = new Map(placed.map((topic) => [topic.path, topic.topic.label]));
  const labelOf = (path: string) => labels.get(path) ?? '';
  const out = { api: [] as Candidate[], members: [] as Candidate[], examples: [] as Candidate[] };
  for (const entry of index) {
    if (entry.kind === 'example') {
      const placed = topics.get(entry.topic);
      if (!placed) continue;
      out.examples.push(
        candidate(
          'examples',
          `${entry.topic}/${entry.id}`,
          entry.name,
          placed.topic.label,
          `${placed.path}#example-${entry.id}`,
          entry.text,
          wordsOf(`${placed.topic.label} ${entry.text}`),
        ),
      );
      continue;
    }
    const part = entry.kind === 'part' ? entry.name : entry.part;
    const path = partPath(part);
    if (!path) continue;
    if (entry.kind === 'part') {
      out.api.push(
        candidate(
          'api',
          part,
          part,
          `${entry.partKind} · ${labelOf(path)}`,
          `${path}#api-${part}`,
          entry.text,
          wordsOf(entry.text),
        ),
      );
    } else {
      const label = `${part}.${entry.name}`;
      out.members.push(
        candidate(
          'members',
          label,
          label,
          labelOf(path),
          `${path}#api-${part}`,
          entry.text,
          wordsOf(entry.text),
        ),
      );
    }
  }
  return out;
}

function candidate(
  group: GroupKey,
  id: string,
  label: string,
  detail: string,
  path: string,
  text: string,
  other: readonly string[],
): Candidate {
  return {
    item: { id: `${group}:${id}`, label, detail, icon: ICONS[group], path },
    text,
    hay: haystack(label, [], other),
  };
}

/** The topics the docs' search places its results by: the app's, or a spec's own. */
export const SEARCH_GROUPS = new InjectionToken<readonly TopicGroup[]>('showcase search groups', {
  factory: () => GROUPS,
});

/**
 * The docs' search: topics and guides at once, and the kit's parts, their members and the examples
 * once the index (`docs:emit`'s, about 150 kB) has loaded, which the first search starts.
 */
@Injectable({ providedIn: 'root' })
export class DocsSearch {
  private readonly groups = inject(SEARCH_GROUPS);
  private readonly topics = topicCandidates(this.groups);
  private readonly index = signal<ReturnType<typeof indexCandidates> | null>(null);
  private loading: Promise<void> | null = null;

  /** Loads the index once; later calls wait for the same load. */
  load(): Promise<void> {
    this.loading ??= import('../docs/generated/search-index').then(({ SEARCH_INDEX }) =>
      this.index.set(indexCandidates(SEARCH_INDEX, this.groups)),
    );
    return this.loading;
  }

  /** Every match of `query`, in groups, best first; none for an empty query. */
  hits(query: string): readonly DocsHitGroup[] {
    if (!query.trim()) return [];
    void this.load();
    const index = this.index();
    const lists: Record<GroupKey, readonly Candidate[]> = {
      topics: this.topics,
      api: index?.api ?? [],
      members: index?.members ?? [],
      examples: index?.examples ?? [],
    };
    return (Object.keys(GROUP_LABELS) as GroupKey[])
      .map((key) => ({
        label: GROUP_LABELS[key],
        hits: rank(lists[key], query, (candidate) => candidate.hay),
      }))
      .filter((group) => group.hits.length);
  }

  /** The palette's `search`: the same matches, as its groups. */
  readonly palette = (query: string): readonly NeatSearchGroup[] =>
    this.hits(query).map((group) => ({
      label: group.label,
      items: group.hits.map((hit) => hit.item),
    }));
}
