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
  /** Its link's text, in the rail or in its category's side list, and the document's title. */
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
      readonly page?: never;
    }
  | {
      /**
       * The page's component, for a topic that is no part's docs (the theme's tokens). It is
       * routed as it is, with no inputs, so it belongs to a group's own `topics`: a category's
       * topic gets its side list from the docs page. It has no examples module, so the examples
       * rules of `docs.spec.ts` leave it out.
       */
      readonly page: () => Promise<Type<unknown>>;
      readonly load?: never;
      readonly fit?: never;
    }
);

/** A sub-page of a group with categories, and the topics its pages list in their side list. */
export interface TopicCategory {
  /** The route's second segment: `/components/data/select-list`. */
  readonly id: string;
  /** The rail child's text, and the side list's name ("Data topics"). */
  readonly label: string;
  /** In list order; the first is where the category's rail child goes. */
  readonly topics: readonly TopicConfig[];
}

/**
 * A rail item and the topics it opens, the kit's navigation applied to the docs: a few topics as
 * the item's sub-pages (`topics`), or categories as its sub-pages, each with its many topics in a
 * side list beside its pages (`categories`), as Components has. Why not a rail item per category:
 * seven of them read as seven areas of an app when they are only filing.
 */
export type TopicGroup = {
  /** The route's first segment. */
  readonly id: string;
  /** The rail item's label, which the top bar shows beside the open sub-page's. */
  readonly label: string;
  readonly icon: NeatIconName;
} & (
  | {
      /** In rail order; the first is where the rail item goes. */
      readonly topics: readonly TopicConfig[];
      readonly categories?: never;
    }
  | {
      /** In rail order; the first category's first topic is where the rail item goes. */
      readonly categories: readonly TopicCategory[];
      readonly topics?: never;
    }
);

