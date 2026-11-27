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

| Name         | What it is                                                                                                             | In the code                                  | Others say                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------- |
| shell        | the app's frame: the rail, the top bar and the page's area                                                             | `neat-shell`, `NeatShell`                    | layout, frame                          |
| rail         | the column of the app's pages at the start of the shell, with the app's items below                                    | `navItems`, `neatRailItem`                   | sidebar, side nav                      |
| rail item    | one entry of the rail: a page, or one of the app's own items (a board)                                                 | `NeatRailItem`, `[neatRailItem]`             | nav item, menu item                    |
| sub-page     | a page's own views, unfolded under its rail item                                                                       | `children` (`NeatNavChild`)                  | child page, tab                        |
| board item   | the rail block for the board an app works with: its name, address and connection, a button that opens the app's dialog | `NeatBoardItem`, `neat-board-item`           | device item, connection chip           |
| rail divider | the line between groups of the app's rail items                                                                        | `NeatRailDivider`                            | separator                              |
| top bar      | the bar across the top of the shell: logo, app name, page title, then the tools                                        | `topbar` (`neatTopbarEnd`)                   | header, app bar                        |
| app detail   | the short line under the app name in the top bar, such as the version                                                  | `appDetail`                                  | subtitle, tagline                      |
| page toolbar | the page's own tools, at the right end of the top bar                                                                  | `*neatPageToolbar`, `NeatPageToolbarDivider` | actions, top bar (for the tools alone) |
| kiosk mode   | the page alone, full screen, its tools floating                                                                        | `KioskService`                               | full screen                            |
| page         | what a route shows in the shell                                                                                        | `neat-page`, `NeatPage`                      | view, screen                           |
| content area | the shell's part below the top bar and beside the rail, where the page shows                                           | `main.content`, region `content`             | main area, viewport                    |
| body         | a page's own column, beside its page nav and its aside, which scrolls                                                  | `.body`, region `body`                       | main column                            |
| page nav     | a page's list of links, beside its body (or above it on a phone)                                                       | `nav[neatPageNav]`, `NeatPageNav`            | side list, sidebar                     |
| aside        | the column on a page's right, for an inspector or details; its toggle's visible name is "Side panel"                   | `[neatPageAside]`, `NeatAsidePanel`          | side panel, drawer, inspector          |
| aside toggle | the button at the top bar's right edge that opens and closes the aside                                                 | `neat-aside-toggle`                          | panel button                           |
| prose        | long-form text on a page (help, an explanation, a README), in Spartan's typography                                     | `[neatProse]`, `NeatProse`                   | rich text, article                     |
| typography   | Spartan's look for one text element (a heading, a paragraph, a list, a quote), set by its directive                    | `h2[neatH2]`, `NEAT_TYPOGRAPHY`              | text styles, type scale                |
| expand       | to show an element over the whole browser window or a region of it, and put it back; not the screen                    | `[neatExpand]`, `NeatExpand`                 | full screen, maximize, lightbox        |
| region       | what an expanded element covers: the window, the shell's content area, the page's body or an element                   | `region`, `NeatExpandRegion`                 | target, area, zone                     |

## Components

