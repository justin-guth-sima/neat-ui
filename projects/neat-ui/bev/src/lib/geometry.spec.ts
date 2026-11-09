import {
  canvasAngle,
  defaultView,
  hitObject,
  metresText,
  objectCorners,
  PLOT_INSET,
  pixelsPerMetre,
  plotArea,
  ringStep,
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

describe('plotArea', () => {
  it('puts a round plot in the largest centred square', () => {
    expect(plotArea(800, 400, 'round')).toEqual({
      cx: 400,
      cy: 200,
      halfWidth: 200,
      halfHeight: 200,
    });
    expect(plotArea(300, 500, 'round')).toEqual({
      cx: 150,
      cy: 250,
      halfWidth: 150,
      halfHeight: 150,
    });
  });

  it('lets a square plot fill the whole box', () => {
    expect(plotArea(800, 400, 'square')).toEqual({
      cx: 400,
      cy: 200,
      halfWidth: 400,
      halfHeight: 200,
    });
  });

  it('treats a negative size as none', () => {
    expect(plotArea(-5, 100, 'round').halfWidth).toBe(0);
  });
});

describe('the view', () => {
  it('reaches the range at the nearer edge, less the inset', () => {
    const view = defaultView(plotArea(800, 400, 'square'), 50);
    expect(view.ppm).toBeCloseTo((200 - PLOT_INSET) / 50);
    expect(pixelsPerMetre({ ...view, k: 2 })).toBeCloseTo(view.ppm * 2);
  });

  it('has no scale without room or range', () => {
    expect(defaultView(plotArea(10, 10, 'round'), 50).ppm).toBe(0);
    expect(defaultView(plotArea(400, 400, 'round'), 0).ppm).toBe(0);
  });

  it('puts the vehicle at the centre, forward up and left to the left', () => {
    const view = defaultView(plotArea(400, 400, 'round'), 47);
    const at = { x: 0, y: 0 };
    expect(toScreen(view, 0, 0, at)).toEqual({ x: 200, y: 200 });
    expect(toScreen(view, 10, 0, at)).toEqual({ x: 200, y: 200 - 10 * view.ppm });
    expect(toScreen(view, 0, 10, at)).toEqual({ x: 200 - 10 * view.ppm, y: 200 });
  });

  it('applies the pan and zoom on top, and maps the screen back to metres', () => {
    const view = { ...defaultView(plotArea(400, 400, 'round'), 47), k: 2, tx: -150, ty: -120 };
    const screen = toScreen(view, 12.5, -3.25, { x: 0, y: 0 });
    const back = toVehicle(view, screen.x, screen.y, { x: 0, y: 0 });
    expect(back.x).toBeCloseTo(12.5);
    expect(back.y).toBeCloseTo(-3.25);
  });

  it('turns the vehicle angle into the canvas angle', () => {
    expect(canvasAngle(0)).toBeCloseTo(-Math.PI / 2); // forward is up
    expect(Math.cos(canvasAngle(Math.PI / 2))).toBeCloseTo(-1); // left is left
    expect(Math.sin(canvasAngle(Math.PI))).toBeCloseTo(1); // back is down
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
  const view = defaultView(plotArea(800, 800, 'round'), 60);

  it('keeps the ring step while the rings sit far enough apart', () => {
    expect(stepFor(60, view)).toBe(10);
    // Zoomed in four times: 15 m across, rings every 2 m, 2 m being 52 px.
    expect(stepFor(60, { ...view, k: 4 })).toBe(2);
  });

  it('coarsens the step while the rings would crowd their labels', () => {
    const small = defaultView(plotArea(300, 300, 'round'), 60);
    // 138 px for 60 m: 10 m would be 23 px, 20 m 46 px.
    expect(stepFor(60, small)).toBe(20);
    const tiny = defaultView(plotArea(100, 100, 'round'), 60);
    expect(stepFor(60, tiny)).toBe(100);
  });
});

describe('metresText', () => {
  it('shows at most one decimal', () => {
    expect(metresText(10)).toBe('10 m');
    expect(metresText(2.5)).toBe('2.5 m');
    expect(metresText(0.30000000000000004)).toBe('0.3 m');
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

  it('keeps a list as given, defaulting the origin to the centre and dropping bad angles', () => {
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
  it('runs from the centre to the range', () => {
    expect(spokeLength({ x: 0, y: 0 }, 0.7, 'round', 60)).toBeCloseTo(60);
    expect(spokeLength({ x: 0, y: 0 }, 0, 'square', 60)).toBeCloseTo(60);
    expect(spokeLength({ x: 0, y: 0 }, Math.PI / 4, 'square', 60)).toBeCloseTo(60 * Math.SQRT2);
  });

  it('ends on the outer ring from an origin off the centre', () => {
    const origin = { x: 1.5, y: 0.5 };
    for (const angle of [0, 1, 2.5, -2]) {
      const t = spokeLength(origin, angle, 'round', 60);
      const end = { x: origin.x + t * Math.cos(angle), y: origin.y + t * Math.sin(angle) };
      expect(Math.hypot(end.x, end.y)).toBeCloseTo(60);
    }
  });

  it('ends on the square edge from an origin off the centre', () => {
    const origin = { x: 1.5, y: -0.5 };
    const angle = 0.2;
    const t = spokeLength(origin, angle, 'square', 60);
    expect(origin.x + t * Math.cos(angle)).toBeCloseTo(60);
  });

  it('is 0 for an origin outside the plot', () => {
    expect(spokeLength({ x: 70, y: 0 }, 0, 'round', 60)).toBe(0);
    expect(spokeLength({ x: 0, y: -61 }, 0, 'square', 60)).toBe(0);
  });
});

describe('objectCorners', () => {
  it('gives front left, front right, back right, back left', () => {
    expect([...objectCorners(box(10, 5), new Float64Array(8))]).toEqual([12, 6, 12, 4, 8, 4, 8, 6]);
  });

  it('turns with the yaw, counter-clockwise', () => {
    const corners = objectCorners(box(0, 0, Math.PI / 2), new Float64Array(8));
    // Heading left: the front left corner is ahead-left of the centre in the box's frame, which
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
