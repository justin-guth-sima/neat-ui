import type { NeatIconName } from '@sima/neat-ui';
import type { DocsEntry, DocsExample } from './model';

/**
 * One page of the docs: the parts it documents and where its generated data comes from. The data
 * is loaded when the page is opened, so the main bundle carries none of it.
 */
export interface TopicConfig {
  /** The route's last segment, and the name of the topic's folder under `examples/`. */
  readonly id: string;
  /** The page tab's text, and the document's title. */
  readonly label: string;
  /** Export names in the order the topic reads, each in exactly one topic. */
  readonly parts: readonly string[];
  /** The main parts, which the body introduces and the panel lists first. */
  readonly leads: readonly string[];
  /** The top bar's Fit button, for examples that have a `fit()` (`DocsTopic.fit`). */
  readonly fit?: true;
  /** The examples need a whole page: each is routed at `/demo/<id>/<example>` (`DocsTopic.openBase`). */
  readonly fullPage?: true;
  /** The generated API modules of the entries that declare the parts, and the examples module. */
  readonly load: () => Promise<{
    readonly entries: readonly DocsEntry[];
    readonly examples: readonly DocsExample[];
  }>;
}

/** A rail item and the topics it opens, which its pages show as tabs. */
export interface TopicGroup {
  /** The route's first segment. */
  readonly id: string;
  /** The rail item's label, and the title in the top bar. */
  readonly label: string;
  readonly icon: NeatIconName;
  /** In tab order; the first is where the rail item goes. */
  readonly topics: readonly TopicConfig[];
}

/**
 * The docs by kind, in rail order. Only the topics that are migrated yet: the rest of the kit is on
 * the old pages, whose parts no topic documents until they move (`docs.spec.ts`).
 */
export const GROUPS: readonly TopicGroup[] = [
  {
    id: 'status',
    label: 'Status',
    icon: 'info',
    topics: [
      {
        id: 'status-chip',
        label: 'Status chip',
        parts: ['NeatStatusChip', 'NeatStatusChipButton', 'NeatStatusChipVariant'],
        leads: ['NeatStatusChip', 'NeatStatusChipButton'],
        load: async () => {
          const [api, examples] = await Promise.all([
            import('./generated/api/status-chip'),
            import('./generated/examples/status-chip'),
          ]);
          return { entries: [api.API], examples: examples.EXAMPLES };
        },
      },
    ],
  },
  {
    id: 'charts',
    label: 'Charts',
    icon: 'stats',
    topics: [
      {
        id: 'time-chart',
        label: 'Time chart',
        parts: [
          'NeatTimeChart',
          'NeatSeries',
          'NeatThreshold',
          'NeatReference',
          'NeatChartFormat',
          'NeatChartAxis',
          'NeatChartTone',
        ],
        leads: ['NeatTimeChart'],
        load: async () => {
          const [api, examples] = await Promise.all([
            import('./generated/api/charts'),
            import('./generated/examples/time-chart'),
          ]);
          return { entries: [api.API], examples: examples.EXAMPLES };
        },
      },
    ],
  },
  {
    id: 'diagram',
    label: 'Diagram',
    icon: 'device',
    topics: [
      {
        id: 'diagram',
        label: 'Diagram',
        // The legend is the diagram's until it has a tab of its own.
        parts: [
          'NeatDiagramView',
          'NeatDiagramBlockTemplate',
          'NeatDiagramNoteTemplate',
          'NeatDiagramEdgeTipTemplate',
          'NeatDiagramLegend',
          'NeatDiagramLegendItem',
          'NeatDiagramSet',
          'NeatDiagram',
          'NeatDiagramNode',
          'NeatDiagramEdge',
          'NeatDiagramNote',
          'NeatDiagramChip',
          'NeatDiagramRole',
          'NeatDiagramSide',
          'NeatDiagramLine',
          'NeatDiagramLook',
          'NeatDiagramTip',
        ],
        leads: ['NeatDiagramView'],
        fit: true,
        load: async () => {
          const [api, examples] = await Promise.all([
            import('./generated/api/diagram'),
            import('./generated/examples/diagram'),
          ]);
          return { entries: [api.API], examples: examples.EXAMPLES };
        },
      },
    ],
  },
];
