# AGENTS.md

Guidance for anyone (human or agent) working in this repository or building an app on `@sima/neat-ui`.
The rules below come with their reasons; if a reason does not apply to your situation, the escape
hatch says what to do instead of working around the rule.

## What this repo is

`neat-ui` is the shared SiMa.ai look and component set for Neat applications (Neat Insight first,
demo apps later). Its value is that every app looks and behaves the same and that a change to the
look happens in one place. Every rule here protects that.

- `projects/neat-ui`: the library, with one primary and several secondary entry points, each with
  its own public API file:
  - `@sima/neat-ui` (the primary): what the shell and every page need: theme, `NeatIcon`,
    `NeatShell`, `NeatPageToolbar`, `NeatPage` with its side panel's parts (`NeatAsideToggle`,
    `NeatAsidePanel`, `NeatAsideTitle`, `NeatAsideHeading`, `NeatAsideActions`), `neatAsideOpen`
    (a page's panel state, closed on a narrow screen) and `NeatViewport` (the kit's one answer to
    "is this screen narrow", below 48rem), `NeatCode`,
    `KioskService`, `NeatButton`, `NeatInlineButton`, `NeatTooltip`, `NeatNote` and `neatSecondsAgo`
    (the kit's one relative-time style, "just now", "12 s ago", "3 min ago"). Public API is
    `projects/neat-ui/src/public-api.ts`.
  - one secondary entry point per other component, `@sima/neat-ui/<name>`: `switch`, `slider`,
    `segmented`, `tabs`, `popover`, `confirm`, `input`, `number-field`, `line-list`, `select`
    (`NeatSelect`, a labelled listbox combobox, its label shown above it with `showLabel` or, with
    `labelPosition="inline"`, before it on its row), `progress` (`NeatProgress`, a bar or, with a
    `heading`, a titled readout, which the progress toast renders through), `drop-zone`
    (`NeatDropZone`, files by drop or by the system's chooser), `dialog` (`NeatDialog`, the general
    modal dialog, with `neat-dialog-body` and `neat-dialog-actions`) and
    `toast` (`NeatToasts` and `neat-toast-host`), `select-list` (`NeatSelectList`, a listbox of rows
    in columns, with the `neatColumn` templates that lay them out and `NeatSelectListGroup` for
    rows under headings) and `file-browser`
    (`NeatFileBrowser`, a tree's breadcrumb, count, filter and rows, built on `select-list` and
    `input`; `NeatFileNode` is its tree), `status-chip` (`NeatStatusChip`, a short status on a
    status fill, and `NeatStatusChipButton`, the same as a button; their `NeatTone` is the
    primary's, since a select list's `rowTone` takes the same tones), `details` (`NeatDetails`, the
    key/value list of a side panel; `--neat-details-term-width` on an ancestor lines several up, and
    a term wider than a fixed column breaks inside the word),
    `table` (`NeatTable`, the data table's look on a `table`: cells, rules, column headings; and
    `NeatNumeric`, which end-aligns a column's figures on one line with tabular digits, and
    `NeatFigure`, the same without the end alignment, for a cell with something after its figure; a
    table that gives up columns when its container is narrow says so itself, since the kit does not
    know the container),
    `field` (`NeatField`, a control under its visible name with
    a hint and an error, and `NeatErrorNote`, a failure said in place), `collapsible`
    (`NeatCollapsible`, a section a labelled button opens and closes, with a summary while closed),
    `callout` (`NeatCallout`, a note on a status tint with an icon, a heading and actions),
    `level-meter` (`NeatLevelMeter`, a live audio level as a bar of segments) and `charts` (live
    metric charts, drawn as SVG but for the heatmap: `NeatSparkline`, `NeatTimeChart`,
    `NeatStackedChart` and `NeatHeatmap`, `NeatChartCard`, the card they sit on, and
    `NeatSeriesSwatch`, a series' colour beside a label outside the chart; the only code that
    imports d3),
    each exporting that component and its types; and
    `video`: the video tile, the tile grid and what they need (overlay drawing, metadata sync, the
    overlay palette), and the region-of-interest editor with its swatch and `neatRoiNames`, which
    sit in the tile's overlay layer. Public API is `projects/neat-ui/<name>/src/public-api.ts`; its
    code lives in `projects/neat-ui/<name>/src/lib/`.
    Why one entry per component: an app's main bundle carries only the entries its shell imports,
    and a lazy route can keep a component (video's canvas, frame-loop and overlay code most of all)
    out of the main bundle only if it is a different import.
  - To add an entry point: create `projects/neat-ui/<name>/` with `ng-package.json` and
    `src/public-api.ts` as the existing ones have, add its path to `tsconfig.json`, and add its
    selectors to `SECONDARY_ENTRIES` in `tools/check-dist.mjs` and its public API to the list in
    `src/public-api.spec.ts`. `npm run test:tools` fails until the table matches the entry folders;
    the lint direction rules and the stylesheet's `@source` glob find a new entry by themselves. The
    stylesheet's scan skips `video`, which styles itself with component CSS only: a Tailwind utility
    in video code needs that exclusion lifted in `neat-ui.tailwind.css`, with the reason there.
- `projects/showcase`: the component gallery.

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
two folders they cannot do without and may import by relative path: `src/lib/theme/` (the helpers
the primary does not export) and `src/lib/ui/` (the vendored helm source their drift checks read
as text). The primary's `public-api.spec.ts`, which compares it with every entry, is the one file
that imports entries by relative path.
A new export goes into the entry point that owns its code, and only what an app or the showcase
needs is exported: a helper that only the kit's own code uses stays internal.

**d3 belongs to the `charts` entry alone.** ESLint (`@typescript-eslint/no-restricted-imports` in
the root `eslint.config.js`, which the kit's and the showcase's configs both take) fails an import
of `d3` or `d3-*` anywhere outside `projects/neat-ui/charts/`; `tools/lint-boundaries.test.mjs`
runs the real configs over sample code to prove it fires and that the entry-direction rules above
still do. Why: d3 reaches an app's bundle only through the entry its lazy route imports, and the
apps draw through the kit's components, never through d3 (`d3-scale` and `d3-shape` are ISC
licensed runtime `dependencies` of the package, listed in `allowedNonPeerDependencies`).

**How the charts are drawn.** Every chart in `charts` but the heatmap is an SVG with
`viewBox="0 0 600 100"`, `preserveAspectRatio="none"` and `overflow: visible`, so it fills
whatever box its host has, and its strokes carry `vector-effect: non-scaling-stroke`, so a
stretched box does not thicken them. What must not stretch (labels, the newest point's dot, the
crosshair, the readout) is an HTML overlay positioned in percent of the box, so nothing measures
the chart. Colours are named in `line-token.ts`, the one place a tone or a series index becomes a
token (the reference line's `--muted-foreground`, `REFERENCE_TOKEN` in `time-chart.ts`, and the
heatmap's `color-mix` in `fillOf` aside), and reach the CSS as a custom property the stroke or
fill reads (`--series`, `--level`, `--tone`, `--cell`, `--sparkline-stroke`), so a variant (a
tone) is stated once. A series' swatch is `NeatSeriesSwatch` (its `index` from 0, through
`seriesToken`), which the legends and readouts render and an app shows beside its own labels (a
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
stacked chart and the heatmap) is `position: relative` on its host, without a z-index
(`chart-frame.css`): the host is the containing block of its own absolutely positioned parts, so
the visually hidden live region cannot reach past a page's scroll body, which is not positioned,
and a readout that hangs below its plot still paints over the next card.

The charts that read out a sample (the time chart, the stacked chart and the heatmap) share one
cursor, `ReadoutCursor` in `charts/src/lib/readout.ts`: the pointer-versus-keys rule, Escape (a
readout that is there to close, else it belongs to whatever holds the chart), focus, blur and the
announce rule live there once, and each chart tells it only what its cells are (a sample for the
time-based charts, a row and column for the heatmap). The frame the plots share (heights, grid,
time axis, accessible name) is `frame.ts`, and their styles are `chart-frame.css` (host, head,
readout, axis) and `plot.css` (the drawn box), which a component lists before its own in
`styleUrls`. The stacked chart's bands are `stackedPaths` (bottom first; a sample where any band is
missing breaks the whole stack, since a partial sum was never measured, and for the same reason a
sample of "Other", the sum of the series folded beyond eight, is null where any folded value is),
at 0.85 opacity with a hairline in `--neat-surface`; its legend carries each band's value and
share as text, because eight colours alone are not enough. The heatmap is an HTML grid, not an
SVG: a cell is a `<span>` whose `--cell` is a `color-mix` of `--neat-heat-low` and
`--neat-heat-high` by the value's place in the domain (transparent when empty), its rows are
columns of time from `heatmap-columns.ts` (at most 48, one per sampling interval while the history
is short, so a pause stays visible), and its grid is one tab stop with a cell cursor. The geometry
is internal; only the components and their types are exported.

