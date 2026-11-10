import {
  bevPlot,
  boxPlot,
  defaultView,
  farthestCorner,
  hasArea,
  hitObject,
  LABEL_ANGLE,
  labelAngle,
  metersText,
  objectCorners,
  onPlot,
  panArea,
  PLOT_INSET,
  pixelsPerMeter,
  plotAspect,
  plotReach,
  plotRect,
  ringStep,
  zoomLimits,
  stepFor,
  spokeLength,
  spokeList,
  toScreen,
  toVehicle,
} from './geometry';
import type { NeatBevObject } from './model';

const box = (x: number, y: number, yaw = 0, label = 'car'): NeatBevObject => ({
  x,
  y,
  length: 4,
  width: 2,
  yaw,
  label,
});

const round = (range = 60) => bevPlot('round', range);
const rect = (back: number, front: number, right: number, left: number) =>
  bevPlot('rect', 60, { x: [back, front], y: [right, left] });

describe('bevPlot', () => {
  it('gives the circle the square of ±range around it', () => {
    expect(round(40)).toEqual({
      shape: 'round',
      range: 40,
      back: -40,
      front: 40,
      right: -40,
      left: 40,
    });
  });

  it('takes the rect from its bounds, or ±range without', () => {
    expect(rect(-20, 80, -30, 30)).toMatchObject({ back: -20, front: 80, right: -30, left: 30 });
    expect(bevPlot('rect', 25)).toMatchObject({ back: -25, front: 25, right: -25, left: 25 });
    // The circle has no bounds.
    expect(bevPlot('round', 25, { x: [0, 1], y: [0, 1] })).toMatchObject({ front: 25 });
  });

  it('has an area only with a positive range or a min below each max', () => {
    expect(hasArea(round())).toBe(true);
    expect(hasArea(round(0))).toBe(false);
    expect(hasArea(round(Number.NaN))).toBe(false);
    expect(hasArea(rect(10, 10, -5, 5))).toBe(false);
    expect(hasArea(rect(0, 10, 5, -5))).toBe(false);
    expect(hasArea(rect(0, Infinity, -5, 5))).toBe(false);
  });

  it('knows its proportions, its reach and what lies on it', () => {
    expect(plotAspect(round())).toBe(1);
    expect(plotAspect(rect(-20, 80, -30, 30))).toBeCloseTo(0.6);
    expect(plotAspect(rect(0, 0, 0, 0))).toBe(1);
    expect(plotReach(rect(-20, 80, -30, 30))).toBe(30);
    expect(onPlot(round(), 40, 40)).toBe(true);
    expect(onPlot(round(), 50, 40)).toBe(false);
    expect(onPlot(rect(-20, 80, -30, 30), 70, 25)).toBe(true);
    expect(onPlot(rect(-20, 80, -30, 30), -25, 0)).toBe(false);
  });
});