/**
 * The docs by kind, in rail order (after Getting started, which is no group). Every public export
 * of the kit is a part of exactly one topic (`docs.spec.ts`).
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
        parts: ['NeatIcon', 'NeatIconName', 'NeatIconGlyph', 'NEAT_ICON_NAMES', 'lucide'],
        leads: ['NeatIcon'],
        load: async () => {
          const [api, lucide, examples] = await Promise.all([
            import('./generated/api/primary'),
            import('./generated/api/lucide'),
            import('./generated/examples/icons'),
          ]);
          return { entries: [api.API, lucide.API], examples: examples.EXAMPLES };
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
          'NeatNavChild',
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
        parts: [
          'NeatPage',
          'NeatPageNav',
          'NeatPageNavGroup',
          'NeatPageNavLink',
          'NeatPageToolbar',
          'NeatViewport',
        ],
        leads: ['NeatPage'],
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
    id: 'components',
    label: 'Components',
    icon: 'shapes',
    categories: [
      {
        id: 'actions',
        label: 'Actions',
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
        id: 'forms',
        label: 'Forms',
        topics: [
          {
            id: 'input',
            label: 'Input',
            parts: ['NeatInput', 'NeatInputSize'],
            leads: ['NeatInput'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/input'),
                import('./generated/examples/input'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'number-field',
            label: 'Number field',
            parts: ['NeatNumberField'],
            leads: ['NeatNumberField'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/number-field'),
                import('./generated/examples/number-field'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'field',
            label: 'Field',
            parts: ['NeatField', 'NeatErrorNote'],
            leads: ['NeatField'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/field'),
                import('./generated/examples/field'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'select',
            label: 'Select',
            parts: ['NeatSelect', 'NeatSelectOption', 'NeatSelectSize', 'NeatSelectLabelPosition'],
            leads: ['NeatSelect'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/select'),
                import('./generated/examples/select'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'switch',
            label: 'Switch',
            parts: ['NeatSwitch'],
            leads: ['NeatSwitch'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/switch'),
                import('./generated/examples/switch'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'slider',
            label: 'Slider',
            parts: ['NeatSlider'],
            leads: ['NeatSlider'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/slider'),
                import('./generated/examples/slider'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'segmented',
            label: 'Segmented',
            parts: ['NeatSegmented', 'NeatSegmentedOption'],
            leads: ['NeatSegmented'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/segmented'),
                import('./generated/examples/segmented'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'tabs',
            label: 'Tabs',
            parts: ['NeatTabs', 'NeatTab'],
            leads: ['NeatTabs'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/tabs'),
                import('./generated/examples/tabs'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'drop-zone',
            label: 'Drop zone',
            parts: ['NeatDropZone'],
            leads: ['NeatDropZone'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/drop-zone'),
                import('./generated/examples/drop-zone'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
        ],
      },
      {
        id: 'status',
        label: 'Status',
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
          {
            id: 'callout',
            label: 'Callout',
            parts: ['NeatCallout'],
            leads: ['NeatCallout'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/callout'),
                import('./generated/examples/callout'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'note',
            label: 'Note',
            parts: ['NeatNote'],
            leads: ['NeatNote'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/primary'),
                import('./generated/examples/note'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'live-dot',
            label: 'Live dot',
            parts: ['NeatLiveDot'],
            leads: ['NeatLiveDot'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/primary'),
                import('./generated/examples/live-dot'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'stale',
            label: 'Stale',
            parts: ['NeatStale'],
            leads: ['NeatStale'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/primary'),
                import('./generated/examples/stale'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'progress',
            label: 'Progress',
            parts: ['NeatProgress'],
            leads: ['NeatProgress'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/progress'),
                import('./generated/examples/progress'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'level-meter',
            label: 'Level meter',
            parts: ['NeatLevelMeter'],
            leads: ['NeatLevelMeter'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/level-meter'),
                import('./generated/examples/level-meter'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'motion',
            label: 'Motion',
            parts: ['neatEased', 'NeatEasedNumber', 'NEAT_EASINGS', 'NeatEasing', 'NeatEasingName'],
            leads: ['neatEased', 'NeatEasedNumber'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/primary'),
                import('./generated/examples/motion'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'time',
            label: 'Time',
            parts: ['neatSecondsAgo'],
            leads: ['neatSecondsAgo'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/primary'),
                import('./generated/examples/time'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
        ],
      },
      {
        id: 'data',
        label: 'Data',
        topics: [
          {
            id: 'table',
            label: 'Table',
            parts: ['NeatTable', 'NeatNumeric', 'NeatFigure'],
            leads: ['NeatTable'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/table'),
                import('./generated/examples/table'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'details',
            label: 'Details',
            parts: ['NeatDetails'],
            leads: ['NeatDetails'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/details'),
                import('./generated/examples/details'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'line-list',
            label: 'Line list',
            parts: ['NeatLineList', 'NeatLine', 'NeatLineEnd'],
            leads: ['NeatLineList'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/line-list'),
                import('./generated/examples/line-list'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'select-list',
            label: 'Select list',
            parts: ['NeatSelectList', 'NeatColumn', 'NeatSelectListGroup', 'NeatActivateOn'],
            leads: ['NeatSelectList'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/select-list'),
                import('./generated/examples/select-list'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'file-browser',
            label: 'File browser',
            parts: [
              'NeatFileBrowser',
              'NeatFileNode',
              'NeatFileBrowserMode',
              'NeatFileBrowserLabels',
            ],
            leads: ['NeatFileBrowser'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/file-browser'),
                import('./generated/examples/file-browser'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'collapsible',
            label: 'Collapsible',
            parts: ['NeatCollapsible'],
            leads: ['NeatCollapsible'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/collapsible'),
                import('./generated/examples/collapsible'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'card',
            label: 'Card',
            parts: ['NeatCard'],
            leads: ['NeatCard'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/card'),
                import('./generated/examples/card'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'stored-signal',
            label: 'Stored signal',
            parts: ['neatStoredSignal'],
            leads: ['neatStoredSignal'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/primary'),
                import('./generated/examples/stored-signal'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
        ],
      },
      {
        id: 'charts',
        label: 'Charts',
        topics: [
          {
            id: 'sparkline',
            label: 'Sparkline',
            parts: ['NeatSparkline'],
            leads: ['NeatSparkline'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/charts'),
                import('./generated/examples/sparkline'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
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
              'NeatSamplePick',
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
          {
            id: 'stacked-chart',
            label: 'Stacked chart',
            parts: ['NeatStackedChart'],
            leads: ['NeatStackedChart'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/charts'),
                import('./generated/examples/stacked-chart'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'heatmap',
            label: 'Heatmap',
            parts: ['NeatHeatmap', 'NeatHeatmapRow', 'NeatHeatmapCell', 'NeatHeatmapPick'],
            leads: ['NeatHeatmap'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/charts'),
                import('./generated/examples/heatmap'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'score-bars',
            label: 'Score bars',
            parts: ['NeatScoreBars', 'NeatScore', 'neatLabelColour'],
            leads: ['NeatScoreBars'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/charts'),
                import('./generated/examples/score-bars'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'label-timeline',
            label: 'Label timeline',
            parts: ['NeatLabelTimeline', 'NeatLabelRun', 'NeatTimelineMotion', 'NeatRunPick'],
            leads: ['NeatLabelTimeline'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/charts'),
                import('./generated/examples/label-timeline'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'chart-card',
            label: 'Chart card',
            parts: ['NeatChartCard'],
            leads: ['NeatChartCard'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/charts'),
                import('./generated/examples/chart-card'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'series-swatch',
            label: 'Swatch',
            parts: ['NeatSwatch', 'NeatSeriesSwatch'],
            leads: ['NeatSwatch', 'NeatSeriesSwatch'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/primary'),
                import('./generated/examples/series-swatch'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'bev',
            label: "Bird's-eye view",
            parts: [
              'NeatBev',
              'NeatBevFrame',
              'NeatBevObject',
              'NeatBevPoints',
              'NeatBevLine',
              'NeatBevGrid',
              'NeatBevLayer',
              'NeatBevSpoke',
              'NeatBevShape',
              'NeatBevBounds',
              'NeatBevOverflow',
              'NeatBevGuides',
              'NeatBevObjectId',
              'NeatBevPick',
              'NeatBevPoint',
            ],
            leads: ['NeatBev'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/bev'),
                import('./generated/examples/bev'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
        ],
      },
      {
        id: 'diagram',
        label: 'Diagram',
        topics: [
          {
            id: 'diagram',
            label: 'Diagram',
            parts: [
              'NeatDiagramView',
              'NeatDiagramBlockTemplate',
              'NeatDiagramNoteTemplate',
              'NeatDiagramEdgeTipTemplate',
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
              'NeatDiagramHighlight',
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
          {
            id: 'messaging',
            label: 'Messaging',
            parts: [
              'NeatDiagramMessages',
              'NeatDiagramRateCard',
              'NeatDiagramAnimationSettings',
              'NeatDiagramMessageSettings',
              'NeatDiagramMessageStep',
              'NeatDiagramEdgeRate',
              'NEAT_DIAGRAM_MESSAGE_DEFAULTS',
              'neatParseMessageSettings',
              'neatBatchTimes',
            ],
            leads: ['NeatDiagramMessages', 'NeatDiagramRateCard'],
            fit: true,
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/diagram'),
                import('./generated/examples/messaging'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'legend',
            label: 'Legend',
            parts: ['NeatDiagramLegend', 'NeatDiagramLegendItem'],
            leads: ['NeatDiagramLegend'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/diagram'),
                import('./generated/examples/legend'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'drill-down',
            label: 'Drill-down',
            parts: ['neatDrillDownLevel'],
            leads: ['neatDrillDownLevel'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/diagram'),
                import('./generated/examples/drill-down'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
        ],
      },
      {
        id: 'video',
        label: 'Video',
        topics: [
          {
            id: 'video-tile',
            label: 'Video tile',
            parts: [
              'NeatVideoTile',
              'NeatVideoBox',
              'NeatTileFrame',
              'NeatTileFrameListener',
              'NeatTileSource',
              'NeatTileState',
              'NeatFrameStats',
              'NeatOverlaySettings',
              'NeatOverlayClassStyle',
              'NeatOverlayLineStyle',
              'NEAT_OVERLAY_DEFAULTS',
              'NEAT_OVERLAY_STYLE_FALLBACK_COLOR',
            ],
            leads: ['NeatVideoTile'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/video'),
                import('./generated/examples/video-tile'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'tile-grid',
            label: 'Tile grid',
            parts: [
              'NeatTileGrid',
              'NeatTileLayout',
              'NeatTilePack',
              'NeatTileArea',
              'NEAT_MIN_TILE_WIDTH',
              'fitAllTileWidth',
            ],
            leads: ['NeatTileGrid'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/video'),
                import('./generated/examples/tile-grid'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'roi-editor',
            label: 'ROI editor',
            parts: [
              'NeatRoiEditor',
              'NeatRoiSwatch',
              'NeatRoiPolygon',
              'NeatRoiDrawMode',
              'neatRoiNames',
            ],
            leads: ['NeatRoiEditor'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/video'),
                import('./generated/examples/roi-editor'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
          {
            id: 'metadata-sync',
            label: 'Metadata sync',
            parts: [
              'lateNoticeDetails',
              'nextWarningActive',
              'bufferSettleMs',
              'NeatMetadataMessage',
              'NeatMetadataSnapshot',
              'NeatMetadataQueueStats',
              'NeatLatenessSnapshot',
              'NeatLateNoticeDetails',
              'NeatLateNoticeBlocker',
              'NeatGlobalBufferAction',
            ],
            leads: ['lateNoticeDetails'],
            load: async () => {
              const [api, examples] = await Promise.all([
                import('./generated/api/video'),
                import('./generated/examples/metadata-sync'),
              ]);
              return { entries: [api.API], examples: examples.EXAMPLES };
            },
          },
        ],
      },
    ],
  },
];