`NeatChartCard` is the one card for a metric (the overview cards, the Power tiles, a run view's
tiles): heading, `[neatChartCardChip]`, value with unit, caption, then the chart. It sets
`--neat-surface` to `--card` for the charts' label halos and has no `overflow`, `z-index`,
`isolation` or `transform`: a readout can hang below its plot, and a card that clipped it or made a
stacking context would let the next card paint over it. A `selectable` card's heading is a button
with `aria-current` and a click anywhere on the card emits `activate` too, its chart's plot
included: the readout follows the pointer without a click, and the plot is most of the card. Only
a control in the content (a button, a link, a form field) keeps its click; the plot's keys move the
readout and choose nothing. A chart in a card can drop its value labels (`[valueLabels]="false"`):
the grid and level lines, the time axis and the readout stay.

**What entries share goes through the primary under a `ɵ` prefix.** The vendored helm code
(`lib/ui/`, with its `hlm` class-merging util) and the shell's `IN_PAGE_TOOLBAR` token are internal,
yet the secondary entries need them, and an entry sees the primary only through its public API. So
the primary exports `ɵhlm`, `ɵtoggleVariants`, `ɵlistVariants`, `ɵIN_PAGE_TOOLBAR` and
`ɵFIELD_LABEL_CLASSES` (the field label's look, which `select` and `field` share so that their
fields line up): Angular's convention for private API. They are not for apps, may change in any
release, and no app file may import a `ɵ` name. A shared internal that a second entry needs is
exported the same way, never by a relative path. `lib/ui/` itself stays where `helm:add` writes it.