| Name              | What it is                                                                                   | In the code                                | Others say                             |
| ----------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| button            | an action; seven variants                                                                    | `NeatButton`, `[neatButton]`               |                                        |
| inline button     | a button inside running text                                                                 | `NeatInlineButton`                         | link button                            |
| card              | a raised surface with an optional title, actions and footer                                  | `neat-card`, `NeatCard`                    | panel, tile, box                       |
| chart card        | the card for one metric: heading, badge, value, caption, chart                               | `NeatChartCard`                            | metric tile                            |
| callout           | a notice on a tint of its tone, with an icon, a heading and actions                          | `neat-callout`, `NeatCallout`              | banner, alert, info box                |
| empty state       | what a large area shows when no part of the app is on it; not the video tile's no-video note | `neat-empty`, `NeatEmpty`                  | placeholder, blank slate               |
| note              | a short muted remark under a control or a heading                                            | `[neatNote]`, `NeatNote`                   | hint, help text                        |
| error note        | a failure said in place                                                                      | `NeatErrorNote`                            | error message                          |
| dialog            | a modal window                                                                               | `NeatDialog`                               | modal, popup                           |
| confirm           | a dialog that asks for a yes or no                                                           | `NeatConfirm`                              | alert                                  |
| popover           | a panel that opens from a trigger and holds controls or a menu                               | `neat-popover`, `NeatPopover`              | dropdown, flyout                       |
| tooltip           | the short text shown while hovering or focusing a control                                    | `[neatTooltip]`                            | tip, hint                              |
| bubble            | a speech bubble that points at what it explains, in the popover's colors; not helm's bubble  | `neat-bubble`, `NeatBubble`                | speech bubble, coach mark, annotation  |
| shortcut          | a keyboard shortcut's keys, each drawn as a key, in words for a screen reader                | `neat-shortcut`, `NeatShortcut`            | hotkey, key hint, keyboard hint, kbd   |
| toast             | a short message that appears and goes by itself                                              | `NeatToasts`, `neat-toast-host`            | snackbar, notification                 |
| tabs              | views inside one page that are not addresses                                                 | `neat-tabs`, `NeatTabs`                    |                                        |
| select            | a labeled list that opens to pick one value                                                  | `neat-select`, `NeatSelect`                | dropdown, combo box                    |
| select list       | a list of rows in columns that holds the focus; one row selected, or rows checked            | `neat-select-list`                         | table, list view                       |
| file browser      | a folder tree's breadcrumbs, filter and rows                                                 | `neat-file-browser`                        | file picker                            |
| number field      | one whole number, committed on Enter or on leaving the field; steps are its − and +          | `neat-number-field`, `NeatNumberField`     | number input, spin box, stepper        |
| search field      | a field that filters what a page shows, with a clear button and a status line                | `neat-search`, `NeatSearch`                | filter, search bar, search box         |
| search palette    | a search over the whole app, opened from the top bar or by Ctrl K                            | `neat-search-palette`, `NeatSearchPalette` | command palette, quick open, spotlight |
| switch            | an on/off control                                                                            | `button[neatSwitch]`                       | toggle, checkbox                       |
| slider            | a value picked along a track                                                                 | `NeatSlider`                               | range                                  |
| segmented control | one of a few options, side by side, a thumb under the chosen one                             | `neat-segmented`                           | toggle group, radio buttons            |
| badge             | a short status or fact in a small pill: soft, its tone on a tint, or solid, filled with it   | `neat-badge`, `NeatBadge`                  | chip, status chip, pill, tag           |
| status chip       | the badge's old name, deprecated in 0.44: see badge                                          | `neat-status-chip`                         |                                        |
| details           | the key/value list of an aside                                                               | `dl[neatDetails]`                          | properties, key/value table            |
| table             | the data table's look on a `table`                                                           | `table[neatTable]`                         | grid                                   |
| code block        | code set apart on the muted fill, as written, with an optional Copy button                   | `neat-code-block`, `NeatCodeBlock`         | code box, pre                          |
| copy button       | a button that copies a text and says whether it did                                          | `neat-copy-button`, `NeatCopyButton`       | clipboard button                       |
| field             | a control under its visible name, with a hint and an error                                   | `NeatField`                                | form group                             |
| field width       | how wide a field part is: `fill`, its container's width, or `content`, what it holds         | `width`, `NeatFieldWidth`                  | compact, dense, auto width             |
| collapsible       | a section a labeled button opens and closes, as a `section` or, under a field, a `note`      | `neat-collapsible`                         | accordion, expander                    |
| breadcrumbs       | the path to where the user is, each step but the last a button                               | `neat-breadcrumbs`                         | path bar                               |
| progress          | a bar, or a titled readout, of how far something is                                          | `neat-progress`                            | loading bar                            |
| drop zone         | where files are dropped or chosen                                                            | `neat-drop-zone`                           | upload area                            |
| level meter       | a live audio level as a bar of segments                                                      | `neat-level-meter`                         | VU meter                               |
| live dot          | the red dot of something live                                                                | `NeatLiveDot`                              | recording dot                          |
| live badge        | a pill on a picture that says whether it is live, led by the live dot, or what shows instead | `neat-live-badge`, `NeatLiveBadge`         | live indicator, live label             |
| swatch            | a small square of a color beside a label                                                     | `NeatSwatch`, `NeatSeriesSwatch`           | color chip                             |
| icon              | a glyph of the kit's set, by name                                                            | `neat-icon`, `NeatIcon`                    |                                        |

