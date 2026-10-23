import { afterEveryRender, Component, inject, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { NeatRoiPolygon } from '../overlays/overlay-settings';
import { OVERLAY_ROI_COLORS } from '../theme/overlay-palette';
import type { NeatVideoBox } from '../tile/video-tile';
import { NeatVideoTile } from '../tile/video-tile';
import type { NeatRoiDrawMode } from './roi-editor';
import { NeatRoiEditor } from './roi-editor';

/** A 200×100 image with a 50 px and 30 px margin inside its tile. */
const BOX: NeatVideoBox = { x: 50, y: 30, width: 200, height: 100 };
/** The tile around BOX, which the editor covers: its own measured size. */
const TILE = { width: 300, height: 160 };

const EXISTING: NeatRoiPolygon = {
  type: 'exclusion',
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ],
};

const INCLUSION: NeatRoiPolygon = {
  type: 'inclusion',
  points: [
    { x: 0.25, y: 0.5 },
    { x: 0.5, y: 0 },
    { x: 0.75, y: 0.5 },
  ],
};

/** A ResizeObserver that reports only when a test says so. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  disconnect(): void {
    this.observed.length = 0;
    this.disconnected = true;
  }

  resize(width: number, height: number): void {
    const entry = { target: this.observed[0], contentRect: { width, height } };
    this.callback([entry as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

/**
 * Stands in for the tile the editor sits in: the editor reads only `videoBox`, and the test sets
 * it. The host element sits at the origin in jsdom, so client coordinates are tile coordinates.
 */
@Component({
  imports: [NeatRoiEditor],
  providers: [{ provide: NeatVideoTile, useFactory: () => ({ videoBox: inject(Host).box }) }],
  template: `
    <neat-roi-editor
      [regions]="regions()"
      [mode]="mode()"
      [(highlighted)]="highlighted"
      (regionsChange)="emitted.push($event)"
    />
  `,
})
class Host {
  readonly box = signal<NeatVideoBox | null>(null);
  readonly highlighted = signal<number | null>(null);
  readonly regions = signal<readonly NeatRoiPolygon[]>([]);
  readonly mode = signal<NeatRoiDrawMode>('inclusion');
  readonly emitted: (readonly NeatRoiPolygon[])[] = [];
}

