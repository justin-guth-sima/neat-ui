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

const EXISTING: NeatRoiPolygon = {
  type: 'exclusion',
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ],
};

/**
 * Stands in for the tile the editor sits in: the editor reads only `videoBox`, and the test sets
 * it. The host element sits at the origin in jsdom, so client coordinates are tile coordinates.
 */
@Component({
  imports: [NeatRoiEditor],
  providers: [{ provide: NeatVideoTile, useFactory: () => ({ videoBox: inject(Host).box }) }],
  template: `
    <neat-roi-editor [regions]="regions()" [mode]="mode()" (regionsChange)="emitted.push($event)" />
  `,
})
class Host {
  readonly box = signal<NeatVideoBox | null>(null);
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

  async function create(box: NeatVideoBox | null = BOX): Promise<void> {
    fixture = TestBed.createComponent(Host);
    host().box.set(box);
    await fixture.whenStable();
  }

  /** Dispatches a mouse event at tile coordinates; the box offsets are the caller's business. */
  async function mouse(type: string, x: number, y: number, button = 0): Promise<void> {
    surface().dispatchEvent(
      new MouseEvent(type, { clientX: x, clientY: y, button, bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
  }

  const click = (x: number, y: number, button = 0) => mouse('click', x, y, button);

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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing while the tile has no video box', async () => {
    await create(null);

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

  it('a double-click closes a polygon of three or more points without a duplicate last point', async () => {
    await create();
    await clickAt(BOX, 0.1, 0.1);
    await clickAt(BOX, 0.9, 0.1);
    // The browser delivers click, click, dblclick; the second click lands on the same spot.
    await clickAt(BOX, 0.9, 0.9);
    await clickAt(BOX, 0.9, 0.9);
    await mouse('dblclick', BOX.x + 0.9 * BOX.width, BOX.y + 0.9 * BOX.height);

    expect(host().emitted).toHaveLength(1);
    expect(host().emitted[0][0].points).toEqual([
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
    ]);
  });

  it('a double-click only drops a last point within 1 px of the one before', async () => {
    await create();
    await drawOpenTriangle();

    await mouse('dblclick', BOX.x + 0.9 * BOX.width, BOX.y + 0.9 * BOX.height);

    expect(host().emitted[0][0].points, 'the third point is a real one').toHaveLength(3);
  });

  it('a double-click on fewer than three points does not close', async () => {
    await create();
    await clickAt(BOX, 0.1, 0.1);
    await clickAt(BOX, 0.9, 0.1);
    await clickAt(BOX, 0.9, 0.1);
    await mouse('dblclick', BOX.x + 0.9 * BOX.width, BOX.y + 0.1 * BOX.height);

    expect(host().emitted).toEqual([]);

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

  it('works inside a real tile, whose element injector provides the video box', async () => {
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

    expect(inTile.nativeElement.querySelector('neat-roi-editor')).not.toBeNull();
  });
});
