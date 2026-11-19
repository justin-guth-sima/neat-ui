<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Expand

_Layout_ · [All topics](../README.md)

Shows its host over the whole browser window, and puts it back: a video tile, a card or a 3D view, made large for a closer look.

```html
<neat-card title="Detections" neatExpand #expand="neatExpand">
  <button neatButton neatCardActions type="button" (click)="expand.toggle()">
    {{ expand.expanded() ? 'Close' : 'Expand' }}
  </button>
  …
</neat-card>
```

```ts
import { NeatExpand } from '@sima/neat-ui';
```

## Examples

### Expanding a card

A card shown over the whole window from the button in its header, and put back from the same button. Its chart takes the window's height.

Press Expand, then Close or Escape. The button sits inside the card, which covers the page while expanded.

<details>
<summary>Code</summary>

`1-expanding-a-card.example.ts`

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton, NeatExpand, NeatIcon } from '@sima/neat-ui';
import { NeatCard } from '@sima/neat-ui/card';
import { NeatTimeChart } from '@sima/neat-ui/charts';
import { MLA_USAGE, percent, TIMES } from './data';

@Component({
  selector: 'app-expanding-a-card',
  imports: [NeatButton, NeatCard, NeatExpand, NeatIcon, NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-expanding-a-card.example.html',
  styleUrl: './expanding-a-card.example.css',
})
export class ExpandingACard {
  protected readonly usage = MLA_USAGE;
  protected readonly times = TIMES;
  protected readonly percent = percent;
}
```

`1-expanding-a-card.example.html`

```html
<neat-card title="MLA usage" subtitle="The last 8 minutes" neatExpand #expand="neatExpand">
  <button
    neatButton
    neatCardActions
    type="button"
    variant="outlined"
    size="small"
    (click)="expand.toggle()"
  >
    <neat-icon [name]="expand.expanded() ? 'close' : 'expand-window'" [size]="16" />
    {{ expand.expanded() ? 'Close' : 'Expand' }}
  </button>
  <neat-time-chart
    label="MLA usage"
    headline="62%"
    size="fill"
    [series]="usage"
    [times]="times"
    [domain]="[0, 100]"
    [format]="percent"
  />
</neat-card>
```

`data.ts`

```ts
import type { NeatChartFormat, NeatSeries } from '@sima/neat-ui/charts';

/**
 * Eight minutes of MLA usage, a sample every four seconds, ending at a fixed instant so the demo
 * stands still.
 */
const SAMPLES = 120;

export const TIMES: readonly number[] = Array.from(
  { length: SAMPLES },
  (_, index) => Date.UTC(2026, 9, 24, 12, 0, 0) + index * 4000,
);

export const MLA_USAGE: readonly NeatSeries[] = [
  {
    key: 'mla',
    label: 'MLA',
    values: Array.from({ length: SAMPLES }, (_, index) =>
      Number((48 + 22 * Math.sin((index / SAMPLES) * 4 * Math.PI)).toFixed(1)),
    ),
  },
];

export const percent: NeatChartFormat = (value) => `${value.toFixed(0)}%`;
```

`expanding-a-card.example.css`

```css
/* The chart takes the height the card's content has: its medium plot in place, the window's expanded. */
neat-time-chart {
  height: 100%;
}
```

</details>

## API

### `NeatExpand`

Directive from `@sima/neat-ui`, selector `[neatExpand]`, exported as `neatExpand`.

It is the same element, not a copy, so what it shows keeps running: a video plays on, and a chart or a canvas takes the new size as it would any other. It covers the window, not the screen: the browser's own full screen is not used.

Put the button that closes it inside the host. The host covers the page, so a button outside it is covered too. Escape closes it as well.

How it looks:

- The host fills the window, edge to edge, with no rounded corners. It is lifted into the browser's top layer (the Popover API), so no container of the page clips it or paints over it.
- Its own fill, padding and text color stay. A host without a fill or a text color takes the page's.
- Content taller than the window scrolls inside the host.

The keyboard:

- Opening moves the focus into the host when it is outside, such as on a button that opened it from elsewhere.
- Tab and Shift+Tab go round the host's controls, never to the covered page.
- Escape closes it, unless a control inside handled the key first, such as an open select.
- Closing puts the focus back where it was before opening, when it was inside the host.

Overlays opened from inside it, such as a tooltip, a popover, a select's list or a dialog, show above it. A toast shown while it is open does too.

`expanded` is a model, so the app can open it from its own state and follow it: `[(expanded)]="large"`.

**Models (two-way)**

- **`expanded`** `boolean`, default `false`

  Whether the host is shown over the whole window.

**Methods**

- **`open`**

  ```ts
  open(): void
  ```

  Shows the host over the whole window.

- **`close`**

  ```ts
  close(): void
  ```

  Puts the host back in its place on the page.

- **`toggle`**

  ```ts
  toggle(): void
  ```

  Opens the host when it is in its place, and closes it when it is open.
