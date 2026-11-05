import { pointAlong, routePoints, type Point } from '../route';
import { EdgeGeometry } from './edge-geometry';

describe('EdgeGeometry', () => {
  it('measures a straight route and finds a point by its share of the length', () => {
    const geometry = EdgeGeometry.fromPoints([
      { x: 0, y: 10 },
      { x: 400, y: 10 },
    ]);
    expect(geometry.length).toBe(400);
    const at = { x: 0, y: 0 };
    expect(geometry.at(0.25, at)).toEqual({ x: 100, y: 10 });
    expect(geometry.at(1, at)).toEqual({ x: 400, y: 10 });
  });

  it('runs on past the ends by `before` and `after`, straight on along the end samples', () => {
    const geometry = EdgeGeometry.fromPoints([
      { x: 0, y: 10 },
      { x: 400, y: 10 },
    ]);
    const at = { x: 0, y: 0 };
    // 0 is `before` ahead of the start, 1 `after` past the end, the share between over the whole.
    expect(geometry.at(0, at, undefined, 5, 7)).toEqual({ x: -5, y: 10 });
    expect(geometry.at(1, at, undefined, 5, 7)).toEqual({ x: 407, y: 10 });
    expect(geometry.at(0.5, at, undefined, 6, 6)).toEqual({ x: 200, y: 10 });
    // Without them it stays on the shape.
    expect(geometry.at(0, at)).toEqual({ x: 0, y: 10 });
  });

  it('writes the point into the object it is given', () => {
    const geometry = EdgeGeometry.fromPoints([
      { x: 0, y: 0 },
      { x: 0, y: 50 },
    ]);
    const into = { x: 9, y: 9 };
    expect(geometry.at(0.5, into)).toBe(into);
    expect(into).toEqual({ x: 0, y: 25 });
  });

  it('matches pointAlong within half a unit at 20 positions on a Z route', () => {
    const route = routePoints({ x: 0, y: 0 }, 'right', { x: 400, y: 260 }, 'left');
    expect(route).toHaveLength(4);
    const geometry = EdgeGeometry.fromPoints(route);
    const at: Point = { x: 0, y: 0 };
    for (let i = 0; i < 20; i++) {
      const t = i / 19;
      const expected = pointAlong(route, t);
      geometry.at(t, at);
      expect(Math.hypot(at.x - expected.x, at.y - expected.y)).toBeLessThan(0.5);
    }
  });

  it('keeps its length table cumulative, from 0 to the length', () => {
    const geometry = EdgeGeometry.fromPoints(
      routePoints({ x: 0, y: 0 }, 'right', { x: 300, y: 300 }, 'top'),
    );
    const { lut, length } = geometry;
    expect(lut[0]).toBe(0);
    expect(lut[lut.length - 1]).toBeCloseTo(length, 3);
    for (let i = 1; i < lut.length; i++) expect(lut[i]).toBeGreaterThanOrEqual(lut[i - 1]);
    expect(geometry.xy).toHaveLength(2 * lut.length);
    // The rounded turn is shorter than the corner it cuts.
    expect(length).toBeLessThan(600);
    expect(length).toBeGreaterThan(550);
  });

  it('keeps out-of-range shares at the ends and a route of one point at that point', () => {
    const geometry = EdgeGeometry.fromPoints([
      { x: 0, y: 0 },
      { x: 0, y: 50 },
    ]);
    const at = { x: 0, y: 0 };
    expect(geometry.at(-1, at)).toEqual({ x: 0, y: 0 });
    expect(geometry.at(2, at)).toEqual({ x: 0, y: 50 });
    expect(geometry.at(NaN, at)).toEqual({ x: 0, y: 0 });
    const lone = EdgeGeometry.fromPoints([{ x: 7, y: 8 }]);
    expect(lone.length).toBe(0);
    expect(lone.at(0.5, at)).toEqual({ x: 7, y: 8 });
  });

  it('finds the point in samples mapped to other coordinates by the same table', () => {
    const geometry = EdgeGeometry.fromPoints([
      { x: 0, y: 10 },
      { x: 400, y: 10 },
    ]);
    // Scaled by 2 and moved by (5, 7), as the layer maps the samples to the screen.
    const screen = geometry.xy.map((v, i) => 2 * v + (i % 2 === 0 ? 5 : 7));
    expect(geometry.at(0.25, { x: 0, y: 0 }, screen)).toEqual({ x: 205, y: 27 });
  });
});
