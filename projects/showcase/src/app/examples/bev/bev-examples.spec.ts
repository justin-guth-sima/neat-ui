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