## How the kit is built on Spartan

The components come from Spartan UI: `@spartan-ng/brain` (headless primitives, an npm dependency)
and helm (Spartan's styled layer, generated into the repo). Apps see neither.

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
  table labelled with the helm file, and its spec reads that file as text
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
  `NeatCallout` hosts no brain primitive (brain has none); it is the kit's own box over the theme's
  tints, one look for the banners, problems and guides of every app. Its heading is a real heading
  (`role="heading"`, `headingLevel`, 3 by default), and with `region` (a landmark, which needs a
  heading to be named and takes no role without one) or `announce` (a live role) the callout is
  labelled by it; the role and the label are the callout's, so an app's notice never builds its own
  around it. Its fills are the tints the select list's rows have, opaque mixes over `--background`,
  so on a raised surface (a dialog, a popover) a tinted callout is the page's colour mixed, not the
  surface's, and a neutral one's `--muted` fill is a dark dialog's own surface: there the start
  border and the icon carry the tone (with the words), and the fill alone does not. Its icon takes
  the tone's solid colour where that holds 3:1 on the tint; warning's does not on its light tint, so
  its icon is `--foreground` and the start border carries the tone.

  `NeatLevelMeter` hosts no brain primitive (brain has none); it is the kit's own bar of 28
  segments over -50…0 dBFS, lit in the theme's status colours (`--success`, `--warning`,
  `--destructive`) and dark in `--border` (`--muted` would vanish on a dark card, whose fill it
  is). Its `sample` is a function, not a value: the meter calls it once per animation frame while
  it is set and the meter is rendered, and writes each segment's fill straight to the DOM,
  outside change detection (the per-frame rule below), so a level the app polls and a Web Audio
  analyser both feed it without a signal write per frame. It calls the function on its own, so an
  app passes an arrow-function property, never a method, which returns null rather than throw
  when its source is gone (a throw repeats every frame). A rendered meter samples even when
  hidden, so an app renders it only while there is a level (`@if`). It is `aria-hidden`; the app
  says the state in text.

  `NeatSelectList` and `NeatFileBrowser` own their behaviour too. Brain has no listbox on its own
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
  blocks. A column's `hideBelow`
  is judged against the list's own width, which a ResizeObserver watches only while some column
  has one. The header line, the listbox and each row are lines of one grid (each spans every track
  on `grid-cols-subgrid`), so a content-sized column (`width="max-content"`) fits the widest of its
  heading and its cells, and `align="end"` puts both at the column's end. The header sits inside
  the scrolling area, sticky at its top and filled with `--neat-surface`; the area's top scroll
  padding is the header's height, so a row scrolled into view stops below it. The focus ring is
  the outline of a pseudo-element over the area, since the sticky header paints over an outline
  of the area itself. `groups` (with `groupOf`) puts the rows under headings, each group a
  `role="group"` named by its heading and, like its heading, a line of the grid. A heading is a
  `--muted` band from edge to edge of the area (the rows' negative margins), its text on the
  cells' inset. In dark, `--muted` is the card, dialog and popover surface itself, so the band
  shows only on the page there (in light it shows on every surface); the heading's type still sets
  it apart. The keys move over the rows as shown, which a row's `data-index` numbers, never
  onto a heading, and a group's first row brings its heading into view with it, as the last row
  does the empty groups after it. An item of a group the app did not list, or a group listed
  twice, throws in dev mode; in production the item shows after the groups under no heading, set off
  from the last group by a rule (an empty strip between two border lines, not a band, which would
  run into a muted last heading), and the first listing stands: never a row dropped or shown twice,
  since a silently missing row (a device) is the worse failure. A row's `rowTone` tints it with the
  tone its status chip has
  (theme tokens `--neat-tint-<tone>` and, for hover and selection, `--neat-tint-<tone>-accent`);
  each row takes exactly one set of fills, so no class has to outweigh another, and the tints are
  opaque mixes over `--background`, so a toned list sits on the page, not on a card. The file
  browser reuses the list for its rows, since a folder row is a row that Enter or a click also
  opens (`activated`), and its `manage` mode is the list's checked mode (a file's path is its
  key); what differs is the browser's, not the list's: an arrow key onto a folder highlights it
  without changing `selected` (which is a file's path), and Backspace, which the list has no use
  for, is handled on the list's host. A checked list adds no hint of its own: the
  multi-selectable listbox says what checking is. A node's `tag` is a neutral `neat-status-chip`,
  the kit's one look for a fact beside a value, and an `unavailable` node is greyed but usable (so
  not `disabled`, which in the kit means "cannot be used"). The browser says nothing of its own that
  an app cannot replace (`labels`), and its tree helpers are the helpers of the media browser it was
  extracted from (`file-tree.ts`, not exported). `filter` is a model so that an app can show a
  note about its folder (how many files it left out) only while no filter is active; the kit never
  hides a file itself.

  A listbox's options have presentational children, so a button in a row is not strictly valid
  ARIA. The compromise is deliberate and holds only as long as the row's controls are pointer
  conveniences: a cell button that is a tab stop needs an `aria-label` naming its row; if every
  row's controls must be keyboard-reachable on their own, the list should become a grid.

  Three wrappers own their behaviour instead of hosting a brain primitive, each for a stated reason:
  - `NeatSwitch` is a native `button` with `role="switch"`: brain's switch is a component that
    renders its own button, so it cannot be a host directive.
  - `NeatSegmented` owns its radios (roles, roving tabindex, arrow keys): brain's toggle item
    re-writes `aria-pressed` on every change, which contradicts the radio roles.
  - `NeatPopoverTrigger` owns its ARIA and its click (`NeatPopover` itself hosts brain's popover):
    brain's trigger names the panel in `aria-controls` while it is closed, when no element has
    that id.

  `NeatTabs` renders a panel element for every tab, so each trigger's `aria-controls` names an
  element that exists; only the open tab's holds its template, and the others are empty and
  `hidden`. Brain's ids come from the keys alone, so the kit's keys are the instance's prefix and
  the tab's index, never its `value`: a value with spaces ("Board 1") would be an invalid id.
  The tab list sits in a strip that scrolls sideways (`overflow-x-auto`) when the tabs do not fit
  their container, as in a side panel: the tabs neither wrap nor push the page sideways, and the
  strip, not the page, moves to show the open tab.
  Inside a `neat-popover`'s panel, a menu's items are `button[neatPopoverItem]`: the panel is a
  flex column, and the directive's `self-start` keeps each button the width of its text, at the
  panel's start. An app has no stylesheet of its own to say that, and the look is the kit's.

- **Customise in this order: theme tokens, then wrapper inputs and classes, never helm.** Tokens
  come from `lib/theme/*.ts`; `npm run theme:emit` regenerates `tokens.generated.css`, and the theme
  spec checks the contrast of every text pair it emits. A wrapper overrides a helm class only where
  its spec shows a failure (the button's hover states are the example), with the reason in a comment.
- **Class strings are literals**, never built at runtime. Why: Tailwind finds the classes the kit
  stylesheet needs by reading the kit's sources; a computed class name is silently missing.
- **Apps need no Tailwind.** The kit ships its compiled stylesheet (`styles/neat-ui.css`), which
  contains exactly the utilities the kit's sources use; utility classes in app templates are not
  part of the kit's API.
- **A button that waits without losing the focus is `aria-disabled`, not `disabled`.** `NeatButton`
  dims `[attr.aria-disabled]="true"` as helm dims a disabled button, with a not-allowed cursor,
  while the button stays focusable and keeps its pointer events, so a tooltip saying why it waits
  still opens on hover; a `disabled` button drops the focus, which a dialog's focus trap then
  cannot take back. The kit only styles it: a click, Enter and Space all still fire `click`, so
  the handler ignores presses while it waits.
- **A toggle button binds `pressed`, never `aria-pressed`.** `NeatButton` owns the attribute (a
  host binding that is absent while `pressed` is undefined) and gives the pressed look with it, so
  an `[attr.aria-pressed]` on a `neatButton` is overwritten. The look is the inverse of the page
  (`foreground` fill, `background` text) and is 3:1 from the surface in both themes and from the
  resting fill of every variant but `primary`, whose solid fill leaves no room: put toggles on the
  others. A name that stays the same while the state changes is a toggle's; a button whose label
  changes with the state is not one, so leave `pressed` unset.
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
Why: each component carries the theme, accessibility and behaviour decisions already made. A
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
`!important`, hard-coded sizes or colours) silently break in one theme or after a Spartan update.
The tokens are the theme's colours (Spartan's variables such as `--primary`, `--muted-foreground`,
`--border`), `--radius`, and a short layout set from Tailwind's scale, defined once in the kit
stylesheet: `--neat-space-2`, `--neat-space-3`, `--neat-space-4`, `--neat-space-6` (0.5, 0.75, 1
and 1.5rem, for gaps and insets), `--neat-text-xs`, `--neat-text-sm` (0.75 and 0.875rem),
`--neat-aside-width` (22rem, the width of a page's side panel) and `--neat-surface` (the fill of
the surface a component sits on, for a part that covers what scrolls under it: `--background`, set
to `--popover` by a dialog panel and a popover, and to its fill by an app's own surface such as a
card). Charts draw with `--neat-series-1` to `--neat-series-8` (four hues, blue, purple, orange and
teal, then a darker blue and the lighter purple, orange and blue), `--neat-line` (a single metric's
line), `--neat-line-warning` and `--neat-line-danger` (threshold lines), and `--neat-heat-low` and
`--neat-heat-high` (the ends of the heatmap ramp). Green, amber and red are left out of the series
so that they keep meaning status. Light series 6 to 8 are below 3:1 on white: use them as fills
whose values the legend carries as text. Page insets come from `neat-page` (`padding="page"` by
default, `padding="none"` for full-bleed content such as a video grid), never from a page's own
stylesheet. Escape hatch: if a look cannot be reached through tokens and inputs, that is a kit gap.
Treat it as a proposal under the previous rule, not as a reason to override.

