# Glossary

The kit's name for each thing you see, what it is, and where the code names it. Use these names in
the docs, the showcase, doc comments and commit messages, and in conversations about the kit, so
that what you read is what you type.

The last column, "Others say", lists words people use for the same thing. They are not wrong in a
conversation, but the docs and the code don't use them.

**Use the glossary's name. Add a new term here before you use it.** Why: one name per thing lets a
reader, or an agent, find every place that talks about it, and a second name makes it look like a
second thing. Where the wider UI world has an established name (card, dialog, tooltip), that name
wins over a name of our own.

## The kit and its docs

| Name         | What it is                                                               | In the code             | Others say             |
| ------------ | ------------------------------------------------------------------------ | ----------------------- | ---------------------- |
| the kit      | `@sima/neat-ui`: the shared look and components of Neat apps             | `projects/neat-ui`      | the library, neat-ui   |
| app          | a Neat application built on the kit (Neat Insight, a demo)               |                         | application, consumer  |
| entry point  | one importable part of the kit: the primary or a secondary one           | `@sima/neat-ui/<name>`  | sub-package, module    |
| the showcase | the kit's docs app: each topic's examples, live, with their code and API | `projects/showcase`     | the demo, the docs app |
| topic        | one page of the showcase: a component and its parts                      | `docs/topics.ts`        |                        |
| example      | a live, copyable use of a part on a topic's page                         | `*.example.ts`          | demo, sample           |
| token        | a named theme value (a color, a space, a size)                           | `--primary`, `--neat-*` | variable (in prose)    |

## The shell and the page

| Name         | What it is                                                                                           | In the code                         | Others say                             |
| ------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------- |
| shell        | the app's frame: the rail, the top bar and the page's area                                           | `neat-shell`, `NeatShell`           | layout, frame                          |
| rail         | the column of the app's pages at the start of the shell, with the app's items below                  | `navItems`, `neatRailItem`          | sidebar, side nav                      |
| rail item    | one entry of the rail: a page, or one of the app's own items (a board)                               | `NeatRailItem`, `[neatRailItem]`    | nav item, menu item                    |
| sub-page     | a page's own views, unfolded under its rail item                                                     | `children` (`NeatNavChild`)         | child page, tab                        |
| rail divider | the line between groups of the app's rail items                                                      | `NeatRailDivider`                   | separator                              |
| top bar      | the bar across the top of the shell: logo, app name, page title, then the tools                      | `topbar` (`neatTopbarEnd`)          | header, app bar                        |
| page toolbar | the page's own tools, at the right end of the top bar                                                | `*neatPageToolbar`                  | actions, top bar (for the tools alone) |
| kiosk mode   | the page alone, full screen, its tools floating                                                      | `KioskService`                      | full screen                            |
| page         | what a route shows in the shell                                                                      | `neat-page`, `NeatPage`             | view, screen                           |
| page nav     | a page's list of links, beside its body (or above it on a phone)                                     | `nav[neatPageNav]`, `NeatPageNav`   | side list, sidebar                     |
| aside        | the column on a page's right, for an inspector or details; its toggle's visible name is "Side panel" | `[neatPageAside]`, `NeatAsidePanel` | side panel, drawer, inspector          |
| aside toggle | the button at the top bar's right edge that opens and closes the aside                               | `neat-aside-toggle`                 | panel button                           |

## Components