The kit has three kinds of notes, each for one job: a **callout** says something about the page or
a task, with a heading; a **note** is a quiet remark beside what it is about; an **error note** says
what failed, where it failed. The diagram's notes are a fourth, unrelated thing (below).

Helm's bubble, the look the transcript gives a message (the question's box on its tint), is not the
kit's bubble, `NeatBubble`: the code and the docs call it "helm's bubble" or "the question's box".

## Code block

| Name          | What it is                                                                                             | In the code                     | Others say                  |
| ------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------- | --------------------------- |
| language      | what a code block's code is written in, by its Shiki name or an alias                                  | `language`                      | lang, syntax                |
| grammar       | the rules that color one language, loaded the first time a block shows it                              | `NeatCodeLanguages`             | language pack, syntax file  |
| highlighter   | what colors code by its grammar: Shiki, which the code block loads on first use                        | `highlighter.ts` (internal)     | syntax highlighter          |
| turn          | a code block's own task to color its code once near the view, after the turns asked for before it      | `nextTurn` (internal)           | slot, tick                  |
| code colors   | the theme's tokens for the kinds of code text: keyword, string, comment and so on                      | `--neat-code-keyword`, ...      | syntax colors, syntax theme |
| line numbers  | the numbers at the start of a code block's lines, which a selection leaves out                         | `lineNumbers`                   |                             |
| mark          | lines, or a part of a line, that a code block sets apart, counted from 1 as people read them           | `NeatCodeMark`, `marks`         | highlight, emphasis, focus  |
| band          | how a marked line shows: the mark tint across the block behind it                                      | `.line[data-marked]`            | line highlight              |
| marker        | how a marked part shows: a rounded patch of the mark tint behind its text                              | `mark`                          | highlight                   |
| mark tint     | the theme's tint behind a mark, which marked code reads on at 4.5:1                                    | `--neat-code-mark`              | highlight color             |
| dim           | what a code block does to the code outside its marks: the muted text color, without code colors        | `dim`                           | fade, gray out              |
| step          | one stage of a walk through a code block's code: a set of marks and a label                            | `NeatCodeStep`, `steps`, `step` | slide, stop, frame          |
| step controls | the Previous and Next buttons and the position ("2 of 5") under a code block with steps                | `stepControls`                  | pager, stepper              |
| code note     | what a code block shows in a bubble beside its step's marks or a hovered mark, from the app's template | `NeatCodeNote`                  | annotation, comment         |

## Charts

| Name           | What it is                                                                                   | In the code                | Others say           |
| -------------- | -------------------------------------------------------------------------------------------- | -------------------------- | -------------------- |
| series         | one line or band of values over time, with its color                                         | `NeatSeries`               | dataset, trace       |
| sample         | one value of a series at one time                                                            | `values`, `times`          | point, data point    |
| headline       | the chart's big value beside its title                                                       | `headline`                 | value, KPI           |
| readout        | the box that shows the values under the pointer or the keyboard's cursor                     | `ReadoutCursor` (internal) | tooltip, hover card  |
| crosshair      | the line through the moment the readout shows, shared by charts bound together               | `hovered`                  | cursor line          |
| legend         | the list of series, each with its swatch                                                     |                            | key                  |
| threshold      | a level line (a warning, a danger)                                                           | `NeatThreshold`            | limit line           |
| reference line | a dashed line at a fixed value                                                               | `NeatReference`            | baseline             |
| band           | one layer of a stacked chart                                                                 | `NeatStackedChart`         | area, layer          |
| cell           | one square of a heatmap: a row at a time                                                     | `NeatHeatmapCell`          | bin, tile            |
| run            | a stretch of a label timeline where one label held                                           | `NeatLabelRun`             | segment, span        |
| sparkline      | a small chart without axes, inline with text                                                 | `neat-sparkline`           | mini chart           |
| gauge          | a live value within a range, drawn as a ¾ arc with the figure inside                         | `neat-gauge`, `NeatGauge`  | dial, speedometer    |
| gauge track    | the gauge's whole range, the thick arc behind the value arc                                  | `--neat-gauge-track`       | background arc       |
| value arc      | the stretch of the gauge track the value covers, from `min` to the value                     |                            | fill, progress arc   |
| zone           | a stretch of a gauge's range, warning or danger, drawn as a thin arc outside the gauge track | `NeatGaugeZones`           | band, threshold band |

