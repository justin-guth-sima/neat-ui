import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NeatTileArea, NeatTilePack, packTiles } from './pack';

/**
 * What the grid reports: the packing, the gap it used between tiles and the content box it was
 * packed into. A page that sizes tiles itself (to fit a count, say) needs the gap the grid used,
 * which may be the kit's token rather than a number the page chose.
 */
export interface NeatTileLayout extends NeatTilePack {
  /** Space between tiles in CSS pixels. */
  readonly gap: number;
  readonly areaWidth: number;
  readonly areaHeight: number;
}

/**
 * The gap used when the kit's spacing token cannot be resolved (no kit stylesheet, as in a unit
 * test under jsdom): `--neat-space-2` is 0.5rem, which is 8 px at the browser's default size.
 */
const FALLBACK_GAP = 8;

function sameArea(a: NeatTileArea, b: NeatTileArea): boolean {
  return a.width === b.width && a.height === b.height;
}

function sameLayout(a: NeatTileLayout | null, b: NeatTileLayout | null): boolean {
  if (a === null || b === null) return a === b;
  // Over the layout's own fields, so one added to it later is compared without touching this.
  return (Object.keys(a) as (keyof NeatTileLayout)[]).every((field) => a[field] === b[field]);
}

/**
 * Lays its items out as 16:9 tiles of a fixed width in a centred grid, as many as fit into its own box
 * without scrolling or overflowing. The tile width comes from the page (a slider, say); the grid
 * works out the columns, rows and tiles per page and reports them through `layout`, so the page
 * can slice its items to `perPage`. The grid never pages itself.
 *
 * It fills its parent and measures its own box, never the shell's, so it repacks when the parent
 * changes size for any reason. `layout` is emitted when a value of it changes, not on every
 * resize notification.
 *
 * `count` is the number of projected items. When fewer than a row's worth are shown, they form a
 * centred block of their own width instead of hugging the left edge of a full-width row.
 *
 * The gap defaults to the kit's `--neat-space-2` token, read once when the grid initialises; an
 * explicit `gap` (in CSS pixels) overrides it.
 */
@Component({
  selector: 'neat-tile-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #grid
      class="grid"
      [attr.data-ready]="view() !== null"
      [style.--grid-columns]="view()?.columns"
      [style.--grid-tile-width.px]="view()?.tileWidth"
      [style.--grid-tile-height.px]="view()?.tileHeight"
      [style.--grid-gap.px]="gapPx()"
    >
      <ng-content />
    </div>
  `,
  styleUrl: './tile-grid.css',
})
export class NeatTileGrid {
  /** Tile width in CSS pixels; a tile wider than the area shrinks to it. */
  readonly tileWidth = input.required<number>();
  /** Space between tiles in CSS pixels; the kit's `--neat-space-2` when unset. */
  readonly gap = input<number>();
  /** The number of projected items. */
  readonly count = input.required<number>();

  /**
   * The packed grid: columns, rows, tiles per page and the tile size. Emitted once the box is
   * measured and again whenever a value of it changes; slice your items to `perPage`.
   */
  readonly layout = output<NeatTileLayout>();

  private readonly gridElement = viewChild.required<ElementRef<HTMLElement>>('grid');

  private readonly area = signal<NeatTileArea | null>(null, {
    equal: (a, b) => (a === null || b === null ? a === b : sameArea(a, b)),
  });
  /** The token's gap, known once the grid has rendered and its stylesheet can be read. */
  private readonly tokenGap = signal<number | null>(null);

  /**
   * The gap in use. It waits for the token to be read even when `gap` is set, so the read never
   * sees a gap this component applied itself.
   */
  protected readonly gapPx = computed(() => {
    const token = this.tokenGap();
    return token === null ? null : (this.gap() ?? token);
  });

  private readonly packed = computed<NeatTileLayout | null>(
    () => {
      const area = this.area();
      const gap = this.gapPx();
      // A box with no area (a collapsed or hidden parent) is not a measurement: reporting it would
      // make the page slice down to one tile and back.
      if (area === null || !(area.width > 0 && area.height > 0) || gap === null) return null;
      return {
        ...packTiles(area, this.tileWidth(), gap),
        gap,
        areaWidth: area.width,
        areaHeight: area.height,
      };
    },
    { equal: sameLayout },
  );

  /** What the template draws: the packed tiles, in as many columns as there are items to show. */
  protected readonly view = computed(() => {
    const packed = this.packed();
    if (packed === null) return null;
    return { ...packed, columns: Math.min(packed.columns, Math.max(1, this.count())) };
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    effect(() => {
      const layout = this.packed();
      if (layout !== null) untracked(() => this.layout.emit(layout));
    });

    afterNextRender(() => {
      // The stylesheet gives the grid `gap: var(--neat-space-2)`, so the computed column gap is
      // the token in pixels. Anything else (no stylesheet, so no token) leaves the fallback.
      const resolved = parseFloat(getComputedStyle(this.gridElement().nativeElement).columnGap);
      this.tokenGap.set(Number.isFinite(resolved) ? resolved : FALLBACK_GAP);

      // The component is zoneless: setting a signal is what schedules the render, so the callback
      // needs no zone or change-detection call.
      const observer = new ResizeObserver((entries) => {
        const { width, height } = entries[entries.length - 1].contentRect;
        this.area.set({ width, height });
      });
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
