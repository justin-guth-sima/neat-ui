<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Tile grid

_Components › Video_ · [All topics](../README.md)

Lays its items out as 16:9 tiles of one width, as many as fit its box without scrolling.

```html
<neat-tile-grid [tileWidth]="tileWidth()" [count]="shown().length" (layout)="layout.set($event)">
  @for (channel of shown(); track channel.id) {
    <neat-video-tile [source]="channel.source" [label]="channel.name" />
  }
</neat-tile-grid>
```

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/tile-grid/packing.dark.webp">
<img src="../images/tile-grid/packing.light.webp" alt="Tile grid: Packing" width="900">
</picture>

```ts
import { NeatTileGrid, NEAT_MIN_TILE_WIDTH, fitAllTileWidth } from '@sima/neat-ui/video';
```

## Examples

### Packing

Forty-eight numbered tiles in a box of a fixed height. The slider sets the tile width, and the readout is the layout the grid reported: the page shows only the tiles that fit. Resize the window to repack.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/tile-grid/packing.dark.webp">
<img src="../images/tile-grid/packing.light.webp" alt="Tile grid: Packing" width="900">
</picture>

<details>
<summary>Code</summary>

`1-packing.example.ts`

```ts
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NeatSlider } from '@sima/neat-ui/slider';
import { NeatTileGrid, type NeatTileLayout } from '@sima/neat-ui/video';

const TILE_COUNT = 48;
const TILES = Array.from({ length: TILE_COUNT }, (_, index) => index + 1);

@Component({
  selector: 'app-packing',
  imports: [NeatSlider, NeatTileGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="width">
      <span>Tile width</span>
      <neat-slider label="Tile width" [min]="120" [max]="480" [step]="10" [(value)]="tileWidth" />
      <span class="showcase-code showcase-muted">{{ tileWidth() }} px</span>
    </div>
    <p class="showcase-code showcase-muted" aria-live="polite">{{ summary() }}</p>
    <div class="box">
      <neat-tile-grid
        [tileWidth]="tileWidth()"
        [count]="visible().length"
        (layout)="layout.set($event)"
      >
        @for (tile of visible(); track tile) {
          <div class="tile">{{ tile }}</div>
        }
      </neat-tile-grid>
    </div>
  `,
  styleUrl: './tile-box.css',
})
export class Packing {
  protected readonly tileWidth = signal(240);
  protected readonly layout = signal<NeatTileLayout | null>(null);
  protected readonly visible = computed(() => TILES.slice(0, this.layout()?.perPage ?? TILE_COUNT));
  protected readonly summary = computed(() => {
    const layout = this.layout();
    return layout
      ? `${layout.columns} × ${layout.rows} = ${layout.perPage} per page of ${TILE_COUNT}, gap ${layout.gap} px`
      : 'Measuring';
  });
}
```

`tile-box.css`

```css
:host {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-3);
}

/* A slider fills its container's width, so the example gives it one. */
.width {
  display: flex;
  align-items: center;
  gap: var(--neat-space-3);
}

neat-slider {
  width: 16rem;
}

/* The grid fills its parent, so the example gives it a box of a fixed height to fill. */
.box {
  height: 24rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}

.tile {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: var(--neat-text-sm);
}
```

</details>

### Fit all

Twelve numbered tiles, and a button that sets the tile width to the widest one at which all twelve fit the box, from the area and the gap the grid reported. Resize the window and press it again.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/tile-grid/fit-all.dark.webp">
<img src="../images/tile-grid/fit-all.light.webp" alt="Tile grid: Fit all" width="900">
</picture>

<details>
<summary>Code</summary>

`2-fit-all.example.ts`

```ts
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatSlider } from '@sima/neat-ui/slider';
import {
  fitAllTileWidth,
  NEAT_MIN_TILE_WIDTH,
  NeatTileGrid,
  type NeatTileLayout,
} from '@sima/neat-ui/video';

const TILE_COUNT = 12;
const TILES = Array.from({ length: TILE_COUNT }, (_, index) => index + 1);