describe('NeatRoiEditor', () => {
  let fixture: ComponentFixture<Host>;

  const host = () => fixture.componentInstance;
  const editor = (): HTMLElement => fixture.nativeElement.querySelector('neat-roi-editor');
  const surface = (): SVGSVGElement => editor().querySelector('svg') as SVGSVGElement;
  const draft = (): SVGPolylineElement | null => editor().querySelector('polyline');
  const polygons = (): SVGPolygonElement[] => Array.from(editor().querySelectorAll('polygon'));

  /** The observer that measures the editor's own host, which covers the tile. */
  const hostObserver = (): FakeResizeObserver => {
    const observer = FakeResizeObserver.instances.find((instance) =>
      instance.observed.includes(editor()),
    );
    if (observer === undefined) throw new Error('the editor does not measure its host');
    return observer;
  };

  async function resizeTile(width: number, height: number): Promise<void> {
    hostObserver().resize(width, height);
    await fixture.whenStable();
  }

  /** With `size` null, the editor's measure of itself has not arrived. */
  async function create(
    box: NeatVideoBox | null = BOX,
    size: { width: number; height: number } | null = TILE,
  ): Promise<void> {
    fixture = TestBed.createComponent(Host);
    host().box.set(box);
    await fixture.whenStable();
    if (size !== null) await resizeTile(size.width, size.height);
  }

  /** Dispatches a mouse event at tile coordinates; the box offsets are the caller's business. */
  async function mouse(type: string, x: number, y: number, button = 0, detail = 1): Promise<void> {
    surface().dispatchEvent(
      new MouseEvent(type, {
        clientX: x,
        clientY: y,
        button,
        detail,
        bubbles: true,
        cancelable: true,
      }),
    );
    await fixture.whenStable();
  }

  /** A click; `detail` is the browser's click count, 2 for the second click of a double-click. */
  const click = (x: number, y: number, button = 0, detail = 1) =>
    mouse('click', x, y, button, detail);

  /**
   * What a browser delivers for a double-click: click (detail 1), click (detail 2), dblclick. The
   * second click may land `drift` px right of the first, as it does when the hand moves.
   */
  async function doubleClick(x: number, y: number, drift = 0): Promise<void> {
    await click(x, y);
    await click(x + drift, y, 0, 2);
    await mouse('dblclick', x + drift, y, 0, 2);
  }

  /** `doubleClick` at fractions of the box. */
  const doubleClickAt = (box: NeatVideoBox, x: number, y: number, drift = 0) =>
    doubleClick(box.x + x * box.width, box.y + y * box.height, drift);

  /** Clicks at fractions of the current box. */
  async function clickAt(box: NeatVideoBox, x: number, y: number): Promise<void> {
    await click(box.x + x * box.width, box.y + y * box.height);
  }

  async function press(key: string): Promise<KeyboardEvent> {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    editor().dispatchEvent(event);
    await fixture.whenStable();
    return event;
  }

  /** Three corners of the box, at 10%/10%, 90%/10% and 90%/90%. */
  async function drawOpenTriangle(): Promise<void> {
    await clickAt(BOX, 0.1, 0.1);
    await clickAt(BOX, 0.9, 0.1);
    await clickAt(BOX, 0.9, 0.9);
  }

  beforeEach(() => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders nothing while it has neither a video box nor a size of its own', async () => {
    await create(null, null);

    expect(surface()).toBeNull();

    host().box.set(BOX);
    await fixture.whenStable();

    expect(surface()).not.toBeNull();

    host().box.set(null);
    await fixture.whenStable();

    expect(surface()).toBeNull();
  });

  it("renders each region as a polygon with its type's fill and stroke, positioned on the video box", async () => {
    await create();
    host().regions.set([
      EXISTING,
      {
        type: 'inclusion',
        points: [
          { x: 0.25, y: 0.5 },
          { x: 0.5, y: 0 },
          { x: 0.75, y: 0.5 },
        ],
      },
    ]);
    await fixture.whenStable();

    expect(surface().style.left).toBe('50px');
    expect(surface().style.top).toBe('30px');
    expect(surface().style.width).toBe('200px');
    expect(surface().style.height).toBe('100px');
    expect(polygons().map((polygon) => polygon.getAttribute('points'))).toEqual([
      '0,0 200,0 200,100',
      '50,50 100,0 150,50',
    ]);
    expect(polygons().map((polygon) => polygon.getAttribute('fill'))).toEqual([
      OVERLAY_ROI_COLORS.exclusion.fill,
      OVERLAY_ROI_COLORS.inclusion.fill,
    ]);
    expect(polygons().map((polygon) => polygon.getAttribute('stroke'))).toEqual([
      OVERLAY_ROI_COLORS.exclusion.stroke,
      OVERLAY_ROI_COLORS.inclusion.stroke,
    ]);
    expect(polygons().map((polygon) => polygon.getAttribute('stroke-width'))).toEqual(['2', '2']);
  });

  it('skips regions with fewer than three points, as the canvas drawing does', async () => {
    await create();
    host().regions.set([
      {
        type: 'inclusion',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      EXISTING,
    ]);
    await fixture.whenStable();

    expect(polygons().map((polygon) => polygon.getAttribute('points'))).toEqual([
      '0,0 200,0 200,100',
    ]);
  });

  it('hides its drawing from assistive technology', async () => {
    await create();

    expect(surface().getAttribute('aria-hidden')).toBe('true');
  });

  it('three clicks and a click on the first point emit one inclusion polygon with normalized points', async () => {
    await create();
    host().regions.set([EXISTING]);
    await fixture.whenStable();

    await drawOpenTriangle();

    expect(host().emitted, 'nothing is emitted before the polygon closes').toEqual([]);

    // 4 px right and 3 px down of the first point: 5 px away.
    await click(BOX.x + 0.1 * BOX.width + 4, BOX.y + 0.1 * BOX.height + 3);

    expect(host().emitted).toHaveLength(1);
    const [regions] = host().emitted;
    expect(regions).not.toBe(host().regions());
    expect(regions).toEqual([
      EXISTING,
      {
        type: 'inclusion',
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.9, y: 0.1 },
          { x: 0.9, y: 0.9 },
        ],
      },
    ]);
    expect(draft(), 'the closed polygon is no longer drawn as a draft').toBeNull();
  });

  it('closes an exclusion polygon in exclusion mode', async () => {
    await create();
    host().mode.set('exclusion');
    await fixture.whenStable();

    await drawOpenTriangle();
    await clickAt(BOX, 0.1, 0.1);

    expect(host().emitted[0].map((region) => region.type)).toEqual(['exclusion']);
  });

  it('does not close on a click more than 10 px from the first point', async () => {
    await create();
    await drawOpenTriangle();

    await click(BOX.x + 0.1 * BOX.width + 11, BOX.y + 0.1 * BOX.height);

    expect(host().emitted).toEqual([]);
  });

  it('a double-click closes a polygon of three or more points; its second click adds no point', async () => {
    await create();
    await clickAt(BOX, 0.1, 0.1);
    await clickAt(BOX, 0.9, 0.1);
    await doubleClickAt(BOX, 0.9, 0.9);

    expect(host().emitted).toHaveLength(1);
    expect(host().emitted[0][0].points).toEqual([
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
    ]);
    expect(draft()).toBeNull();
  });

  it('a second click that drifted a few px adds no point either', async () => {
    await create();
    await clickAt(BOX, 0.1, 0.1);
    await clickAt(BOX, 0.9, 0.1);
    await doubleClickAt(BOX, 0.9, 0.9, 4);

    expect(host().emitted[0][0].points).toEqual([
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
    ]);
  });

  it('a double-click whose first click closes the polygon emits one region and starts no new one', async () => {
    await create();
    await drawOpenTriangle();

    // 3 px from the first point: the first click closes, the second must not open a polygon.
    await doubleClick(BOX.x + 0.1 * BOX.width + 3, BOX.y + 0.1 * BOX.height);

    expect(host().emitted).toHaveLength(1);
    expect(host().emitted[0][0].points).toHaveLength(3);
    expect(draft()).toBeNull();
    expect(editor().hasAttribute('tabindex'), 'no polygon is open').toBe(false);

    // A later single click starts a fresh polygon with one point.
    await clickAt(BOX, 0.5, 0.5);

    expect(draft()?.getAttribute('points')).toBe('100,50 100,50');
    expect(editor().getAttribute('tabindex')).toBe('-1');
  });

  it('a double-click on fewer than three points does not close and adds no point', async () => {
    await create();
    await clickAt(BOX, 0.1, 0.1);
    await doubleClickAt(BOX, 0.9, 0.1, 4);

    expect(host().emitted).toEqual([]);
    // Two points and the pointer, which the ignored second click did not move.
    expect(draft()?.getAttribute('points')).toBe('20,10 180,10 180,10');

    // The polygon is still open with its two points: one more corner and a close complete it.
    await clickAt(BOX, 0.9, 0.9);
    await clickAt(BOX, 0.1, 0.1);

    expect(host().emitted[0][0].points).toEqual([
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
    ]);
  });

  it('a click near the first point with two points adds a point instead of closing', async () => {
    await create();
    await clickAt(BOX, 0.1, 0.1);
    await clickAt(BOX, 0.9, 0.1);
    await click(BOX.x + 0.1 * BOX.width + 5, BOX.y + 0.1 * BOX.height);

    expect(host().emitted).toEqual([]);

    // Now there are three points, so a click near the first closes with all three.
    await click(BOX.x + 0.1 * BOX.width + 3, BOX.y + 0.1 * BOX.height);

    expect(host().emitted).toHaveLength(1);
    expect(host().emitted[0][0].points).toHaveLength(3);
  });

  it('clicks outside the video box are clamped to 0..1', async () => {
    await create();
    await click(0, 0);
    await click(1000, 1000);
    await clickAt(BOX, 0.5, 0.5);
    // Back at the first point, which was clamped to the image's top-left corner.
    await click(BOX.x + 1, BOX.y + 1);

    expect(host().emitted[0][0].points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 0.5, y: 0.5 },
    ]);
  });

  it('ignores a click of any button but the primary', async () => {
    await create();

    await click(100, 60, 2);
    await click(100, 60, 1);

    expect(draft()).toBeNull();
  });

  it('draws the open polygon as a dashed polyline in the stroke colour, through the pointer', async () => {
    await create();
    await clickAt(BOX, 0.1, 0.1);
    await clickAt(BOX, 0.9, 0.1);
    await mouse('pointermove', BOX.x + 100, BOX.y + 80);

    expect(draft()?.getAttribute('points')).toBe('20,10 180,10 100,80');
    expect(draft()?.getAttribute('stroke-dasharray')).toBe('4 4');
    expect(draft()?.getAttribute('stroke')).toBe(OVERLAY_ROI_COLORS.inclusion.stroke);
    expect(draft()?.getAttribute('stroke-width')).toBe('2');
    expect(draft()?.getAttribute('fill')).toBe('none');
  });

  it('marks the first point', async () => {
    await create();
    await clickAt(BOX, 0.1, 0.2);
    await clickAt(BOX, 0.9, 0.1);

    const marker = editor().querySelector('circle') as SVGCircleElement;
    expect(marker.getAttribute('cx')).toBe('20');
    expect(marker.getAttribute('cy')).toBe('20');
    expect(marker.getAttribute('fill')).toBe(OVERLAY_ROI_COLORS.inclusion.stroke);
  });

  it('does not stretch the polyline to an old pointer position after a click without a move', async () => {
    await create();
    await mouse('pointermove', BOX.x + 190, BOX.y + 90);
    await clickAt(BOX, 0.5, 0.5);

    expect(draft()?.getAttribute('points')).toBe('100,50 100,50');
  });

  describe('Escape', () => {
    it('cancels the open polygon and stops propagation', async () => {
      await create();
      const outside = vi.fn();
      fixture.nativeElement.addEventListener('keydown', outside);
      await clickAt(BOX, 0.1, 0.1);

      expect(draft()).not.toBeNull();

      await press('Escape');

      expect(draft()).toBeNull();
      expect(outside).not.toHaveBeenCalled();

      // The cancelled points are gone: a click near the old first point starts a polygon.
      await clickAt(BOX, 0.1, 0.1);
      await clickAt(BOX, 0.9, 0.1);
      await clickAt(BOX, 0.1, 0.1);

      expect(host().emitted).toEqual([]);
    });

    it('propagates when no polygon is open', async () => {
      await create();
      const outside = vi.fn();
      fixture.nativeElement.addEventListener('keydown', outside);

      await press('Escape');

      expect(outside).toHaveBeenCalledTimes(1);
    });

    it('lets other keys through while a polygon is open', async () => {
      await create();
      const outside = vi.fn();
      fixture.nativeElement.addEventListener('keydown', outside);
      await clickAt(BOX, 0.1, 0.1);

      await press('a');

      expect(outside).toHaveBeenCalledTimes(1);
      expect(draft()).not.toBeNull();
    });
  });

  describe('mode off', () => {
    beforeEach(async () => {
      await create();
      host().mode.set('off');
      await fixture.whenStable();
    });

    it('sets pointer-events none on the surface and ignores clicks', async () => {
      expect(getComputedStyle(surface()).pointerEvents).toBe('none');

      await drawOpenTriangle();
      await clickAt(BOX, 0.1, 0.1);
      await mouse('dblclick', 100, 60);

      expect(draft()).toBeNull();
      expect(host().emitted).toEqual([]);
      expect(editor().hasAttribute('tabindex')).toBe(false);
    });

    it('still renders the regions', async () => {
      host().regions.set([EXISTING]);
      await fixture.whenStable();

      expect(polygons()).toHaveLength(1);
    });
  });

  it('shows a crosshair and takes pointer events while a mode is on', async () => {
    await create();

    expect(getComputedStyle(surface()).pointerEvents).toBe('auto');
    expect(getComputedStyle(surface()).cursor).toBe('crosshair');
    expect(
      getComputedStyle(editor()).pointerEvents,
      'the host itself leaves the tile to what is under it',
    ).toBe('none');
  });

  it('takes focus on the first point so Escape reaches it, and labels itself while drawing', async () => {
    await create();

    expect(editor().hasAttribute('tabindex')).toBe(false);
    expect(editor().hasAttribute('aria-label')).toBe(false);

    await clickAt(BOX, 0.1, 0.1);

    expect(editor().getAttribute('tabindex'), 'focusable by script, not by Tab').toBe('-1');
    expect(editor().getAttribute('aria-label')).toBe('Region drawing surface');
    expect(editor().getAttribute('role')).toBe('group');
    expect(document.activeElement).toBe(editor());

    await press('Escape');

    expect(editor().hasAttribute('tabindex')).toBe(false);
    expect(editor().hasAttribute('aria-label')).toBe(false);
    expect(editor().hasAttribute('role')).toBe(false);
  });

  it('cancels the open polygon when the mode changes from outside', async () => {
    await create();
    await clickAt(BOX, 0.1, 0.1);
    await clickAt(BOX, 0.9, 0.1);

    host().mode.set('exclusion');
    await fixture.whenStable();

    expect(draft()).toBeNull();

    // A new polygon starts from nothing, in the new mode.
    await clickAt(BOX, 0.5, 0.1);
    await clickAt(BOX, 0.9, 0.9);
    await clickAt(BOX, 0.1, 0.9);
    await clickAt(BOX, 0.5, 0.1);

    expect(host().emitted[0][0]).toEqual({
      type: 'exclusion',
      points: [
        { x: 0.5, y: 0.1 },
        { x: 0.9, y: 0.9 },
        { x: 0.1, y: 0.9 },
      ],
    });
  });

  it('cancels the open polygon when the regions change from outside', async () => {
    await create();
    await clickAt(BOX, 0.1, 0.1);

    host().regions.set([EXISTING]);
    await fixture.whenStable();

    expect(draft()).toBeNull();
    expect(editor().hasAttribute('tabindex')).toBe(false);
  });

  it('cancels the open polygon when the video box goes away', async () => {
    await create();
    await clickAt(BOX, 0.1, 0.1);

    host().box.set(null);
    await fixture.whenStable();
    host().box.set(BOX);
    await fixture.whenStable();

    expect(draft(), 'the polygon is not back after the image returns').toBeNull();
  });

  it('points stay on the image when the video box changes between clicks', async () => {
    await create();
    const resized: NeatVideoBox = { x: 100, y: 50, width: 400, height: 200 };

    await clickAt(BOX, 0.1, 0.1);
    host().box.set(resized);
    await fixture.whenStable();

    expect(draft()?.getAttribute('points'), 'the drawn point follows the image').toMatch(/^40,20 /);

    await clickAt(resized, 0.9, 0.1);
    await clickAt(resized, 0.9, 0.9);
    await click(resized.x + 0.1 * resized.width + 3, resized.y + 0.1 * resized.height + 2);

    expect(host().emitted[0][0].points).toEqual([
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
    ]);
  });

  it('closes by the distance on screen when the box is not square', async () => {
    await create();
    const wide: NeatVideoBox = { x: 0, y: 0, width: 1000, height: 100 };
    host().box.set(wide);
    await fixture.whenStable();
    await clickAt(wide, 0.1, 0.5);
    await clickAt(wide, 0.5, 0.1);
    await clickAt(wide, 0.5, 0.9);

    // 0.005 of the width is 5 px; the same step in y would be 0.5 px.
    await click(100 + 11, 50);
    expect(host().emitted, '11 px away').toEqual([]);
    await click(100 + 5, 50);
    expect(host().emitted, '5 px away').toHaveLength(1);
  });

  it('writes nothing to the console', async () => {
    const calls = (['log', 'warn', 'error', 'info', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    await create();
    await drawOpenTriangle();
    await mouse('pointermove', 100, 60);
    await clickAt(BOX, 0.1, 0.1);
    await press('Escape');

    for (const spy of calls) expect(spy).not.toHaveBeenCalled();
  });

  describe('without a video box', () => {
    /** The tile's full box, which the editor covers; the tile is 16:9. */
    const FULL: NeatVideoBox = { x: 0, y: 0, width: 320, height: 180 };

    it("without a video box the editor draws regions on the tile's full box and takes clicks there", async () => {
      await create(null, FULL);
      host().regions.set([INCLUSION]);
      await fixture.whenStable();

      expect(surface().style.left).toBe('0px');
      expect(surface().style.top).toBe('0px');
      expect(surface().style.width).toBe('320px');
      expect(surface().style.height).toBe('180px');
      expect(polygons().map((polygon) => polygon.getAttribute('points'))).toEqual([
        '80,90 160,0 240,90',
      ]);

      await clickAt(FULL, 0.1, 0.1);
      await clickAt(FULL, 0.9, 0.1);
      await clickAt(FULL, 0.9, 0.9);
      await clickAt(FULL, 0.1, 0.1);

      expect(host().emitted).toEqual([
        [
          INCLUSION,
          {
            type: 'inclusion',
            points: [
              { x: 0.1, y: 0.1 },
              { x: 0.9, y: 0.1 },
              { x: 0.9, y: 0.9 },
            ],
          },
        ],
      ]);
    });

    it('follows its own size as the tile resizes', async () => {
      await create(null, FULL);
      host().regions.set([INCLUSION]);
      await fixture.whenStable();

      await resizeTile(640, 360);

      expect(surface().style.width).toBe('640px');
      expect(polygons()[0].getAttribute('points')).toBe('160,180 320,0 480,180');
    });

    it('moves to the image once the tile has a video box, and back when it goes', async () => {
      await create(null, FULL);

      host().box.set(BOX);
      await fixture.whenStable();

      expect(surface().style.left).toBe('50px');
      expect(surface().style.width).toBe('200px');

      host().box.set(null);
      await fixture.whenStable();

      expect(surface().style.left).toBe('0px');
      expect(surface().style.width).toBe('320px');
    });

    it('cancels the open polygon when the box it was drawn on changes to the image or back', async () => {
      await create(null, FULL);
      await clickAt(FULL, 0.1, 0.1);

      host().box.set(BOX);
      await fixture.whenStable();

      expect(draft(), 'points on the tile box mean something else on the image').toBeNull();

      await clickAt(BOX, 0.1, 0.1);
      host().box.set(null);
      await fixture.whenStable();

      expect(draft(), 'and the other way round').toBeNull();
    });

    it('disconnects its observer when destroyed', async () => {
      await create(null, FULL);
      const observer = hostObserver();

      fixture.destroy();

      expect(observer.disconnected).toBe(true);
    });
  });

  describe('highlight', () => {
    /** Overlaps INCLUSION, and comes after it in the list, so it is drawn above it. */
    const OVER: NeatRoiPolygon = {
      type: 'exclusion',
      points: [
        { x: 0.4, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
    };

    const pointer = async (type: 'pointerenter' | 'pointerleave', target: Element) => {
      target.dispatchEvent(new PointerEvent(type, { bubbles: false }));
      await fixture.whenStable();
    };

    it('hovering a region sets highlighted to its index, the topmost of overlapping ones; leaving clears it', async () => {
      await create();
      host().regions.set([INCLUSION, OVER]);
      await fixture.whenStable();

      // The list's order is the drawing order, so where the two overlap the browser hits the later.
      const [under, over] = polygons();
      expect(
        under.compareDocumentPosition(over) & Node.DOCUMENT_POSITION_FOLLOWING,
        'the later region is drawn above the earlier',
      ).not.toBe(0);

      await pointer('pointerenter', over);
      expect(host().highlighted()).toBe(1);

      // On to the part of the lower region that the upper one does not cover.
      await pointer('pointerleave', over);
      await pointer('pointerenter', under);
      expect(host().highlighted()).toBe(0);

      await pointer('pointerleave', under);
      expect(host().highlighted()).toBeNull();
    });

    it('a highlighted region gets the stronger fill and a 3px stroke', async () => {
      await create();
      host().regions.set([INCLUSION, OVER]);
      host().highlighted.set(1);
      await fixture.whenStable();

      expect(polygons().map((polygon) => polygon.getAttribute('fill'))).toEqual([
        OVERLAY_ROI_COLORS.inclusion.fill,
        OVERLAY_ROI_COLORS.exclusion.fillActive,
      ]);
      expect(polygons().map((polygon) => polygon.getAttribute('stroke-width'))).toEqual(['2', '3']);

      host().highlighted.set(0);
      await fixture.whenStable();

      expect(polygons().map((polygon) => polygon.getAttribute('fill'))).toEqual([
        OVERLAY_ROI_COLORS.inclusion.fillActive,
        OVERLAY_ROI_COLORS.exclusion.fill,
      ]);
    });

    it('highlights by the index into regions, counting regions it does not draw', async () => {
      await create();
      host().regions.set([{ type: 'inclusion', points: [{ x: 0, y: 0 }] }, INCLUSION]);
      host().highlighted.set(1);
      await fixture.whenStable();

      expect(polygons()).toHaveLength(1);
      expect(polygons()[0].getAttribute('stroke-width')).toBe('3');

      await pointer('pointerleave', polygons()[0]);
      await pointer('pointerenter', polygons()[0]);
      expect(host().highlighted()).toBe(1);
    });

    it('regions take hover and right-click in mode off while the surface ignores other pointer input', async () => {
      await create();
      host().mode.set('off');
      host().regions.set([INCLUSION]);
      await fixture.whenStable();

      expect(getComputedStyle(surface()).pointerEvents).toBe('none');
      expect(getComputedStyle(polygons()[0]).pointerEvents).toBe('auto');

      await pointer('pointerenter', polygons()[0]);
      expect(host().highlighted()).toBe(0);

      const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      polygons()[0].dispatchEvent(menu);
      await fixture.whenStable();
      expect(menu.defaultPrevented).toBe(true);
      expect(editor().querySelector('button')).not.toBeNull();

      // A left click on the region still draws nothing.
      polygons()[0].dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }),
      );
      await fixture.whenStable();
      expect(draft()).toBeNull();
    });
  });

  describe('right-click Delete', () => {
    /** Regions numbered per type: Inclusion 1, Exclusion 1, Inclusion 2. */
    const LIST: readonly NeatRoiPolygon[] = [INCLUSION, EXISTING, INCLUSION];

    const deleteButton = (): HTMLButtonElement | null => editor().querySelector('button');
    const bubble = (): HTMLElement | null => deleteButton()?.parentElement ?? null;

    async function rightClick(target: Element, x: number, y: number): Promise<MouseEvent> {
      target.dispatchEvent(
        new MouseEvent('pointerdown', { clientX: x, clientY: y, button: 2, bubbles: true }),
      );
      const event = new MouseEvent('contextmenu', {
        clientX: x,
        clientY: y,
        button: 2,
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      await fixture.whenStable();
      return event;
    }

    async function createWithList(): Promise<void> {
      await create();
      host().regions.set(LIST);
      await fixture.whenStable();
    }

    it('right-click on a region opens a Delete bubble; Delete emits regions without it; Escape and an outside click close it', async () => {
      await createWithList();

      const event = await rightClick(polygons()[2], 120, 70);

      expect(event.defaultPrevented, 'no browser menu').toBe(true);
      expect(deleteButton()?.textContent?.trim()).toBe('Delete');
      expect(deleteButton()?.getAttribute('aria-label')).toBe('Delete Inclusion 2');
      expect(deleteButton()?.type).toBe('button');
      expect(document.activeElement, 'focus goes to Delete').toBe(deleteButton());

      deleteButton()?.click();
      await fixture.whenStable();

      expect(host().emitted).toEqual([[INCLUSION, EXISTING]]);
      expect(host().regions(), 'the editor never changes regions itself').toBe(LIST);
      expect(deleteButton(), 'the bubble closes').toBeNull();

      // Escape closes it, and goes no further: it does not close what is around the editor.
      await rightClick(polygons()[1], 120, 70);
      expect(deleteButton()?.getAttribute('aria-label')).toBe('Delete Exclusion 1');
      const outside = vi.fn();
      fixture.nativeElement.addEventListener('keydown', outside);
      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      deleteButton()?.dispatchEvent(escape);
      await fixture.whenStable();

      expect(deleteButton()).toBeNull();
      expect(outside).not.toHaveBeenCalled();

      // A press outside the bubble closes it; one inside does not.
      await rightClick(polygons()[0], 120, 70);
      expect(deleteButton()?.getAttribute('aria-label')).toBe('Delete Inclusion 1');
      deleteButton()?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      await fixture.whenStable();
      expect(deleteButton(), 'a press on the bubble keeps it').not.toBeNull();
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      await fixture.whenStable();
      expect(deleteButton()).toBeNull();
      expect(host().emitted, 'only the Delete emitted').toHaveLength(1);
    });

    it('opens at the pointer, kept inside the tile', async () => {
      await createWithList();
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80);
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(40);

      await rightClick(polygons()[0], 120, 70);

      expect(bubble()?.style.left).toBe('120px');
      expect(bubble()?.style.top).toBe('70px');

      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      await fixture.whenStable();
      // Near the tile's bottom-right corner (300×160): the bubble moves in by its own size.
      await rightClick(polygons()[0], 290, 150);

      expect(bubble()?.style.left).toBe('220px');
      expect(bubble()?.style.top).toBe('120px');
    });

    it('a new right-click on another region moves the bubble to it', async () => {
      await createWithList();
      await rightClick(polygons()[0], 120, 70);
      await rightClick(polygons()[1], 60, 40);

      expect(editor().querySelectorAll('button')).toHaveLength(1);
      expect(deleteButton()?.getAttribute('aria-label')).toBe('Delete Exclusion 1');
      expect(bubble()?.style.left).toBe('60px');
    });

    it('closes when the regions change from outside', async () => {
      await createWithList();
      await rightClick(polygons()[0], 120, 70);

      host().regions.set([EXISTING]);
      await fixture.whenStable();

      expect(deleteButton()).toBeNull();
    });

    it('closes when focus moves out of it, but not when the window loses focus', async () => {
      await createWithList();
      await rightClick(polygons()[0], 120, 70);

      deleteButton()?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      await fixture.whenStable();
      expect(deleteButton(), 'no relatedTarget: the window lost focus').not.toBeNull();

      const elsewhere = document.createElement('button');
      document.body.append(elsewhere);
      deleteButton()?.dispatchEvent(
        new FocusEvent('focusout', { bubbles: true, relatedTarget: elsewhere }),
      );
      await fixture.whenStable();
      elsewhere.remove();

      expect(deleteButton()).toBeNull();
    });

    it('gives focus back to what had it when Escape or Delete closes the bubble', async () => {
      await createWithList();
      // Mid-polygon the editor's host has focus, so Escape can cancel the polygon.
      await clickAt(BOX, 0.5, 0.5);
      expect(document.activeElement).toBe(editor());

      await rightClick(polygons()[0], 120, 70);
      expect(document.activeElement).toBe(deleteButton());

      deleteButton()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await fixture.whenStable();

      expect(document.activeElement).toBe(editor());
      expect(draft(), 'Escape on the bubble leaves the open polygon alone').not.toBeNull();
    });

    it('clears the highlight of the region it deletes', async () => {
      await createWithList();
      host().highlighted.set(2);
      await rightClick(polygons()[2], 120, 70);

      deleteButton()?.click();
      await fixture.whenStable();

      expect(host().highlighted()).toBeNull();
    });

    it('a click on the bubble draws no point', async () => {
      await createWithList();
      await rightClick(polygons()[0], 120, 70);

      bubble()?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, button: 0 }),
      );
      await fixture.whenStable();

      expect(draft()).toBeNull();
    });

    it('left-clicks on a region in a drawing mode still place points', async () => {
      await createWithList();

      polygons()[0].dispatchEvent(
        new MouseEvent('click', { clientX: 150, clientY: 80, bubbles: true, detail: 1 }),
      );
      await fixture.whenStable();

      expect(draft()?.getAttribute('points')).toBe('100,50 100,50');
      expect(deleteButton()).toBeNull();
    });
  });

  describe('change detection', () => {
    /** Moves the pointer and returns how many application ticks that caused. */
    async function ticksForPointerMove(): Promise<number> {
      let ticks = 0;
      TestBed.runInInjectionContext(() => afterEveryRender(() => ticks++));
      await fixture.whenStable();
      const before = ticks;
      surface().dispatchEvent(
        new MouseEvent('pointermove', { clientX: 90, clientY: 50, bubbles: true }),
      );
      await fixture.whenStable();
      return ticks - before;
    }

    it('does not run for pointer moves while no polygon is open', async () => {
      await create();

      expect(await ticksForPointerMove()).toBe(0);
    });

    it('runs for pointer moves while a polygon is open, to move the polyline', async () => {
      await create();
      await clickAt(BOX, 0.1, 0.1);

      expect(await ticksForPointerMove()).toBeGreaterThan(0);
    });
  });

  it("sits in a real tile's overlay layer, whose element injector provides the video box", async () => {
    @Component({
      imports: [NeatVideoTile, NeatRoiEditor],
      template: `
        <neat-video-tile>
          <neat-roi-editor neatTileOverlay [regions]="[]" />
        </neat-video-tile>
      `,
    })
    class InTile {}

    const inTile = TestBed.createComponent(InTile);
    await inTile.whenStable();

    const roiEditor = inTile.nativeElement.querySelector('neat-roi-editor') as HTMLElement;
    expect(roiEditor.parentElement?.classList.contains('overlay-slot')).toBe(true);
  });
});
