import type { Type } from '@angular/core';
import type { NeatIconName } from '@sima/neat-ui';
import type { DocsEntry, DocsExample } from './model';

/** What a topic generated from the kit loads: its API modules and its examples module. */
export type LoadTopic = () => Promise<{
  readonly entries: readonly DocsEntry[];
  readonly examples: readonly DocsExample[];
}>;

/**
 * One page of the docs, and what it is made of: either generated from the kit (`load`: the parts
 * it documents, its examples) or a hand-made page of the showcase's own (`page`), never both. The
 * data of a generated page is loaded when the page is opened, so the main bundle carries none of
 * it; a hand-made page is a lazy component.
 */
export type TopicConfig = {
  /** The route's last segment, and the name of the topic's folder under `examples/`. */
  readonly id: string;
  /** The page tab's text, and the document's title. */
  readonly label: string;
  /** Export names in the order the topic reads, each in exactly one topic; none for a `page`. */
  readonly parts: readonly string[];
  /** The main parts, which the body introduces and the panel lists first; none for a `page`. */
  readonly leads: readonly string[];
} & (
  | {
      /** The generated API modules of the entries that declare the parts, and the examples. */
      readonly load: LoadTopic;
      /** The top bar's Fit button, for examples that have a `fit()` (`DocsTopic.fit`). */
      readonly fit?: true;
      /**
       * The examples need a whole page: each is routed at `/demo/<id>/<example>`
       * (`DocsTopic.openBase`).
       */
      readonly fullPage?: true;
      readonly page?: never;
    }
  | {
      /**
       * The page's component, for a topic that is no part's docs (the theme's tokens). It is
       * routed with the group's tabs as its `tabs` and `tabsLabel` inputs, as a docs page is, and
       * has no examples module, so the examples rules of `docs.spec.ts` leave it out.
       */
      readonly page: () => Promise<Type<unknown>>;
      readonly load?: never;
      readonly fit?: never;
      readonly fullPage?: never;
    }
);

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
    id: 'theme',
    label: 'Theme',
    icon: 'palette',
    topics: [
      {
        id: 'tokens',
        label: 'Tokens',
        parts: [],
        leads: [],
        page: () => import('../pages/theme.page').then((m) => m.ThemePage),
      },
      {
        id: 'colours',
        label: 'Colours',
        parts: [
          'ThemeService',
          'provideNeatUi',
          'NeatColorScheme',
          'neatThemeColors',
          'neatResolveColor',
          'buildColorScale',
          'buildSurfaceScale',
          'buildNeutralSurfaceScale',
          'contrastRatio',
          'ColorScale',
          'ColorStep',
          'SurfaceScale',
          'NeatRgb',
          'NeatTone',
          'SIMA_PALETTE',
          'NEAT_PRIMARY_BASE',
          'NEAT_DANGER_BASE',
          'NEAT_HIGHLIGHT_BASE',
          'NEAT_WARN_BASE',
          'NEAT_SERIES_TEAL_BASE',
          'NEAT_NEAR_BLACK',
        ],
        leads: ['ThemeService', 'provideNeatUi'],
        load: async () => {
          const [api, examples] = await Promise.all([
            import('./generated/api/primary'),
            import('./generated/examples/colours'),
          ]);
          return { entries: [api.API], examples: examples.EXAMPLES };
        },
      },
      {
        id: 'icons',
        label: 'Icons',
        parts: ['NeatIcon', 'NeatIconName', 'NEAT_ICON_NAMES'],
        leads: ['NeatIcon'],
        load: async () => {
          const [api, examples] = await Promise.all([
            import('./generated/api/primary'),
            import('./generated/examples/icons'),
          ]);
          return { entries: [api.API], examples: examples.EXAMPLES };
        },
      },
    ],
  },
  {
    id: 'layout',
    label: 'Layout',
    icon: 'document',
    topics: [
      {
        id: 'shell',
        label: 'Shell',
        parts: [
          'NeatShell',
          'NeatRailItem',
          'NeatRailDivider',
          'NeatNavItem',
          'provideNeatTitles',
          'KioskService',
          'KIOSK_POINTER_IDLE_MS',
        ],
        leads: ['NeatShell', 'NeatRailItem'],
        load: async () => {
          const [api, examples] = await Promise.all([
            import('./generated/api/primary'),
            import('./generated/examples/shell'),
          ]);
          return { entries: [api.API], examples: examples.EXAMPLES };
        },
      },
      {
        id: 'page',
        label: 'Page',
        parts: ['NeatPage', 'NeatPageToolbar', 'NeatPageTabs', 'NeatPageTab', 'NeatViewport'],
        leads: ['NeatPage'],
        fullPage: true,
        load: async () => {
          const [api, examples] = await Promise.all([
            import('./generated/api/primary'),
            import('./generated/examples/page'),
          ]);
          return { entries: [api.API], examples: examples.EXAMPLES };
        },
      },
      {
        id: 'side-panel',
        label: 'Side panel',
        parts: [
          'NeatAsidePanel',
          'NeatAsideHeading',
          'NeatAsideTitle',
          'NeatAsideActions',
          'NeatAsideToggle',
          'NeatAsideOpen',
          'neatAsideOpen',
          'NeatCode',
        ],
        leads: ['NeatAsidePanel'],
        fullPage: true,
        load: async () => {
          const [api, examples] = await Promise.all([
            import('./generated/api/primary'),
            import('./generated/examples/side-panel'),
          ]);
          return { entries: [api.API], examples: examples.EXAMPLES };
        },
      },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    icon: 'shapes',
    topics: [
      {
        id: 'button',
        label: 'Button',
        parts: ['NeatButton', 'NeatButtonVariant', 'NeatButtonSize'],
        leads: ['NeatButton'],
        load: async () => {
          const [api, examples] = await Promise.all([
            import('./generated/api/primary'),
            import('./generated/examples/button'),
          ]);
          return { entries: [api.API], examples: examples.EXAMPLES };
        },
      },
      {
        id: 'inline-button',
        label: 'Inline button',
        parts: ['NeatInlineButton'],
        leads: ['NeatInlineButton'],
        load: async () => {
          const [api, examples] = await Promise.all([
            import('./generated/api/primary'),
            import('./generated/examples/inline-button'),
          ]);
          return { entries: [api.API], examples: examples.EXAMPLES };
        },
      },
      {
        id: 'breadcrumbs',
        label: 'Breadcrumbs',
        parts: ['NeatBreadcrumbs', 'NeatBreadcrumb'],
        leads: ['NeatBreadcrumbs'],
        load: async () => {
          const [api, examples] = await Promise.all([
            import('./generated/api/primary'),
            import('./generated/examples/breadcrumbs'),
          ]);
          return { entries: [api.API], examples: examples.EXAMPLES };
        },
      },
      {
        id: 'tooltip',
        label: 'Tooltip',
        parts: ['NeatTooltip', 'NeatTooltipPosition'],
        leads: ['NeatTooltip'],
        load: async () => {
          const [api, examples] = await Promise.all([
            import('./generated/api/primary'),
            import('./generated/examples/tooltip'),
          ]);
          return { entries: [api.API], examples: examples.EXAMPLES };
        },
      },
      {
        id: 'popover',
        label: 'Popover',
        parts: [
          'NeatPopover',
          'NeatPopoverTrigger',
          'NeatPopoverContent',
          'NeatPopoverItem',
          'NeatPopoverDivider',
          'NeatPopoverAlign',
        ],
        leads: ['NeatPopover', 'NeatPopoverTrigger'],
        load: async () => {
          const [api, examples] = await Promise.all([
            import('./generated/api/popover'),
            import('./generated/examples/popover'),
          ]);
          return { entries: [api.API], examples: examples.EXAMPLES };
        },
      },
      {
        id: 'confirm',
        label: 'Confirm',
        parts: ['NeatConfirm', 'NeatConfirmOptions'],
        leads: ['NeatConfirm'],
        load: async () => {
          const [api, examples] = await Promise.all([
            import('./generated/api/confirm'),
            import('./generated/examples/confirm'),
          ]);
          return { entries: [api.API], examples: examples.EXAMPLES };
        },
      },
      {
        id: 'dialog',
        label: 'Dialog',
        parts: [
          'NeatDialog',
          'NeatDialogBody',
          'NeatDialogActions',
          'NeatDialogRef',
          'NeatDialogOptions',
          'NeatDialogComponentOptions',
          'NeatDialogInputs',
          'NeatDialogSize',
        ],
        leads: ['NeatDialog'],
        load: async () => {
          const [api, examples] = await Promise.all([
            import('./generated/api/dialog'),
            import('./generated/examples/dialog'),
          ]);
          return { entries: [api.API], examples: examples.EXAMPLES };
        },
      },
      {
        id: 'toast',
        label: 'Toast',
        parts: ['NeatToasts', 'NeatToastHost', 'NeatProgressToast'],
        leads: ['NeatToasts', 'NeatToastHost'],
        load: async () => {
          const [api, examples] = await Promise.all([
            import('./generated/api/toast'),
            import('./generated/examples/toast'),
          ]);
          return { entries: [api.API], examples: examples.EXAMPLES };
        },
      },
    ],
  },
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