| Name              | What it is                                                                        | In the code                                | Others say                             |
| ----------------- | --------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| button            | an action; seven variants                                                         | `NeatButton`, `[neatButton]`               |                                        |
| inline button     | a button inside running text                                                      | `NeatInlineButton`                         | link button                            |
| card              | a raised surface with an optional title, actions and footer                       | `neat-card`, `NeatCard`                    | panel, tile, box                       |
| chart card        | the card for one metric: heading, chip, value, caption, chart                     | `NeatChartCard`                            | metric tile                            |
| callout           | a notice on a status tint, with an icon, a heading and actions                    | `neat-callout`, `NeatCallout`              | banner, alert, info box                |
| note              | a short muted remark under a control or a heading                                 | `[neatNote]`, `NeatNote`                   | hint, help text                        |
| error note        | a failure said in place                                                           | `NeatErrorNote`                            | error message                          |
| dialog            | a modal window                                                                    | `NeatDialog`                               | modal, popup                           |
| confirm           | a dialog that asks for a yes or no                                                | `NeatConfirm`                              | alert                                  |
| popover           | a panel that opens from a trigger and holds controls or a menu                    | `neat-popover`, `NeatPopover`              | dropdown, flyout                       |
| tooltip           | the short text shown while hovering or focusing a control                         | `[neatTooltip]`                            | tip, hint                              |
| shortcut          | a keyboard shortcut's keys, each drawn as a key, in words for a screen reader     | `neat-shortcut`, `NeatShortcut`            | hotkey, key hint, keyboard hint, kbd   |
| toast             | a short message that appears and goes by itself                                   | `NeatToasts`, `neat-toast-host`            | snackbar, notification                 |
| tabs              | views inside one page that are not addresses                                      | `neat-tabs`, `NeatTabs`                    |                                        |
| select            | a labeled list that opens to pick one value                                       | `neat-select`, `NeatSelect`                | dropdown, combo box                    |
| select list       | a list of rows in columns that holds the focus; one row selected, or rows checked | `neat-select-list`                         | table, list view                       |
| file browser      | a folder tree's breadcrumbs, filter and rows                                      | `neat-file-browser`                        | file picker                            |
| search field      | a field that filters what a page shows, with a clear button and a status line     | `neat-search`, `NeatSearch`                | filter, search bar, search box         |
| search palette    | a search over the whole app, opened from the top bar or by Ctrl K                 | `neat-search-palette`, `NeatSearchPalette` | command palette, quick open, spotlight |
| switch            | an on/off control                                                                 | `button[neatSwitch]`                       | toggle, checkbox                       |
| slider            | a value picked along a track                                                      | `NeatSlider`                               | range                                  |
| segmented control | one of a few options, side by side, a thumb under the chosen one                  | `neat-segmented`                           | toggle group, radio buttons            |
| status chip       | a short status on a status fill                                                   | `neat-status-chip`                         | badge, pill, tag                       |
| details           | the key/value list of an aside                                                    | `dl[neatDetails]`                          | properties, key/value table            |
| table             | the data table's look on a `table`                                                | `table[neatTable]`                         | grid                                   |
| code block        | code set apart on the muted fill, as written, with an optional Copy button        | `neat-code-block`, `NeatCodeBlock`         | code box, pre                          |
| copy button       | a button that copies a text and says whether it did                               | `neat-copy-button`, `NeatCopyButton`       | clipboard button                       |
| field             | a control under its visible name, with a hint and an error                        | `NeatField`                                | form group                             |
| collapsible       | a section a labeled button opens and closes                                       | `neat-collapsible`                         | accordion, expander                    |
| breadcrumbs       | the path to where the user is, each step but the last a button                    | `neat-breadcrumbs`                         | path bar                               |
| progress          | a bar, or a titled readout, of how far something is                               | `neat-progress`                            | loading bar                            |
| drop zone         | where files are dropped or chosen                                                 | `neat-drop-zone`                           | upload area                            |
| level meter       | a live audio level as a bar of segments                                           | `neat-level-meter`                         | VU meter                               |
| live dot          | the red dot of something live                                                     | `NeatLiveDot`                              | recording dot                          |
| swatch            | a small square of a color beside a label                                          | `NeatSwatch`, `NeatSeriesSwatch`           | color chip                             |
| icon              | a glyph of the kit's set, by name                                                 | `neat-icon`, `NeatIcon`                    |                                        |

