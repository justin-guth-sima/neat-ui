# AGENTS.md

Guidance for anyone (human or agent) working in this repository or building an app on `@sima/neat-ui`.
The rules below come with their reasons; if a reason does not apply to your situation, the escape
hatch says what to do instead of working around the rule. Everything you write for people to read
(docs, doc comments, examples, this file) follows [docs/writing.md](docs/writing.md) and calls
things by their names in [docs/glossary.md](docs/glossary.md). [CONTRIBUTING.md](CONTRIBUTING.md)
is the way in for people; it links here for the details, so a rule lives here once.

## What this repo is

`neat-ui` is the shared SiMa.ai look and component set for Neat applications (Neat Insight first,
demo apps later). Its value is that every app looks and behaves the same and that a change to the
look happens in one place. Every rule here protects that.

- `projects/neat-ui`: the library, with one primary and several secondary entry points, each with
  its own public API file:
  - `@sima/neat-ui` (the primary): what the shell and every page need: theme, `NeatIcon`,
    `NeatShell` with `NeatRailItem` and `NeatRailDivider` (an item of its rail and the line between
    groups of items, for the app's items at its bottom),
    `NeatPageToolbar`, `NeatPage` with its page nav (`NeatPageNav`, with `NeatPageNavGroup` and
    `NeatPageNavLink`) and its aside's parts (`NeatAsideToggle`, `NeatAsidePanel`,
    `NeatAsideTitle`, `NeatAsideHeading`, `NeatAsideActions`), `neatAsideOpen`
    (a page's panel state, closed on a narrow screen) and `NeatViewport` (the kit's one answer to
    "is this screen narrow", below 48rem), `NeatCode`,
    `KioskService`, `NeatButton`, `NeatInlineButton`, `NeatBreadcrumbs` (`neat-breadcrumbs`, the
    kit's one breadcrumb: a `nav` named by `label`, each crumb but the last an inline button whose
    index `go` emits, the last the location with its detail muted; on Spartan's breadcrumb look, its
    classes copied from helm behind a drift spec: earlier crumbs muted and dark on hover, a chevron
    `next` icon between crumbs, the last in the text color; the file browser and the diagram's level
    bar use it), `NeatTooltip`, `NeatNote`, `NeatSearch` (`neat-search`, the kit's one search field:
    a search glyph, a clear button and Escape to clear, always, and an optional `status` line
    announced politely; four looks, `filled` by default, `outlined`, `underlined` and `raised`, and
    a `large` size for a search page; the page nav's and the file browser's filters are it; it fills
    its container, or with `width="content"` is as wide as its input), `NeatFieldWidth` (`fill` or
    `content`, the one `width` every field part takes: `neatInput`, `neat-number-field`,
    `neat-select` and `neat-search` fill their container by default, as helm's fields do
    (`w-full min-w-0`, the same on all four), and are as wide as what they hold with `content`, for
    a toolbar or a heading's row; one name and one default on all four, so that no field part sizes
    itself differently from another; an app sizes a field otherwise through its own layout),
    `NeatShortcut` (`neat-shortcut`, the kit's one look for a keyboard shortcut: its `keys`, named
    as `aria-keyshortcuts` names them plus `Mod`, which is ⌘ on a Mac and Ctrl elsewhere, each a
    `kbd` hidden from assistive technology, with the keys in visually hidden words, "Control K"; the
    platform check is its own, and the search palette's trigger shows its keys with it,
    `aria-hidden` there since the trigger's `aria-keyshortcuts` names them), `NeatLiveDot` (a
    red dot for something live, still or, with `pulse`, beating with a ring that grows out of it;
    its red is `--neat-live`, not `--destructive`, held to 3:1 on the page and on the video scrim
    over black to mid-gray video, so a "Live" badge over a picture can use it),
    `NeatLiveBadge` (`neat-live-badge`, a badge in the badge's shape and type that says what a
    picture is, "Live" led by the pulsing live dot with `live`, or what shows instead with a still
    gray dot of the same size, on the video scrim with `onPicture` and muted on an empty frame; the
    app places it, in a tile's `neatTileOverlay` layer or its own frame's corner),
    `NeatSeriesSwatch` (a series' color as a small square beside a label outside the drawing that
    uses it: the charts' legends and readouts, the diagram's legend, an app's chip; in the primary
    so the diagram shows it without the charts' d3, and still exported by `charts`, where apps
    imported it first), `NeatSwatch` (the same square for any color: a class's color in a legend,
    the bird's-eye view's readout; it holds the swatch's one look, which `NeatSeriesSwatch` shares
    by taking its sheet), `neatSecondsAgo` (the kit's one relative-time style, "just now",
    "12 s ago", "3 min ago") and `neatDuration` (its one style for a length of time beside it,
    "42 s", "5 min 07 s", "2 h 05 min", "3 d 04 h": each unit cut to whole units as a clock does,
    the second always two digits, and "–" for anything not a finite number of at least 0; with
    `{ tenths: true }` (`NeatDurationOptions`), "34.4 s" under a minute, for a run's length),
    `NeatStale` (`[neatStale]`: what its host shows is stale, faded to 0.55 and gray, with no
    transition; the words beside it say why), `NeatProse` (`[neatProse]`: long-form text in
    Spartan's typography, its blocks 1.5rem apart with none before the first, `h1` to `h4`,
    paragraphs, bulleted lists, quotes and inline code as the typography directives draw them,
    `h5`, `h6` and numbered lists the kit's, links underlined in medium weight and their text's
    color, `kbd` as a key; its styles are the kit stylesheet's, below), the typography directives
    (`h1[neatH1]` to `h4[neatH4]`, `p[neatP]`, `p[neatLead]`, `[neatLarge]`, `small[neatSmall]`,
    `p[neatMuted]`, `blockquote[neatBlockquote]` and `ul[neatUl]`, collected in `NEAT_TYPOGRAPHY`:
    Spartan's typography on single elements, each binding helm's class constant for its element
    with a `[class]` host binding, the headings' copied less helm's `scroll-m-20`, since
    `neat-page` owns where a fragment link stops; inline code is `code[neatCode]`, and a heading,
    the lead and small print bring no space above them, which the page sets) and
    `provideNeatTitles(appName)` (the document's title, `<appName> · <route title>`, or the app name
    alone on an untitled route).
    `NeatExpand` (`[neatExpand]`, `exportAs: 'neatExpand'`) shows its host over the whole browser
    window and puts it back: `expanded` is a model, with `open()`, `close()` and `toggle()`. It
    covers the window, not the screen (the Fullscreen API is deferred until needed). The host is
    lifted into the top layer as a `manual` popover, not an `auto` one: an auto popover's light
    dismiss closes it on a click in an overlay opened from inside it (a select's list, a dialog),
    and a host that covers the window leaves nothing outside to click. Escape inside it closes it
    unless a control handled the key first, Tab stays inside it, the focus goes in when it opens
    from outside and goes back when it closes. Its look is `lib/expand/expand.css` in the kit
    stylesheet, only while `:popover-open`: the geometry unlayered and two selectors strong, so it
    outweighs a host's own sizing (a `:host` rule), and the fill, text color and overflow in the
    base layer, so a host's own win and a plain element still covers the page. It adds no padding:
    the video tile measures its content box, and a padding would shrink it under the tile's
    layers, which fill the padding box. Without the
    Popover API the state changes and the host stays in place. The video tile carries it as a host
    directive (its `expanded` forwarded, so an app never adds `neatExpand` to a tile, which Angular
    refuses in dev mode), and its `expandControl` adds a button for it.
    `neatEased` (a number signal that eases to each new value in 400 ms, ease-in-out cubic by
    default, and follows at once under reduced motion or after no value) and `NeatEasedNumber`
    (that figure in tabular digits, "–" while there is none) are the kit's one way a live figure
    moves. Their `easing` is a catalog name (`NEAT_EASINGS`: `ease-in-out`, `ease-out`, `ease-in`,
    `linear`), so every app moves the same way; a custom function only where no name fits. The
    curve may be switched while a value moves, and the last frame always shows the target exactly.
    `neatThemeColors` (the theme's tokens as `NeatRgb`, sRGB from 0 to 1, read again when the
    scheme changes) and `neatResolveColor` (any CSS color, resolved on a 1×1 canvas) are for code
    that draws outside CSS (three.js, a canvas), which takes colors as numbers: any CSS color a
    token or an app holds, resolved by the browser, so the kit has no color parser of its own.
    `neatStoredSignal(key, initial, parse)` is a signal kept in localStorage as JSON, the app's
    `parse` judging what it reads back; storage that refuses never throws.
    Public API is
    `projects/neat-ui/src/public-api.ts`.
  - one secondary entry point per other component, `@sima/neat-ui/<name>`: `switch`, `slider`,
    `segmented`, `tabs`, `popover`, `bubble` (`NeatBubble`, `neat-bubble`: a speech bubble with a
    tail that points at its `anchor` (`NeatBubbleAnchor`, an element or several), on the popover's
    panel surface, shown while it has one; it prefers its `side` and takes another where that has
    no room, follows its anchor as boxes scroll and hides while the anchor is out of view; it is
    drawn in the CDK overlay and its `id` is for an `aria-describedby`; the code block's notes use
    it), `confirm`, `input` (`NeatInput`, the text field, filling its container or, with
    `width="content"`, as wide as the browser makes an input), `number-field` (`NeatNumberField`,
    one whole number committed on Enter or on leaving the field; with `step`, the input is a
    spinbutton with − and + inside its box, the kit's `minus` and `plus` icons, pointer-only buttons
    that commit at once, held to `min` and `max` and `aria-disabled` at a bound or with no number
    shown (typed, if whole digits within the bounds, else `value`; null is shown as "–"); `reset()`
    shows `value` again for an owner that refused a committed number; `unit` is text inside the box
    after the number, `neatNumberFieldSuffix` content follows the box, and `showLabel` false leaves
    the label the input's name only; the label holds only its text, so the steps are not inside it;
    with steps or a unit its box is helm's `input-group`, the group, an addon at each end for − and
    +, the unit as the group's text and the input as its control, copied behind a drift spec with
    the input's full focus ring, no dark fill and the not-allowed cursor while disabled, without
    helm's `group` roles, since the input is the one control, and with the kit's own step buttons,
    since helm's ghost hover does not show; it fills its container, the box taking what the label
    and suffix leave, the number and unit in the middle between the steps, or with `width="content"`
    is as wide as its number and unit, as 0.43 drew it), `line-list`,
    `select`
    (`NeatSelect`, a labeled listbox combobox, its label shown above it with `showLabel` or, with
    `labelPosition="inline"`, before it on its row; `describedBy` names the element that describes it,
    on its trigger as the slider's goes on its thumb; it fills its container, or with
    `width="content"` is as wide as its choice, helm's own trigger held to the room it has),
    `progress` (`NeatProgress`, a bar or, with a `heading`, a titled readout, which the progress
    toast renders through), `drop-zone` (`NeatDropZone`, files by drop or by the system's chooser),
    `dialog` (`NeatDialog`, the general modal dialog, with `neat-dialog-body` and
    `neat-dialog-actions`) and `empty` (`NeatEmpty`, `neat-empty`: Spartan's empty state taken as it
    is, for a large area where no part of the app is shown, such as a tile grid with every tile
    hidden: an optional `icon`, a required `heading` as a real heading at `headingLevel` (3 by
    default), the content as its description and elements marked `neatEmptyActions` as its actions;
    the video tile's "No signal" is its own `notice`, not an empty state),
    `toast` (`NeatToasts` and `neat-toast-host`), `search-palette` (`NeatSearchPalette`,
    `neat-search-palette`: a search over the whole app, its trigger for the top bar
    (`neatTopbarEnd`) with Ctrl K, ⌘K on a Mac, and the palette it opens, the CDK's own `Dialog`
    anchored near the top so it does not jump as the results change; the app's `search` function
    gives `NeatSearchGroup`s of `NeatSearchItem`s, each a link the palette opens through the router,
    and the field is a `neat-search` as a combobox over their listbox; its backdrop is helm's
    dialog backdrop, copied behind a drift spec as the dialog's and the confirm's are), `select-list` (`NeatSelectList`, a listbox of rows
    in columns, with the `neatColumn` templates that lay them out and `NeatSelectListGroup` for
    rows under headings) and `file-browser`
    (`NeatFileBrowser`, a tree's breadcrumb, count, filter and rows, built on `select-list`
    and the primary's `NeatSearch` and `NeatBreadcrumbs`; `NeatFileNode` is its tree), `badge`
    (`NeatBadge`, `neat-badge`: a short status or fact in a small pill, Spartan's badge in the
    kit's tones, and `NeatBadgeButton`, the same as a button; their `NeatTone` is the primary's,
    since a select list's `rowTone` takes the same tones; `variant` (`NeatBadgeVariant`) is `soft`
    by default, the tone's color on its `--neat-tint-<tone>-accent`, or `solid`, the tone's status
    fill, for the rare badge that must stand out (a video tile's notice); a soft badge belongs on a
    card or the page, not on a toned list row, whose selected fill is the same tint, so a toned
    row's badge is solid; warning's soft text is `--neat-warning-text`, and neutral is muted text on
    `--neat-chip-neutral` in both, a gray that shows on the card, the page and a hovered or
    selected row's `--accent` in both schemes; how it is built on helm's badge is under "How the
    kit is built on Spartan" below), `status-chip` (`NeatStatusChip`, `NeatStatusChipButton` and
    `NeatStatusChipVariant`, the badge's old names, deprecated in 0.44 and kept for one release:
    they keep 0.43's colors and default, `solid` still their default and `tinted` the badge's
    `soft`, while their shape is the badge's, a 20 px pill with helm's focus ring on the button),
    `details` (`NeatDetails`, the
    key/value list of an aside; `--neat-details-term-width` on an ancestor lines several up, and
    a term wider than a fixed column breaks inside the word),
    `code-block` (`NeatCodeBlock`, `neat-code-block`: code on the muted fill as written, `wrap` or
    `scroll` for a long line, with `copy`, what the code is, a Copy button named after it,
    `language` to color it in the theme's code colors, `lineNumbers` for a gutter of numbers,
    `marks` (`NeatCodeMark`) to set lines and parts of lines apart and dim the rest, and `steps`
    (`NeatCodeStep`) with the `step` model and `stepControls` to walk through it, and
    `ng-template[neatCodeNote]` (`NeatCodeNote`, with its `NeatCodeNoteContext`) for a note in a
    bubble beside the step's marks or a hovered mark;
    `provideNeatCodeLanguages` (with its `NeatCodeLanguages`) adds languages; and
    `NeatCopyButton`, that button alone, for text shown some other way. An app that colors its code
    itself puts its spans inside the element, shown in place of the block's own lines, `code`
    staying what is copied; the showcase's snippets do this with the generator's runs. How it
    colors and marks code is under "How the code block colors code" below. The clipboard needs a
    secure context, and the button says when it could not copy. Not helm's `code-block`: its Copy
    button is an unnamed icon that hides until hover and ignores a refused clipboard, and its
    dynamic icon fails adoption),
    `table` (`NeatTable`, Spartan's table look on a plain `table` (helm's per-element classes as
    `:where` rules on the app's own `thead`, `tr`, `th`, `td` and `caption`, held by a drift spec):
    a rule under every row, a row filling under the pointer or while selected
    (`data-state="selected"`), 2.5rem medium-weight headings, a row heading's too; and
    `NeatNumeric`, which end-aligns a column's figures on one line with tabular digits, and
    `NeatFigure`, the same without the end alignment, for a cell with something after its figure; a
    table that gives up columns when its container is narrow says so itself, since the kit does not
    know the container),
    `field` (`NeatField`, a control under its visible name with
    a hint and an error, laid out as Spartan's vertical field (its gap, its label, its description
    and its error, copied from helm behind drift specs; the inputs stay plain, tied to no Angular
    form), and `NeatErrorNote`, a failure said in place, in helm's field error look), `collapsible`
    (`NeatCollapsible`, a section a labeled button opens and closes, with a summary while closed; its
    `variant` is `section` or, for a note under a field, `note`, the same disclosure in the note's
    small muted text with `tone`'s dot and a `triggerId` for the field's `aria-describedby`),
    `callout` (`NeatCallout`, a note on a tint of its tone with an icon, a heading and actions, and
    `plainText` for the body in the text color),
    `card` (`NeatCard`, a card on Spartan's helm card with an optional `title` (a heading at
    `headingLevel`, 3 by default; `region` makes the card a landmark named by it, opt-in as the
    callout's; `--neat-card-header-min-height` is for the kit's own presets, a chart card's chip,
    not for apps), a `subtitle`, the elements marked `neatCardActions` at the header's end, one
    marked `neatCardTitle` in place of the title's text (a button) and those marked
    `neatCardFooter` in its footer; the content takes the height the card has left, so an image can
    fill an untitled card; the attributes are the card's own selectors, no import),
    `level-meter` (`NeatLevelMeter`, a live audio level as a bar of segments), `markdown`
    (`NeatMarkdown`, `neat-markdown`: Markdown, as a model writes its replies, drawn in the kit's
    prose with its code block and table look, never as HTML; `streaming` for a text that grows,
    `motion` for how its newest text appears, a `NeatTextMotion` of `NEAT_TEXT_MOTIONS`,
    `cloudWords` for how many words the word cloud floats, and `speech` (a `NeatSpeech`, its
    audio a buffer or `NeatSpeechSamples`) with `speakingMotion` (a `NeatSpeakingMotion` of
    `NEAT_SPEAKING_MOTIONS`) for the sentence being read aloud; and `neatSpeakable`, the
    sentences read aloud speaks, each a `NeatSpeakableSentence` with its range in the text, read
    as `NeatSpeakableOptions` say),
    `stream` (`neatStreamPost`, a streamed reply to a POST as its `data:` lines' JSON, with
    `NeatStreamError`, and `NeatEventStream`, an app server's typed server-sent events), `chat` (a
    conversation with a model: `NeatChatTranscript`, `neat-chat-transcript`, drawn from the app's
    `NeatChatMessage`s with `ng-template[neatChatMessageFooter]` and
    `ng-template[neatChatErrorActions]`, its replies' `textMotion` (with `cloudWords`), passed to
    `neat-markdown`, its questions' `pictureMotion` (a `NeatPictureMotion` of
    `NEAT_PICTURE_MOTIONS`) with `pictureFlight` and `pictureScale`, its replies' `speech` with
    `speakingMotion`, and `emptyTitle` and `emptyHint` before the first message;
    `NeatMessageBox`, `neat-message-box`, the message box with pictures (`pictureFromFile`), Send
    and Stop, Stop reading aloud while the app reads a reply aloud (`speaking`, `stopSpeaking`), its
    `glow` (a `NeatMessageBoxGlow`, one of `NEAT_MESSAGE_BOX_GLOWS` or `none`), `camera` (a Camera
    button and its dialog) and `talk` (push-to-talk beside Send, with `recording`, `transcribing`,
    `listeningMotion` and `recorded`); and `NeatPushToTalk`, `neat-push-to-talk`, the button held or tapped to ask by
    voice, alone or in the box, with `recording`, `transcribing`, `disabled`, `maxSeconds`,
    `recorded` and its `listeningMotion` (a `NeatListeningMotion` of `NEAT_LISTENING_MOTIONS`);
    how they are drawn is under "How the chat parts are drawn" below) and `charts` (live
    metric charts, drawn as SVG but for the heatmap, the score bars and the label timeline, which are
    HTML: `NeatSparkline`, `NeatTimeChart`,
    `NeatStackedChart` and `NeatHeatmap`, `NeatChartCard`, the card they sit on, `NeatScoreBars`
    (a classifier's scores as labeled bars, with `NeatScore` and `neatLabelColor`, the one rule
    that colors a label like the bars do), `NeatLabelTimeline` (the classifier's recent results
    as colored runs over a time axis, with `NeatLabelRun`, colored by the same rule, and
    `NeatTimelineMotion`, `step` or `smooth` for whether it scrolls between updates) and the
    primary's `NeatSeriesSwatch` again; with `diagram` and `bev`, the only code that imports d3),
    `bev` (`NeatBev`, `neat-bev`: a bird's-eye view around a vehicle, with its model types
    `NeatBevFrame`, `NeatBevObject`, `NeatBevPoints`, `NeatBevLine`, `NeatBevGrid`, `NeatBevLayer`,
    `NeatBevSpoke`, `NeatBevShape`, `NeatBevBounds`, `NeatBevOverflow`, `NeatBevGuides`,
    `NeatBevObjectId`, `NeatBevPick` and `NeatBevPoint`; how it draws is under "How the bird's-eye
    view is drawn" below), `diagram`
    (hand-placed diagrams: their model, `NeatDiagramView` (`neat-diagram`) with its templates,
    `NeatDiagramLegend` (`neat-diagram-legend`), `NeatDiagramMessages` (`neat-diagram-messages`)
    with its `NeatDiagramRateCard` (`neat-diagram-rate-card`) and `NeatDiagramAnimationSettings`
    (`neat-diagram-animation-settings`), `NeatDiagramFigureCard` (`neat-diagram-figure-card`, a
    note's count or time), `neatDrillDownLevel`, `neatBatchTimes` and
    `neatParseMessageSettings`; how it draws is under "How the diagram is drawn" below),
    each exporting that component and its types; `lucide`, which has no component: its public API
    is `export * from 'lucide'`, every glyph of Lucide for `neat-icon`'s `name` (the icon rule is
    under "The kit's icons" below); and
    `video`: the video tile, the tile grid and what they need (overlay drawing, metadata sync, the
    overlay palette), and the region-of-interest editor with its swatch and `neatRoiNames`, which
    sit in the tile's overlay layer. The `pose-estimation` overlay draws a person (COCO names) and
    a hand (MediaPipe's 21 snake-case landmarks, `wrist` to `pinky_tip`) from one message: the
    two name sets are disjoint, so one link list serves both. Its `showBoxes` setting turns the
    box and label plate off, and `objects` rows (as for detections) style a pose by its `label`.
    The overlays word a confidence in one place (`withConfidence` in `overlays/draw-context.ts`):
    "car (87%)", or the label alone when the confidence is missing or not a finite number. Every
    overlay's label sits on the one label plate (`drawLabelPlate`), its text in the class color,
    and the plate stays inside the overlay's top, left and right edges. A box's label (a
    detection's, a segment's, a track's, a pose's) stands just above the box's top edge on screen,
    at its left edge in the picture (`boxLabelAnchor`, then `drawBoxLabels`), and an overlay draws
    its labels after all of its boxes and masks, so none of them crosses a label; where boxes
    overlap, a later label covers an earlier one.
    A detection may carry `oriented_bbox` (`[cx, cy, width, height, angle]`, the center and size in
    video pixels, the angle in radians turning the box clockwise on screen): the overlay then draws
    that rotated box as one closed path through its four corners, mapped as every point is, so a
    mirrored or flipped tile turns it the other way by itself, and `bbox` stays its upright extent,
    which the region filter reads. Anything but five finite numbers falls back to `bbox`. Its label
    stands upright at the box's corner topmost on screen (on a flipped tile, the lowest in the
    frame), its plate above the corner (of two corners equally high, the one with the smaller x in
    video pixels, so a box at angle 0 labels at its top-left as an upright box does, and on a
    mirrored tile the same frame corner anchors it). The classification list is laid out in CSS
    pixels from the picture's top-left corner on screen (its top edge on a flipped tile too, the
    rows going down), so its rows never overlap on a small tile.
    `NeatVideoTile`'s `mirror` shows the picture as in a mirror (a selfie view), and its
    `flipVertical` turns it top to bottom; the two together turn it 180°. The video flips by the
    stylesheet (`data-mirrored`, `data-flipped`, each a `transform`, with one rule for both) and
    every overlay's geometry flips in the one mapping strategies read (`orientLetterbox`, so a
    rectangle's width or height goes negative; an RLE mask, an image that a negative size does not
    flip, is drawn through a context turned by the scales' signs), while text stays upright:
    mirrored, it is right-aligned at its anchor and a label plate ends at its anchor; flipped, a
    box's label still stands above the box as it shows, and a joint's name above its joint.
    `videoBox`, the bar, the no-video note and the `neatTileOverlay` layer are not flipped
    (projected content reads `mirror` and `flipVertical` from the app), and the region-of-interest
    editor follows neither. Its
    `frameListener` (a `NeatTileFrameListener`) is called once per presented frame, outside
    Angular, after drawing, with a `NeatTileFrame`: the frame's `now` and the `messages` the
    overlay drew, each with a `held` flag; keep it cheap and write a signal only when a value
    changes. A listener that throws is logged once and the frames keep drawing.
    A source with `frames` (`NeatEncodedFrames`, its encoded frames, JPEG) is drawn by the tile on a
    canvas of its own beside the `video` element: the frames canvas (`canvas.frames`, its backing
    store the picture's own size, set only when that changes), shown in place of the video while the
    host has `data-frames`, with the same `object-fit`, letterbox, `videoBox`, stopped frost,
    `mirror` and `flipVertical` (the stylesheet's rules name `:is(.video, .frames)`), `notice` and
    expand control, and the overlay drawn over it as over a stream. A frame scheduler
    (`frame-scheduler.ts`, beside the frame loop) holds the frames until they are due, decodes the
    newest due one at a time with `createImageBitmap`, and draws it, all outside Angular. A source
    with both a `stream` and `frames` plays its stream, and the tile says so once in dev mode. A
    frame that does not decode is skipped, said once per tile; a draw that throws is an uncaught
    error. `frameStats` runs in frames mode too, its `video` describing the frames canvas
    (`NeatFrameStats`).
    `barHeight` (a signal beside `videoBox`) is the bar's laid-out height in CSS pixels, 0 without a
    bar, for content in the `neatTileOverlay` layer that keeps clear of it.
    `expandControl` puts a button in the tile's top-left corner, shown on hover, on keyboard focus
    and while expanded, that shows the tile over the whole window (`NeatExpand`, which every tile
    carries): "Expand <label>" in place, "Close" expanded, the kit's `expand-window` and `close`
    glyphs. The tile's ResizeObserver resizes its canvas for the new size, so the overlays follow.
    `notice` is what keeps the stream from showing as it should ("No signal", "Inference stopped"),
    with or without bars: without video it takes the no-video note's place, an icon above the words
    with no card, muted on the empty tile and white on a stopped tile's frosted frame; while video
    plays it is a solid `neat-badge` of `noticeTone` (`warning` by default) in the picture's
    top-right corner, placed by `videoBox`. Why an input and not a part an app projects: the tile
    owns its no-video note, so one input decides which of the two shows, and the look stays the
    tile's. Content an app places on the picture itself follows `videoBox`.
    `colorOf(type, item)` (a `NeatOverlayType` and a `NeatOverlayIdentity`, the item's `id` and
    `label`) is the color the overlay draws an item in, for a swatch in a list beside the tile: a
    track by its id, a pose by its label's style row or else its id, the other types by their
    label's style row or else its class color, which every tile and bird's-eye view of the page
    shares (track and pose colors are the tile's own). It is null until the overlay has drawn the
    item, and again once its color is taken back. It reads the allocator's signals (the page's
    for classes, the tile's for tracks and poses) and `settings`, which move only when a color is
    given or taken back, never per frame, so a template or a `computed` that calls it follows, and
    asking records no draw. The rule each type colors by is stated once (`item-colors.ts`), for the
    strategies' drawing and for `colorOf`. `neat-bev`'s `colorOf(label)` is the same for the view.
    And `insight` (`neatInsightChannel`, one Insight channel's video and metadata over WebRTC as a
    tile's source, with its `notice`, `failure`, `videoDelayMs` and `stats`; how it connects is
    under "How an Insight channel connects" below).
    Public API is `projects/neat-ui/<name>/src/public-api.ts`; its
    code lives in `projects/neat-ui/<name>/src/lib/`.
    Why one entry per component: an app's main bundle carries only the entries its shell imports,
    and a lazy route can keep a component (video's canvas, frame-loop and overlay code most of all)
    out of the main bundle only if it is a different import.
  - To add an entry point: create `projects/neat-ui/<name>/` with `ng-package.json` and
    `src/public-api.ts` as the existing ones have, add its path to `tsconfig.json` and to
    `projects/bench/tsconfig.app.json` (below), and add its selectors to `SECONDARY_ENTRIES` in
    `tools/check-dist.mjs` and its public API to the list in `src/public-api.spec.ts`.
    `npm run test:tools` fails until the table matches the entry folders and the bench has the path;
    the lint direction rules and the stylesheet's `@source` glob find a new entry by themselves. The
    stylesheet's scan skips `video`, which styles itself with component CSS only: a Tailwind utility
    in video code needs that exclusion lifted in `neat-ui.tailwind.css`, with the reason there.
    The docs need their part too: a topic for the entry's parts in
    `projects/showcase/src/app/docs/topics.ts`, its examples folder (below), and
    `npm run docs:emit`.
- `projects/showcase`: the component gallery, which is the kit's docs (below).
- `projects/bench`: the rendering bench, an app that measures the diagram's drawing and is never
  published (below).

**The showcase is the kit's docs, generated from the kit's source and its own examples.**
`npm run docs:emit` reads the public API of every entry point (selectors, inputs, outputs, models,
types, defaults, doc comments) with the TypeScript compiler API, and every `*.example.ts` under
`projects/showcase/src/app/examples/<topic>/`, and writes typed modules into
`projects/showcase/src/app/docs/generated/`. They are committed, as `tokens.generated.css` is, so a
change to the public API or to an example shows in review as a diff and a fresh checkout needs no
pre-step; never edit them. Why generated: hand-written docs drift from the code. Here the API panel
is the doc comment, and the snippet under an example is the files that render it.

- A topic is one page, `/<group>/<topic>`, or `/<group>/<category>/<topic>` in a group with
  categories: its examples, each live with its code, and the API panel of its parts beside them.
  The groups, the categories, the topics, each topic's parts (each part in exactly one topic), its
  lead parts (the ones the body introduces) and its lazy loader are `docs/topics.ts`, written by
  hand. A topic with `fit: true` gets a Fit button in the top bar that calls `fit()` on each of
  its examples that has one.
- **The rail has four items: Getting started, Theme, Layout and Components.** Getting started is
  the showcase's own, in no group, with two sub-pages in the rail: the Quick start
  (`/getting-started`, `pages/getting-started.page.ts`), how an app starts on the kit, its snippets
  held to the kit by its spec (the tarball's name, the stylesheet's export, each part imported from
  its entry), and its note for coding agents held to the package README's rules for an app; and
  the Tutorial (`/getting-started/tutorial`, `pages/tutorial/`), for someone following by hand,
  from installing Node.js to a small streams app, each step ending with a picture of what it shows
  (`public/tutorial/<step>.webp`). The tutorial's code is real files, a folder per step under
  `pages/tutorial/steps/`, each holding the files its step involves as they stand after it (the
  unchanged ones its code needs included), so the build type-checks every step and the page's spec
  renders the app as the steps leave it; `docs:emit` writes them into
  `docs/generated/tutorial.ts`, showing a file only where it differs from an earlier step. A change
  to a step is a change to its files, then `docs:emit`, and a new picture where it shows
  differently. A group is a rail item, navigated as the kit says an app
  is (below): Theme's and Layout's few topics (`topics`) are its `children` in the rail;
  Components' categories (`categories`: Actions, Forms, Status, Data, Charts, Diagram, Video) are
  its `children`, and each category's topics are the page nav (`nav[neatPageNav]`, with a filter)
  of its pages, the API panel still the page's aside. `/<group>` goes to its first topic and
  `/components/<category>` to the category's first, the routes the rail's links need; an address
  that changed has no redirect, and only the catch-all, to Getting started, takes an unknown one.
  Why categories and not more rail items: a rail item per category read as an area of an app when
  the categories are only filing, so a new component topic goes under a category and a new
  category is a sub-page of Components, never a rail item. A category lists its topics alphabetically by
  label (`docs.spec.ts` holds it), so a reader finds a part by its name; a new topic goes in at its
  place. Topic ids are unique across groups
  (`docs.spec.ts`), since an id is also the examples folder and the `/demo/<id>` path. Escape
  hatch: a fifth rail item is a change to this rule, raised with the maintainer, not a new group in
  `topics.ts`.
  **The docs' search** is the kit's search palette in the top bar (`app.ts`, through
  `neatTopbarEnd`; Ctrl K from any page) and the `/search?q=` page of every result
  (`pages/search.page.ts`, a route with no rail item, so the rail keeps its four). Both read
  `search/docs-search.ts`: the topics and Getting started from `topics.ts` at once, and the parts,
  their members and the examples from `docs/generated/search-index.ts` once it loads (`docs:emit`
  writes it: each with the first sentence of its doc or caption, about 150 kB, loaded on the first
  search), each placed on its topic's page at `#api-<Name>` or `#example-<id>`. The matching (a
  name first, then other words) is `search/match.ts`, which the icon finder shares.
  A topic that is no part's docs (the theme's tokens, the icon finder) is hand-made: `page` (a
  lazy component) instead of `load`, with no parts, no examples module and no inputs, so it
  belongs to a group's own `topics`, not to a category.
- An example is a standalone component in `examples/<topic>/<id>.example.ts` (a numeric prefix
  orders the examples and is not part of the id). Its class doc is its caption: prose shown above
  it and left out of the snippet. Its title is the class name in words (`CPUUsage` is "CPU usage"),
  and the kit parts it imports are the "Shows" links. Its template is its own file beside it,
  `<id>.example.html` with the same prefix (`templateUrl`), never an inline `template`. Why: apps
  and their coding agents copy the examples, so they have the layout an Angular app starts with
  (`ng new` makes `app.ts` and `app.html`). The template, the data files it imports and the
  stylesheets it names (`styleUrl`) must be files of the topic folder, and are shown as further
  files of the snippet, in that order after the example's own file. It is real code: built,
  linted, and given a spec where it has behavior.
  A caption names only what an app can import: a code span or an identifier-shaped word in it
  that names something the kit declares but does not export (or a `ɵ` name) is a doc problem, as
  in a part's doc comment. The showcase's own `app.ts` is one more example of the `shell` topic
  (`SHELL_EXTRA` in `tools/docs-emit.mjs`), shown as code only because the page already sits in
  it, with its template `app.html`; it needs a class doc like any example, and counts once the
  topic has an examples folder.
- How the docs show an example is said by bare tags at the end of its class doc, each alone on
  its line: `@unpadded`, its live area without the inset, for an example that fills it to its
  edges (the diagram's Filling its card), and `@page`, a route of its own at
  `/demo/<topic>/<example>` that its card links to, for an example that needs the whole page (its
  own toolbar, page nav, panel or shell, which a docs page keeps for itself), and `@gallery`, the
  one example of its topic whose picture stands for the topic in the README's gallery (a second
  in a topic is a doc problem; a topic with no example that makes a good picture has none and is
  named under its section instead), and `@animated`, an example whose point is motion (a live
  chart, the bird's-eye view, the live dot's pulse), which the Markdown docs and the README's
  gallery show as an animation, its still picture kept for a reader who asked for reduced motion;
  it does not go with `@capture` (a doc problem), and an example that moves only when a reader
  acts on it (a slider) is not one; and `@unpictured`, an example the Markdown docs show with its
  caption and code but no picture, for one whose point is what a widget reports to the app and
  takes from it (the "From the app" examples, the bird's-eye view's Interaction), which a picture
  cannot show and which the showcase runs; the capture skips it, and it takes no `@gallery`,
  `@animated` or `@capture` (a doc problem). Why per example: how
  an example shows is a fact of that example, beside the code that needs it, so no stylesheet
  outweighs the card's padding and no topic sends examples that fit a card off to a page. Any
  other tag, or text after one of these, is a doc problem. Escape hatch: a new way to show an
  example is a new tag (`EXAMPLE_OPTIONS` in `tools/docs-emit.mjs`, `DocsExample`, the example
  card), never a rule in an example's stylesheet that reaches into the card.
  One tag takes words: `@capture click <selector>` or `@capture hover <selector>`, for an example
  whose content opens in an overlay (a popover, a tooltip, a dialog, a toast, an open select). The
  page ignores it; the docs' pictures (below) click every element of the example the CSS selector
  matches, or hover the first, and show what opened: beside the example, or alone when it is modal
  or opened away from it. `docs:emit` checks its action and that it is one line; a selector that
  matches nothing is a warning of the capture, which then pictures the example as it is.
  An example the docs picture by driving it takes a script instead: `@play hover <selector>`,
  `@play click <selector>` (either with `at <x>%,<y>%` of the target's box before the selector)
  and `@play wait <ms>`, one step a tag, in order. Its still shows the state the script leaves
  (an open section, a crosshair, the last tooltip), framed with what it opened as for `@capture`
  (the two do not go together, a doc problem), and with `@animated` the animation shows the
  script run: a drawn cursor glides to each target, then hovers or clicks it. `@hide <selector>`
  names the example's controls that only drive it for the reader (the slider under a progress
  bar, a "Next value" button): the pictures leave them out (no opacity, so the script still
  drives them) and draw no cursor. Why: hover and click behavior is the point of a tooltip or a
  collapsible, so the cursor shows it; a progress bar's slider is not, so the bar moves alone.
  `@animated` takes a length and a rate where the defaults do not suit (`@animated 8s 20fps`, the
  messaging pipeline, whose dots jump at 10 frames a second); a script runs as long as its steps
  take. `@animated lossy` encodes it lossy (below), for motion that lossless encoding makes
  several times too large.
- `npm run docs:emit -- --check` (which `npm run test:tools` runs, so CI does) fails on a stale,
  missing or extra module and on doc problems: a part or an own input, model or output without a
  doc, an example without a caption or with a tag that is not one of its options, a caption naming
  a name the kit does not export.
  `docs:emit -- --watch` keeps the modules live while editing; `npm start` writes them once first.
  `docs/docs.spec.ts` fails a public export in no topic or in two, a component, directive,
  service or function of a topic that none of its examples shows, and a topic page that does not
  render in jsdom with its examples and API panel.
- **The examples' pictures** for the Markdown docs come from `npm run docs:capture`
  (`tools/docs-capture.mjs`): it builds the showcase, serves it and, in Chrome through Playwright,
  takes each example's live area (a page example's content area on its route) in light and dark as
  WebP, `docs/images/<topic>/<example>.<scheme>.webp`. Fixed viewport and pixel ratio, reduced
  motion, the docs page's side panel closed, the corners transparent; Chrome's canvas encodes, so
  there is no image library for the stills. An `@animated` example is also taken as an animation,
  `<example>.<scheme>.animated.webp`: 4 s at 10 frames a second, at the stills' pixel ratio and
  framing, in a context without reduced motion under Playwright's fake clock (paused once the
  example has settled and stepped a frame at a time, the page's CSS animations with it), each
  frame cut losslessly in Chrome and the frames joined by sharp (libwebp), lossless at its
  slowest, smallest setting. Why lossless: the kit's flat colors and sharp edges come out smaller
  lossless than lossy at that setting (the bird's-eye view: about 260 kB against 1 MB from
  Chrome's lossy encoder), with no artifacts; Chrome's own lossless encoder is a fast one, larger
  than its lossy. The exception is moving blur, which lossless encoding stores almost frame by
  frame: the message box's glows came to 2.7 MB lossless and 400 kB lossy at quality 85, which
  looks the same at the docs' size, so such an example takes `@animated lossy` (quality 85, its
  transparent corners kept whole). A `<video>` plays on the browser's clock, not the fake one, so a video's
  frames come as the page shows them; a video frame callback is given the fake clock's time, as
  Playwright gives `requestAnimationFrame`, since the tile measures a stall between the two (it
  blurred for a frame every 1.8 s before). A scripted animation (`@play`, `@hide`) is framed anew
  each frame over the whole viewport, the example's part and its open overlays, and cut to their
  union, so a section that opens or a tooltip past the example stays in the picture; the cursor
  is drawn onto the frame, above every overlay. The trim measures an SVG's shapes as well as its
  box, since a drawing may run past it (the diagram's loops). It warns past its size budget (150 kB
  a picture, 400 kB an animation, 40 MB in all) and never fails for it, and it lists the pictures no
  example makes any
  more rather than deleting them. `-- --gallery` takes only the `@gallery` examples, and
  `-- --only stills` or `-- --only animations` only the one kind. Pictures are committed (the docs
  pages and the README's gallery show them) and retaken at a release, not on every change: a
  picture is a few dozen kB, an animation a few hundred, that git keeps forever. It is not run in
  CI.
- **The Markdown docs** are written by `npm run docs:pages` (`tools/docs-pages.mjs`):
  `docs/README.md`, the index, and `docs/<group>/<topic>.md` for each topic generated from the kit
  (a hand-made one, the theme's tokens, has none). A page is the writing guide's page shape: the
  lead part's first paragraph, a picture, the import, each example (caption, picture, code folded
  in `<details>`), then each part's API (kind, entry, selector, doc, inputs, models, outputs and the
  rest, a part's name linked to the page that documents it). It shows an example's picture only when
  `docs/images` has it, so a new example never waits for a capture, and its animation in the
  picture's place when that is taken too: a `<picture>` whose first sources give the still to a
  reader who asked for reduced motion (`pictureSources`, which the gallery's cells share). The pages
  are generated: never
  edit them, and Prettier leaves them alone (`.prettierignore`); `npm run test:tools` fails when
  they are stale, and a page of a topic that is gone is removed (only a `.md` file directly in a
  group's folder, `removablePage`).
- **The README's gallery** is written by `npm run docs:gallery` (`tools/readme-gallery.mjs`)
  between its two markers, from `topics.ts` (a group's own topics or each category as a section,
  Charts, Diagram and Video first, `LEAD`, then the rest in rail order) and the `@gallery` examples, each picture light and dark in a `<picture>` and linked to
  its topic's docs page. `npm run test:tools` fails when it is stale or a pick has no picture. The
  README's quick start repeats the Getting started page's four snippets, and that page's spec
  holds them to it.
- **Links stay whole:** `tools/markdown-links.mjs`, in `npm run test:tools`, fails a relative link
  or picture in README.md, CONTRIBUTING.md, AGENTS.md or `docs/` that names no file, or an
  `#anchor` that names no heading of its Markdown file (anchors as GitHub makes them).
- `provideNeatUi` and `provideNeatTitles` configure an app once, in its `app.config.ts`, and
  `NeatToastHost` is rendered once, in its root template, so no example can show them without
  faking their use (a second host would show every toast twice); `docs.spec.ts` names them as
  exempt from the rule that a function or a component has an example.

**The toast host is rendered by the app, once, beside the shell.** `<neat-toast-host />` goes next
to `<neat-shell>` in the app's root template (as the showcase's `app.ts` does); `NeatToasts` shows
nothing without it. Why not in the shell: the shell is the primary entry, which cannot import a
secondary one, and an app that shows no toasts should not carry them. The host renders in the CDK
overlay layer, not where it stands, so a modal dialog's `aria-hidden` on the page does not silence
it and it can sit above a dialog (each new toast brings the stack to the front). Two layers: the
visible stack (`aria-hidden`, takes no pointer events) and a never-re-shown, visually hidden
`aria-live` region that announces each toast once.

**The entry points depend one way.** A secondary entry may import the primary and other secondary
entries only through the package name (`from '@sima/neat-ui'`, `from '@sima/neat-ui/input'`),
never by a relative path across the boundary; the primary never imports from a secondary entry.
Why: ng-packagr builds the primary first and gives each secondary the built package, so a relative
path would copy the primary into the entry's bundle, and an import the other way is a cycle. Two
tools guard the two halves: ESLint (`no-restricted-imports` in `projects/neat-ui/eslint.config.js`,
run by `npm run lint`) fails a relative import from entry code out to a `src` folder or another
entry, and any import of an entry (relative or `@sima/neat-ui/<name>`) in the primary; `npm run
check:dist` fails a build that lacks an entry's FESM, or whose primary bundle contains a
selector of a secondary entry (`neat-video-tile`, `neat-segmented`, ...), which catches entry code
that reached the primary some other way. Specs are not packaged but stay under the rule, except for
what they cannot do without and may import by relative path: `src/lib/theme/` (the helpers the
primary does not export), `src/lib/ui/` (the vendored helm source their drift checks read as text)
and `src/lib/typography/helm-classes.testing.ts` (what reads helm's classes from that text, and
the one way every drift check compares them: the kit's set is helm's less named departures and
plus named additions, so a class helm adds and one it drops both fail). The primary's
`public-api.spec.ts`, which compares it with every entry, is the one file that imports entries by
relative path. A new export goes into the entry point that owns its code, and only what an app or
the showcase needs is exported: a helper that only the kit's own code uses stays internal.

**d3 belongs to three entries, each to its own packages.** `charts` imports `d3-scale` and
`d3-shape`, `diagram` and `bev` import `d3-zoom` and `d3-selection` (each by its exact name, no deep
paths; both pan and zoom with them), and nothing else imports d3. ESLint (`@typescript-eslint/no-restricted-imports` in the root
`eslint.config.js`, which the kit's and the showcase's configs both take) fails any other import of
`d3` or `d3-*`; `tools/lint-boundaries.test.mjs` runs the real configs over sample code to prove it
fires and that the entry-direction rules above still do. Why: d3 reaches an app's bundle only
through the entry its lazy route imports, and the apps draw through the kit's components, never
through d3. The diagram's rate card and figure card draw their history with `NeatSparkline`,
imported from `charts` by package name as any entry may: in a production build only a page that
uses one of the two carries `charts` and its two d3 packages (about 16 kB minified); an unoptimized
build loads the whole entry.
Licenses: `d3-scale`, `d3-shape`, `d3-zoom` and `d3-selection` are ISC licensed runtime
`dependencies` of the package, listed in `allowedNonPeerDependencies`; what `d3-zoom` brings with it
is ISC too (`d3-dispatch`, `d3-drag`, `d3-interpolate`, `d3-timer`, `d3-transition`) but for
`d3-ease`, which is BSD-3-Clause. A new d3 package is a new dependency: check its license and its
own dependencies' before adding it here and to the rule.

**marked belongs to the markdown entry.** `markdown` lexes Markdown with `marked` (an exact version,
in `allowedNonPeerDependencies`) and draws it with the kit's own templates; nothing else imports it.
ESLint (`MARKED` in the root `eslint.config.js`) fails an import of `marked` outside
`projects/neat-ui/markdown/`, and `tools/lint-boundaries.test.mjs` proves the rule fires. Why: it
reaches an app's bundle only on a page that shows Markdown. License: `marked` is MIT and has no
dependencies of its own. A change of its version is reviewed like a dependency added: its license,
its dependencies, and the Markdown specs, which pin how blocks and half-finished marks lex.

**The rendering bench (`projects/bench`) is measured, never published.** It finds how much diagram
(blocks, edges, notes, moving dots) a machine draws smoothly, with the kit's renderer and with
ngx-vflow under the same load, on a laptop and on the Modalix board (its design notes are kept
outside the repo). Its dev dependencies sit in the root `package.json`, the workspace's one
manifest, and never in `projects/neat-ui/package.json`, the published one. Licenses, all bench-only but Playwright, which the docs' capture tool uses too
(above): `ngx-vflow` MIT, `d3-drag` ISC (vflow's peer),
`@types/d3-drag` MIT, `playwright` and the `playwright-core` it wraps Apache-2.0, `source-map`
BSD-3-Clause; and the capture tool's own `sharp`, Apache-2.0, whose prebuilt libvips binaries
(`@img/sharp-libvips-*`, which bring libwebp) are LGPL-3.0-or-later, held to the same rules
below though no bench code uses it. ESLint (`BENCH_ONLY` in the root `eslint.config.js`) fails an
import of any of them
outside `projects/bench/`, where `d3-drag` is the one d3 package allowed, and `npm run check:dist`
fails a built package that names one. ESLint catches static imports only; a dynamic `import()`
is covered by `check:dist` alone. Why: apps install the kit, never the bench's tools. The capture
tool is a `.mjs` file under `tools/`, outside the ESLint rule, and never part of the package.
**The diagram's bench seam is an agreed exception** to exporting only what an app needs.
`projects/neat-ui/diagram/src/bench-seam.ts` re-exports, for the bench alone, the internals it
needs to draw the kit's picture with vflow and put the kit's own dot layer over it: `drawLevel`
(the routes, end markers and colors), `placeNotes`, `levelExtent`, `fitTransform` and `ZOOM_LIMITS` (the
same notes and the same start), the messaging layer's context token and its types, `DOT_FRAME_PROBE`
and `MAX_DOTS`. Why not public: a testing entry would be a promise to every app, and bench copies
of the routing or the painter would measure different code. It is not in `public-api.ts`, so
ng-packagr never ships it. Only `projects/bench/tsconfig.app.json` declares its alias,
`@bench/diagram-seam`, beside a copy of the workspace's entry paths (a tsconfig's own `paths`
replace those it extends; `tools/bench-tsconfig.test.mjs` keeps the two in step). ESLint (`SEAM`
in the root config) fails an import of it outside `projects/bench/`, and a relative one inside;
`npm run check:dist` fails a package that names the file or exports a name the seam exports. A new
name in it is a new reach into the kit: add one only for what the bench measures, saying why in
the seam's header.
**The bench's BEV page** (`/#/bev`, `hosts/bev-host.ts`) measures `neat-bev` under its budget
(100 objects, 30,000 points, 4 lines and a 128 × 128 grid at 20 Hz, `synth/bev-load.ts`;
`?objects=` and `?points=` change it): after a 2 s warm-up it records 10 s of frames and each
frame's script in its animation-frame callbacks (`measure/callback-timer.ts`, which wraps
`requestAnimationFrame`, so it reaches into nothing of the kit's), shown on the page and as
`window.benchBev`. It is not part of the ladders. Measure in a browser with a display and a GPU:
headless Chrome rasterizes the canvas in software, and with a GPU but no display it gets about one
frame a second.
**The bench's chat page** (`/#/chat`, `hosts/chat-host.ts`) measures the chat parts' motions
under their budget: a transcript and a message box as an app has them, a question with the shelf
picture, its reply waiting for `wait` ms (1300) and then streaming 500 pieces at 50 a second
(`synth/chat-load.ts`, the mockup's tokenizer over a seeded corpus; `reply=code` streams a
paragraph and a Python block of about 400 pieces instead), in the `text`, `picture` and `glow` the
query names (`reply=mockup` streams the moments mockup's two sentences). After the 2 s warm-up it
measures the waiting phase and the streaming phase apart (the frames, each frame's script, the
long frames), shown on the page and as `window.benchChat`; `measure=0` loops for watching. With
`listen` (a listening motion) the box first records 3 s through push-to-talk, transcribes for
300 ms and lets the heard question arrive for 1.5 s, measured as the listening and heard phases,
and the page decodes the recording (`recorded`); with `speak` (a speaking motion) the reply is
read aloud as it streams, each complete sentence of `neatSpeakable` at 55 ms a character with a pretend voice, and
3 s of the speech after the reply is the speaking phase. `npm run bench:build`, then
`node projects/bench/harness/chat-budget.mjs --out <file.json>` runs every variant with Chrome's
CPU at full speed and slowed 4× (CDP's `Emulation.setCPUThrottlingRate`) in the installed Google
Chrome, headed, with Chrome's fake camera and a fake microphone playing a fake voice
(`tools/fake-voice.mjs`: `--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`,
`--use-file-for-fake-audio-capture`) and autoplay allowed; a run passes when every phase it has is
smooth, and a listening run only when its recording decodes to within 300 ms of 3 s. It is not
part of the ladders.
Run files go to `projects/bench/results/`, which is gitignored; each campaign's summary is
published as a page. **A board campaign is one command shape:** `npm run bench:build`, then
`npm run bench:run -- --target remote --ssh <user@board> --remote-display bare --serve board
--trace ...` (ladder E, the soak, in its own untraced campaign). Only `bare` runs heal themselves:
the board's guard puts LightDM back even when the laptop is gone, while a run without it (a
`--remote-display :0` run, `--serve board` alone) is cleaned up by the laptop's stop and nothing
else. The harness's specs are `npm run test:tools`; the ones that run board scripts need GNU/Linux
and skip elsewhere.

Operations live where the code is, not here: the harness headers (`harness/remote.mjs`,
`board-x.mjs`, `board-teardown.mjs`, `board-server.mjs`, `signals.mjs`, `trace-check.mjs`,
`campaign.mjs`) and `npm run bench:run -- --help` for the board, the guard, Ctrl-C, the serve
rules and the trace check; the page's own headers (`src/app/run/`, `synth/`, `hosts/`) for the
auto mode, the seeded load and the fairness check; `src/app/results/` for the results view and
the verdict rule; `projects/bench/VALIDATION.md` for the numbers, the rulings and the other checks.

**How the charts are drawn.** Every chart in `charts` but the heatmap is an SVG with
`viewBox="0 0 600 100"`, `preserveAspectRatio="none"` and `overflow: visible`, so it fills
whatever box its host has, and its strokes carry `vector-effect: non-scaling-stroke`, so a
stretched box does not thicken them. What must not stretch (labels, the newest point's dot, the
crosshair, the readout) is an HTML overlay positioned in percent of the box, so nothing measures
the chart. Colors are named in `line-token.ts`, the one place a tone or a series index becomes a
token (the reference line's `--muted-foreground`, `REFERENCE_TOKEN` in `time-chart.ts`, and the
heatmap's `color-mix` in `fillOf` aside), and reach the CSS as a custom property the stroke or
fill reads (`--series`, `--level`, `--tone`, `--cell`, `--sparkline-stroke`), so a variant (a
tone) is stated once. A series' swatch is the primary's `NeatSeriesSwatch` (its `index` from 0,
through `seriesToken`, the kit's one rule from a series to its token, which the primary keeps
beside the swatch and shares with `charts` and `diagram` as `ɵseriesToken`, and its custom
property's name for code that resolves colors itself as `ɵseriesTokenName`; `line-token.ts`
re-exports it), which the legends and readouts render and an app shows beside its own labels (a
run's chip), so a label outside the chart matches its line by the same rule and its look is
stated once. The paths come from `charts/src/lib/geometry.ts` (d3-shape's `line` and
`area`, and d3-scale's linear scale for y, clamped): samples sit where their times put them, or
evenly when a time is missing, and a missing sample (`null`) breaks the line instead of dropping
to zero. A lone sample draws no line and no area; the time chart's newest-point dot, an HTML
overlay at `linePaths().last`, is the only dot, so a lone sample shows as that. The time chart's
readout words its relative time with `neatSecondsAgo` from the primary, the kit's one
relative-time style; its x axis ("−8 min · −4 min · now") is axis notation, not prose, and stays
short for that reason. Its `axis` input (`NeatChartAxis`) picks what that axis, the readout and
the accessible name count: `recent` (the default) back from the newest sample, `elapsed` forward
from the first ("0 s · 17 s · 33.9 s", "at 17 s", "over 33.9 s"), for a run read from its start.
Both wordings come from one code path (`timeAxis`, `whenText` and `chartName` take the axis), so
they cannot drift apart. Its plot is a tab stop whose readout the arrow keys, Home, End and Escape
drive; each key press, and only a key press, is repeated in a polite live region, since a pointer
move announced on every pixel would be noise. A chart with a live region (the time chart, the
stacked chart, the heatmap and the label timeline) is `position: relative` on its host, without a
z-index (`chart-frame.css`, and the timeline's own sheet): the host is the containing block of its
own absolutely positioned parts, so the visually hidden live region cannot reach past a page's
scroll body, which is not positioned, and a readout that hangs below its plot still paints over the
next card.

The charts that read out what lies under the pointer (the time chart, the stacked chart, the heatmap
and the label timeline) share one cursor, `ReadoutCursor` in `charts/src/lib/readout.ts`: the
pointer-versus-keys rule, Escape (a readout that is there to close, else it belongs to whatever
holds the chart), focus, blur and the announce rule live there once, and each chart tells it only
what its cells are (a sample for the time-based charts, a row and column for the heatmap, a run for
the timeline, whose strip is its tab stop). The frame the plots share (heights, grid, time axis,
accessible name) is `frame.ts`, and their styles are `chart-frame.css` (host, head, axis),
`readout.css` (the readout, which the timeline shares without the rest of the frame) and `plot.css`
(the drawn box), which a component lists before its own in `styleUrls`. The stacked chart's bands
are `stackedPaths` (bottom first; a sample where any band is missing breaks the whole stack, since a
partial sum was never measured, and for the same reason a sample of "Other", the sum of the series
folded beyond eight, is null where any folded value is), at 0.85 opacity with a hairline in
`--neat-surface`; its legend carries each band's value and share as text, because eight colors
alone are not enough. The heatmap is an HTML grid, not an SVG: a cell is a `<span>` whose `--cell`
is a `color-mix` of `--neat-heat-low` and `--neat-heat-high` by the value's place in the domain
(transparent when empty), its rows are columns of time from `heatmap-columns.ts` (at most 48, one
per sampling interval while the history is short, so a pause stays visible, and a poll that comes
late leaves no empty column), and its grid is one tab stop with a cell cursor. The geometry is
internal; only the components and their types are exported.

`NeatChartCard` is the one card for a metric (the overview cards, the Power tiles, a run view's
tiles): heading, `[neatChartCardChip]`, value with unit, caption, then the chart. It is a preset of
`NeatCard` (`card`): the heading stands in the card's title (a button when selectable, through
`neatCardTitle`; no heading role and no region, so its accessibility tree is what it was before),
the chip is its header actions, the rest its content. The frame, the `--card` fill and
`--neat-surface` (for the charts' label halos) are the card's, in one place; the chart card adds
the selected look. The card has no `overflow`, `z-index`, `isolation` or `transform`: a
readout can hang below its plot, and a card that clipped it or made a stacking context would let
the next card paint over it. A `selectable` card's heading is a button
with `aria-current` and a click anywhere on the card emits `activate` too, its chart's plot
included: the readout follows the pointer without a click, and the plot is most of the card. Only
a control in the content (a button, a link, a form field) keeps its click; the plot's keys move the
readout and choose nothing. A chart in a card can drop its value labels (`[valueLabels]="false"`):
the grid and level lines, the time axis and the readout stay.
A time chart's `size="fill"` is labeled as `medium` and takes the height its host is given: the
host is a flex column and the plot takes what the title, legend and axis leave, never under
medium's 6 rem. The app gives the host that height (a grid item its row stretches), so it needs no
`::ng-deep` to make the plot grow.

**How the diagram is drawn.** `diagram` draws diagrams the app places by hand (no automatic
layout, no editing): the app places every node, the kit routes the edges between them and draws
the whole in the kit's look.

- **The model** (`model.ts`) is plain data an app may recompute on every poll. A `NeatDiagramSet`
  is an overview and its drill-down levels, each a `NeatDiagram` of nodes, edges and notes.
  Coordinates are diagram units (px at zoom 1), and a node's `x` and `y` are relative to its
  `parent`. A node's `role` is `group` (holds nodes, behind the edges, its title a size above a
  block's label), `block` (a card), `band` (a cable or a bus) or `bracket` (a brace under a row of
  siblings); its `look` is `default`, `accent`, `dashed`, `ghost` (a part not running) or `muted`.
  Its `badges` (`NeatDiagramBadge`) are the kit's badges, soft; `chips`, their old name, is
  deprecated and drawn only while a node has no `badges`, so a node given both shows its `badges`
  (`badgesOf` in `model.ts`, which the drawing and the hidden list share). Its `stale` (a block's
  or a bracket's diagnostics stopped) gives the whole card the look of `[neatStale]`, the primary's
  `ɵSTALE_CLASSES` applied to the card, so the label, badges and the app's content gray out
  together, with no transition, and the hidden list adds "stale"; the app says why in its content.
  **Where a part runs is said by a badge in one convention**, documented here rather than enforced,
  so every demo reads alike: the hardware decoder `HW` in `success`, `EV74` in `highlight`, `MLA` in
  `info`, `A65` in `neutral`. An edge's `series` is 1 to 8, the charts' `--neat-series-1` to `-8`
  (counted from 1, unlike `NeatSeriesSwatch`'s index from 0, and converted in one place,
  `seriesIndex` in `drawing.ts`); unset, or on a `ghost` line, it is muted. Its `line` is `solid`,
  `dashed` or `ghost`, its end markers `none`, `arrow` or `dot` (unset: none at the start, an arrow at the
  end), and its `label` a small mono chip at `labelAt` along it. A note is anchored to its `edges`
  (the mean of their points at `along`, 0.5 unset) or to an `anchor` point, placed at `x`/`y` or
  moved `dx`/`dy` from the anchor, and joined to it by a dotted leader that meets the box's nearest
  point, or its center with `leaderTo: 'center'`. A node's, an edge's and a note's `data` is the
  app's and never read. A part whose ids name nothing (an edge's end, a node's parent, a block's
  `opens`, a note's edge) is left out and named once in dev mode; the diagram never throws for it.
- **The drawing:** `neat-diagram` is a `figure` named by its `label`. Groups and bands are
  positioned HTML behind one SVG of edges; blocks, brackets, edge labels and notes are HTML in front
  of it; one container holds them all, which is what pan and zoom move. Every part is keyed by its
  id, so an equal diagram recomputed on every poll changes nothing in the DOM and a moved node is
  the same element, moved. The routing (port sides and order so fans do not cross, Z routes sharing
  a corridor spread apart, stubs when the target lies behind) is the Autoware demo's, ported with
  its specs, plus one rule of the kit's: an edge whose ports face each other between boxes that
  overlap across runs straight, both ports at one coordinate in the overlap (the spread port's of an
  end with several on its side, so a fan keeps its order) and clear of both boxes' rounded corners,
  instead of a Z with bends a few units apart; edges that share a loop (a U between sides facing
  one way, or a route behind its source between facing sides) are drawn as parallel offsets of one
  another (`spreadLoops`, `LOOP_STEP` apart): a U's ports turn round at its target so they nest and
  the outer one turns higher, and a route behind takes the longer stub at one end and the shorter
  at the other, as an offset staircase does. Where the kit's routing is not what an app wants, an
  edge says it itself: `fromAt` and `toAt` pin its ends along their sides (0 to 1), `via` gives the
  corners it runs through (the kit then spreads no corridor or loop for it, and the label, end markers,
  hover and messages follow those points), and `labelSide` (`on`, `above`, `below`, `left`,
  `right`) with `labelOffset` places its label beside the line, the dots' covers following the
  label's box; an edge between a group and a node inside it runs
  inside the group, from the group's border nearest the node (the group's own `outSide` and `inSide`
  are for the nodes around it). An edge end goes on the side its edge's `fromSide` or `toSide`
  names, else its node's `outSide` or `inSide`, else the side facing the other end; the route and
  the label follow it (an end inside a group stays on the group's border). An edge's color comes
  from `lineColor` in `drawing.ts`, through `seriesIndex` and the kit's `seriesToken`, and each
  line look is stated once in `lines.css`, which the edges and the legend's samples both read. A
  visually hidden list after the drawing says the level's nodes (label, detail, badges) and edges
  ("Camera to Decode, image") in words.
- **The app gives it its size.** The host has no height of its own (what it draws is positioned
  inside it), so without one from the app it is zero high and shows nothing; it fits its level
  once it has a size, so a hidden tab is fine. Give it a bounded box: a height, an
  `aspect-ratio` with a `max-height` (the showcase's), or a grid cell. It takes the wheel and touch
  over that box (`touch-action: none`), so it should not be a long stretch of a scrolling page,
  where it would catch the wheel meant for the page.
- **The app's content comes in through templates, one per kind, each given its part as
  `$implicit`:** `ng-template[neatDiagramBlock]` (a block's body below its label),
  `ng-template[neatDiagramNote]` (a note's content) and `ng-template[neatDiagramEdgeTooltip]` (the tooltip
  of the edge under a mouse or a pen). The app matches parts inside the template, by id or by `data`
  (`@if (note.id === 'rate') { … }`): one template per kind rather than one per id keeps the
  diagram's input plain data. A bracket renders the block template too, after its label and detail
  (the stage's live time over a row of blocks); `node.role` tells the two apart. A block's body sits
  in its card below the label, and the card keeps the size the node gives it, so the app sizes `h`
  (and `w`) for the body it renders. A block the template renders nothing for keeps its card as it
  is, a note it renders nothing for is not drawn (nor its leader; without the template no note is),
  and an edge it renders nothing for shows no tooltip. The tooltip sits by the pointer in the popover's
  colors, kept inside the box, and is hidden from assistive technology, so it must hold nothing a
  reader needs that the hidden list or a note does not say.
- **Focus:** by `highlight`, `'none'` by default, a block or an edge under the pointer, or a block
  whose open button has the keyboard's focus (`:focus-visible`; a press that focuses it does not
  count), stays as it is with what it is joined to (a block's edges, an edge's ends, the notes on
  those edges) while the rest but the groups fades to 0.25 (`hover.ts`). `'edges'` lets only an
  edge do this, `'all'` a block too. Why none: dimming everything on every pass of the pointer is
  noise unless the drawing is read by its links; an app opts in where it is (the Autoware demo
  limited it to links). The edge's tooltip does not depend on it. A note anchored by `anchor` alone
  belongs to no edge, so it is never in focus with one and fades whenever anything is in focus.
  Touch and a drag put nothing in focus.
- **An opening block's border** is one 2px primary border with no box-shadow ring, and its padding
  gives up the 1px, so the content stays put. Why: a 1px border with a 1px ring round it
  rasterizes as two lines that drift apart under a fractional zoom. Do not add a ring to show
  "opens"; if a look needs one, draw it with the border.
- **An example's drawing box** is sized for the drawing, not for a phone: 4:3 up to `40rem` (2:1
  up to `30rem` for a wide drawing: the drill-down's level, the Counts and times row), kept in each
  example's own stylesheet because that is part of its copyable snippet. Why a cap at all: a
  narrow box must not stand tall and empty around a drawing its width shrinks.
- **Levels and the path:** a block whose `opens` names a level is a button ("Open Stages") that
  opens it, and a level may open further levels. `[(level)]` is the path of open levels, `[]` for
  the overview, which an app can bind to its route. A path is followed while each id names a level a
  block of the level before opens; one that leads further nowhere (a stale route) is cut there and
  the model set to it (`levels.ts`). So an app renders the diagram once its data is there: the path
  is checked against the diagram it is given, and a routed path is cut while a placeholder diagram
  is shown. While a level is open a bar top left over the drawing, unscaled and first in the tab
  order, has a back button (an outlined small `neatButton` with the registry's `previous` icon,
  named "Overview" or after the level before, by the block that opens it) and the path as
  `neat-breadcrumbs`, each crumb named by the block that opens its level and the last, where the
  user is, followed by that block's detail, muted; a fit leaves the bar's height free above the
  level (and fits again when the path wraps). A pressed control that leaves with its level leaves
  the focus on the box, and a part the keyboard focuses is panned into view (the box clips with
  `overflow: clip` and never scrolls). `neatDrillDownLevel(diagram, blockId)` places the level a
  block opens from a diagram that holds the block's insides, as the demo does: the block as the
  group, what it holds inside as placed, the nodes it exchanges edges with in a column left
  (senders) and right (receivers), at the demo's sizes; an app may use it or place a level by hand
  (the drill-down example, `examples/drill-down/`, uses it, from a copy of the pipeline that has
  the Detector's steps).
- **Pan, zoom and fit** (`zoom.ts`, d3-zoom on the box): drag, wheel, pinch and double-click; the
  box is a tab stop whose arrow keys pan 48 px, `+`/`=` and `-` zoom 1.25× about its center and `0`
  fits; zoom 0.2 to 3. It fits its level to its box by itself (on its first size, a resize, a new
  extent or level) until the user pans or zooms, as the demo does (a press that moves 3 px or less
  is a click, not a pan). Its `fit()`, for an app's Fit button, fits again, over 250 ms or at once
  under reduced motion, and hands the view back to fitting by itself. An edge's hit path stays 12 px
  wide on screen at any zoom.
- **The legend:** `neat-diagram-legend` takes `items` (`NeatDiagramLegendItem`: `series?`,
  `line?`, `label`) and shows them as the demo's legend chip, a list named "Legend". A series
  without a `line` shows the kit's `NeatSeriesSwatch` (from the primary, so no d3 comes with it);
  any other item shows a short sample of its line (solid when unset) drawn by the edges' own rules
  in the color its edges take, muted for a ghost, without a series or for a series not 1 to 8.
  The app places the legend: above the diagram, or over it in a corner the level bar (top left)
  does not take, as the Filling its card example does.
- **The messages** (`messages/`): `neat-diagram-messages`, projected into `neat-diagram`, draws the
  messages an app feeds by id: `push(edgeId, bytes, atMs?)` per message (`atMs` on the
  `performance.now()` clock) and `stageMs(nodeId, stage, ms)` for the stage times. A message on a
  drawn edge is a dot along it, radius by bytes, travel time by the edge's length at `speed`
  (`NeatDiagramMessageSettings { speed, size, every, steps }`, the demo's 270 units/s, every Nth
  message with `every`), in its edge's color or the series `colors` names. `steps` (keyed by edge
  id, `NeatDiagramMessageStep { from, stage, shares? }`) are edges inside a block no message feeds:
  a dot arriving at a step's start goes on once the stage's time has passed, along the chain, and
  a message places at most `MAX_CHAIN` (32) dots in all, so steps that loop or fan out cannot grow
  without bound. `passive` (edge ids, fed edges and steps alike) names the edges whose messages
  start no steps. `rate(edgeId)` is a signal of messages and bytes per second and a 60 s history
  (`rate(edgeIds)` of several edges their sum: rates added, histories added second by second from
  the newest, so an edge that began later adds nothing before its first second; the same signal
  for the same ids, and `neat-diagram-rate-card` shows the sum like any rate), refreshed at 12 Hz
  while something reads it. A push counts on any edge of any level, drawn or not, so a level opens
  with its numbers; the step edges count only while their level is drawn and the page is visible, as
  their dots place them. An id that is no edge of the diagram is ignored, which keeps the rates'
  memory bounded by the diagram. The performance rules: one canvas over the drawing, sized to the
  layer's own box at the device pixel ratio, sprites per color, edge shapes sampled once per layout
  and mapped to the screen once per pan or zoom, nothing allocated and no signal written per dot or
  per frame, at most `MAX_DOTS` (16 384) dots with the oldest dropped, frames only while a visible
  dot moves (messages that get no dot, see `every`, run none) and never while the page is hidden.
  Dots go behind the blocks, notes and edge labels (a label's measured border box with its own
  corner, as the edge's line goes under it); at an end on a block a dot runs on a radius into it,
  so it comes out of and goes into the block whole instead of popping at the port; they fade with the hover (`--diagram-dim`), scale with the zoom
  and recolor with the scheme (`neatThemeColors`); under reduced motion each message is a brief
  mark at its edge's end. `neat-diagram-rate-card` (`label`, `rate` the signal's value, `stageMs?`,
  `showBytes`, a `[neatRateCardThumbnails]` slot the app lays out) is the demo's card for a note's
  content: the label, whole msg/s, MB/s in hundredths from units of 10 kB, and a `NeatSparkline` of
  the history, or a step's stage time in ms to a tenth in place of the MB/s and the sparkline;
  `showBytes` false leaves the MB/s out for an app that pushes no sizes; it draws no box, the note
  does. `neat-diagram-animation-settings` is the demo's Animation popover (an icon button,
  `neat-popover` with `neat-slider`s for speed 50 to 1000, dot size 0.5 to 2 and messages per dot 1
  to 10, a reset to its `defaults`; dots always go on through the steps) over a two-way `settings`
  model; it keeps nothing. Its `defaults` are `NEAT_DIAGRAM_MESSAGE_DEFAULTS` unless the app gives
  its own starting settings (the messaging example's calmer dots), so a reset returns to where the
  app started. An app that remembers the choice per browser makes the model a `neatStoredSignal`
  with those defaults as its initial value and `neatParseMessageSettings` (clamps, rounds and
  defaults what an older version stored, to the same defaults when given them) as its parse. The
  layer reaches the diagram only
  through an internal context token (the drawn level's edges, the covers, the focus, the transform
  and a hook for its changes), so a benchmark can provide it over another renderer, with an internal
  per-frame probe; neither is public. **Feeding it:** call `push` straight from the transport's
  handler (a timer, a WebSocket message, a poll's reply) per message, with no signal and no batching
  of your own: it is cheap, safe outside the zone and safe to call from anywhere, and a push for a
  level not drawn only counts; an unknown id is ignored. To spread a batch that arrived together,
  pass each message's time from `neatBatchTimes(offsetsMs, arrivalMs)` (the messages' own times from
  the first, at most 200 ms apart, from the batch's `performance.now()`) as its `atMs`; call
  `stageMs` whenever a stage's time changes. A burst (10 000 pushes in one tick, or what piles up
  while a tab is hidden, when pushes only count) costs the cap's worth of dots, not the burst's; do
  not sample or drop messages in the app to protect the page. The messaging example
  (`examples/messaging/`) is the reference feed, and its Burst button, 400 messages (about three
  seconds of its traffic), is the check of the tab-back case.
- **The figure card** (`neat-diagram-figure-card`: `label`, `value`, `digits`, `unit`, `caption`,
  `history`) is the note's card for a figure that is not a rate, such as a count or a time: the
  label, the value in `NeatEasedNumber` (eased, tabular, "–" while there is none) with its unit,
  the caption's words at the end of that line, and a `NeatSparkline` of the history when it has
  one, named by the label and worded in the value's digits and unit. It draws no box, the note does.
  **The rate card takes the figure card's sheet (`figure-card.css`) before its own**, so the label,
  the figures' line and the figures are stated once and every note reads alike; its own sheet
  adds only the stage line. Why not a preset of the figure card, as the chart card is of the card:
  the rate card's line holds two figures (msg/s and MB/s) and a step's stage line takes its
  sparkline's place, so the figure card would need inputs that only the rate card uses. The
  Counts and times example (`examples/diagram/`) shows a count and a time.
- What stays internal: the routing, the port layout, the notes' placement and measurement, the fit
  maths, the pan and zoom, the hover, the level path, and the messaging layer's models, canvas,
  context token and frame probe (the bench reaches some of these through its seam, above).

**What entries share goes through the primary under a `ɵ` prefix.** The vendored helm code
(`lib/ui/`, with its `hlm` class-merging util) and the shell's `IN_PAGE_TOOLBAR` token are internal,
yet the secondary entries need them, and an entry sees the primary only through its public API. So
the primary exports `ɵhlm`, `ɵlistVariants`, `ɵIN_PAGE_TOOLBAR` and `ɵFIELD_LABEL_CLASSES` (helm's
label and field gap, which `select` and `field` share so that their fields line up; the rest of the
field's helm strings are the `field` entry's own), `ɵINPUT_CLASSES` and `ɵINPUT_HELM_CLASSES` (the
text field's look, which `input` shares with the primary's `NeatSearch`, and `ɵINPUT_HELM_CLASSES`
the number field's input inside its group), `ɵFIELD_WIDTH_CLASSES` (each `NeatFieldWidth` as the
class the field parts put on their outer element, which `input`, `number-field` and `select` share
with `NeatSearch`), `ɵCOLLAPSIBLE_CLASSES` (the collapsible section's look, which `collapsible`
shares with the page nav on a narrow screen), `ɵSTALE_CLASSES` (the stale look, which `diagram`
gives a node's card), `ɵTONE_DOT_COLORS` (the color each tone's dot takes, which the rail item and
`collapsible`'s status dot share), `ɵOverlayFocus` and `ɵPANEL_SURFACE_CLASSES` and
`ɵPOPOVER_HELM_CLASSES` (the Tab-order rules and surface of a panel in the overlay, which
`neat-popover` shares with the shell's collapsed-rail menu, and the surface with `neat-bubble`; the
second is the helm popover's own classes, which the popover's drift spec reads), `ɵBROWSER_CLOCK`,
its type `ɵFrameClock` and `ɵreducedMotion` (the browser's frame clock and the reduced-motion
check, which `charts`' label timeline and the `markdown` and `chat` motions share with
`neatEased`), `ɵFrameLoop` and its host's type `ɵFrameLoopHost` (the motions' frames: one at a time
while something moves, none while the page is hidden, starting again back in view, which the
`markdown` text motions and the `chat` picture reading, listening and speaking motions share),
`ɵSEPARATOR_HELM_CLASSES` (helm's own `hlmSeparatorClass`, which the popover's divider shares with
the rail's and the toolbar's, each merging its own classes over it with `hlm`; the vertical and
horizontal variants need `data-vertical` or `data-horizontal` on the host, which brain's separator
does not write, so each divider sets its own), `ɵREADOUT_CLASSES` (the readout's look, which
`charts` shares with `bev`; its surface is held to the panel surface's), `ɵbadgeClasses` and
`ɵbadgeButtonClasses` (the badge's look by tone and variant, and the badge button's, which `badge`
shares with the status chip's deprecated aliases; in the primary so that the primary's live badge
can take it too), and the page's class colors, which `video`'s overlays share with `bev`:
`ɵNeatOverlayColors`, `ɵcreateColorAllocator`, `ɵresolveColor`, `ɵheldColor` (a color read back for
`colorOf`), the identity palette (`ɵOVERLAY_PALETTE`, `ɵOVERLAY_NEUTRAL_COLOR`, in
`lib/theme/identity-palette.ts`) and the style-row lookup (`ɵclassStyles`, `ɵstyleFor`); `video`
re-exports them to its own code under their old names. They moved to the primary because `bev`
imported from `video` pulled the tile's component into a page with a view and no tile. Angular's
convention for private API. They are not for apps, may change in any release, and no app file may
import a `ɵ` name. A shared internal that a second entry needs is exported the same way, never by a
relative path. `lib/ui/` itself stays where `helm:add` writes it.

**A copy of helm's classes is named `*_HELM_CLASSES`** (`BADGE_HELM_CLASSES`, `FIELD_HELM_CLASSES`,
`BREADCRUMB_HELM_CLASSES`, `ɵSEPARATOR_HELM_CLASSES`), and a kit string that departs from helm's
or adds to them is named after its part alone. Why: a reader sees at the name which strings a helm
update may change, and the drift spec beside each copy holds it to the vendored file both ways
(`helm-classes.testing.ts`, above). **Helm's icon sizes reach `neat-icon` as its `[size]`**, never
through helm's selector: helm sizes an icon with `[&>neat-icon]:text-[length:--spacing(N)]`, which
`neat-icon` ignores, since it draws at its `size` (20 by default). So a part that takes a helm icon
rule passes helm's size in pixels, `--spacing(N)` being `4 × N`: the breadcrumb's chevron 14
(`--spacing(3.5)`), the callout's icon 16 (`--spacing(4)`), the empty state's 24 (`--spacing(6)`),
and an icon an app puts in a badge 12 (`--spacing(3)`), as the badge's doc says.

**How the bird's-eye view is drawn.** `bev` draws what a vehicle sees around it (`neat-bev`),
for driving demos such as the FastBEV one.

- Coordinates are the vehicle's own frame in meters, x forward and y to the left (nuScenes, ROS
  REP 103), forward up on the screen; angles are radians counter-clockwise from x, so a detector's
  yaw or a calibration's angles go in unchanged. A grid's `cells` are row-major in screen order:
  row 0 forward, column 0 left.
- What it draws comes from `frame` (objects as rotated boxes with a heading line, point sets as
  `Float32Array` x,y pairs, polylines, polygons as lines with `fill`, grids) and from inputs that
  change rarely: `background` and `foreground` (`NeatBevLayer`: lines, polygons and points the app
  draws under or over the data, such as a map's lanes, a camera's field of view or a zone; there is
  no sensor type of the view's own), `spokes` (a number spaced from straight ahead, or a list of
  angles each with an optional origin), `range`, `shape` (`round`,
  the circle of `range` with rings, as a radar; `rect`, the rectangle `bounds` with a grid, ±`range`
  without), `outline` (the shape's edge), `overflow` (`clip` cuts the data and the guides at the
  shape; `visible` lets them run on over the box), `guides` (`over` or `under` the data), `zoom` and
  `styles`. The shape is fitted into the box with a 12 px inset and sets the scale; the host takes
  its proportions (`aspect-ratio`) unless the app gives it a height. Give a new `frame` object for
  each moment and a new grid `cells` array for new cells: the view redraws on a new frame and
  repaints a grid only for a new array.
- Labels take their colors from the page's class colors (`ɵNeatOverlayColors`), the allocator
  the video tiles use, so a class has one color in every tile and in the view; `styles` takes the
  overlays' class rows (`NeatOverlayClassStyle`), so the same rows give the same look in both. The
  plot's own parts follow the theme (`--muted-foreground`, `--foreground`, `--neat-surface` for the
  labels' halo), read through `neatThemeColors`. The guides and the outline are the foreground,
  see-through (`GUIDE_ALPHA`, `OUTLINE_ALPHA` in `colors.ts`): over the data they darken (dark:
  lighten) what they cross, so they read as on top; an opaque line as light as `--border` read as
  a gap in a fill, the guides seeming under it.
- Drawing (`bev-canvas.ts`, outside change detection, at the next animation frame after a change,
  never while the page is hidden or before the box has a size): what changes only with the size,
  view, theme or inputs goes into two cached layers, one under the data (`background`, then the
  guides when they go under) and one over it (the guides when they go over: rings or grid lines,
  spokes, the outline; then `foreground`; and always the guides' labels), each drawn only when it
  holds something. A static layer's polygons are see-through tints without a backing (over the
  data it must not hide it), its points small squares, one path a label; it is redrawn with the
  cached layers (on a zoom too), so a dense cloud belongs in the frame. Between them a frame draws its grids (small canvases per grid, scaled without
  smoothing) and filled lines as areas: every area's backing, opaque in `--neat-surface` (a grid's
  as far as each cell's value goes), then every area's tint in its label's color at `GRID_ALPHA`,
  so an area covers what lies under it, guides under the data included, still looks see-through
  over the surface, and overlapping areas still blend; a label's filled lines are one path, each
  polygon wound the same way, filled once by the nonzero rule, so pieces of one area (a road
  network from a map) join without darker seams. Filled lines have no outline. Then the lines, points and objects without allocating per item, clipped to the shape as the
  view shows it (zoom included) unless overflow is visible; the vehicle's marker goes on top.
  Points are squares of whole device pixels written into a buffer that covers only the shape's
  rectangle within the box (the box with `visible`), kept in memory (`willReadFrequently`) and
  put over the plot once per frame: one canvas call per point, or one path of them all, cost
  several times as much to rasterize (the bench's BEV page, above). Objects are drawn a label at a
  time, one path for a label's boxes and one for their headings. Ring and grid steps widen until
  their labels sit at least 44 px apart; labels are drawn unclipped, ring labels halfway between
  forward and left (towards the box's middle once the vehicle is panned out of it), grid labels
  along the shape's left and top edges or the box's.
- Pan and zoom (`zoom.ts`, d3-zoom on the host, as the diagram's), only while `zoom` is on (off by
  default; `BevZoom` is made when it turns on and destroyed, listeners and all, when it turns off):
  wheel, pinch, drag and double-click zoom the whole view, the shape with it, within `zoomExtent`
  (relative to the default view, `[1, 4]` by default, always taking in 1; a min below 1 zooms out
  beyond the default), and pan only within what the default view shows (the shape's rectangle with
  `clip`, the box with `visible`) and `panBounds` (meters) when given: a smaller `range` with wider
  `panBounds` starts zoomed in and still reaches further out. Every wheel over the host is prevented, at the zoom's limits too, where
  d3-zoom alone lets the page scroll. The host is then a tab stop whose arrows pan, `+`/`=` and `-`
  zoom about the box's center and `0` resets; a "Reset view" button shows while the view is zoomed
  or panned. The kit stores nothing.
- Interaction (the rule "A widget tells the app what happens on it"): `hovered`, a model of the
  outlined object's id (an object's `id`, or its index without one), set by the pointer while it
  is over the view (null when it leaves) and by the app otherwise, changing only when another
  object comes under the pointer; `activated`, a click or tap that is no drag (`NeatBevPick`: the
  object or null, its id, the point in meters, the event; the reset button's clicks excluded);
  `pointerMove`, a mouse or pen's point in meters once a frame when it changed, null on leaving.
  An object the app hovers is outlined and read out only where the view shows it. `colorOf(label)`
  is the color the view draws a label in (its row in `styles`, else its class color), null until
  the page has drawn the label, for a swatch in the app's list; it follows as the tile's
  `colorOf` does.
- The readout (`readout.ts`): a mouse or pen hovering an object, or a finger tapping it, outlines it
  and shows the kit's readout beside it (`ɵREADOUT_CLASSES`): a swatch and its label, its distance,
  the app's `text`. It is filled and placed by the frames, straight in the DOM, and re-tested at the
  pointer every frame, only within the shape unless overflow is visible. The host is a figure named
  by `label`, with a visually hidden summary of the counts per label on the shape (`summary.ts`:
  "within 60 m", or a rectangle's edges), rewritten at most once a second.

**How the code block colors code.** `code-block` colors code with Shiki, a TextMate-grammar
highlighter, when a block's `language` names one of its languages; with `language` null (the
default) the code is plain.

- **What loads when.** Nothing of Shiki is in the entry's static code. The first block on a page
  with a `language` loads, through dynamic `import()`s, Shiki's tokenizer (`@shikijs/primitive`,
  with `@shikijs/vscode-textmate`) and its pure-JavaScript regular expression engine
  (`@shikijs/engine-javascript`, with `oniguruma-to-es`; no WebAssembly), about 117 kB minified
  (38 kB gzipped) together, and that language's grammar from `@shikijs/langs` (Python 70 kB, 9 kB
  gzipped; C++ with the C, GLSL and regular expression grammars it embeds 870 kB, 64 kB gzipped).
  Each is kept for the page (`highlighter.ts`), so a second Python block loads nothing and a page
  with Python only never loads C++. Until they are there the block shows the code plain, in the
  same lines. Shiki's JavaScript engine gave the same tokens as its Oniguruma (WebAssembly) engine
  for every default language when it was chosen. Each default grammar is a chunk of every app's
  build that uses the entry, loaded only when shown, so the default set stays small.
- **When a block colors.** Only once it comes near the view (`near-view.ts`: an
  `IntersectionObserver` with half the view's height as margin around the window, and around every
  box that scrolls the block where the browser supports `scrollMargin` (Chromium, and Firefox since
  157), since a kit page scrolls its own body; elsewhere a block there colors as it enters the view;
  without an observer, at once), and one block at a time, each tokenizing in a task of its own, in
  order (`turns.ts`); its lines stay plain until then, and once colored it stays so. Why: all blocks
  resolve from one grammar load, so they tokenized in one render pass, and a page of many blocks
  froze for the sum of them (half a second for the showcase's code block topic). Once colored, a
  block colors new `code` at once, without a turn: the turns are for many blocks coloring at once,
  and a preview whose code changes often must not flicker plain. A new language takes a turn again
  (plain until then), so a page that switches the language of many blocks does not freeze. A grammar
  that throws on a block's code leaves it plain and is said once in dev mode.
- **The languages:** Python, C++, C, shell, JSON, YAML, CMake, TypeScript, JavaScript, HTML, CSS,
  Markdown, Dockerfile and Go, under each grammar's Shiki name and aliases (`languages.ts`, held to
  the grammars by its spec). `provideNeatCodeLanguages({ name: () => import('@shikijs/langs/<id>') })`
  adds others in any `providers` (app, route or component), each place on top of the one around it
  (a factory over the token's value one injector up). A name no table has, or a grammar that does
  not load, leaves the code plain and is said once in dev mode; a failed grammar is tried again by
  the next block.
- **The colors are the theme's.** The theme emits eight tokens, `--neat-code-keyword`, `-string`,
  `-comment`, `-constant` (numbers among them), `-type`, `-function`, `-property` (keys and
  attributes too) and `-tag`, each the first step of its scale that reads at 4.5:1 on the block's
  `--muted` fill in both schemes (`codeTokens` in `spartan-theme.ts`, held by the theme spec);
  operators and punctuation keep the text color. Shiki gets a theme of the kit's own
  (`code-theme.ts`) whose colors are the kinds' names, which Shiki hands back as written: a token's
  kind is a `data-kind` attribute, and `code-block.css` is the one place a kind becomes its token.
  No color of a Shiki theme reaches the page. An app's own spans can take the same tokens.
- **The lines:** one element per line (`.line`), the line's runs as spans in it and its line break
  last, so the text of the block is the code as given (a last empty line after a final break is not
  shown). The line numbers are a CSS counter in `::before`, with empty alternative text, so a
  selection, Copy and a screen reader leave them out; a wrapped line hangs clear of the gutter.
  Copy always copies `code` unchanged.
- **Marks** (`marks.ts`): a `NeatCodeMark` names lines (`{ lines: [4, 6] }`, `{ line: 9 }`) or a
  part of a line (`{ line, text }`, the first occurrence, or `{ line, from, to }`, columns for text
  that repeats), counted from 1 as people read them and as `lineNumbers` numbers them, both ends
  included. A marked line is `.line[data-marked]`, a band in `--neat-code-mark` reaching into the
  code box's padding; a marked part is a `mark` element with a rounded marker in the same tint.
  `dim` (on by default while there are marks) turns the rest to `--muted-foreground` without its
  code colors, while marked code keeps them. The theme picks the tint (the highlight hue over
  `--muted`, `CODE_MARK_SHARE`) and then each code color as the first step that reads at 4.5:1 on
  both the fill and the tint, and holds `--foreground` and `--muted-foreground` to 4.5:1 on it. A
  mark that names no line or text throws in dev mode and is left out in production, checked
  against the plain text of the lines for every step at once. The app's projected spans get no
  marks. Marks change no text, so Copy and a selection read the code as given.
- **Steps:** `steps` (each a `NeatCodeStep`: `marks` and an optional `label`) replaces `marks`
  while it is not empty, and `step` (a `model()`, from 0) is the step shown, kept to the steps
  there are without writing the model. Every mark of every step is an element from the start: a
  line is cut at every column any step's marks start or end at, so a step change only toggles
  `data-on` (and `role="none"` on the marks not shown, which are no marks to a screen reader) and
  the colors fade with `--neat-transition-duration`, none under reduced motion. Shown marks that
  touch join square (`data-join`). With steps the host is a tab stop (`role="group"`, "Code in
  steps") whose left and right arrows step, except on the code box itself, which keeps them for
  scrolling; `stepControls` adds Previous and Next (`aria-disabled` at the ends, so the focus
  stays) and the position. A visually hidden polite live region says "Step 2 of 5: Open the camera". After
  each change of the marks shown, `scroll.ts` scrolls the code box, never the page, to show the
  first mark, smoothly unless reduced motion is on. The block's grid row takes what a height or
  `max-height` on the host leaves, so the code box scrolls inside a bounded block.
- **Notes** (`note.ts`): an `ng-template[neatCodeNote]` inside the block is shown in a
  `NeatBubble` (`@sima/neat-ui/bubble`, imported by package name), given the step or the mark as
  the app wrote it and its index. It is projected into a slot of its own after the code
  (`select="[neatCodeNote]"`), so it never counts as the app's own spans. Its `neatCodeNote` input
  takes the steps or marks only to type the template's variable (`ngTemplateContextGuard`). With
  steps the bubble shows the shown step's note beside its shown marks, a marked line by its whole
  line (the code box for a step without marks), and moves with the step. With marks, each mark
  carries `data-mark` (its index) and its first element is a tab stop (`first` and `bandFirst` in
  `marks.ts`), and its note shows while a mouse or pen is over the mark or the bubble (150 ms after
  both are left), while it has the keyboard's focus, or after a tap or click; Escape and a press
  outside the marks and the bubble put it away, and Escape keeps it away until the pointer or the
  focus comes back to the mark. The mark the note shows for points at the bubble with
  `aria-describedby`.
- **The boundary:** ESLint (`SHIKI` in the root `eslint.config.js`) fails any static import of
  `shiki` or `@shikijs/*` outside the code-block entry, and in it any but `import type`; a dynamic
  `import()`, how an app adds a grammar, is not an import ESLint sees. `npm run check:dist` fails a
  static import or export of Shiki in any built module or type declaration, a Shiki specifier in a
  file of another entry, and a TextMate grammar (`scopeName`) inside a module.
- **Licenses:** the three `@shikijs` packages the kit depends on (exact versions, in
  `allowedNonPeerDependencies`) and what they bring (`@shikijs/types`, `@shikijs/vscode-textmate`,
  `oniguruma-to-es`, `oniguruma-parser`, `regex`, `regex-recursion`, `regex-utilities`) are MIT.
  The default grammars are MIT (most from VS Code, CMake's from `twxs/vs.language.cmake`) but YAML's
  (`textmate/yaml.tmbundle`), whose license grants every use without conditions. C++'s grammar
  embeds GLSL's (`polym0rph/GLSL.tmbundle`, 3.7 kB, for raw strings marked `glsl`), which states
  no license; it ships in the C++ chunk. A new default language needs its grammar's license (Shiki's
  `tm-grammars` lists each source and license) and those of the grammars it embeds checked first.

**How an Insight channel connects.** `insight` is the kit's one WebRTC client of Neat Insight:
`neatInsightChannel(channel, { offer, videoBufferMs, log })` returns a `NeatInsightChannel`, a
`NeatTileSource` (imported from `video` by package name, as a type only) with `notice`, `failure`,
`frames`, `videoDelayMs`, `stats`, `videoBufferSupported` and `close()`. Why an entry of its own: `video` knows nothing about how a stream
arrives, and an app that does not watch Insight carries none of this.

- It is made in an injection context and closes its connection when that context is destroyed
  (`DestroyRef`), or earlier on `close()`, which also drops the destroy hook. It connects at once:
  the tile has no "start" call, it only reads `stream` and listens to `onMetadata`. A channel
  opened later (once a setting is read) is made in `runInInjectionContext` with the component's
  injector, and the one it replaces is closed.
- The offer address: Insight's own route, `/api/channels/{channel}/offer`, by default, for a page
  Insight serves. Insight refuses an offer from a page of another origin (its cross-origin
  protection answers 403 `cross_origin`), so an app with its own server relays it, and `offer`
  names the relay (the demos' `/api/offer?channel=N`): a string is posted to as it is, a function
  gets the channel. The body is `{type, sdp}` and the answer the same, errors in Insight's
  `{error: {code, message, hint}}`, which the relays pass on.
- The connection is Insight's own viewer's: a recvonly video transceiver and the `metadata` data
  channel (ordered, `maxRetransmits: 0`), the offer posted without waiting for ICE gathering, the
  answer applied. `videoBufferMs` sets the receiver's `jitterBufferTarget` where the browser has it
  (not Firefox), and a value the browser refuses is left alone;
  given as a signal it is followed on the open connection (an effect in the channel's injection
  context) and on every one that replaces it, so a setting changes it without reconnecting. A failed post or a `failed` or
  `closed` connection is tried again after 1, 2, 5, then every 10 s, the count reset once a
  connection is `connected`; a connection that decodes no new frame for 5 s (`framesDecoded` in
  `getStats`, checked once a second) or stays `disconnected` that long is made anew, since after a
  source restart the decoder can wait for a keyframe forever. `videoDelayMs` is the jitter buffer's
  delay per emitted frame over the last second, null without a connected peer or new frames.
  `stats` (`NeatInsightVideoStats`) comes from the same once-a-second sample while connected: the
  codec as the browser names it (`H264`, from the codec report the inbound report names), the frame
  size and rate, and the bitrate from the bytes received since the last sample; null without a
  connected peer. The words around it (an app's status line) are the app's.
- **A channel Insight sends as JPEG frames** arrives on the `jpeg` data channel (ordered,
  `maxPacketLifeTime: 300`, array buffers), as chunks of whole frames; the protocol's home is
  insight-next's `docs/contracts.md`, "What a viewer's connection carries", and `jpeg-chunks.ts`
  reads it. The connection's first chunk makes it a frames connection: `frames` (a
  `Signal<NeatEncodedFrames | null>`) gets a new run, as a new stream is a new `MediaStream`, and is
  null wherever `stream` is dropped. A connection plays one or the other, never both: a track that
  came with the answer is withdrawn (`stream` goes null) when the first chunk arrives, and a track
  that comes later is not reported, also against an upstream Insight that answers the video with a
  sendonly m-line. Each whole frame goes to the run's listeners with `presentAt`, its arrival plus
  `videoBufferMs` as it is then, in every browser (a change applies to frames that arrive after
  it); a listener that throws is reported with `reportError` and does not take the frame from the
  ones after it. The stall rule belongs to a stream: a frames connection needs no decoder, so
  silence rebuilds nothing, and only 5 s of "disconnected" does. The server closes the `jpeg`
  channel when a send fails, and that close, once frames arrived and unless the connection's own,
  is a retry ("frames channel closed"), after the same delays; before the first chunk it is none,
  so a server that closes a label it does not know cannot loop an H.264 connection, and the stall
  rule rebuilds one that never brings frames. For frames, `videoDelayMs` is the mean hold over the
  last second, and `stats` says "JPEG", the size of the latest whole frame from its JPEG header
  (null before the first), the whole frames per second, and the bitrate of every chunk received,
  those of frames that never complete included.
- `videoBufferSupported` is a signal: true where the browser has `jitterBufferTarget` (checked
  once), and while `frames` is set, which the kit holds itself in every browser. It was a plain
  boolean before 0.41 and is breaking for an app that read it as one.
- `log`, when given, is told each step (connecting, answered, track, frames (the first chunk), a
  connection state, a retry with its reason and delay, a failure, closed), outside Angular, for an app's debug log; the kit
  itself writes nothing to the console.
- What the answers mean, one table for both servers (Insight's route and a relay):
  - A 4xx is final: no retry, and `failure` (and so `notice`) says why: "Codec not supported by this
    browser" for a 415 (`codec_unsupported`), else the answer's `message` as it is (Insight's
    `no_such_channel`, `invalid_offer`, `offer_too_large`, `cross_origin`, a relay's
    `invalid_request`), else "Connection failed: HTTP <status>". A browser without
    `RTCPeerConnection` (jsdom in the specs) fails at once with "This browser has no WebRTC".
  - Anything else is retried, and `notice` says why where the answer does: `no_video` "Waiting for
    video", `codec_changed` "Video format changed", `negotiation_failed` "Could not connect",
    `too_many_viewers` "Too many viewers" (a channel at its viewer limit; a place frees up when a
    viewer leaves), the relay's `insight_unreachable` "Insight not reachable", and the same words when no answer came
    at all (`fetch` rejected) or a 502, 503 or 504 came without a code (a proxy whose server is
    down). Other codes, a 5xx without one, and an answer that is not an answer say nothing:
    `notice` is null and the tile shows its own no-video note. A track arriving clears it.
- The raw browser part (`RTCPeerConnection`, `fetch`, the timers) is `insight-connection.ts`, a
  function of plain callbacks that knows no Angular; `neatInsightChannel` runs it outside the zone
  and writes its reports into signals, so the health check's timer causes no change detection. Its
  specs drive fakes of `RTCPeerConnection` and `fetch` (`insight-connection.testing.ts`) under fake
  timers: no test makes a real connection.

**How the chat parts are drawn.** `markdown`, `stream` and `chat` are the parts of a
conversation with a model (GenAI Studio first). Their design: the conversation is plain data the app
owns, the kit draws it.

- **A streamed reply is data that grows.** The app writes a reply's whole text so far into its
  message, once for each piece that arrives (a new message object, the same `id`). `neat-markdown`
  keeps the blocks it has read (`markdown/src/lib/blocks.ts`): blocks before the last two are
  finished and reused by identity while the text keeps its beginning, so their elements stay, and
  only the last two are read again (two, since the block before the last can still change, as a
  list does when its next item starts after a blank line). So the work per piece grows with those
  two blocks, not with the reply: flat for paragraphs, and as long as the list for a reply that is
  one long list or table, which is read whole since its numbering and looseness depend on all of
  it. A text that is no continuation of the last is read whole. A spec streams a corpus of
  reply-shaped Markdown character by character and holds it to the blocks of a whole read.
- **Half-finished Markdown is closed ahead while streaming** (`close-ahead.ts`): an open fence on
  any line (in a list item or a quote too) gets its closing fence at its indentation, and shows
  without its language while the fence's line is still being written; in the last paragraph, a
  code span, `**`, `*`, `__` or `_` gets its closing mark, a link with half an address shows its text, a
  lone mark at the very end waits. So nothing reflows when the closing mark comes. Markdown that
  resolves only later (a table's header row before its separator) shows as a paragraph first and
  changes once.
- **No HTML from the text.** Blocks and runs render through templates that call themselves (no
  wrapper element, since prose styles its flow by child selectors); raw HTML is text, an image its
  alt text in brackets, a link a link only to an absolute `http:` or `https:` address, in a new tab.
  `marked` is the markdown entry's alone (ESLint's `MARKED` rule).
- **The transcript follows the reply** (`follow-scroll.ts`, outside change detection): while the
  reader is within 48 px of the end it stays there as the text grows; a scroll up away from the end
  lets go and shows Latest, which goes back and follows again. Growth, a clamp and its own scroll
  never let go, since none moves the box up. It is a `log` that is not live, and a polite region
  says "Reply finished:" and the reply's beginning once a reply goes from waiting or streaming to
  done, so a screen reader hears no tokens.
- **The message box's glow** is two gradients behind its card that show on its 2px edge, their
  angle a registered custom property (`--neat-glow-angle`, in `chat/src/lib/glow.css`, which the kit
  stylesheet imports, since an encapsulated sheet must not register a global), its pace
  `--neat-glow-turn` (`glowTurnMs`). The four glows are the mockup GenAI Studio chose them from,
  in CSS alone, keyed on the host's `data-glow` and `data-activity`: the comet (`--neat-series-2`,
  `--primary` and `--neat-glow-head`, white in both schemes) turns every 1.6 s while `waiting` and
  once per `glowTurnMs` × 0.6 while `streaming`; the ring (a conic gradient of the series colors,
  its copy blurred into a halo), the aurora (the series colors along the edge, their blurred light
  below the box drifting) and the sheen (the series colors along the edge, a band of light crossing
  the card) breathe while `waiting` and turn, drift or sweep once per `glowTurnMs` while
  `streaming`. The steady comet is no gradient: the comet's colors as 24 dashes along the edge
  (`glow/steady-comet.ts`: SVG rects in the template, `pathLength` 1000, one dash offset they
  inherit, run by the Web Animations API in a linear lap at 600 px/s), a sharp copy and a blurred
  one, so its head and its tail keep one speed and one length in pixels all the way round, from
  the question to the end of the reply; a turning gradient's tail stretched near the corners. The
  box shows its text area's focus by its edge in `--ring`, as a text field's border.
- **Motion** (the spec's "Motion"; every variant has a still fallback):
  - **The pieces.** While a `motion` is set and the text streams, `neat-markdown` learns which
    characters of the shown prose each write adds (`motion/arrivals.ts`, a `TextArrivals` over the
    live blocks, so its cost is bounded by them) and renders them as pieces, template spans that
    carry their arrival (`span.piece[data-token][data-from]`, `motion/shown.ts`); code blocks,
    tables and inline code grow plainly. A piece moves for its motion's `--neat-motion-ms` and then
    settles into plain text. A text that is no continuation of the one before shows whole and
    plain, and a motion changed while the text streams moves only what comes after the change; a
    reply the transcript first sees mid-stream shows whole.
  - **Four motions are CSS** keyed on the host's `data-motion`: plain (the thin caret), focus,
    token flash and drop-in (a word's letters one after another). **Three have an engine** (`motion/engine.ts`),
    made after a render while the text streams and destroyed when the motion changes, or once the
    text has stopped streaming and nothing of it moves, its layer (canvas or cloud) going with it,
    so a finished reply keeps no engine; outside change detection on the kit's frame clock
    (`ɵFrameClock`), with no frames while the page is hidden or nothing moves, and nothing for text
    that came while it was hidden. A text written anew starts the pieces' count again, and an
    engine then drops what still moves of the old text (particles, flights): decrypt (glyph
    noise that resolves from the start, with a tail of noise to the end of the next line, the text
    under the noise only visually hidden, so assistive technology reads it), reverse
    explosion (a canvas band over the newest line, its particles in typed arrays, sized from a
    `ResizeObserver` at the device pixel ratio) and word cloud (`cloudWords` common words floating
    under the reply's end, one flying into place with each piece). An engine writes only text,
    attributes and inline `transform`, `opacity` and `font-size`, into elements the template
    rendered empty for it. Reverse explosion and word cloud keep 4.5rem of room below the text
    while it streams, easing away over 0.4 s once it ends.
  - **The orb and clock** (`neat-chat-orb`, internal) replace a waiting reply's "…": an orb in the
    series colors that turns once a second, and the seconds to the first word, written once a
    frame outside change detection.
  - **The picture motions** (`picture-reading.ts`, internal): from the moment a reply is first seen
    waiting until soon after its first word, each picture of its question has a reading laid over
    it in its frame (square tiles of whole pixels, about 140 to a picture, the edge cutting the
    last ones; coming into focus, a beam and patches, or a viewfinder; one frame loop outside
    change detection). The frame is the picture's own size, so a reading covers the picture alone.
    The real wait is not known, so the reading sweeps in rounds at the mockup's rate (all tiles in
    1.3 s, a rest, again), and finishes in 0.3 s after the first word (`reading-pace.ts`); then it
    fades out and the plain picture shows. The viewfinder's label, the region's top left in the
    picture's own pixels, is a child of its brackets and moves with them. With `pictureFlight`,
    9 px patches of the picture fly into the reply's orb in any picture motion. Each picture has
    Expand, which shows it whole in the transcript's own viewer over the conversation (a dialog
    over the transcript's box, not the window: Close or Escape put it back and return the focus).
  - **Before the first message** the log shows the kit's `no-messages` icon, large and muted, over
    `emptyTitle` and the app's `emptyHint`.
  - **Under reduced motion** no piece, engine or reading is made: the text is plain, the pictures
    stay as they are, the orb stands still while its clock counts, and each glow shows its colors
    still at its waiting opacity. CSS animates only inside
    `@media (prefers-reduced-motion: no-preference)`, and code checks `ɵreducedMotion()` first.
- **Voice** (`chat/src/lib/voice/`): the microphone is `MicRecorder`, a unit with no Angular (its
  browser APIs given as `MicDeps`, faked in `media.testing.ts`): it makes the AudioContext before
  it asks, so the press's user activation lets it run, records with MediaRecorder (Opus in WebM
  first), reads the level as the RMS of an analyzer's window from -50 to 0 dBFS, and on every end
  stops every track and closes the context, so the browser's indicator goes off. A stop while the
  browser still asks records nothing; a track that ends (unplugged) cancels as "No microphone".
  `neat-push-to-talk` holds or taps by one rule (a release later than 300 ms after the press ends
  a hold), names itself by its state and says a problem in place (`media-problem.ts`, the camera's
  words beside the microphone's). The camera dialog (`camera/`, internal) asks for 1280 × 720,
  shows the preview unmirrored, takes the frame as a JPEG and stops the camera however it closes.
  **The listening motions** are engines outside change detection on the shared frame loop
  (`ɵFrameLoop`), made while recording and dropped once nothing moves (`listening.ts`): in the
  message box, a ring round push-to-talk's button that swells with the level (`ring.ts`) and a
  waveform on a canvas over the text area, which goes see-through but keeps its size and its place
  in the accessibility tree and stays collapsed while `transcribing`; and the radial (a canvas of
  56 bars round the button, folding in on release). Canvases are sized by `SizedCanvas` (a
  `ResizeObserver` at the device pixel ratio). Under reduced motion none moves: push-to-talk says
  "Recording 3 s" beside its button. **A heard question** always arrives deciphered (`heard.ts`,
  internal): its letters come out of glyphs, two more every 30 ms with ten glyphs ahead of them, the
  bubble its whole size from the first frame; under reduced motion it shows plain.
- **Speaking** (`markdown/src/lib/speech/`): a sentence's range is in the reply's Markdown source,
  so it stays put while the text grows and a block before it resolves. `neatSpeakable` and the
  highlights read the text through one map (`readable.ts`): the shown prose and inline code, each
  character with its source offset; the DOM walk (`readable-dom.ts`) reads the same text from the
  rendered nodes, leaving out code blocks, tables, everything `aria-hidden` and what the template
  marks `data-unread` (a picture's alternative text, the checkbox glyphs, raw HTML). The speaking
  motions are drawn with the CSS Custom Highlight API (`highlights.ts`, two highlights shared by
  every instance, each adding and removing only its own ranges: the sentence on `--neat-speech-tint`
  and the reply after it muted), styled by `speech.css` in the kit stylesheet, since a
  `::highlight()` names the document's registry: no element changes, so nothing reflows. The
  equalizer stands in a 1.5rem gutter at the reply's inline end, kept with or without speech,
  beside the sentence's first line. The transcript's waveform motion
  adds a strip under the reply (`speech-strip.ts`, a canvas of 90 peaks and a playhead, its peaks
  and colors read once per speech), growing in and out over 0.2 s. Frames run while a sentence is
  said and the page is visible; back in view the highlight is where the clock says.
- **The helpers** carry no Angular but a signal or two: `neatStreamPost` reads the answer's own body
  reader, so aborting it reaches the connection at once, and ends quietly when its signal aborts;
  `NeatEventStream` stays disconnected where there is no `EventSource` (a page rendered on a
  server).

## How the kit is built on Spartan

The components come from Spartan UI: `@spartan-ng/brain` (headless primitives, an npm dependency)
and helm (Spartan's styled layer, generated into the repo). Apps see neither.

- **A new part starts from Spartan.** Before building one, look in both of Spartan's catalogs at
  the kit's pinned version: brain's primitives (the folders of `@spartan-ng/brain`) and helm's
  components (the folders under `src/generators/ui/libs` of `@spartan-ng/cli` at that version,
  the generator `helm:add` runs). Where one fits, build on it: brain for the behavior, helm's
  classes for the look, vendored with `helm:add` and wrapped as below, then moved toward the kit's
  look through the theme's tokens and the wrapper's table. Helm counts where brain has nothing:
  many helm components (`alert`, `badge`, `kbd`, `separator`, `table`) are classes only, which
  is all such a part needs, so "brain has none" is a reason only when helm has none either. Why:
  Spartan's recipe gives every part the same proportions, spacing, states and focus rings, so
  parts built on it read as one set; a part drawn from scratch drifts from them however carefully
  it is made. Escape hatch: a part of the kit's own, or one that sets Spartan's behavior or look
  aside, says why where the part is described (here, or in its source's header): what Spartan's
  version lacks or gets wrong for the kit. Some parts predate this rule and have no such reason;
  they are being reviewed one by one, so do not take them as precedent.
- **Public API is `neat-*` only**: components, directives and kit types. Why: no library API
  reaching apps is what keeps a later library swap a kit-only change. Never export brain or helm
  symbols, or re-export a third-party component.
- **Vendored helm lives in `projects/neat-ui/src/lib/ui/`: internal, never exported, never
  hand-edited.** Why: it stays exactly as generated, so an update is a regeneration and a reviewed
  diff, not a three-way merge. It enters only through `npm run helm:add -- <name>` (generate, then
  `tools/adopt-helm.mjs`). To update, bump `@spartan-ng/brain` (exact version; `helm:add` runs the
  Spartan CLI of the same version), delete `lib/ui/<name>`, re-add it and review the diff.
  `npm run check:dist` fails a build that still imports the helm alias. A helm component that
  binds a dynamic icon name (`<ng-icon [name]="…">`, as `spinner` and `code-block` do) fails
  adoption on purpose, since the tool maps only static names: when the first one is needed, extend
  `tools/adopt-helm.mjs` to map the glyphs the binding can take (with a test in
  `tools/adopt-helm.test.mjs`), so it still enters as a regeneration; never patch it by hand.
- **A `neat-*` wrapper is the brain primitive as host directive plus helm's style constants as
  data**, with one table mapping kit vocabulary to Spartan's (see `lib/button/button.ts`). Never put
  a helm directive behind a public host directive: Angular cannot re-expose inputs of a host
  directive's own host directives (NG2017) and requires every host directive of a public directive
  to be exported (NG3001). Bind the classes with Angular's `[class]` host binding, not helm's
  `classes()`, which rewrites `className` and can drop an app's `[class.x]` binding. Where helm
  keeps its classes inline rather than as constants, the wrapper copies them verbatim into a
  table labeled with the helm file, and its spec reads that file as text
  (`import src from '…/hlm-x.ts?source' with { loader: 'text' }`) and checks each copied string is
  still there, so a helm update that changes them fails until the wrapper is reviewed.
  `NeatDialog` follows the same pattern as `NeatConfirm` (brain's dialog service, helm's dialog
  classes copied into a table behind a drift spec). Brain reads "may this close" once, when the
  dialog opens, so `NeatDialog` opens it with closing switched off and closes it on Escape and the
  backdrop itself while `NeatDialogRef.dismissible()`, which `setDismissible` changes at any time.
  Both modals stop a handled Escape at the dialog (the CDK's `keydownEvents`, then
  `stopPropagation`), so `document` and `window` shortcuts never see it behind a modal.
  The toast is not helm's `sonner`: that is Spartan's stacked, swiped, hover-expanded toaster
  (about 100 kB of brain source, no third-party library), and none of its model is needed by what
  the kit's toasts do (a column of at most three, fixed lifetimes, progress that updates). The
  toast host lands in every app's main bundle, so the kit's own, a small component on the CDK
  overlay, is the cheaper fit.
  `NeatSelect` and `NeatProgress` use brain's directives in their own template instead of as host
  directives, each for a stated reason:
  - Brain's select finds its options by content query, which only sees what is written inside its
    element in the template that uses it; options rendered by a wrapper's own template are not
    content of the wrapper's host element. `NeatSelect` also handles Escape itself before the CDK's
    overlay dispatcher can: an open list closes and the key stops there, so a dialog around the
    select stays open.
  - Brain's progress throws for a value outside its range, so the kit's own input, held to the
    range, feeds it.

  `NeatDropZone` hosts no brain primitive because brain has none for files: it is a native `button`
  plus a hidden file input, with its own drag handling, over the kit's tokens.

  `NeatCollapsible` hosts brain's collapsible (its `open` is brain's `expanded` under the kit's
  name), with brain's trigger and content directives in its template. Brain only makes closed
  content `inert`, so the kit hides it (`data-closed:hidden`, the one class helm's collapsible
  has, stated by the kit through the preset's variant, so no helm is vendored for it), and when it
  closes with the focus inside, it moves the focus to its trigger before the content turns inert,
  which would drop the focus to the page. Its `headingLevel` puts the trigger in a heading, for
  sections that are part of an outline (the disclosure pattern's button inside a heading).
  Elements marked `neatCollapsibleEnd` sit at the end of the trigger's row, outside the button and
  its heading, for the section's own controls (the docs' file choice and Copy over an example's
  code): a control inside the trigger would be a button in a button. The row wraps, so they drop
  to a line of their own before they take the room of the label and summary (the trigger's width is
  both in full, so a long summary wraps them before it truncates), and a close that removes the
  one with the focus (shown only while open) puts the focus on the trigger, as for the content.
  `NeatCallout` is helm's alert (classes only, brain has none) in the kit's tones: a bordered
  card with the icon in a column of its own beside the heading and text. Helm's `hlmAlert` sets
  `role="alert"`, so the kit copies its classes into a table behind a drift spec instead and keeps
  the role the app's. The icon is a column of the host's grid and the content (heading, body,
  actions) is one element in the next column, so helm's own icon selectors lay it out. Its
  heading is a real heading (`role="heading"`, `headingLevel`, 3 by default), and with `region`
  (a landmark, which needs a heading to be named and takes no role without one) or `announce` (a
  live role) the callout is labeled by it; the role and the label are the callout's, so an app's
  notice never builds its own around it. Each tone but neutral is a tint (`--neat-tint-<tone>`,
  the select list's row tint), a border (`--neat-callout-border-<tone>`, the tone mixed toward
  `--border`) and the tone's text color, which the heading, the icon and the body take (warning's
  is `--neat-warning-text`, since its own color is a fill); the theme spec holds that text to 4.5:1
  on the tint in both schemes. Neutral is helm's default: the card's fill, `--border` and the
  card's text, its body muted. `plainText` sets the body in `--foreground`, the heading and icon
  keeping the tone: a short notice reads well in the tone's color, a paragraph does not. The tints
  are opaque mixes over `--background`, so on a raised surface (a dialog, a popover) a tinted
  callout is the page's color mixed, not the surface's.

  `NeatBadge` and `NeatBadgeButton` are helm's badge, which is classes only (brain has none), drawn
  from `ɵbadgeClasses` in the primary (`lib/badge/badge-classes.ts`): helm's base, copied because
  helm keeps it inline, with a drift spec that holds the badge to helm's base both ways, and the
  tones in place of helm's variants, whose `secondary` is the card's own color in dark and
  vanishes on a card. The kit changes the base in four places, each for a failure seen in Chrome
  or the spec: it is `inline-block` while it holds no icon, since helm's `inline-flex` cannot end
  its text in an ellipsis and its `justify-center` cut the start of a text too long for its
  column (`max-w-full truncate` keeps it within what holds it); its line fills the box inside the
  border (`py-0 leading-4.5`) and it is `align-middle`, so the text sits centered as in the flex
  row; it may shrink (`shrink` for helm's `shrink-0`), so in a crowded row it cuts its text as the
  status chip did rather than run past the row, while the badge button keeps `shrink-0`, so a
  control's name is never cut; and the button's focus ring is full `--ring` where helm's is half
  of it, below 3:1. An icon in a badge is the app's `neat-icon` at `[size]="12"`, helm's
  `--spacing(3)`, before the words.

  `NeatLevelMeter` hosts no brain primitive (brain has none); it is the kit's own bar of 28
  segments over -50…0 dBFS, lit in the theme's status colors (`--success`, `--warning`,
  `--destructive`) and dark in `--border` (`--muted` would vanish on a dark card, whose fill it
  is). Its `sample` is a function, not a value: the meter calls it once per animation frame while
  it is set and the meter is rendered, and writes each segment's fill straight to the DOM,
  outside change detection (the per-frame rule below), so a level the app polls and a Web Audio
  analyzer both feed it without a signal write per frame. It calls the function on its own, so an
  app passes an arrow-function property, never a method, which returns null rather than throw
  when its source is gone (a throw repeats every frame). A rendered meter samples even when
  hidden, so an app renders it only while there is a level (`@if`). It is `aria-hidden`; the app
  says the state in text.

  `NeatSelectList` and `NeatFileBrowser` own their behavior too. Brain has no listbox on its own
  (its select's list lives in a popover, and `command` is a palette), so the list owns its roles
  and keys as `NeatSegmented` does: a `listbox` that holds the focus and names the selected row in
  `aria-activedescendant`, with selection following focus. Its checked mode (`checkable`) is the
  WAI-ARIA multi-select listbox: the listbox is `aria-multiselectable`, a checked row is
  `aria-selected`, Space checks the row the keyboard is on, and the selected row becomes that row
  only (drawn by `data-active`, not by `aria-selected`). Its box is drawn from the theme's tokens,
  not brain's checkbox (a thousand-file folder would be a thousand brain components), and is
  `aria-hidden` and no tab stop, since the row says whether it is checked. `checkBlocked` gives
  the reason a row's box cannot change now (a cap): the box is dimmed and Space and a click on it
  do nothing, while the row still takes the keys, a click and Enter. Its option keeps
  `aria-selected` and is `aria-disabled`: selecting is checking here, so an enabled option would
  promise a check that Space silently refuses, and `aria-disabled` blocks no events while the row
  stays the active descendant. The reason describes it (`aria-describedby` to a `hidden` element
  in the row, so it is not part of the row's name) and is the box's tooltip; any reason but null
  blocks. The pointer has a file manager's gestures in checked mode, each checking only rows the
  box could: a click on the selected row toggles its box (a row with no box, or a blocked one, is
  activated instead, so a folder still opens), Ctrl or Cmd-click toggles and selects without
  activating, Shift-click checks the rows from the anchor (the row last clicked or toggled, else
  the selected row) to the clicked one and selects it, and Ctrl or Cmd+A checks every row. They
  only ever check: a row with no box or a blocked one is skipped and nothing is unchecked. The
  blocks are those of the moment the gesture starts, so an app whose cap is its `checkBlocked`
  must clamp `checked` too. `activateOn="double-click"` (type `NeatActivateOn`) makes a click only
  select and a double click tell `activated`, as a file manager opens a folder; Enter tells it in
  both. A second, separate click on the
  selected checkable row checks it in both modes (so a file in the browser's manage mode checks on a
  second click); the second click of a double click (`event.detail >= 2`) never does, so a double
  click on a row not yet selected only selects and activates it. A double click on the already
  selected checkable row toggles it once, with its first click. The box, Space and Ctrl-click also
  check. The second
  press of any double click on a row is kept from selecting the row's text. The list reveals the
  selected row by scrolling its own area only (never `scrollIntoView`, which also scrolls the page
  and every other ancestor, even from below the fold). The file browser needs nothing more: a Ctrl
  or Shift-click on a folder highlights it and opens nothing.
  A column's `hideBelow` is judged against the list's own width, which a ResizeObserver
  watches only while some column has one. The header line, the listbox and each row are lines of one
  grid (each spans every track on `grid-cols-subgrid`), so a content-sized column
  (`width="max-content"`) fits the widest of its heading and its cells, and `align="end"` puts both
  at the column's end. The header sits inside the scrolling area, sticky at its top and filled with
  `--neat-surface`; the area's top scroll padding is the header's height, so a row scrolled into
  view stops below it. The focus ring is the outline of a pseudo-element over the area, since the
  sticky header paints over an outline of the area itself. `groups` (with `groupOf`) puts the rows
  under headings, each group a `role="group"` named by its heading and, like its heading, a line of
  the grid. A heading is a `--muted` band from edge to edge of the area (the rows' negative
  margins), its text on the cells' inset. In dark, `--muted` is the card, dialog and popover surface
  itself, so the band shows only on the page there (in light it shows on every surface); the
  heading's type still sets it apart. The keys move over the rows as shown, which a row's
  `data-index` numbers, never onto a heading, and a group's first row brings its heading into view
  with it, as the last row does the empty groups after it. An item of a group the app did not list,
  or a group listed twice, throws in dev mode; in production the item shows after the groups under
  no heading, set off from the last group by a rule (an empty strip between two border lines, not a
  band, which would run into a muted last heading), and the first listing stands: never a row
  dropped or shown twice, since a silently missing row (a device) is the worse failure. A row's
  `rowTone` tints it with the tone its badge has (theme tokens `--neat-tint-<tone>` and, for
  hover and selection, `--neat-tint-<tone>-accent`); each row takes exactly one set of fills, so no
  class has to outweigh another, and the tints are opaque mixes over `--background`, so a toned list
  sits on the page, not on a card. The file browser reuses the list for its rows, since a folder row
  is a row that Enter or a double click also opens (`activated`, with `activateOn="double-click"`;
  a single click only highlights a folder, and a chevron button, no tab stop, ends a folder row for
  a pointer's single-click open), and its `manage` mode is the list's
  checked mode (a file's path is its key); what differs is the browser's, not the list's: an arrow
  key onto a folder highlights it without changing `selected` (which is a file's path), and
  Backspace, which the list has no use for, is handled on the list's host. A checked list adds no
  hint of its own: the multi-selectable listbox says what checking is. A node's `tag` is a neutral
  `neat-badge`, the kit's one look for a fact beside a value, and an `unavailable` node is
  grayed but usable (so not `disabled`, which in the kit means "cannot be used"). The browser says
  nothing of its own that an app cannot replace (`labels`), and its tree helpers are the helpers of
  the media browser it was extracted from (`file-tree.ts`, not exported). `filter` is a model so
  that an app can show a note about its folder (how many files it left out) only while no filter is
  active; the kit never hides a file itself.

  A listbox's options have presentational children, so a button in a row is not strictly valid
  ARIA. The compromise is deliberate and holds only as long as the row's controls are pointer
  conveniences: a cell button that is a tab stop needs an `aria-label` naming its row; if every
  row's controls must be keyboard-reachable on their own, the list should become a grid.

  Three wrappers own their behavior instead of hosting a brain primitive, each for a stated reason:
  - `NeatSwitch` is a native `button` with `role="switch"`: brain's switch is a component that
    renders its own button, so it cannot be a host directive.
  - `NeatSegmented` owns its radios (roles, roving tabindex, arrow keys): brain's toggle item
    re-writes `aria-pressed` on every change, which contradicts the radio roles.
    It is drawn as an iOS-style switch: a track (`--neat-segmented-track`) with a raised thumb
    (`--neat-segmented-thumb`) that slides under the chosen label, which is semibold in `--primary`,
    and a divider between two unchosen neighbors. The options are equal-width grid columns, so the
    thumb is pure CSS from two custom properties on the group (`--neat-segmented-count` and
    `--neat-segmented-index`), never measured. The control is 32 px tall (28 px segments in a 2 px
    inset), the height of the small buttons, icon buttons and pills beside it in a toolbar. It sizes to its widest label times the count and
    fills at most its container (`max-w-full`): in a narrower one the columns shrink together
    (`auto-cols-fr`) and each label ends in an ellipsis, its accessible name still whole. A flex row
    never squeezes it (`shrink-0`): a crowded row moves or wraps it, or its other items give way, as
    a toolbar's title does. In dark the thumb is only as light as keeps the primary label 4.5:1 on
    it, so it stands about 1.1:1 from the track and a hairline ring (`--neat-segmented-thumb-edge`,
    1.5:1 from the track) outlines it. Each label is stacked with an invisible `aria-hidden`
    semibold copy, so the control does not resize as the choice moves.
  - `NeatPopoverTrigger` owns its ARIA and its click (`NeatPopover` itself hosts brain's popover):
    brain's trigger names the panel in `aria-controls` while it is closed, when no element has
    that id.

  `NeatTabs` renders a panel element for every tab, so each trigger's `aria-controls` names an
  element that exists; only the open tab's holds its template, and the others are empty and
  `hidden`. Brain's ids come from the keys alone, so the kit's keys are the instance's prefix and
  the tab's index, never its `value`: a value with spaces ("Board 1") would be an invalid id.
  The tab list sits in a strip that scrolls sideways (`overflow-x-auto`) when the tabs do not fit
  their container, as in an aside: the tabs neither wrap nor push the page sideways, and the
  strip, not the page, moves to show the open tab.
  Inside a `neat-popover`'s panel, a menu's items are `button[neatPopoverItem]`, full-width rows
  with the text at the start and no gap to the next row, and `hr[neatPopoverDivider]` (a plain `hr`
  with Spartan's separator classes and `role="separator"`, so it sets a menu's groups apart for
  assistive technology) sets groups of rows apart. The panel's padding and gap are one number,
  `--neat-popover-inset`, which the rows reach back across to the panel's edges (a negative
  inline margin, the same inset as padding), so the hover fill is a band edge to edge and the
  number is stated once. A row is a plain button, not a `neatButton`: its look is the item's, and
  a button's classes would compete with it. Hover and keyboard focus fill it with `--accent`
  (focus adds the `--ring` inside the row); a disabled row is `--muted-foreground` with no fill
  and, being a disabled button, no tab stop. The panel puts focus on its first _enabled_ control
  and carries Tab from its first and last enabled ones, because CDK's `isTabbable` counts a
  disabled button. An app has no stylesheet of its own to say any of this, and the look is the
  kit's.

- **Customize in this order: theme tokens, then wrapper inputs and classes, never helm.** Tokens
  come from `lib/theme/*.ts`; `npm run theme:emit` regenerates `tokens.generated.css`, and the theme
  spec checks the contrast of every text pair it emits. A wrapper overrides a helm class only where
  its spec shows a failure (the button's hover states are the example), with the reason in a comment.
- **Class strings are literals**, never built at runtime. Why: Tailwind finds the classes the kit
  stylesheet needs by reading the kit's sources; a computed class name is silently missing.
- **Apps need no Tailwind.** The kit ships its compiled stylesheet (`styles/neat-ui.css`), which
  contains exactly the utilities the kit's sources use; utility classes in app templates are not
  part of the kit's API.
- **Long-form text is styled by the kit stylesheet, under `neatProse`.** `lib/prose/prose.css` is a
  stylesheet of the kit's own that the compiled stylesheet imports, not a component's: the text it
  styles is the app's (another template's, or `[innerHTML]`), which encapsulated styles cannot
  reach, and a directive has no styles. Its rules sit in the `components` layer under `:where()`,
  below the kit's utilities and every unlayered style. They reach only the prose's flow: the host,
  its quotes, the items of its lists and of the lists inside them, and the links, code and keys in
  their text. So a kit part placed in it keeps its own look, and nothing outside a `neatProse`
  host changes. Its `h1` to `h4`, paragraphs, bulleted lists, quotes and inline code are Spartan's
  typography: the classes of helm's `hlmH1` to `hlmH4`, `hlmP`, `hlmUl`, `hlmBlockquote` and
  `hlmCode` as `@apply` rules (the headings less helm's `scroll-m-20`, as the directives, since
  `neat-page` owns where a fragment link stops), the same classes the typography directives bind,
  so prose and a page set element by element show no seam; the spec reads the vendored files and
  holds each rule to them. Helm states the space between blocks on each element (a paragraph unless
  first, a quote, a list above and below); prose states it once, as its flow's 1.5rem gap before
  every block but the first, so a container's edges stay free (a chat bubble, a card). Spartan has
  no `h5`, `h6`, numbered list, list item, link or table, so those keep the kit's rules, and blocks
  inside a list item stay `--neat-space-3` apart. Inline code and a key have one look each, the
  utilities `neat-code` (Spartan's inline code, wrapping anywhere) and `neat-key` there, which
  `NeatCode` and `NeatShortcut` put on their elements and prose applies to a plain `code` and `kbd`;
  keys stay the kit's, Spartan's typography having none. A link takes no color of its own, so it
  holds its text's contrast on any surface (a callout's tint, a dialog), and its underline sets it
  apart (WCAG 1.4.1). The spec tests which elements each rule reaches. `neat-markdown` keeps
  `neatProse` on its host rather than typography directives on its elements: Spartan has none
  for `h5`, `h6`, `ol`, `li`, links or tables, so a reply would be half directives and half prose
  with the same look either way. Escape hatch: what the flow does not cover is a change to
  prose.css and its spec, never an app's own prose styles; a table is `neatTable`'s.
- **A button that waits without losing the focus is `aria-disabled`, not `disabled`.** `NeatButton`
  dims `[attr.aria-disabled]="true"` as helm dims a disabled button, with a not-allowed cursor,
  while the button stays focusable and keeps its pointer events, so a tooltip saying why it waits
  still opens on hover; a `disabled` button drops the focus, which a dialog's focus trap then
  cannot take back. The kit only styles it: a click, Enter and Space all still fire `click`, so
  the handler ignores presses while it waits.
- **`NeatButton` has seven variants: `primary`, `secondary`, `outlined`, `text`, `danger`,
  `danger-text` and `success`.** `success` is a solid `--success` fill under `--success-foreground`
  for the action that starts something (Start recording), hovering to 90% of the fill and focusing
  with the ring color as `primary` does. `danger` is its counterpart, a solid `--destructive` fill
  under `--destructive-foreground` for the action that stops or discards (Stop recording), hovering
  to 90% and focusing with its red ring; the quiet red, for a destructive action among text
  buttons, is `danger-text`. `button.spec` holds the text of both to 4.5:1 at rest and on hover in
  both schemes. Each variant's contrast is pinned there, so a new one is added to the spec's
  variant list first.
- **The kit's icons are outlines, except `play`, `pause` and `stop`, which are filled.** Why: media
  controls are solid by convention, and a filled glyph reads at the sizes a transport is drawn at.
  `lib/icon/icon-registry.ts` makes them through `filled(...)` (`fill: currentColor` on each shape);
  no other glyph is filled, so do not use it to emphasize one. `spinner` is the one glyph that
  moves: `icon.css` turns it once a second, and only for a user who has not asked for reduced
  motion (otherwise it is a still glyph), so an app's busy control never animates it itself and
  says that it waits in text or state (`aria-busy`), since the icon is decorative.
- **An icon takes a name of the kit's set first; a glyph from `@sima/neat-ui/lucide` only where no
  name fits; Lucide is never imported from its own package, nor `@lucide/angular`.** Why: the
  names say what an icon means and are swapped in one place (`icon-registry.ts`), and every app
  importing the library itself would make the kit's choice of it a promise to every app. A glyph
  from the `lucide` entry is the escape hatch (`<neat-icon [name]="Rocket" />` with
  `import { Rocket } from '@sima/neat-ui/lucide'`): `NeatIconGlyph`, a drawing, which has no
  `data-icon` and so no spinner turn, and which only the glyphs an app imports bundle (the
  entry is side-effect free). The rail takes the same: a page's `icon` (`NeatNavItem.icon`) is a
  name or a glyph, and an app's rail item holds a `neat-icon` of either; `home` is the name for an
  app's start page. If a glyph is wanted in more than one place, or means something in
  the app, add a name to the registry instead. The entry's `export *` is the one place the kit
  re-exports a package whole: the docs show it as one part named `lucide`, not one per glyph.
  The showcase's icon finder (Theme › Icon finder, `pages/icon-finder/`) lists both, the kit's
  names first, found by name or by Lucide's tags, each with its usage and, for a glyph a kit name
  draws, that name to take instead. Which glyph a name draws is internal: `docs:emit` reads it from
  `icon-registry.ts` into `docs/generated/icon-glyphs.ts` rather than the kit exporting it. The
  tags come from `lucide-static` (ISC, pinned to `lucide`'s version), the showcase's one dev
  dependency of its own: ESLint (`SHOWCASE_ONLY` in the root `eslint.config.js`) fails an import
  of it outside `projects/showcase/`, and `npm run check:dist` fails a package that names it.
- **A toggle button binds `pressed`, never `aria-pressed`.** `NeatButton` owns the attribute (a
  host binding that is absent while `pressed` is undefined) and gives the pressed look with it, so
  an `[attr.aria-pressed]` on a `neatButton` is overwritten. The look is the inverse of the page
  (`foreground` fill, `background` text) and is 3:1 from the surface in both themes and from the
  resting fill of every variant but `primary`, `success` and `danger`, whose solid fills leave no
  room: put toggles on the others. A name that stays the same while the state changes is a
  toggle's; a button whose label changes with the state is not one, so leave `pressed` unset.
- **`NeatSlider` takes `describedBy`, an element id, for notes about the slider; it lands on the
  thumb, with `aria-disabled` mirrored there.** Why: brain puts `aria-disabled` on the root and
  assistive technology moves focus to the thumb, so a description or a disabled state on the root
  is never announced.
- **Tooltips never open on touch** (brain's design: a tap would also trigger the control). A tooltip
  repeats the control's accessible name; never put information only in a tooltip. `neatTooltip`
  takes a string only: its type shows brain's `TemplateRef` too (the host-directive alias keeps the
  primitive's input type), but templates are not part of the kit's API.

## Rules

**Reuse what the kit offers.**
Why: each component carries the theme, accessibility and behavior decisions already made. A
re-implementation drifts from them and from every other app.
Escape hatch: if nothing fits, go to the next rule.

**If nothing fits, stop and propose a kit change instead of working around it.**
A kit change is a new component or a new input on an existing one. Why: a workaround in one app is
invisible to the others and hardens into a divergent fork; a kit change is reviewed once and
benefits every app. Escape hatch: write the proposal (what you need, why existing components fall
short, the API you would like) and raise it with the maintainer before building; do not ship the
workaround in the meantime.

**Style only through theme tokens and component inputs.**
Why: tokens are what make light/dark and later rebranding work. Overrides (deep selectors,
`!important`, hard-coded sizes or colors) silently break in one theme or after a Spartan update.
The tokens are the theme's colors (Spartan's variables such as `--primary`, `--muted-foreground`,
`--border`), `--radius`, and a short layout set from Tailwind's scale, defined once in the kit
stylesheet: `--neat-space-2`, `--neat-space-3`, `--neat-space-4`, `--neat-space-6` (0.5, 0.75, 1
and 1.5rem, for gaps and insets), `--neat-text-xs`, `--neat-text-sm`, `--neat-text-base` (0.75,
0.875 and 1rem), `--neat-aside-width` (22rem, the width of a page's aside) and `--neat-surface`
(the fill of the surface a component sits on, for a part that covers what scrolls under it:
`--background`, set to `--popover` by a dialog panel and a popover, and to its fill by an app's own
surface such as a card). Charts draw with `--neat-series-1` to `--neat-series-8` (four hues, blue,
purple, orange and teal, then a darker blue and the lighter purple, orange and blue; Spartan's
`--chart-1` to `--chart-5` alias the first five, for Spartan parts that use them), `--neat-line`
(a single metric's line), `--neat-line-warning` and `--neat-line-danger` (threshold lines), and
`--neat-heat-low` and `--neat-heat-high` (the ends of the heatmap ramp). Code takes
`--neat-code-keyword`, `-string`, `-comment`, `-constant`, `-type`, `-function`, `-property` and
`-tag`, each held to 4.5:1 on `--muted`, the code block's fill, and on `--neat-code-mark`, the
tint behind a mark. `--neat-speech-tint` is the tint behind the sentence being read aloud, the
primary over `--background` (30 % light, 40 % dark), with `--foreground` held to 4.5:1 on it.
`--neat-glow-head` is the message box comet's bright head, white in both schemes. `--neat-picture-dim` is the
dim over a picture the viewfinder reads, black at 35 % in both schemes, as a picture is the same in
both. `--neat-live` is the live
dot's red, one value in both schemes since it also sits on video. `--neat-video-surface` is a video
tile's own fill where there is no picture: `--muted` in light, and in dark, where `--muted` is the
card's own color and tiles on a card vanished in it, the neutral badge's gray. Green, amber and red
are left out of the series so that they keep meaning status. Light series 6 to 8 are below 3:1 on
white: use them as fills whose values the legend carries as text. Page insets come from `neat-page`
(`padding="page"` by default, `padding="none"` for full-bleed content such as a video grid), never
from a page's own stylesheet. Escape hatch: if a look cannot be reached through tokens and inputs,
that is a kit gap. Treat it as a proposal under the previous rule, not as a reason to override.

**No color literals outside the theme directories: `projects/neat-ui/src/lib/theme/`, and
`projects/neat-ui/video/src/lib/theme/` for the video overlay palette.**
No hex, `rgb()`, `rgba()`, `hsl()` or `hsla()` anywhere else, in CSS, TypeScript or templates.
Why: the palette is fixed and lives in the theme so both themes stay coherent. Stylelint enforces
this for stylesheets (`npm run lint`). Escape hatch: if you need a color that is not a token, add a
token in the theme directory through a kit change; never inline the value.
The only exception: official brand-asset SVGs (the SiMa.ai logo) keep their own `fill` attributes.

**A component is the containing block of its own absolutely positioned parts.**
A part positioned `absolute` (a visually hidden label or live region, an overlay, a readout) has a
positioned box of its component around it: the host, or the scrolling box inside the component
that the part scrolls with (the select list's area, the shell's nav). Why: a clipping ancestor
clips only the descendants whose containing block lies inside it, and a page's scroll body
(neat-page's) is not positioned. A part whose containing block falls back to the viewport escapes
every scroll body and, below the fold, makes the whole document scroll. Use `position: relative`
without a z-index, so the box makes no stacking context and a part that hangs out of it (a
readout below its plot) still paints over its neighbors. Escape hatch: a part that must leave its
component (a popover, a tooltip, a toast) goes through the CDK overlay, never through a
positioned ancestor of the app's.

**Component styles live in a `.css` file next to the component, referenced with `styleUrl`.**
Why: Stylelint reads only stylesheets, so a style written inline in the decorator (`styles:`)
escapes the color-literal rules above without anyone noticing. ESLint rejects inline styles
(`component-max-inline-declarations`); the kit's templates may stay inline (an example's may not,
above). Escape hatch: none; a component that needs no styles simply has no stylesheet.

**Pages fill the shell's content area and own at most one scroll context.**
Why: nested scroll containers and hard-coded heights break on other screen sizes and in kiosk mode,
where the shell's size is not yours to know. Do not measure or hard-code the shell's size. The
supported other scroll contexts are the page's aside and its page nav (below). Escape hatch:
if a page needs another independently scrolling region (for example a log pane beside a form), raise
it as a kit change so the layout is a supported component, not an ad hoc one. The shell fills the
viewport, or the bounded box it is placed in (its `max-height` is 100% of the parent, which does
nothing at the root); that is for a demo or an embedded frame, not a way for a page to size the
shell.

**Navigation is the rail and the page nav; tabs are not navigation.**
Pages are the rail's items (`navItems`); a page's sub-pages are its item's `children`; more than a
few sub-pages (about six), groups of them or a level below a sub-page are the page nav
(`nav[neatPageNav]`). Never route-linked tabs: `neat-tabs` is for views inside one page that are
not addresses (a dialog's sections, say). The package README's "Using the kit in an app" states
this rule for apps, and the showcase follows it. Why: an app's coding agent copies what the kit
shows, and two ways to navigate (tabs on some pages, the rail on others) drift into as many as
there are apps; one model also lets the kit keep each level reachable on every screen and to a
screen reader. `NeatPageTabs` and `NeatPageTab` were removed in 0.26.0 for this: a page's
route-linked views are its rail item's `children`, or links in its page nav. Escape hatch: a
level the three do not cover is a change to this rule, raised with the maintainer, never a row of
links an app draws itself.

**The rail is the app's, the top bar is the page's.**
Why: a colleague's review found that page tools running straight into the app's controls (the
board, System Info, the theme) did not read as the page's. `neat-shell` says which is which by
place, so every app reads the same way.

- The rail holds the pages (`navItems`), then, at its bottom below a divider, the app's items:
  elements marked `neatRailEnd`, then the kit's theme item, then the rail's own control. The tab
  order follows: pages, the app's items, the theme, the rail's control. Rail items are actions
  whose label says what a click does, never toggles: the theme item is "Dark theme" with the moon
  while light and "Light theme" with the sun while dark; the control is "Show labels" while
  collapsed and "Collapse" while expanded.
- **Level 2, a page's sub-pages, are its item's `children`** (`NeatNavChild`: a `label` and an
  absolute `path`, no icon). Why: the rail is the one place pages are navigated, and sub-pages
  there keep a page's views reachable without a second row of tabs. They unfold under the item
  only while its page is active and the rail shows its labels (expanded, or floating open on a
  narrow screen), so the rail does not grow with every page's sub-pages. The open one is the child
  whose `path` is a prefix of the route (query and fragment ignored), so a deeper route keeps it
  open; a child whose `path` equals its page's (Stats' Live at `/stats`) matches exactly. The open
  child carries `aria-current="page"` and the page's item then does not: it keeps its label at
  weight 500 with no fill, so one row alone looks current. The item's link goes to its own `path`:
  the app routes that to the first child or gives the first child the page's path; the kit does not
  redirect. The child row is `neatRailItem`'s `data-child` variant, stated once in `rail-item.css`.
  The top bar's title is the open child's label with the page's label beside it, muted; on a route
  deeper than the child with its own route `title` it is that title beside "page › child".
  Deeper levels are not the rail's: more than a few sub-pages, groups or nesting belong in the
  page nav (`nav[neatPageNav]`, below).
- **Collapsed, a page with `children` stays a link; hover and keyboard focus show their menu.** The
  collapsed rail has no room for sub-pages, so a menu beside the rail offers the choice among them,
  but only as a companion: a press (click, tap, Enter, Space) navigates to the page's `path`, as on
  any rail item (the app's routes decide which sub-page shows), with a link's modified clicks, and
  puts the menu away if it is up. Why: a menu that a click opened and left up was a nuisance, and
  the rail can be expanded where there is no hover (touch), so a tap shows no menu. A mouse or pen
  hovering shows it and it closes a short delay after the pointer leaves the item and the menu;
  keyboard focus on the item (`:focus-visible`, as the tooltip shows on focus) shows it, Tab from the
  item goes to the first link, Tab from the last link closes the menu and goes on from the item,
  Shift+Tab from the first returns to the item, Escape closes it and leaves focus on the item, and
  focus leaving both closes it. The menu is a `group` named by its heading, the page's label, with
  one link per child, the open one `aria-current="page"`; the item `aria-controls` it while it is
  shown and has no `aria-haspopup`/`aria-expanded` (a press opens nothing) and no tooltip, since the
  heading says the label. `aria-describedby`, the tooltip's way, would hold the links as text. It is
  `RailMenu` (`rail-menu.ts`) on CDK's overlay: brain's popover opens below its trigger, not beside
  the rail. Its focus rules (`OverlayFocus`) and its panel surface (`PANEL_SURFACE_CLASSES`) are the
  ones `neat-popover` uses, one place for each, exported `ɵ` for the popover's entry (the primary
  may not import a secondary entry, so what both need lives in the primary); its rows are the
  rail's own `data-child` rows.
- An app's item is a `button[neatRailItem]` or `a[neatRailItem]` with a `label`, the look and
  behavior the page links have (they are rail items too): the content is the icon (a
  `neat-icon`), the label shows beside it while the rail is expanded, and while it is collapsed
  stays as visually hidden text (the item's name) and shows as a tooltip on the right.
- An item with a state (a board, a connection) says it with `tone` (a `NeatTone`: a 0.5rem dot on
  the icon's corner, ringed in the surface it sits on, the rail's or the hover and current-page
  fill), `text` (the visible first line, the label by default) and `detail` (a smaller second line
  in the tone's color, muted for success, neutral or no tone), as the board item of the shell
  topic's Rail items example and the device items after it, one per other tone, do.
  Both lines ellipsize and hide with the label while the rail is collapsed. `label` stays the
  tooltip and the name, so the app writes the whole sentence there, the state the dot alone shows
  included ("DevKit, 192.168.100.2, connected"). Why not composed by the kit: brain's tooltip takes
  its text from the template only. While the lines say other than `label`, they are `aria-hidden`
  and the label is visually hidden text beside them, so the name still comes from the content: a
  kit `aria-label` binding would remove one the app sets. So `label` must contain the visible
  `text` and `detail` as they read: the name is all assistive technology gets, and someone who
  speaks what they see ("click DevKit") must find it there (WCAG 2.5.3, label in name). Each
  tone's dot color is `TONE_DOT_COLORS` in the theme (`ɵTONE_DOT_COLORS`, which a dot reads as
  `--neat-tone-dot`) and its detail color is stated once in `rail-item.css`; the spec holds the
  detail text to 4.5:1 and the dot to 3:1 on `--sidebar` and `--sidebar-accent` in both schemes.
- Visible text the inputs cannot say goes in an element marked `neatRailItemLabel` inside the item,
  which takes the label's place; `label` stays the tooltip, so it should say at least as much, and
  an `aria-label` the app sets wins as the name. The kit ellipsizes only the label's own line: the
  lines of such a flex column are the app's elements, so each one ellipsizes itself
  (`min-width: 0`, `overflow: hidden`, `white-space: nowrap`, `text-overflow: ellipsis`). An item
  has no pressed state, and the rail's selection fill means only "the current page"
  (`aria-current="page"`). A link followed on a phone puts the floating rail away; a button leaves
  it. The item's look is `rail-item.css`, once.
- `<hr neatRailEnd neatRailDivider />` between an app's items sets groups apart (below a board
  block, for example): Spartan's separator, horizontal, 1px of `--sidebar-border`, half a step from
  the items around it, decorative (`role="none"`). The shell draws the line above the whole group
  with the same element, so the line exists once. An app's rail content draws nothing of its own but
  what goes inside an item.
- The top bar holds the logo, the app name and the page title, then at its right the page's tools
  (`*neatPageToolbar`, below), elements marked `neatTopbarEnd` (kept for an app that needs one),
  the kiosk button (the one app control there: it changes how the page is shown), and last, at the
  right edge above the aside, the page's aside toggle, in a cell of its own set apart by
  a divider. The page title is the label of the nav item the route belongs to, else the route's
  own `title` (a page with no rail item), else none.

**A page's toolbar goes through `*neatPageToolbar`, its aside toggle through
`neat-aside-toggle`, its page nav through `nav[neatPageNav]`, its aside through
`[neatPageAside]`.**
Why: the shell owns the top bar and kiosk mode, and `neat-page` owns the page's layout; a page that
builds its own bar, row of views or panel duplicates both and breaks in one of them. Views do not
belong in the toolbar: it sits at the right end of the top bar, so its left edge moves with the
number of tools and a switch in it moves too.

- `<div *neatPageToolbar>…</div>` (an `ng-container` where the page has dividers: the tools are the
  row's items, and a `div` makes one item of them) anywhere in a page's template renders that
  content in the top bar, at its right end just before the end slot and the kiosk button, while the
  page exists. In kiosk mode it floats beside the exit control and fades with it. The content stays
  the page's (bindings, injection), but its view is re-created on entering and leaving kiosk mode,
  so keep its state (values, open menus) in the page, never in components inside the toolbar. Groups
  of tools are set apart by `<hr neatPageToolbarDivider />` between them
  (`NeatPageToolbarDivider`, primary): Spartan's separator, vertical and decorative (`role="none"`),
  1px of `--border`, the row's
  height less `--neat-space-3` at top and bottom, so it reads the same in the top bar, the kiosk bar
  and a phone's second row.
  The region gives up width first and scrolls sideways rather than push the end slot out, so keep
  a toolbar narrow enough to fit at the screen sizes the app supports. One toolbar at a time; a
  second throws in dev mode. On a narrow screen (below 48rem) the shell wraps its top bar into two
  rows: the logo, the end slot, the kiosk button and the aside toggle share the first (the end
  slot has a zero basis and grows, so a long pill truncates inside it instead of wrapping onto a
  row of its own; the toggle is the row's last item), and the toolbar takes the whole last row (the
  host's `data-narrow` says which). A page without tools keeps the wide bar's height. The markup
  order is unchanged, so the tab order runs toolbar, end slot, kiosk button, toggle. Kit 0.12.2's
  rule that the toggle leads the tools on a phone is gone with the toggle's place in the first row,
  where it stays in view and the visual order is the tab order.
- `<nav neatPageNav aria-label="Components" [groups]="groups" filterLabel="Filter">` as a direct
  child of `neat-page` is the page nav, the third level of navigation after the rail's
  pages and their `children`: for more than a few of a page's links, links in groups, or a level
  below a sub-page. Data, not content: `groups` (`NeatPageNavGroup`, an optional heading `label`
  and its `items`, each `NeatPageNavLink` a `label` and an absolute `path`) and an optional
  `filterLabel`, which adds a `NeatSearch` at its top that keeps the links whose label holds what
  was typed (ignoring case) and a group's heading while any of its links is kept, and says
  "Nothing matches" when none is. The open link is the one whose `path` the route is under, query
  and fragment ignored, the longest such path winning; it carries `aria-current="page"` and has
  the rail's current-page look in the page's tokens (accent fill and weight 500), the other links
  muted until hovered. The landmark's name is the app's `aria-label` (a nav without a name throws
  in dev mode). On a wide screen the page draws it as the body's start column,
  15rem, as high as the page and scrolling on its own with every `scroll` mode, the filter sticky
  at its top, the aside at the other end; on a narrow screen it is a closed section above the
  body, with `NeatCollapsible`'s look (the primary cannot import the collapsible entry, so the look
  is shared from the primary as `ɵCOLLAPSIBLE_CLASSES` and brain's collapsible is the behavior),
  the landmark's name as its label and the open link as its summary; opened, its list scrolls
  inside it up to the page's height, and choosing a link closes it with the focus on its button.
  It scrolls only its own box to show the open link whenever a navigation leaves it out of view,
  never with `scrollIntoView`, which also scrolls the page and every other ancestor. `neat-page`
  says which layout with a `data-nav="beside" | "above"` attribute on its host (the list's own
  host says `data-layout="column" | "collapsible"`), from `NeatViewport`. Why a kit part: the
  showcase's own topic list, which it replaced, proved the pattern, and a list each app draws
  itself would drift in look, scrolling and accessibility.
- Elements marked `neatPageAside` inside `neat-page` form a right-hand panel shown while
  `aside="open"`: `--neat-aside-width` wide (unless `asideWidth` says otherwise, below), inset and
  scrolling on its own, with the body narrowing beside it and keeping its own `scroll` setting.
  Closed, the panel is removed from the DOM, but projected content is still instantiated: gate
  expensive content (an inspector with a live preview) with an `@if` of your own.
  On a narrow screen (`NeatViewport.narrow`, below 48rem, stated once there) the panel floats
  over the right of the page instead, at most the page's width, and the body keeps the whole
  width; `neat-page` says which with a `data-aside="beside" | "overlay"` attribute on its host,
  and its CSS reacts to that, never to a second `@media` with the breakpoint. No scrim, no Escape:
  the top bar's toggle closes it. Why: a phone has no room for a column beside the body.
  `neatAsideOpen(remembered, remember)` (in an injection context) is the state a page that
  remembers its panel should bind: wide, it is the remembered choice; narrow, a transient flag
  that starts closed and is reset each time the screen becomes narrow, so a phone's opening and
  closing never overwrites the choice made on a wide screen. A page that opens its panel by
  itself (a row selected) calls `set(true)`, which floats it over the body on a phone.
  Tests that need a screen width provide
  `{ provide: NeatViewport, useValue: { narrow: signal(true) } }`;
  nothing but `NeatViewport` calls `matchMedia` for the breakpoint.
- Beside the body (wide screens only; a phone's panel keeps its fixed width and has no handle) the
  panel is resizable. `[(asideWidth)]` is its width in pixels, `null` for the default; the kit
  stores nothing, so an app that wants the width kept binds the model to its own storage. The
  handle is a `role="separator"` on the panel's inline-start edge (`aria-valuemin`, `-max`, `-now`
  and `-valuetext` in pixels, "Resize side panel"): dragging it with a pointer shows the width
  live and writes the model on release; ArrowLeft widens and ArrowRight narrows by 16 px, Home and
  End go to the bounds, a double click resets to `null`. The bounds, stated once in `page.ts`, are
  18rem and the page's width less 20rem (so the body keeps 20rem; no other cap, and on a page too
  small for both the minimum wins). Until the page is measured there is no maximum, and the CSS
  falls back to the page's own width. A width outside
  them is shown clamped and the model left alone, and the panel is re-clamped when the page is
  resized (a `ResizeObserver` on the page, only while the panel is open), so a remembered width
  returns with a wider window. The handle's look (an 8 px hit area, the `col-resize` cursor, a
  line on hover, focus and drag) is the page's stylesheet, not the app's. The handle assumes a
  right-hand panel: right-to-left layouts are not supported.
- The panel opens and closes with `<neat-aside-toggle [(open)]="asideOpen" />`, declared in the
  page's template beside `*neatPageToolbar`, never inside it (that throws in dev mode). It renders
  nothing where it is declared: its button is a template the shell draws at the top bar's right
  edge after the kiosk button (on a phone, the first row's last item; in kiosk mode, after the
  page's tools in the floating bar), the way the toolbar reaches the top bar, and it leaves with
  the page. One at a time; a second throws in dev mode. It is the one look for that button on
  every page, drawn as the kiosk button beside it (a large, round, text, icon-only `neatButton`,
  "Side panel" unless `label` says otherwise); the page owns `open` and remembers it where it
  likes. Inside the panel,
  `neatAsidePanel` stacks the parts one gap apart, `neatAsideTitle` and `neatAsideHeading` are the
  panel's title and section headings, `neatAsideActions` a row of buttons and `code[neatCode]` a
  URL or path in running text. A page's panel styles nothing of this itself.
- **A link to a section is a fragment, and `neat-page` follows it; an app turns nothing on.**
  Why: the router's `anchorScrolling` scrolls the window, which never scrolls in a kit app, so
  each app wrote its own handler. A navigation whose URL has a fragment (a `routerLink` with
  `fragment`, a shared link, back and forward) scrolls the page's own box that holds the element
  of that id, the body or the aside, once the page has rendered (`page/fragment.ts`). It scrolls
  that box alone, never with `scrollIntoView`, which would scroll the page's clipped boxes too.
  The element stops at the box's inset (the body's and the aside's `scroll-padding-top` are their
  padding), or as far below it as its own `scroll-margin-top` says. It glides for a link on the page and jumps
  as the page opens at a fragment or under reduced motion. A plain `href="#id"` inside the page
  becomes such a navigation (it would otherwise resolve against the document's base and leave the
  page), except with `HashLocationStrategy`, where it is a route. A link to the fragment the URL
  has scrolls again (the router's `NavigationSkipped`). An element of a nested `neat-page` is that
  page's, and one that arrives after the page has rendered is not waited for. The showcase's
  `#example-<id>` and `#api-<Name>` anchors go through it; the docs page only opens the panel and
  focuses the part's heading.

**Raw browser APIs used for performance stay isolated, outside change detection, with tests.**
Why: canvas, requestAnimationFrame, observers and similar code is fast because it bypasses Angular;
spread through components it makes change detection unpredictable and bugs hard to reproduce.
Keep it in a small, separate unit that runs outside the Angular zone/signals graph, exposes a narrow
interface, and has its own tests. Escape hatch: if the isolation costs too much for a case, say so
in the PR and agree the exception before merging.

**A widget tells the app what happens on it: `model()` for state, `output()` for events.**
State the app may also set (what is hovered, what is selected) is a `model()`, so the app can bind
it both ways and drive the widget from outside (a row hovered in a list outlines the item in the
view). Events are `output()`s carrying the widget's own item and a position in the widget's own
units (meters, a time, a cell), not a DOM event alone. An item is named by an id the app gives,
stable across updates, not by an index into data that changes. Listeners that run outside change
detection hand events back inside Angular's zone (`NgZone.run`), so an app's handler runs as any
other; continuous events (a pointer moving) at most once per animation frame, and only when they
changed. Every widget that gets them gets a showcase example in which another component (a card)
shows the state and drives it. Why: an app reacts to the widget without reaching into it, and
every widget does it the same way. `neat-bev` has `hovered`, `activated` and `pointerMove`. The
time chart, the stacked chart and the label timeline name a moment (ms) in `hovered`, so charts
bound to one signal share a crosshair (each shows its nearest sample, or the run covering the
moment), and the heatmap names a cell (`NeatHeatmapCell`: row key and time); their `activated`
reports a click or Enter (`NeatSamplePick`, `NeatHeatmapPick`, `NeatRunPick`). The charts share
it through `charts/readout.ts`: the cursor's `own` (pointer or keys) and `outside` (the app's),
and `linkHovered`, which writes `hovered` only from the chart's own cursor, so charts bound
together never answer each other. The diagram's `hovered` is the part in focus
(`NeatDiagramPart`: a block or an edge by id), the pointer's or the keyboard's, or the app's while
they are on none, shown as `highlight` allows; its `activated` reports a click on a block or an
edge (`NeatDiagramPick`).

**Write for people first, in American English, as [docs/writing.md](docs/writing.md) says.**
The README, the docs, the showcase's text, doc comments and example descriptions open with what a
person needs (what it is, a picture, the shortest example, when to use it) and keep every detail,
rule and reason below it or one link away: layered, not trimmed. Why: many who read the kit work
without an agent, and an agent loses nothing when the detail stays. `npm run test:tools` fails on
the British spellings the repo used to have (`tools/spelling.mjs`); HTML's `aria-labelledby` and the
deprecated aliases `neatLabelColour` and the diagram messages' `colours` are the only exceptions.

**Call each thing by its name in [docs/glossary.md](docs/glossary.md); add a new term there before
using it.** This holds for prose, doc comments, example captions, test names and commit messages,
and for new public names, which take the glossary's word (a diagram's `group`, not a frame). Where
the wider UI world has an established name (card, dialog, tooltip), it wins over one of our own.
Name the thing, not its shape: "the block" or "the object", and "box" only for a rectangle. Why: one
name per thing lets a reader, or an agent, find every place that talks about it, and a second name
reads as a second thing (the diagram's "tip" was both a tooltip and an end marker). Escape hatch: a
thing the glossary lacks gets its entry in the same change that first names it.

**Every public part has a doc comment, and appears in the docs.**
Why: the docs are generated from the comments, so an undocumented part is an empty entry, and a
part missing from the docs will be reinvented. Every public part and every own input, model and
output has a doc comment; the docs show it as Markdown, of which they know paragraphs, fenced code
(`@if` and `@for` inside a fence stay intact), one level of `-` lists, `**strong**` and code spans.
A code span that is exactly a public part's name (`NeatTone`), or `Name.member`, becomes a link; one
naming a kit identifier that is not public (a private constant) fails `docs:emit -- --check`, since
no reader could follow it. The tags are `@deprecated <what to use instead>`, `@internal` (leaves a
member out, as a template directive's `template`) and, in a class's doc, `@input <name> <text>` and
`@output <name> <text>` for what it forwards from a primitive it hosts, which has no declaration of
its own to carry a comment. Every public part has a docs entry, and every component, directive,
service and function also has an example (types, interfaces and consts need only their entry in
the API panel); the examples are how both themes are checked by eye. Escape hatch: none for the docs
entry; the example rule names its exemptions in `docs.spec.ts` (`BELONGS_TO_THE_APP`), for parts
only an app's root can use. Code that is not exported needs no entry.

## Commands

Node 24 is required (`.node-version`; Angular 22 supports `^22.22.3 || ^24.15.0`, we pin 24).

| Command                  | What it does                                                                    |
| ------------------------ | ------------------------------------------------------------------------------- |
| `npm start`              | Showcase dev server (after one `docs:emit`)                                     |
| `npm test`               | Unit tests for all projects (`npm test -- --watch=false` runs once and exits)   |
| `npm run lint`           | ESLint (angular-eslint) and Stylelint                                           |
| `npm run build`          | Build the library and its compiled stylesheet into `dist/neat-ui`               |
| `npm run check:dist`     | Check the built package (entry points, stylesheet, no helm or bench imports)    |
| `npm run test:tools`     | Tests for the repo tools (`tools/*.test.mjs`)                                   |
| `npm run theme:emit`     | Regenerate `lib/theme/tokens.generated.css` from the theme sources              |
| `npm run docs:emit`      | Regenerate the docs (`-- --check` only checks, `-- --watch` follows)            |
| `npm run docs:capture`   | Build the showcase and picture its examples into `docs/images` (`-- --help`)    |
| `npm run docs:pages`     | Write the Markdown docs in `docs/` from the kit and its examples (`-- --check`) |
| `npm run docs:gallery`   | Write the README's gallery from the `@gallery` examples (`-- --check` checks)   |
| `npm run helm:add`       | Add a Spartan helm component to `lib/ui/` (`-- <name>`), the only way in        |
| `npm run build:showcase` | Build the showcase app                                                          |
| `npm run bench`          | Rendering bench dev server, on port 4300                                        |
| `npm run bench:build`    | Build the bench for measuring (production, source maps, named chunks, commit)   |
| `npm run bench:run`      | The bench's harness (`projects/bench/harness/run.mjs`; `-- --help` for usage)   |
| `npm run pack`           | Build, then write `dist/neat-ui/sima-neat-ui-<version>.tgz` for apps to install |

Run lint, tests and the three builds (library, showcase, bench) before opening a PR; CI runs the
same.

## Quality bar

This is a prototype held to production standards of cleanliness, structure and tests, without
overengineering: no abstraction without a second use or a stated reason, no speculative
configurability. When a quick fix and a clean fix differ, take the clean one or stop and raise it.