**No colour literals outside the theme directories: `projects/neat-ui/src/lib/theme/`, and
`projects/neat-ui/video/src/lib/theme/` for the video overlay palette.**
No hex, `rgb()`, `rgba()`, `hsl()` or `hsla()` anywhere else, in CSS, TypeScript or templates.
Why: the palette is fixed and lives in the theme so both themes stay coherent. Stylelint enforces
this for stylesheets (`npm run lint`). Escape hatch: if you need a colour that is not a token, add a
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
readout below its plot) still paints over its neighbours. Escape hatch: a part that must leave its
component (a popover, a tooltip, a toast) goes through the CDK overlay, never through a
positioned ancestor of the app's.

**Component styles live in a `.css` file next to the component, referenced with `styleUrl`.**
Why: Stylelint reads only stylesheets, so a style written inline in the decorator (`styles:`)
escapes the colour-literal rules above without anyone noticing. ESLint rejects inline styles
(`component-max-inline-declarations`); templates may stay inline. Escape hatch: none; a component
that needs no styles simply has no stylesheet.

**Pages fill the shell's content area and own at most one scroll context.**
Why: nested scroll containers and hard-coded heights break on other screen sizes and in kiosk mode,
where the shell's size is not yours to know. Do not measure or hard-code the shell's size. The one
supported second scroll context is the page's side panel (below). Escape hatch: if a page needs
another independently scrolling region (for example a log pane beside a form), raise it as a kit
change so the layout is a supported component, not an ad hoc one.