## Diagram

| Name         | What it is                                                               | In the code                           | Others say               |
| ------------ | ------------------------------------------------------------------------ | ------------------------------------- | ------------------------ |
| diagram      | a drawing the app places by hand: nodes, edges and notes                 | `neat-diagram`, `NeatDiagram`         | graph, flow chart        |
| diagram set  | a diagram's overview and the levels its blocks open                      | `NeatDiagramSet`                      |                          |
| overview     | the top level of a diagram set                                           | `[(level)]` of `[]`                   | root, main view          |
| level        | one diagram of a set, opened from a block                                | `opens`, `[(level)]`                  | sub-diagram, drill-down  |
| node         | anything placed on the diagram: a group, a block, a band or a bracket    | `NeatDiagramNode`                     | element, item            |
| block        | a node drawn as a card, with a label, badges and the app's content       | `role: 'block'`                       | box, card, step          |
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

| Name                 | What it is                                                                                                                              | In the code                                       | Others say                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| tile                 | one stream's video with its overlays and bar                                                                                            | `neat-video-tile`                                 | player, video panel                              |
| tile grid            | tiles laid out together                                                                                                                 | `neat-tile-grid`                                  | video wall, mosaic                               |
| stream               | the video a tile plays                                                                                                                  | `stream`, `NeatTileSource.stream`                 | feed, source                                     |
| encoded frames       | a source's pictures one at a time, each encoded (JPEG), which the tile decodes and draws, for video the browser cannot play as a stream | `frames`, `NeatEncodedFrames`, `NeatEncodedFrame` | MJPEG, image stream, frame feed                  |
| channel              | which of a pipeline's streams a tile shows                                                                                              | `channel`                                         |                                                  |
| video box            | the rectangle of the picture inside the tile, letterbox left out                                                                        | `NeatVideoBox`, `videoBox`                        | viewport                                         |
| overlay              | what the tile draws over the picture from a message: detections, poses, labels                                                          | `NeatOverlay*`                                    | annotation, layer                                |
| track                | a detection the tracking overlay follows from frame to frame, under one id                                                              | `tracking`, `id`                                  | tracklet, object                                 |
| class color          | a label's color, the same on every tile of a page and in its bird's-eye view                                                            | `colorOf`                                         | label color, identity color                      |
| label plate          | the dark backing an overlay's label is drawn on, its text in the class color                                                            | `drawLabelPlate`                                  | label background, caption box                    |
| rotated box          | a detection's box turned by an angle; `bbox` stays its upright extent                                                                   | `oriented_bbox`                                   | oriented box, OBB, tilted box                    |
| flip vertical        | the tile's picture and overlays turned top to bottom, text upright; with mirror, turned 180°                                            | `flipVertical`                                    | rotate, upside down                              |
| bar                  | the line along the tile's bottom: its label, status and chips                                                                           | `bars`                                            | footer, status bar                               |
| notice               | what keeps a tile's stream from showing as it should, in words                                                                          | `notice`, `noticeTone`                            | tile state, state overlay, no signal             |
| Insight channel      | one Insight channel's video and metadata over WebRTC, as a tile's source                                                                | `neatInsightChannel`                              | channel source, WebRTC source                    |
| offer address        | where the browser posts its WebRTC offer: Insight's route or the app's relay                                                            | `offer`                                           | signaling URL, offer URL                         |
| relay                | the app's own route that passes the offer on to Insight and its answer back                                                             | `offer`                                           | proxy                                            |
| region of interest   | a part of the picture the app includes or excludes, drawn as a polygon                                                                  | `NeatRoiPolygon`, `regions`                       | ROI (in prose: say it once), zone, mask, polygon |
| inclusion, exclusion | a region's type: a part the app looks at, or one it leaves out                                                                          | `NeatRoiDrawMode`                                 | allow zone, deny zone                            |

## Chat

