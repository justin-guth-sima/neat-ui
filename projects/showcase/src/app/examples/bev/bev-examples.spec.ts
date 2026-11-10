import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatBev } from '@sima/neat-ui/bev';
import { By } from '@angular/platform-browser';
import { Round } from './1-round.example';
import { Rect } from './2-rect.example';
import { Overflow } from './3-overflow.example';
import { OverflowZoom } from './4-overflow-zoom.example';
import { CameraSeams } from './5-camera-seams.example';
import { Zoom } from './6-zoom.example';
import { SharedStyles } from './7-shared-styles.example';
import { Polygons } from './8-polygons.example';
import { RoadScene } from './roads';
import { CAMERAS, SEAMS, StreetScene } from './scene';

describe('the BEV examples', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no ResizeObserver; the views need none to take their frames.
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(() => ({ observe: vi.fn(), disconnect: vi.fn() })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const examples: readonly Type<unknown>[] = [
    Round,
    Rect,
    Overflow,
    OverflowZoom,
    CameraSeams,
    Zoom,
    SharedStyles,
    Polygons,
  ];
  for (const example of examples) {
    it(`${example.name} moves its scene on while shown, and stops when gone`, async () => {
      const fixture = TestBed.createComponent(example);
      fixture.detectChanges();
      const views = fixture.debugElement.queryAll(By.directive(NeatBev));
      expect(views.length).toBeGreaterThan(0);
      const view = views[0].componentInstance as NeatBev;
      const first = view.frame();
      await vi.advanceTimersByTimeAsync(200);
      fixture.detectChanges();
      expect(view.frame()).not.toBe(first);
      fixture.destroy();
      const after = view.frame();
      await vi.advanceTimersByTimeAsync(200);
      expect(view.frame()).toBe(after);
    });
  }
});

/** Whether `x`, `y` lies inside the polygon `xy` (x, y pairs), by counting crossings. */
function inside(xy: Float32Array, x: number, y: number): boolean {
  let crossings = 0;
  for (let i = 0, j = xy.length - 2; i < xy.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [xy[i], xy[i + 1], xy[j], xy[j + 1]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) crossings++;
  }
  return crossings % 2 === 1;
}

describe('the road network', () => {
  const frame = new RoadScene().frameAt(3);
  const areas = frame.lines!.filter((line) => line.fill);
  const onRoad = (x: number, y: number) => areas.some((area) => inside(area.xy, x, y));

  it('gives the drivable area as filled pieces the vehicle and every mover are on', () => {
    expect(areas.length).toBeGreaterThan(3);
    expect(areas.every((area) => area.label === 'drivable area')).toBe(true);
    expect(onRoad(0, 0)).toBe(true);
    for (const object of frame.objects!) expect(onRoad(object.x, object.y)).toBe(true);
  });

  it("rounds the side road's corners and leaves the crossing's square", () => {
    // Behind, where the side road meets the main road's left edge (12.25 m): a rounded corner
    // fills the angle near the edge, and leaves its outer corner clear.
    expect(onRoad(-29.5, 12.75)).toBe(true);
    expect(onRoad(-33.5, 17.5)).toBe(false);
    // Ahead, the crossing's corner is square: just beside the narrow road, off it.
    expect(onRoad(18.5, 13)).toBe(false);
    expect(onRoad(19.5, 13)).toBe(true);
  });

  it('branches a ramp off to the right that the planned path takes', () => {
    const path = frame.lines!.find((line) => line.label === 'planned path')!;
    const end = [path.xy[path.xy.length - 2], path.xy[path.xy.length - 1]];
    expect(end[1]).toBeLessThan(-50);
    expect(onRoad(end[0], end[1])).toBe(true);
    // Beside the main road on the right, short of the ramp: off the road.
    expect(onRoad(28, -10)).toBe(false);
  });
});

describe('the street scene', () => {
  it('marks the road ahead and its crossing drivable, row 0 forward and column 0 left', () => {
    const [grid] = new StreetScene().frameAt(0).grids!;
    const at = (x: number, y: number) => {
      const size = 102.4 / 128;
      const row = Math.floor((51.2 - x) / size);
      const column = Math.floor((51.2 - y) / size);
      return grid.cells[row * grid.columns + column];
    };
    expect(at(0, 0)).toBe(255); // the vehicle's lane
    expect(at(22, 30)).toBe(255); // the crossing road, to the left
    expect(at(0, 30)).toBe(0); // a block beside the road
    expect(at(40, -20)).toBe(0);
  });

  it('moves traffic on and keeps the grid, so it is not painted again', () => {
    const scene = new StreetScene();
    const before = scene.frameAt(0);
    const after = scene.frameAt(1);
    expect(after.grids![0]).toBe(before.grids![0]);
    const oncoming = (frame: typeof before) =>
      frame.objects!.filter((o) => o.label === 'car' && Math.abs(o.yaw - Math.PI) < 1e-9);
    expect(oncoming(after)[0].x).toBeCloseTo(oncoming(before)[0].x - 9);
  });

  it('has six cameras, each from its mount, and a seam between each two neighbours', () => {
    expect(CAMERAS).toHaveLength(6);
    expect(CAMERAS.every((camera) => camera.origin !== undefined && !camera.fill)).toBe(true);
    expect(SEAMS).toHaveLength(6);
    // The back camera is wider, so the seams are not evenly spaced.
    const gaps = SEAMS.map((seam, i) => {
      const next = SEAMS[(i + 1) % SEAMS.length].angle;
      return (((next - seam.angle) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    });
    expect(new Set(gaps.map((g) => g.toFixed(3))).size).toBeGreaterThan(1);
    expect(gaps.reduce((a, b) => a + b, 0)).toBeCloseTo(2 * Math.PI);
  });
});