The kit has three kinds of notes, each for one job: a **callout** says something about the page or
a task, with a heading; a **note** is a quiet remark beside what it is about; an **error note** says
what failed, where it failed. The diagram's notes are a fourth, unrelated thing (below).

## Charts

| Name           | What it is                                                                     | In the code                | Others say          |
| -------------- | ------------------------------------------------------------------------------ | -------------------------- | ------------------- |
| series         | one line or band of values over time, with its color                           | `NeatSeries`               | dataset, trace      |
| sample         | one value of a series at one time                                              | `values`, `times`          | point, data point   |
| headline       | the chart's big value beside its title                                         | `headline`                 | value, KPI          |
| readout        | the box that shows the values under the pointer or the keyboard's cursor       | `ReadoutCursor` (internal) | tooltip, hover card |
| crosshair      | the line through the moment the readout shows, shared by charts bound together | `hovered`                  | cursor line         |
| legend         | the list of series, each with its swatch                                       |                            | key                 |
| threshold      | a level line (a warning, a danger)                                             | `NeatThreshold`            | limit line          |
| reference line | a dashed line at a fixed value                                                 | `NeatReference`            | baseline            |
| band           | one layer of a stacked chart                                                   | `NeatStackedChart`         | area, layer         |
| cell           | one square of a heatmap: a row at a time                                       | `NeatHeatmapCell`          | bin, tile           |
| run            | a stretch of a label timeline where one label held                             | `NeatLabelRun`             | segment, span       |
| sparkline      | a small chart without axes, inline with text                                   | `neat-sparkline`           | mini chart          |

## Diagram

| Name         | What it is                                                               | In the code                           | Others say               |
| ------------ | ------------------------------------------------------------------------ | ------------------------------------- | ------------------------ |
| diagram      | a drawing the app places by hand: nodes, edges and notes                 | `neat-diagram`, `NeatDiagram`         | graph, flow chart        |
| diagram set  | a diagram's overview and the levels its blocks open                      | `NeatDiagramSet`                      |                          |
| overview     | the top level of a diagram set                                           | `[(level)]` of `[]`                   | root, main view          |
| level        | one diagram of a set, opened from a block                                | `opens`, `[(level)]`                  | sub-diagram, drill-down  |
| node         | anything placed on the diagram: a group, a block, a band or a bracket    | `NeatDiagramNode`                     | element, item            |
| block        | a node drawn as a card, with a label, chips and the app's content        | `role: 'block'`                       | box, card, step          |
| group        | a node that holds other nodes, drawn behind the edges                    | `role: 'group'`                       | frame, cluster, subgraph |
| band         | a strip across the drawing: a cable or a bus                             | `role: 'band'`                        | lane, bus                |
| bracket      | a brace under a row of sibling nodes                                     | `role: 'bracket'`                     | brace                    |
| edge         | a line from one node to another                                          | `NeatDiagramEdge`                     | arrow, link, connection  |
| port         | where an edge meets its node                                             |                                       | anchor, handle           |
| end marker   | the mark at an edge's start or end: none, an arrow or a dot              | `NeatDiagramMarker`                   | tip, arrowhead           |
| edge label   | the small chip along an edge                                             | `label`, `labelAt`                    | edge chip                |
| edge tooltip | what the app shows while the pointer is over an edge                     | `ng-template[neatDiagramEdgeTooltip]` | edge tip                 |
| note         | a box of the app's content joined to edges or a point by a dotted leader | `NeatDiagramNote`                     | annotation, callout      |
| leader       | the dotted line from a note to what it is about                          | `leaderTo`                            | connector                |
| message      | one thing sent along an edge, drawn as a moving dot                      | `neat-diagram-messages`, `push`       | packet, particle         |
| step         | an edge inside a block that no message feeds, which dots go on along     | `NeatDiagramMessageStep`              |                          |
| rate card    | a note's readout of an edge's messages per second                        | `neat-diagram-rate-card`              |                          |
| figure card  | a note's labeled figure that is not a rate: a count, a time              | `neat-diagram-figure-card`            | metric note, stat card   |

