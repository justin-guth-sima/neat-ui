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
    `NeatAsidePanel`, `NeatAsideTitle`, `NeatAsideHeading`, `NeatAsideActions`), `NeatCode`,
    `KioskService`, `NeatButton`, `NeatInlineButton`, `NeatTooltip` and `NeatNote`. Public API is
    `projects/neat-ui/src/public-api.ts`.
  - one secondary entry point per other component, `@sima/neat-ui/<name>`: `switch`, `slider`,
    `segmented`, `tabs`, `popover`, `confirm`, `input`, `number-field`, `line-list`, `select`
    (`NeatSelect`, a labelled listbox combobox), `progress` (`NeatProgress`, a bar or, with a
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
    key/value list of a side panel) and `field` (`NeatField`, a control under its visible name with
    a hint and an error, and `NeatErrorNote`, a failure said in place), each exporting that
    component and its types; and
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

  `NeatSelectList` and `NeatFileBrowser` own their behaviour too. Brain has no listbox on its own
  (its select's list lives in a popover, and `command` is a palette), so the list owns its roles
  and keys as `NeatSegmented` does: a `listbox` that holds the focus and names the selected row in
  `aria-activedescendant`, with selection following focus. Its checked mode (`checkable`) is the
  WAI-ARIA multi-select listbox: the listbox is `aria-multiselectable`, a checked row is
  `aria-selected`, Space checks the row the keyboard is on, and the selected row becomes that row
  only (drawn by `data-active`, not by `aria-selected`). Its box is drawn from the theme's tokens,
  not brain's checkbox (a thousand-file folder would be a thousand brain components), and is
  `aria-hidden` and no tab stop, since the row says whether it is checked. A column's `hideBelow`
  is judged against the list's own width, which a ResizeObserver watches only while some column
  has one. The header line, the listbox and each row are lines of one grid (each spans every track
  on `grid-cols-subgrid`), so a content-sized column (`width="max-content"`) fits the widest of its
  heading and its cells, and `align="end"` puts both at the column's end. The header sits inside
  the scrolling area, sticky at its top and filled with `--neat-surface`; the area's top scroll
  padding is the header's height, so a row scrolled into view stops below it. The focus ring is
  the outline of a pseudo-element over the area, since the sticky header paints over an outline
  of the area itself. `groups` (with `groupOf`) puts the rows under headings, each group a
  `role="group"` named by its heading and, like its heading, a line of the grid; the keys move over
  the rows as shown, which a row's `data-index` numbers, never onto a heading. An item of a group
  the app did not list throws in dev mode and, in production, shows after the groups under no
  heading: never dropped, since a silently missing row (a device) is the worse failure. A row's
  `rowTone` tints it with the tone its status chip has (theme tokens
  `--neat-tint-<tone>` and, for hover and selection, `--neat-tint-<tone>-accent`); each row takes
  exactly one set of fills, so no class has to outweigh another, and the tints are opaque mixes
  over `--background`, so a toned list sits on the page, not on a card. The file browser reuses
  the list for its rows, since a folder row is a row that Enter or a click also opens
  (`activated`), and its `manage` mode is the list's checked mode (a file's path is its key); what differs is the browser's, not the list's: an arrow key onto a folder
  highlights it without changing `selected` (which is a file's path), and Backspace, which the
  list has no use for, is handled on the list's host. A checked list adds no hint of its own: the
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
card). Page insets come from `neat-page` (`padding="page"` by default, `padding="none"` for
full-bleed content such as a video grid), never from a page's own stylesheet. Escape hatch: if a
look cannot be reached through tokens and inputs, that is a kit gap. Treat it as a proposal under
the previous rule, not as a reason to override.

**No colour literals outside the theme directories: `projects/neat-ui/src/lib/theme/`, and
`projects/neat-ui/video/src/lib/theme/` for the video overlay palette.**
No hex, `rgb()`, `rgba()`, `hsl()` or `hsla()` anywhere else, in CSS, TypeScript or templates.
Why: the palette is fixed and lives in the theme so both themes stay coherent. Stylelint enforces
this for stylesheets (`npm run lint`). Escape hatch: if you need a colour that is not a token, add a
token in the theme directory through a kit change; never inline the value.
The only exception: official brand-asset SVGs (the SiMa.ai logo) keep their own `fill` attributes.

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
  second throws in dev mode.
- Elements marked `neatPageAside` inside `neat-page` form a right-hand panel shown while
  `aside="open"`: `--neat-aside-width` wide, inset and scrolling on its own, with the body
  narrowing beside it and keeping its own `scroll` setting. Closed, the panel is removed from the
  DOM, but projected content is still instantiated: gate expensive content (an inspector with a
  live preview) with an `@if` of your own.
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