describe('the view', () => {
  it('fits the plot within the inset, at the nearer edge', () => {
    const view = defaultView(800, 400, round(50));
    expect(view.ppm).toBeCloseTo((200 - PLOT_INSET) / 50);
    expect(pixelsPerMeter({ ...view, k: 2 })).toBeCloseTo(view.ppm * 2);
    // 60 m across and 100 m along: the height limits it in a square box.
    const tall = defaultView(400, 400, rect(-20, 80, -30, 30));
    expect(tall.ppm).toBeCloseTo((400 - 2 * PLOT_INSET) / 100);
  });

  it('puts the middle of the rectangle at the middle of the box, the vehicle off it', () => {
    const view = defaultView(400, 400, rect(-20, 80, -30, 30));
    const at = toScreen(view, 30, 0, { x: 0, y: 0 });
    expect(at.x).toBeCloseTo(200);
    expect(at.y).toBeCloseTo(200);
    expect(toScreen(view, 0, 0, at).y).toBeCloseTo(200 + 30 * view.ppm);
  });

  it('has no scale without room or range', () => {
    expect(defaultView(10, 10, round(50)).ppm).toBe(0);
    expect(defaultView(400, 400, round(0)).ppm).toBe(0);
    expect(defaultView(400, 400, rect(5, 5, -5, 5)).ppm).toBe(0);
  });

  it('puts the vehicle at the center, forward up and left to the left', () => {
    const view = defaultView(400, 400, round(47));
    const at = { x: 0, y: 0 };
    expect(toScreen(view, 0, 0, at)).toEqual({ x: 200, y: 200 });
    expect(toScreen(view, 10, 0, at)).toEqual({ x: 200, y: 200 - 10 * view.ppm });
    expect(toScreen(view, 0, 10, at)).toEqual({ x: 200 - 10 * view.ppm, y: 200 });
  });

  it('applies the pan and zoom on top, and maps the screen back to meters', () => {
    const view = { ...defaultView(400, 400, round(47)), k: 2, tx: -150, ty: -120 };
    const screen = toScreen(view, 12.5, -3.25, { x: 0, y: 0 });
    const back = toVehicle(view, screen.x, screen.y, { x: 0, y: 0 });
    expect(back.x).toBeCloseTo(12.5);
    expect(back.y).toBeCloseTo(-3.25);
  });

  it('pans within the plot with clip, and within the box with visible', () => {
    const view = defaultView(600, 400, round(50));
    const r = 200 - PLOT_INSET;
    expect(panArea(view, round(50), 'clip', 600, 400)).toEqual([
      [300 - r, 200 - r],
      [300 + r, 200 + r],
    ]);
    expect(panArea(view, round(50), 'visible', 600, 400)).toEqual([
      [0, 0],
      [600, 400],
    ]);
  });

  it('pans over the whole box and the rectangle of the app too, when it gives one', () => {
    const view = defaultView(600, 400, round(50));
    // ±100 m ahead and behind, 10 m to either side: taller than the box, narrower.
    const [[x0, y0], [x1, y1]] = panArea(view, round(50), 'clip', 600, 400, {
      x: [-100, 100],
      y: [-10, 10],
    });
    expect([x0, x1]).toEqual([0, 600]);
    expect(y0).toBeCloseTo(200 - 100 * view.ppm);
    expect(y1).toBeCloseTo(200 + 100 * view.ppm);
    // A rectangle with no area is no rectangle.
    expect(panArea(view, round(50), 'visible', 600, 400, { x: [5, 5], y: [-1, 1] })).toEqual([
      [0, 0],
      [600, 400],
    ]);
  });

  it('keeps the zoom limits positive, around the default view', () => {
    expect(zoomLimits([0.5, 8])).toEqual([0.5, 8]);
    expect(zoomLimits([2, 0.5])).toEqual([1, 1]);
    expect(zoomLimits([0, Number.NaN])).toEqual([1, 4]);
  });

  it('finds the rectangle of the plot on the screen, zoomed and panned', () => {
    const plot = round(50);
    const view = { ...defaultView(600, 400, plot), k: 2, tx: -300, ty: -200 };
    const [[x0, y0], [x1, y1]] = plotRect(view, plot);
    const r = 2 * (200 - PLOT_INSET);
    expect([x0, y0, x1, y1].map((v) => Math.round(v))).toEqual([
      300 - r,
      200 - r,
      300 + r,
      200 + r,
    ]);
  });

  it('finds the box in meters, and its farthest corner from the vehicle', () => {
    const view = defaultView(400, 400, round(47));
    const box = boxPlot(view, 400, 400, 47);
    const edge = 200 / view.ppm;
    expect(box.front).toBeCloseTo(edge);
    expect(box.back).toBeCloseTo(-edge);
    expect(box.left).toBeCloseTo(edge);
    expect(box.right).toBeCloseTo(-edge);
    expect(farthestCorner(box)).toBeCloseTo(edge * Math.SQRT2);
  });

  it('puts the ring labels towards the box once the vehicle is out of it', () => {
    const view = defaultView(400, 400, round(50));
    expect(labelAngle(view, 400, 400)).toBe(LABEL_ANGLE);
    // Zoomed in and panned so the vehicle lies below the box: the labels point forward.
    const below = { ...view, k: 4, tx: -600, ty: -200 };
    expect(labelAngle(below, 400, 400)).toBeCloseTo(0);
  });
});

describe('ringStep', () => {
  it('picks 1, 2 or 5 times a power of ten near a sixth of the range', () => {
    expect(ringStep(60)).toBe(10);
    expect(ringStep(61.2)).toBe(10);
    expect(ringStep(30)).toBe(5);
    expect(ringStep(120)).toBe(20);
    expect(ringStep(15)).toBe(2);
    expect(ringStep(3)).toBe(0.5);
    expect(ringStep(600)).toBe(100);
  });

  it('falls back to 1 for a range that is no positive number', () => {
    expect(ringStep(0)).toBe(1);
    expect(ringStep(Number.NaN)).toBe(1);
    expect(ringStep(Infinity)).toBe(1);
  });
});

describe('stepFor', () => {
  const view = defaultView(800, 800, round());

  it('keeps the ring step while the rings sit far enough apart', () => {
    expect(stepFor(60, view)).toBe(10);
    // Zoomed in four times: 15 m across, rings every 2 m, 2 m being 52 px.
    expect(stepFor(60, { ...view, k: 4 })).toBe(2);
  });

  it('coarsens the step while the rings would crowd their labels', () => {
    const small = defaultView(300, 300, round());
    // 138 px for 60 m: 10 m would be 23 px, 20 m 46 px.
    expect(stepFor(60, small)).toBe(20);
    const tiny = defaultView(100, 100, round());
    expect(stepFor(60, tiny)).toBe(100);
  });
});

