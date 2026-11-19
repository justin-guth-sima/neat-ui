import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatBev } from '@sima/neat-ui/bev';
import { By } from '@angular/platform-browser';
import { Round } from './1-round.example';
import { Rect } from './2-rect.example';
import { Overflow } from './3-overflow.example';
import { OverflowZoom } from './4-overflow-zoom.example';
import { Layers } from './5-layers.example';
import { Zoom } from './6-zoom.example';
import { SharedStyles } from './7-shared-styles.example';
import { Polygons } from './8-polygons.example';
import { Interaction } from './9-interaction.example';
import { LAP, RoadScene } from './roads';
import { BUILDINGS, SAFETY_ZONE, StreetScene } from './scene';

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
    Layers,
    Zoom,
    SharedStyles,
    Polygons,
    Interaction,
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

describe('the interaction example', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(() => ({ observe: vi.fn(), disconnect: vi.fn() })),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('lists the vehicles by their tracks, and binds the selected one to the view both ways', () => {
    const fixture = TestBed.createComponent(Interaction);
    fixture.detectChanges();
    const view = fixture.debugElement.query(By.directive(NeatBev)).componentInstance as NeatBev;
    const text = () => (fixture.nativeElement as HTMLElement).querySelector('.report')!.textContent;
    expect(text()).toContain('Nothing');
    // The view hovers a car: the card names it.
    view.hovered.set('car 2');
    fixture.detectChanges();
    expect(text()).toContain('car 2,');
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('[role="option"]');
    expect(rows.length).toBeGreaterThan(10);
    expect(
      [...rows].find((row) => row.getAttribute('aria-selected') === 'true')?.textContent,
    ).toContain('car 2');
    fixture.destroy();
  });

  it('gives each vehicle a swatch in the color the view draws its label in', () => {
    const colorOf = vi
      .spyOn(NeatBev.prototype, 'colorOf')
      .mockImplementation((label) => (label === 'truck' ? 'rgb(1 2 3)' : null));
    const fixture = TestBed.createComponent(Interaction);
    fixture.detectChanges();
    const swatches = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
      '[role="option"] neat-swatch',
    );
    expect(colorOf).toHaveBeenCalledWith('car');
    expect(swatches.length).toBeGreaterThan(0);
    for (const swatch of swatches) {
      expect(swatch.style.getPropertyValue('--swatch')).toBe('rgb(1 2 3)');
      expect(swatch.closest('[role="option"]')?.textContent).toContain('truck');
    }
    fixture.destroy();
    colorOf.mockRestore();
  });
});

describe('the road network', () => {
  const scene = new RoadScene();
  const onRoad = (frame: ReturnType<RoadScene['frameAt']>, x: number, y: number) =>
    frame.lines!.some((line) => line.fill && inside(line.xy, x, y));

  it('keeps the vehicle and every mover on the drivable area all round the lap', () => {
    for (const seconds of [0, 3.3, 7.9, 12.4, 19, 26.5]) {
      const frame = scene.frameAt(seconds);
      expect(onRoad(frame, 0, 0)).toBe(true);
      for (const object of frame.objects!) expect(onRoad(frame, object.x, object.y)).toBe(true);
    }
  });

  it('comes round to where it started after a lap', () => {
    const start = [...scene.frameAt(0).lines![0].xy];
    const lap = [...scene.frameAt(LAP / 12).lines![0].xy];
    lap.forEach((value, i) => expect(value).toBeCloseTo(start[i], 3));
  });

  it('turns the world as the vehicle turns: a quarter of the way round, the road heads on', () => {
    // At the start the vehicle heads east, so the world is only moved; in the first corner it
    // turns, and the ring's lines turn with it, still ahead of it.
    const corner = scene.frameAt(52 / 12);
    const path = corner.lines!.find((line) => line.label === 'planned path')!;
    expect(path.xy[0]).toBeCloseTo(0, 1);
    expect(path.xy[1]).toBeCloseTo(0, 1);
    const end = path.xy.length - 2;
    expect(path.xy[end]).toBeGreaterThan(20);
  });

  it('has square crossings, rounded corners elsewhere, and a ramp to the south', () => {
    // At the start the vehicle heads east, 41.75 m south of the ring's middle: the world moved.
    const frame = scene.frameAt(0);
    const at = (x: number, y: number) => onRoad(frame, x, y + 41.75);
    // The through road meets the ring's inner edge (33 m south) at a square corner.
    expect(at(2.5, -32)).toBe(true);
    expect(at(3.3, -32.7)).toBe(false);
    // The side road meets the ring's east edge with rounded corners.
    expect(at(67.5, 13.5)).toBe(true);
    expect(at(72.5, 18.5)).toBe(false);
    // The ring's own corners are rounded.
    expect(at(66, 46)).toBe(false);
    // The ramp runs south on its own, east of the through road.
    expect(at(40, -100)).toBe(true);
    expect(at(20, -100)).toBe(false);
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

  it('keeps its buildings off the road, and the safety zone around the vehicle', () => {
    const [grid] = new StreetScene().frameAt(0).grids!;
    const size = 102.4 / 128;
    const onRoad = (x: number, y: number) =>
      grid.cells[Math.floor((51.2 - x) / size) * 128 + Math.floor((51.2 - y) / size)] === 255;
    for (const building of BUILDINGS.lines!) {
      expect(building.fill).toBe(true);
      const xy = building.xy;
      // Each footprint's corners, a little inside it, are off the road.
      const xs = [xy[0], xy[2]];
      const ys = [xy[1], xy[5]];
      const inX = [Math.min(...xs) + 1, Math.max(...xs) - 1];
      const inY = [Math.min(...ys) + 1, Math.max(...ys) - 1];
      for (const x of inX)
        for (const y of inY)
          if (Math.abs(x) < 50 && Math.abs(y) < 50) expect(onRoad(x, y)).toBe(false);
    }
    const [zone] = SAFETY_ZONE.lines!;
    expect(zone).toMatchObject({ closed: true, style: 'dashed' });
  });
});