**A page's toolbar goes through `*neatPageToolbar`, its side panel through `[neatPageAside]`.**
Why: the shell owns the top bar and kiosk mode, and `neat-page` owns the page's layout; a page that
builds its own bar or panel duplicates both and breaks in one of them.

- `<div *neatPageToolbar>…</div>` anywhere in a page's template renders that content in the top
  bar, at its right end just before the end slot, while the page exists. In kiosk mode it floats
  beside the exit control and fades with it. The content stays the page's (bindings, injection),
  but its view is re-created on entering and leaving kiosk mode, so keep its state (values, open
  menus) in the page, never in components inside the toolbar.
  The region gives up width first and scrolls sideways rather than push the end slot out, so keep
  a toolbar narrow enough to fit at the screen sizes the app supports. One toolbar at a time; a
  second throws in dev mode. On a narrow screen (below 48rem) the shell wraps its top bar into two
  rows: the logo, the end slot and the actions share the first (the end slot has a zero basis and
  grows, so a long pill truncates inside it instead of wrapping onto a row of its own), and the
  toolbar takes the whole last row (the host's `data-narrow` says which). A page without tools
  keeps the wide bar's height. The markup order is unchanged, so the tab order still runs toolbar,
  end slot, actions.
  The toolbar still scrolls sideways past the row's width, so on a phone `neat-aside-toggle` is
  drawn first among the tools (the one control that must stay in view while the panel floats over
  the page); for that button the tab order differs from the visual order.
- Elements marked `neatPageAside` inside `neat-page` form a right-hand panel shown while
  `aside="open"`: `--neat-aside-width` wide, inset and scrolling on its own, with the body
  narrowing beside it and keeping its own `scroll` setting. Closed, the panel is removed from the
  DOM, but projected content is still instantiated: gate expensive content (an inspector with a
  live preview) with an `@if` of your own.
  On a narrow screen (`NeatViewport.narrow`, below 48rem, stated once there) the panel floats
  over the right of the page instead, at most the page's width, and the body keeps the whole
  width; `neat-page` says which with a `data-aside="beside" | "overlay"` attribute on its host,
  and its CSS reacts to that, never to a second `@media` with the breakpoint. No scrim, no Escape:
  the toolbar's toggle closes it. Why: a phone has no room for a column beside the body.
  `neatAsideOpen(remembered, remember)` (in an injection context) is the state a page that
  remembers its panel should bind: wide, it is the remembered choice; narrow, a transient flag
  that starts closed and is reset each time the screen becomes narrow, so a phone's opening and
  closing never overwrites the choice made on a wide screen. A page that opens its panel by
  itself (a row selected) calls `set(true)`, which floats it over the body on a phone.
  Tests that need a screen width provide
  `{ provide: NeatViewport, useValue: { narrow: signal(true) } }`;
  nothing but `NeatViewport` calls `matchMedia` for the breakpoint.
- The panel opens and closes with `<neat-aside-toggle [(open)]="asideOpen" />` in the page's
  toolbar, the one look for that button on every page ("Side panel" unless `label` says
  otherwise); the page owns `open` and remembers it where it likes. Inside the panel,
  `neatAsidePanel` stacks the parts one gap apart, `neatAsideTitle` and `neatAsideHeading` are the
  panel's title and section headings, `neatAsideActions` a row of buttons and `code[neatCode]` a
  URL or path in running text. A page's panel styles nothing of this itself.

**Raw browser APIs used for performance stay isolated, outside change detection, with tests.**
Why: canvas, requestAnimationFrame, observers and similar code is fast because it bypasses Angular;
spread through components it makes change detection unpredictable and bugs hard to reproduce.
Keep it in a small, separate unit that runs outside the Angular zone/signals graph, exposes a narrow
interface, and has its own tests. Escape hatch: if the isolation costs too much for a case, say so
in the PR and agree the exception before merging.

**Every component appears in the showcase in both themes.**
Why: the showcase is how people and agents discover what exists (rule one) and how both themes are
checked by eye. A component missing from it will be reinvented. Escape hatch: none for components;
internal building blocks that are not exported need no page.

## Commands

Node 24 is required (`.node-version`; Angular 22 supports `^22.22.3 || ^24.15.0`, we pin 24).

| Command                  | What it does                                                                    |
| ------------------------ | ------------------------------------------------------------------------------- |
| `npm start`              | Showcase dev server                                                             |
| `npm test`               | Unit tests for all projects (`npm test -- --watch=false` runs once and exits)   |
| `npm run lint`           | ESLint (angular-eslint) and Stylelint                                           |
| `npm run build`          | Build the library and its compiled stylesheet into `dist/neat-ui`               |
| `npm run check:dist`     | Check the built package (every entry point, no helm alias imports, stylesheet)  |
| `npm run test:tools`     | Tests for the repo tools (`tools/*.test.mjs`)                                   |
| `npm run theme:emit`     | Regenerate `lib/theme/tokens.generated.css` from the theme sources              |
| `npm run helm:add`       | Add a Spartan helm component to `lib/ui/` (`-- <name>`), the only way in        |
| `npm run build:showcase` | Build the showcase app                                                          |
| `npm run pack`           | Build, then write `dist/neat-ui/sima-neat-ui-<version>.tgz` for apps to install |

Run lint, tests and both builds before opening a PR; CI runs the same.

## Quality bar

This is a prototype held to production standards of cleanliness, structure and tests, without
overengineering: no abstraction without a second use or a stated reason, no speculative
configurability. When a quick fix and a clean fix differ, take the clean one or stop and raise it.