| Name               | What it is                                                                                                                   | In the code                              | Others say                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| transcript         | a conversation with a model, drawn from the app's messages: the visitor's questions and the replies                          | `neat-chat-transcript`                   | chat log, conversation, thread              |
| message            | one turn of the transcript: a question or a reply, with its text, pictures and state                                         | `NeatChatMessage`                        | turn, bubble (for its look)                 |
| reply              | a message of the model's (`role: 'assistant'`)                                                                               | `NeatChatMessage`                        | answer, completion, response                |
| message box        | where the visitor writes a question, attaches pictures, sends it, or stops a reply                                           | `neat-message-box`                       | composer, input bar, prompt box             |
| picture            | an image attached to a question, shown as a thumbnail in the message box and in its message                                  | `NeatChatPicture`                        | attachment, image, upload                   |
| draft              | what the message box sends: its text and pictures                                                                            | `NeatChatDraft`                          | prompt, input                               |
| glow               | the message box's animated border while the board works on a reply: comet, steady comet, glow ring (`ring`), aurora or sheen | `glow`, `NeatMessageBoxGlow`             | halo, loading border                        |
| Latest             | the button that brings a transcript scrolled up back to the newest text, which it then follows again                         | `neat-chat-transcript`                   | jump to bottom, scroll to end               |
| streamed reply     | a reply that arrives as it is written, one `data:` line per piece, from a POST                                               | `neatStreamPost`                         | SSE response, streaming fetch               |
| event stream       | an app server's server-sent events, each a JSON object with a `type`                                                         | `NeatEventStream`                        | SSE, EventSource                            |
| Markdown           | text with light markup (headings, lists, code, tables), as a model writes its replies; drawn as prose                        | `neat-markdown`                          | rich text                                   |
| piece              | what one write of a streamed reply adds, the model's token or a few                                                          | `ShownPiece` (internal)                  | token (in the kit a token is a theme value) |
| text motion        | how a streaming reply's newest text appears: plain, focus, decrypt, reverse explosion, token flash, drop-in, word cloud      | `textMotion`, `motion`, `NeatTextMotion` | token animation, typing effect              |
| word cloud         | the text motion whose words float under the reply's end, one flying into place with each piece                               | `'word-cloud'`, `cloudWords`, `cloudBox` |                                             |
| picture flight     | patches of a question's pictures flying into the reply's orb while they are read, in any picture motion                      | `pictureFlight`, `flight`                | data into the model                         |
| picture motion     | how a question's pictures show the board reading them until the first word: coming into focus, beam and patches, viewfinder  | `pictureMotion`, `NeatPictureMotion`     | scan effect                                 |
| picture viewer     | a picture of the conversation shown whole over the transcript, from its Expand button, until Close or Escape                 | `neatExpand` on its frame                | lightbox                                    |
| orb and clock      | a waiting reply's placeholder, a turning orb and the seconds since the reply began to wait                                   | `neat-chat-transcript`                   | spinner, thinking indicator                 |
| push-to-talk       | the button the visitor holds, or taps to start and tap to stop, to ask by voice: idle, recording, transcribing               | `neat-push-to-talk`                      | mic button, record button                   |
| recording          | what push-to-talk gives the app, one `Blob` of the browser's audio (WebM/Opus in Chrome)                                     | `recorded`, `recording`                  | audio clip, voice note                      |
| listening motion   | how the voice shows while it is recorded: in the message box, radial                                                         | `listeningMotion`, `NeatListeningMotion` | voice visualizer                            |
| heard question     | a question the visitor spoke; its text is what speech-to-text heard, and it arrives deciphered                               | `heard`                                  | transcription, voice message                |
| camera dialog      | the dialog the message box's Camera button opens, with the camera's live preview and Take; it gives back a picture           | `neat-message-box`, `camera`             | webcam capture, photo picker                |
| speakable sentence | a sentence of a reply as read aloud speaks it, its words without Markdown and its range in the text                          | `neatSpeakable`, `NeatSpeakableSentence` | utterance, TTS chunk                        |
| speech             | the sentence of a reply being said now, with its audio and when it began                                                     | `NeatSpeech`, `speech`                   | playback state                              |
| speaking motion    | how a reply being read aloud shows how far the voice got: sentence, equalizer, waveform                                      | `speakingMotion`, `NeatSpeakingMotion`   | read-along highlight                        |

## Words for shapes, not things

**Name the thing, not its shape.** A diagram block, a BEV object and a detection all have a box, but
none of them _is_ "the box". Write "the block", "the object", "the detection", and keep "box" for
its rectangle ("the object's box turns with its heading") or for a CSS box ("the host's box").
Why: "box" alone could be any of a dozen things on a page, and a reader has to guess which.