describe('metersText', () => {
  it('shows at most one decimal', () => {
    expect(metersText(10)).toBe('10 m');
    expect(metersText(2.5)).toBe('2.5 m');
    expect(metersText(0.30000000000000004)).toBe('0.3 m');
  });
});

describe('spokeList', () => {
  it('spaces a number of spokes evenly from straight ahead', () => {
    const spokes = spokeList(4);
    expect(spokes.map((s) => s.angle)).toEqual([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]);
    expect(spokes.every((s) => s.origin.x === 0 && s.origin.y === 0)).toBe(true);
  });

  it('draws none for 0 or anything that is no positive number, and rounds a fraction down', () => {
    expect(spokeList(0)).toEqual([]);
    expect(spokeList(-3)).toEqual([]);
    expect(spokeList(Number.NaN)).toEqual([]);
    expect(spokeList(2.7)).toHaveLength(2);
  });

  it('keeps a list as given, defaulting the origin to the center and dropping bad angles', () => {
    const mount = { x: 1.5, y: 0.4 };
    expect(spokeList([{ angle: 0.3 }, { angle: 1, origin: mount }, { angle: Number.NaN }])).toEqual(
      [
        { angle: 0.3, origin: { x: 0, y: 0 } },
        { angle: 1, origin: mount },
      ],
    );
  });
});

describe('spokeLength', () => {
  it('runs from the center to the range', () => {
    expect(spokeLength({ x: 0, y: 0 }, 0.7, round())).toBeCloseTo(60);
    expect(spokeLength({ x: 0, y: 0 }, 0, bevPlot('rect', 60))).toBeCloseTo(60);
    expect(spokeLength({ x: 0, y: 0 }, Math.PI / 4, bevPlot('rect', 60))).toBeCloseTo(
      60 * Math.SQRT2,
    );
    // Off-center bounds: 80 m ahead, 20 m behind.
    expect(spokeLength({ x: 0, y: 0 }, 0, rect(-20, 80, -30, 30))).toBeCloseTo(80);
    expect(spokeLength({ x: 0, y: 0 }, Math.PI, rect(-20, 80, -30, 30))).toBeCloseTo(20);
  });

  it('ends on the outer ring from an origin off the center', () => {
    const origin = { x: 1.5, y: 0.5 };
    for (const angle of [0, 1, 2.5, -2]) {
      const t = spokeLength(origin, angle, round());
      const end = { x: origin.x + t * Math.cos(angle), y: origin.y + t * Math.sin(angle) };
      expect(Math.hypot(end.x, end.y)).toBeCloseTo(60);
    }
  });

  it('ends on the square edge from an origin off the center', () => {
    const origin = { x: 1.5, y: -0.5 };
    const angle = 0.2;
    const t = spokeLength(origin, angle, bevPlot('rect', 60));
    expect(origin.x + t * Math.cos(angle)).toBeCloseTo(60);
  });

  it('is 0 for an origin outside the plot', () => {
    expect(spokeLength({ x: 70, y: 0 }, 0, round())).toBe(0);
    expect(spokeLength({ x: 0, y: -61 }, 0, bevPlot('rect', 60))).toBe(0);
    expect(spokeLength({ x: -25, y: 0 }, 0, rect(-20, 80, -30, 30))).toBe(0);
  });
});

describe('objectCorners', () => {
  it('gives front left, front right, back right, back left', () => {
    expect([...objectCorners(box(10, 5), new Float64Array(8))]).toEqual([12, 6, 12, 4, 8, 4, 8, 6]);
  });

  it('turns with the yaw, counter-clockwise', () => {
    const corners = objectCorners(box(0, 0, Math.PI / 2), new Float64Array(8));
    // Heading left: the front left corner is ahead-left of the center in the box's frame, which
    // is now behind and to the left in the vehicle's.
    expect(corners[0]).toBeCloseTo(-1);
    expect(corners[1]).toBeCloseTo(2);
  });
});

describe('hitObject', () => {
  const objects = [box(10, 0), box(10.5, 0, 0, 'bus'), box(-20, 5, Math.PI / 2)];

  it('finds the object drawn last under the point', () => {
    expect(hitObject(objects, 10.2, 0.1, 0)).toBe(1);
    expect(hitObject(objects, 8.2, 0, 0)).toBe(0);
  });

  it('tests the rotated box, not its bounds', () => {
    // The third box heads left: 4 m along y, 2 m along x.
    expect(hitObject(objects, -20, 6.8, 0)).toBe(2);
    expect(hitObject(objects, -21.5, 5, 0)).toBe(-1);
  });

  it('allows a tolerance around small objects', () => {
    expect(hitObject(objects, 10, 1.3, 0)).toBe(-1);
    expect(hitObject(objects, 10, 1.3, 0.5)).toBe(1);
  });
});