## Bird's-eye view

| Name            | What it is                                                               | In the code                | Others say                                   |
| --------------- | ------------------------------------------------------------------------ | -------------------------- | -------------------------------------------- |
| bird's-eye view | what the vehicle sees around it, from above                              | `neat-bev`, `NeatBev`      | BEV (in prose: say it once), radar, top view |
| vehicle         | the car the view is centered on; the field calls it the ego vehicle      | the marker at the origin   | ego, ego vehicle                             |
| frame           | what the vehicle sees at one moment: objects, points, lines, grids       | `NeatBevFrame`             | scene, snapshot                              |
| object          | a detected thing, drawn as a rotated box with a heading line             | `NeatBevObject`            | detection, box, track                        |
| points          | a cloud of points                                                        | `NeatBevPoints`            | point cloud                                  |
| line            | a polyline; with `fill`, a polygon                                       | `NeatBevLine`              | path                                         |
| polygon         | a closed, filled line                                                    | `NeatBevLine` with `fill`  | area, region                                 |
| grid            | cells of values over the ground                                          | `NeatBevGrid`              | occupancy map, raster                        |
| layer           | what the app draws under (`background`) or over (`foreground`) the frame | `NeatBevLayer`             | overlay, sensor                              |
| shape           | the round or rectangular area the view shows                             | `shape`, `range`, `bounds` | plot area, canvas                            |
| guides          | the rings or grid lines and the spokes that help read distances          | `guides`, `spokes`         | grid (for rings)                             |
| outline         | the shape's edge                                                         | `outline`                  | border                                       |
| readout         | the box beside a hovered object: its label, distance and the app's text  |                            | tooltip                                      |

## Video

| Name                 | What it is                                                                     | In the code                 | Others say                                       |
| -------------------- | ------------------------------------------------------------------------------ | --------------------------- | ------------------------------------------------ |
| tile                 | one stream's video with its overlays and bar                                   | `neat-video-tile`           | player, video panel                              |
| tile grid            | tiles laid out together                                                        | `neat-tile-grid`            | video wall, mosaic                               |
| stream               | the video a tile plays                                                         | `NeatTileSource`            | feed, source                                     |
| channel              | which of a pipeline's streams a tile shows                                     | `channel`                   |                                                  |
| video box            | the rectangle of the picture inside the tile, letterbox left out               | `NeatVideoBox`, `videoBox`  | viewport                                         |
| overlay              | what the tile draws over the picture from a message: detections, poses, labels | `NeatOverlay*`              | annotation, layer                                |
| track                | a detection the tracking overlay follows from frame to frame, under one id     | `tracking`, `id`            | tracklet, object                                 |
| class color          | a label's color, the same on every tile of a page and in its bird's-eye view   | `colorOf`                   | label color, identity color                      |
| bar                  | the line along the tile's bottom: its label, status and chips                  | `bars`                      | footer, status bar                               |
| notice               | what keeps a tile's stream from showing as it should, in words                 | `notice`, `noticeTone`      | tile state, state overlay, no signal             |
| region of interest   | a part of the picture the app includes or excludes, drawn as a polygon         | `NeatRoiPolygon`, `regions` | ROI (in prose: say it once), zone, mask, polygon |
| inclusion, exclusion | a region's type: a part the app looks at, or one it leaves out                 | `NeatRoiDrawMode`           | allow zone, deny zone                            |

## Words for shapes, not things

**Name the thing, not its shape.** A diagram block, a BEV object and a detection all have a box, but
none of them _is_ "the box". Write "the block", "the object", "the detection", and keep "box" for
its rectangle ("the object's box turns with its heading") or for a CSS box ("the host's box").
Why: "box" alone could be any of a dozen things on a page, and a reader has to guess which.