@Component({
  selector: 'app-fit-all',
  imports: [NeatButton, NeatSlider, NeatTileGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="width">
      <span>Tile width</span>
      <neat-slider
        label="Tile width"
        [min]="minWidth"
        [max]="480"
        [step]="1"
        [(value)]="tileWidth"
      />
      <span class="showcase-code showcase-muted">{{ tileWidth() }} px</span>
      <button neatButton type="button" variant="outlined" size="small" (click)="fitAll()">
        Fit all
      </button>
    </div>
    <p class="showcase-code showcase-muted" aria-live="polite">{{ summary() }}</p>
    <div class="box">
      <neat-tile-grid
        [tileWidth]="tileWidth()"
        [count]="visible().length"
        (layout)="layout.set($event)"
      >
        @for (tile of visible(); track tile) {
          <div class="tile">{{ tile }}</div>
        }
      </neat-tile-grid>
    </div>
  `,
  styleUrl: './tile-box.css',
})
export class FitAll {
  protected readonly minWidth = NEAT_MIN_TILE_WIDTH;
  protected readonly tileWidth = signal(240);
  protected readonly layout = signal<NeatTileLayout | null>(null);
  protected readonly visible = computed(() => TILES.slice(0, this.layout()?.perPage ?? TILE_COUNT));
  protected readonly summary = computed(() => {
    const layout = this.layout();
    return layout
      ? `${this.visible().length} of ${TILE_COUNT} tiles on the page, ${layout.columns} × ${layout.rows}`
      : 'Measuring';
  });

  protected fitAll(): void {
    const layout = this.layout();
    if (layout === null) return;
    const area = { width: layout.areaWidth, height: layout.areaHeight };
    this.tileWidth.set(fitAllTileWidth(area, TILE_COUNT, layout.gap));
  }
}
```

`tile-box.css`

```css
:host {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-3);
}

/* A slider fills its container's width, so the example gives it one. */
.width {
  display: flex;
  align-items: center;
  gap: var(--neat-space-3);
}

neat-slider {
  width: 16rem;
}

/* The grid fills its parent, so the example gives it a box of a fixed height to fill. */
.box {
  height: 24rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}

.tile {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: var(--neat-text-sm);
}
```

</details>

## API

### `NeatTileGrid`

Component from `@sima/neat-ui/video`, selector `neat-tile-grid`.

The grid is centered. The tile width comes from the page, from a slider say. The grid works out the columns, rows and tiles per page, and reports them through `layout`, so the page can slice its items to `perPage`. The grid never pages itself.

It fills its parent and measures its own box, never the shell's, so it repacks when the parent changes size for any reason. `layout` is emitted when a value of it changes, not on every resize notification.

`count` is the number of projected items. When fewer than a row's worth are shown, they form a centered block of their own width. They do not hug the left edge of a full-width row.

The gap defaults to the kit's `--neat-space-2` token, read once when the grid initializes; an explicit `gap` (in CSS pixels) overrides it.

**Inputs**

- **`tileWidth`** `number`, required

  Tile width in CSS pixels; a tile wider than the area shrinks to it.

- **`gap`** `number`

  Space between tiles in CSS pixels; the kit's `--neat-space-2` when unset.

- **`count`** `number`, required

  The number of projected items.

**Outputs**

- **`layout`** `NeatTileLayout`

  The packed grid: columns, rows, tiles per page and the tile size. Emitted once the box is measured and again whenever a value of it changes; slice your items to `perPage`.

### `NeatTileLayout`

Interface from `@sima/neat-ui/video`.

What the grid reports: the packing, the gap it used between tiles and the content box it was packed into.

A page that sizes tiles itself, to fit a count say, needs the gap the grid used. It may be the kit's token rather than a number the page chose.

**Members**

- **`gap`** `number`

  Space between tiles in CSS pixels.

- **`areaWidth`** `number`

- **`areaHeight`** `number`

### `NeatTilePack`

Interface from `@sima/neat-ui/video`.

How tiles of one size fill an area: the grid they form and the size each tile gets.

**Members**

- **`columns`** `number`

- **`rows`** `number`

- **`perPage`** `number`

  How many tiles fit at once: `columns * rows`.

- **`tileWidth`** `number`

  The tile size actually used; below the requested width only when one tile did not fit.

- **`tileHeight`** `number`

### `NeatTileArea`

Interface from `@sima/neat-ui/video`.

The box tiles are laid out in, in CSS pixels ([`NeatTileGrid`](../components/tile-grid.md#neattilegrid) measures it from its host).

**Members**

- **`width`** `number`

- **`height`** `number`

### `NEAT_MIN_TILE_WIDTH`

Constant from `@sima/neat-ui/video`.

The narrowest tile the kit lays out, in CSS pixels. Below this a tile is a postage stamp, so with very many items in a small area the page pages instead of shrinking tiles further. Only an area smaller than this makes a tile narrower (it then shrinks to the area).

```ts
const NEAT_MIN_TILE_WIDTH: 64
```

### `fitAllTileWidth`

Function from `@sima/neat-ui/video`.

The widest tile, in whole CSS pixels, at which `count` tiles fit into `area` on one page.

For each column count from 1 to `count`, the rows follow (`ceil(count / columns)`). The tile is bounded by both the width and the height of the area. The column count with the widest tile wins. The width is in whole pixels, rounded down, so a floating-point edge can never make the grid drop a row that this function counted on.

Never below [`NEAT_MIN_TILE_WIDTH`](../components/tile-grid.md#neat_min_tile_width): when `count` tiles would need narrower ones, the result is the minimum and the caller pages. A count that is not a finite number of at least 1 is one tile; a fractional count is rounded down.

```ts
fitAllTileWidth(area: NeatTileArea, count: number, gap: number): number
```
