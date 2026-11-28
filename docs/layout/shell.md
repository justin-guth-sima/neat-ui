<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Shell

_Layout_ · [All topics](../README.md)

The app frame: a sidebar of pages on the left, a top bar, and the content area for the page. It is Spartan's sidebar layout.

```html
<neat-shell appName="Insight" [navItems]="navItems">
  <router-outlet />
</neat-shell>
```

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/shell/rail-items.dark.webp">
<img src="../images/shell/rail-items.light.webp" alt="Shell: Rail items" width="1224">
</picture>

```ts
import { NeatShell, NeatRailItem, NeatBoardItem, NeatRailDivider, provideNeatTitles, KioskService, KIOSK_POINTER_IDLE_MS } from '@sima/neat-ui';
```

## Examples

### Kiosk

Kiosk mode for an expo, from [`KioskService`](../layout/shell.md#kioskservice).

`toggle()` enters it, which hides the shell's rail and top bar and asks for fullscreen. `toggle()` leaves it too, as a floating exit control does.

`pointerIdle` turns true once the pointer has rested for [`KIOSK_POINTER_IDLE_MS`](../layout/shell.md#kiosk_pointer_idle_ms), which is how a page hides its own chrome. A component that has UI of its own outside the floating bar holds the bar open with `holdToolbar()`, until it releases it.

<details>
<summary>Code</summary>

`1-kiosk.example.ts`

```ts
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { KIOSK_POINTER_IDLE_MS, KioskService, NeatButton } from '@sima/neat-ui';

@Component({
  selector: 'app-kiosk',
  imports: [NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-kiosk.example.html',
  styleUrl: './kiosk.example.css',
})
export class Kiosk {
  protected readonly kiosk = inject(KioskService);
  protected readonly idleSeconds = KIOSK_POINTER_IDLE_MS / 1000;
  /** Releases the hold the button took; null while there is none. */
  protected readonly release = signal<(() => void) | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.release()?.());
  }

  protected hold(): void {
    const release = this.release();
    if (release) {
      release();
      this.release.set(null);
    } else {
      this.release.set(this.kiosk.holdToolbar());
    }
  }
}
```

`1-kiosk.example.html`

```html
<div class="showcase-row">
  <button neatButton type="button" variant="outlined" size="small" (click)="kiosk.toggle()">
    {{ kiosk.active() ? 'Leave' : 'Enter' }} kiosk mode
  </button>
  <button
    neatButton
    type="button"
    variant="text"
    size="small"
    [pressed]="release() !== null"
    (click)="hold()"
  >
    Hold the toolbar
  </button>
</div>
<p class="showcase-code">active: {{ kiosk.active() }}, pointerIdle: {{ kiosk.pointerIdle() }}</p>
<p class="showcase-muted">
  Rest the pointer for {{ idleSeconds }} seconds and pointerIdle turns true; move it and it is false
  again.
</p>
```

`kiosk.example.css`

```css
:host {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-3);
}

p {
  margin: 0;
}
```

</details>

### Rail items

The app's own items in the sidebar's footer, in a shell of their own.

Each element marked `neatRailEnd` goes in the sidebar's footer, above the kit's theme switch. They are [`NeatRailItem`](../layout/shell.md#neatrailitem)s, and a [`NeatRailDivider`](../layout/shell.md#neatraildivider) between groups of them.

The board is the kit's [`NeatBoardItem`](../layout/shell.md#neatboarditem), which words its state itself from the connection. The devices after it say theirs with the rail item's `tone`, `text` and `detail`, one per tone. Each device's `label` is the whole sentence: its tooltip and its name.

The first page has `children`, which unfold under it while it is the active page and the rail is expanded. Its `icon` is a Lucide glyph, as a page takes one where no name of the kit's set fits.

_This example needs a page of its own: it runs in the showcase._

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/shell/rail-items.dark.webp">
<img src="../images/shell/rail-items.light.webp" alt="Shell: Rail items" width="1224">
</picture>

<details>
<summary>Code</summary>

`2-rail-items.example.ts`

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  NeatBoardItem,
  NeatIcon,
  NeatNavItem,
  NeatRailDivider,
  NeatRailItem,
  NeatShell,
} from '@sima/neat-ui';
import { LayoutDashboard } from '@sima/neat-ui/lucide';
import { NeatToasts } from '@sima/neat-ui/toast';

@Component({
  selector: 'app-rail-items',
  imports: [NeatBoardItem, NeatIcon, NeatRailDivider, NeatRailItem, NeatShell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-rail-items.example.html',
})
export class RailItems {
  protected readonly toasts = inject(NeatToasts);
  /**
   * The app's pages: here this example alone, with three sub-pages to show the rail's second
   * level. All stay under the example's own route, which serves its sub-paths with the same example, so a
   * press changes the URL and the open sub-page without leaving the docs. The first sub-page has
   * the page's own path, so the page needs no redirect.
   */
  protected readonly navItems: NeatNavItem[] = [
    {
      label: 'Rail items',
      icon: LayoutDashboard,
      path: '/demo/shell/rail-items',
      children: [
        { label: 'Overview', path: '/demo/shell/rail-items' },
        { label: 'Devices', path: '/demo/shell/rail-items/devices' },
        { label: 'Settings', path: '/demo/shell/rail-items/settings' },
      ],
    },
  ];
}
```

`2-rail-items.example.html`

```html
<neat-shell appName="Demo app" [navItems]="navItems">
  <button
    neatRailEnd
    neatRailItem
    type="button"
    label="About this app"
    (click)="toasts.status('An about item would open its dialog here.')"
  >
    <neat-icon name="info" />
  </button>
  <neat-board-item
    neatRailEnd
    name="Demo board"
    address="192.168.1.20"
    connection="connected"
    (activated)="toasts.status('A board item would open its dialog here.')"
  />
  <button
    neatRailEnd
    neatRailItem
    type="button"
    label="Front camera, reconnecting"
    text="Front camera"
    detail="Reconnecting"
    tone="warning"
    (click)="toasts.status('A device item would open its dialog here.')"
  >
    <neat-icon name="camera" />
  </button>
  <button
    neatRailEnd
    neatRailItem
    type="button"
    label="Lidar, no data"
    text="Lidar"
    detail="No data"
    tone="danger"
    (click)="toasts.status('A device item would open its dialog here.')"
  >
    <neat-icon name="lidar" />
  </button>
  <button
    neatRailEnd
    neatRailItem
    type="button"
    label="Microphone, idle"
    text="Microphone"
    detail="Idle"
    tone="neutral"
    (click)="toasts.status('A device item would open its dialog here.')"
  >
    <neat-icon name="microphone" />
  </button>
  <!-- Sets the devices apart from the items below them, as the kit's line above the group
       does. -->
  <hr neatRailEnd neatRailDivider />
</neat-shell>
```

</details>

### The showcase's shell

The showcase's own root. [`NeatShell`](../layout/shell.md#neatshell) takes the app's name and its navigation (`navItems`), here Getting started and one rail item per group of the docs, with the group's topics or categories as the item's `children`, and [`NeatToastHost`](../components/toast.md#neattoasthost) is rendered once, beside the shell. The rail keeps only the kit's theme switch and its control at its bottom; the Rail items example shows an app's own items there. The top bar holds the docs' search (`neatTopbarEnd`), which Ctrl K opens from any page. Under the app name the shell shows the kit's version (`appDetail`).

<details>
<summary>Code</summary>

`app.ts`

```ts
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NeatNavItem, NeatShell } from '@sima/neat-ui';
import { NeatSearchPalette } from '@sima/neat-ui/search-palette';
import { NeatToastHost } from '@sima/neat-ui/toast';
import { GETTING_STARTED, SEARCH, TUTORIAL } from './app.routes';
import { groupNavItems } from './docs/docs-routes';
import { KIT_VERSION } from './docs/generated/kit-version';
import { GROUPS } from './docs/topics';
import { DocsSearch } from './search/docs-search';

@Component({
  imports: [NeatSearchPalette, NeatShell, NeatToastHost, RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  /** The docs' search: topics at once, the API and the examples once its index has loaded. */
  protected readonly search = inject(DocsSearch).palette;
  protected readonly searchPage = `/${SEARCH}`;
  /** The kit's version, shown under the app name as the shell's `appDetail`. */
  protected readonly kitVersion = KIT_VERSION;

  /**
   * Getting started with its Quick start and Tutorial, then the docs' groups (Theme, Layout,
   * Components) with their sub-pages.
   */
  protected readonly navItems: NeatNavItem[] = [
    {
      label: 'Getting started',
      icon: 'home',
      path: `/${GETTING_STARTED}`,
      children: [
        { label: 'Quick start', path: `/${GETTING_STARTED}` },
        { label: 'Tutorial', path: `/${TUTORIAL}` },
      ],
    },
    ...groupNavItems(GROUPS),
  ];
}
```

`app.html`

```html
<neat-shell appName="neat-ui showcase" [appDetail]="kitVersion" [navItems]="navItems">
  <neat-search-palette
    neatTopbarEnd
    label="Search docs"
    [search]="search"
    [allResults]="searchPage"
  />
  <router-outlet />
</neat-shell>
<neat-toast-host />
```

</details>

## API

### `NeatShell`

Component from `@sima/neat-ui`, selector `neat-shell`.

The sidebar is the app's, the top bar is the page's. The sidebar comes first in the DOM, so the tab order is the visual one: sidebar, top bar, content.

The shell fills the viewport, or the bounded box it is placed in. The content area gives its page the remaining space and never scrolls itself, so pages own their scrolling (see `neat-page`).

**The sidebar** (the rail) holds, from the top:

- the header: the logo, the app name and `appDetail`, the short line under it. It is not a control. Collapsed, it shows the logo alone;
- the pages, `navItems`, as the sidebar's menu rows. The navigation scrolls when the pages do not fit, collapsed and expanded;
- the footer: a divider, the app's own items (elements marked `neatRailEnd`, which are `neatRailItem`s and the `neatRailDivider`s between groups of them) and the kit's theme item.

Expanded (16rem), its items show icon and label. Collapsed (3rem), they show the icon, with the label as a tooltip and as hidden text. The theme item is an action named for what a click does: "Dark theme" or "Light theme". An app's own `neat-icon` in a rail item is drawn at 16 px, whatever its `size`, so apps need no change.

The top bar starts with the sidebar's trigger, "Show labels" while the sidebar is collapsed and "Hide labels" while it is expanded, then a divider and the page title. A click on the sidebar's edge toggles it too, for a pointer. The choice is remembered in the browser.

**Sub-pages.** A page with `children` unfolds them under its item while it is the active page and the rail shows its labels: expanded, or in the drawer on a narrow screen. They are rows of text, indented under a thin line, the open one in the rail's current-page look. Only the active page's children show, so the rail does not grow with every page's sub-pages.

The page's item then keeps its label in full text color at weight 500, without the fill. So one row alone reads as current, and only that row carries `aria-current="page"`.

Collapsed, the rail has no room for sub-pages. Its item for a page with `children` stays a link to the page's `path`, and a press navigates, as on any rail item. The item keeps the current-page look while the route belongs to the page.

A menu of the sub-pages beside the rail goes with mouse hover and keyboard focus only. Tab steps from the item into its links, and Escape closes it. A tap shows none, since the rail can be expanded. The menu's heading is the page's label, which is why that item has no tooltip.

**The top bar** holds the trigger and the page title. At its right it holds, in order:

- the active page's tools, `*neatPageToolbar`;
- elements marked `neatTopbarEnd`;
- the kiosk button, the one app control there, since it changes how the page is shown;
- last, at the right edge above the aside, the page's aside toggle (`neat-aside-toggle`), when the page has one.

The page title is the matching nav item's label, else the route's `title`. On a page with sub-pages, it is the open sub-page's label, with the page's label beside it, muted. On a route deeper than the sub-page, with a `title` of its own (not an ancestor's), it is that title, with "page › sub-page" beside it.

The default slot is the content area, usually a `<router-outlet />`.

**Kiosk mode** ([`KioskService`](../layout/shell.md#kioskservice)) is entered from the top bar or with `?kiosk`. It drops the sidebar and the top bar, and gives the content area the whole viewport. An exit control floats over its top right corner while the pointer moves. The page toolbar, then the aside toggle, float beside it on the same terms. Their views are re-created on entering and leaving kiosk mode, so the page keeps their state.

**On a narrow screen** ([`NeatViewport`](../layout/page.md#neatviewport), below 48rem), there is no sidebar: the content takes the whole width. The top bar's first row holds the trigger, the page title (truncated), the end slot, the kiosk button and the aside toggle; the end slot grows from a zero basis, and the toggle comes last. The page toolbar takes its own full-width second row. The app name stays in the top bar as visually hidden text.

The trigger, "Show navigation", opens a drawer from the left: a modal named by the app name, holding the sidebar's header, pages and bottom items as expanded. The focus goes to the current page's link, Escape and the scrim close it, and the focus goes back to the trigger. A followed link closes it; a button (the theme item, the board) leaves it open. Opening it never touches the remembered wide choice, and a screen that turns wide closes it.

**Inputs**

- **`appName`** `string`, required

  The app's name, shown beside the logo in the sidebar's header and the drawer's; on a narrow screen it is also in the top bar, read out only.

- **`appDetail`** `string`

  A short line under the app name in the sidebar's header, smaller and muted, such as a version ("0.45.0"). Without it the header shows the name alone.

- **`navItems`** `NeatNavItem[]`, required

  The pages the rail links to, in order: each an icon, a label and an absolute path.

### `NeatRailItem`

Component from `@sima/neat-ui`, selector `button[neatRailItem], a[neatRailItem]`.

An app's own item in the shell's rail, in the sidebar's footer below the pages.

```html
<button neatRailEnd neatRailItem type="button" label="System information" (click)="…">
  <neat-icon name="info" />
</button>
```

It has the look of every rail item: the page links and the theme item. Mark it `neatRailEnd` to place it in the footer.

The content is the icon: a `neat-icon` with a name of the kit's set, or a glyph from `@sima/neat-ui/lucide` where no name fits. It is drawn at 16 px, whatever its `size`. `label` is the visible text while the rail is expanded. Collapsed, it stays as the item's visually hidden text, so the name is kept, and shows as a tooltip on the right.

An item with a state, such as a board or a connection, says it with the kit's inputs:

```html
<button neatRailEnd neatRailItem type="button" label="DevKit, 192.168.100.2, connected"
        text="DevKit" detail="192.168.100.2" tone="success" (click)="…">
  <neat-icon name="board" />
</button>
```

- `tone` puts a dot on the icon's corner.
- `text` is the visible first line, the label by default.
- `detail` is a smaller second line, in the tone's color. An item with a `detail` is a two-line row.

Both lines are cut with an ellipsis, and hidden with the label while the rail is collapsed.

`label` stays the tooltip and the name, so it is the whole sentence, with the state the dot alone shows. The tooltip takes its text from `label` alone, so the kit cannot compose it from the lines. So `label` must hold the visible `text` and `detail` as they read.

While the lines say other than `label`, they are `aria-hidden`, and the label is visually hidden text beside them. So the name still comes from the content, and an `aria-label` the app sets still wins. A kit `aria-label` binding would remove the app's.

Visible text the inputs cannot say goes in an element marked `neatRailItemLabel`, which takes the label's place. `label` stays the tooltip, so it should say at least what that text says. The item's name is then that text, unless the app gives an `aria-label`.

The lines of such an element are the app's, which the kit's stylesheet cannot reach. So each ellipsizes itself: `min-width: 0`, `overflow: hidden`, `white-space: nowrap`, `text-overflow: ellipsis`.

An item is an action, never a toggle. Its label says what a click does: "Dark theme" while light, "Light theme" while dark. So it has no pressed state, and the rail's selection fill means only "the current page" (`aria-current="page"`).

The host stays the native button or link, with its own click, focus and `routerLink`. A link followed on a narrow screen puts the drawer away. A button leaves it, since its action may want the rail, as a theme switch does, or open a dialog over it.

The tooltip is off while the labels show. It is off too on a collapsed page item with `children`, whose menu of sub-pages names the page itself.

**Inputs**

- **`label`** `string`, required

  The item's name and tooltip, and its visible text while the rail is expanded unless `text` or `detail` say otherwise.

- **`text`** `string`

  The visible first line, when it says less than `label` (a board's name, its state aside).

- **`detail`** `string`

  A smaller second line under the first (an address, a state), in the tone's color.

- **`tone`** `NeatTone`

  The state a dot on the icon's corner shows; no dot without it.

### `NeatBoardItem`

Component from `@sima/neat-ui`, selector `neat-board-item`.

The shell's rail block for the board an app works with: its name, its address and how the app stands with it.

```html
<neat-board-item neatRailEnd name="DevKit" address="192.168.1.20" connection="connected"
                 (activated)="openBoardDialog()" />
```

Put it in the rail's end slot with `neatRailEnd`, as any rail item. It is a rail item with the kit's `board` icon, so it looks and tabs like the others, and says the board's state three ways:

- The dot takes the tone of `status` while the app sets one, else of `connection`.
- The second line is the status's text, else the address while connected, else the connection's words.
- The name and the tooltip are one sentence: the name, the address, the connection's words (with `reason` after a colon) and the status's text, joined by commas, empty parts left out ("DevKit, 192.168.1.20, Connected, Loading models").

A polite live region says that sentence whenever it changes, so an app builds no region of its own. It says nothing on the first render and nothing when an input changes to an equal value.

Why a button: it opens the app's dialog for choosing and checking the board, as the app's `activated` handler decides (`aria-haspopup="dialog"`). An app with a Board page lists that page among its pages, and its dialog links there; the item itself is no link.

**Inputs**

- **`name`** `string`, required

  The board's name, the item's first line ("DevKit").

- **`address`** `string | null`, default `null`

  The board's address, shown as the second line while connected; null while there is none.

- **`connection`** `NeatBoardConnection`, required

  How the app stands with the board: the kit's words and the dot's tone follow from it.

- **`reason`** `string | null`, default `null`

  Why the connection is as it is ("Timed out"), added to its words in the name and tooltip.

- **`status`** `NeatBoardStatus | null`, default `null`

  What the app says beyond the connection ("Loading models"). While set it outranks the connection in the second line and the dot, and ends the name and tooltip.

**Outputs**

- **`activated`** `void`

  Emitted when the item is pressed (a click, Enter or Space): the app opens its dialog.

### `NeatBoardConnection`

Type from `@sima/neat-ui`.

How the app stands with its board, the kit's words for it.

- `loading`: the app has not read its board settings yet.
- `not-selected`: no board is chosen.
- `not-checked`: a board is chosen and nobody has looked whether it answers.
- `checking`: the app is looking.
- `connecting`: the app is making the connection.
- `connected`: the board answers and the app is connected.
- `unreachable`: the board does not answer.

```ts
type NeatBoardConnection = | 'loading'
  | 'not-selected'
  | 'not-checked'
  | 'checking'
  | 'connecting'
  | 'connected'
  | 'unreachable'
```

### `NeatBoardStatus`

Interface from `@sima/neat-ui`.

What the app says about its board beyond the connection: words and the tone of their dot.

**Members**

- **`text`** `string`

  The words, short enough for a rail's second line ("Loading models").

- **`tone`** `NeatTone`

  The tone of the item's dot while the status is set.

### `NeatRailDivider`

Directive from `@sima/neat-ui`, selector `hr[neatRailDivider]`.

A line between groups of the rail's bottom items.

```html
<hr neatRailEnd neatRailDivider />
```

Put it among an app's `[neatRailEnd]` items, below a board block, for example. The shell draws the line above the whole group with the same element, so the look is stated once.

It is helm's sidebar separator, horizontal: a line 1px high of `--sidebar-border`, inset 0.5rem from each side.

It is decorative (`role="none"`, so it exposes nothing). The items' names say what they are, and a separator announced between them would only be noise.

### `NeatNavItem`

Interface from `@sima/neat-ui`.

One page in the shell's rail.

**Members**

- **`label`** `string`

  Shown as the link's name, its tooltip and, while the page is active, the page title.

- **`icon`** `NeatIconName | NeatIconGlyph`

  The page's icon, as `neat-icon`'s `name` takes it: a name of the kit's set (`'home'`) first, and a glyph from `@sima/neat-ui/lucide` only where no name fits.

- **`path`** `string`

  Absolute app path, for example `/media`; the item stays active on routes nested under it.

- **`children`** `readonly NeatNavChild[]`, optional

  The page's sub-pages, the only second level of the rail's navigation.

  More than a few, or deeper levels, belong in the page nav. They unfold under the item while the page is active and the rail shows its labels. The open one carries `aria-current="page"`, and the item then does not.

  The item's link still goes to `path`. The app routes it to the first sub-page, or gives the first sub-page the page's own path: the kit does not redirect.

  Collapsed, a press on the item goes to `path` as well. Hovering it with a mouse, or focusing it with the keyboard, shows the sub-pages as a menu beside the rail.

### `NeatNavChild`

Interface from `@sima/neat-ui`.

One sub-page of a page in the shell's rail. It has no icon: sub-pages are rows of text under their page, which carries the icon.

**Members**

- **`label`** `string`

  Shown as the link's name and, while it is open, the page title.

- **`path`** `string`

  Absolute app path, for example `/theme/colors`.

  It is open on its own path and every route nested under it, whatever the query. A child whose path is its page's own, such as a first view at `/stats` beside `/stats/runs`, is open on that path only. So it is not open on its siblings' routes. Where two children match, the one with the longer path is open.

### `provideNeatTitles`

Function from `@sima/neat-ui`.

Titles the document `<appName> · <route title>`, so every app's browser tabs read the same way.

```ts
providers: [provideRouter(routes), provideNeatTitles('Neat Insight')],
```

On a route without a title, the document's title is `<appName>` alone. The page title in the shell's top bar is the shell's own, and does not come from here.

```ts
provideNeatTitles(appName: string): EnvironmentProviders
```

### `KioskService`

Service from `@sima/neat-ui`.

Kiosk mode for expos: the shell hides its rail and top bar, and pages can hide their own chrome while the pointer rests (`pointerIdle`). Kiosk keeps the current color scheme and is not persisted; it comes from the button or from a `?kiosk` URL parameter read once at start.

`enter()` also asks for browser fullscreen. The URL parameter does not, because browsers refuse fullscreen without a user gesture; booth machines use the browser's own kiosk flag instead. If fullscreen was obtained by `enter()`, leaving it (Esc) leaves kiosk mode too.

Some components have UI that lives outside the floating chrome but belongs to it, such as a popover opened from the page toolbar. They hold the toolbar with `holdToolbar()`, so the chrome does not fade under them.

**Properties**

- **`active`** `Signal<boolean>`

- **`pointerIdle`** `Signal<boolean>`

  True once the pointer has rested for [`KIOSK_POINTER_IDLE_MS`](../layout/shell.md#kiosk_pointer_idle_ms); false again on pointer or touch input, and false throughout a `holdToolbar()`.

**Methods**

- **`enter`**

  ```ts
  enter(): Promise<void>
  ```

  Turns kiosk on and asks for fullscreen; kiosk stays on if fullscreen is refused.

- **`exit`**

  ```ts
  exit(): Promise<void>
  ```

  Turns kiosk off, leaving fullscreen only if `enter()` obtained it.

- **`toggle`**

  ```ts
  toggle(): Promise<void>
  ```

- **`holdToolbar`**

  ```ts
  holdToolbar(): () => void
  ```

  Keeps `pointerIdle` false, so the kiosk chrome stays shown, until the returned function is called. Holds stack: the pointer can go idle again only once every hold is released, and then only after resting a full [`KIOSK_POINTER_IDLE_MS`](../layout/shell.md#kiosk_pointer_idle_ms). Releasing twice counts once.

### `KIOSK_POINTER_IDLE_MS`

Constant from `@sima/neat-ui`.

How long the pointer must rest before [`KioskService.pointerIdle`](../layout/shell.md#kioskservice) turns true.

```ts
const KIOSK_POINTER_IDLE_MS: 2500
```
