import {
  pathThrough,
  pointAlong,
  roundCorners,
  routePoints,
  sampleRoute,
  type Point,
} from './route';

/** A turn's legs at most (route.ts's `BEND`): what a turn with long runs on both sides takes. */
const BEND = 60;

/** The SVG path the layout draws for an edge between these ports. */
const pathBetween = (...ends: Parameters<typeof routePoints>) => pathThrough(routePoints(...ends));

describe('rounded routes', () => {
  it('an L: straight runs, the turn one bezier with both control points on the corner', () => {
    const points = routePoints({ x: 0, y: 0 }, 'right', { x: 300, y: -200 }, 'bottom');
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: -200 },
    ]);
    expect(roundCorners(points)).toEqual([
      { line: { x: 300 - BEND, y: 0 } },
      {
        curve: [
          { x: 300, y: 0 },
          { x: 300, y: 0 },
          { x: 300, y: -BEND },
        ],
      },
      { line: { x: 300, y: -200 } },
    ]);
    expect(pathBetween({ x: 0, y: 0 }, 'right', { x: 300, y: -200 }, 'bottom')).toBe(
      `M 0 0 L ${300 - BEND} 0 C 300 0 300 0 300 -${BEND} L 300 -200`,
    );
  });

  it('a straight edge stays straight', () => {
    expect(pathBetween({ x: 0, y: 10 }, 'right', { x: 400, y: 10 }, 'left')).toBe(
      'M 0 10 L 400 10',
    );
    expect(pathBetween({ x: 5, y: 300 }, 'top', { x: 5, y: 0 }, 'bottom')).toBe('M 5 300 L 5 0');
  });

  it('a short run shortens both legs of its turn equally', () => {
    // The first run is all turn: no zero-length line before it.
    expect(roundCorners(routePoints({ x: 0, y: 0 }, 'right', { x: 20, y: 300 }, 'top'))).toEqual([
      {
        curve: [
          { x: 20, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
        ],
      },
      { line: { x: 20, y: 300 } },
    ]);
  });

  it('a Z: two turns sharing the middle run, `jog` past halfway; a tiny step stays smooth', () => {
    expect(routePoints({ x: 0, y: 0 }, 'right', { x: 200, y: 100 }, 'left', 10)).toEqual([
      { x: 0, y: 0 },
      { x: 110, y: 0 },
      { x: 110, y: 100 },
      { x: 200, y: 100 },
    ]);
    // Leftwards, the jog still counts along the way.
    expect(routePoints({ x: 0, y: 0 }, 'left', { x: -200, y: 100 }, 'right', 10)[1]).toEqual({
      x: -110,
      y: 0,
    });
    // A 4 px step: each turn takes half of it, the curve is continuous and never leaves the step.
    const pieces = roundCorners(routePoints({ x: 0, y: 0 }, 'right', { x: 200, y: 4 }, 'left'));
    expect(pieces).toEqual([
      { line: { x: 98, y: 0 } },
      {
        curve: [
          { x: 100, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 2 },
        ],
      },
      {
        curve: [
          { x: 100, y: 4 },
          { x: 100, y: 4 },
          { x: 102, y: 4 },
        ],
      },
      { line: { x: 200, y: 4 } },
    ]);
    for (const p of sampleRoute({ x: 0, y: 0 }, pieces)) {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(4);
    }
  });

  it('a very short edge degrades gracefully: equal legs as long as its shorter run', () => {
    const d = pathBetween({ x: 0, y: 0 }, 'right', { x: 8, y: -6 }, 'bottom');
    // Legs of 6 (the shorter run) on both sides of the corner; no zero-length line after it.
    expect(d).toBe('M 0 0 L 2 0 C 8 0 8 0 8 -6');
  });

  it('a target behind the source gets stubs out of both ports, only axis-parallel runs', () => {
    const points = routePoints({ x: 0, y: 0 }, 'right', { x: -100, y: 200 }, 'left');
    for (let i = 1; i < points.length; i++) {
      expect(points[i].x === points[i - 1].x || points[i].y === points[i - 1].y).toBe(true);
    }
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 100 },
      { x: -130, y: 100 },
      { x: -130, y: 200 },
      { x: -100, y: 200 },
    ]);
  });

  it('both ports facing the same way: out past the farther one and back (a U)', () => {
    expect(routePoints({ x: 0, y: 0 }, 'right', { x: 100, y: 200 }, 'right')).toEqual([
      { x: 0, y: 0 },
      { x: 130, y: 0 },
      { x: 130, y: 200 },
      { x: 100, y: 200 },
    ]);
  });
});

describe('pointAlong', () => {
  const near = (p: Point, q: Point) => {
    expect(p.x).toBeCloseTo(q.x, 1);
    expect(p.y).toBeCloseTo(q.y, 1);
  };

  it('measures a straight route by length: its ends at 0 and 1, its middle at 0.5', () => {
    const route = [
      { x: 0, y: 10 },
      { x: 400, y: 10 },
    ];
    near(pointAlong(route, 0), { x: 0, y: 10 });
    near(pointAlong(route, 0.25), { x: 100, y: 10 });
    near(pointAlong(route, 1), { x: 400, y: 10 });
  });

  it('measures along the drawn shape: a point at a turn lies on the curve, not its corner', () => {
    // A symmetric L: the middle of the drawn shape is the middle of its turn.
    const route = routePoints({ x: 0, y: 0 }, 'right', { x: 300, y: 300 }, 'top');
    const middle = pointAlong(route, 0.5);
    // On the bezier between (240, 0) and (300, 60) about the corner (300, 0): inside the corner.
    expect(middle.x).toBeLessThan(300);
    expect(middle.y).toBeGreaterThan(0);
    near(middle, { x: 300 - middle.y, y: middle.y });
  });

  it('keeps out-of-range fractions at the ends and a route of one point at that point', () => {
    const route = [
      { x: 0, y: 0 },
      { x: 0, y: 50 },
    ];
    near(pointAlong(route, -1), { x: 0, y: 0 });
    near(pointAlong(route, 2), { x: 0, y: 50 });
    near(pointAlong([{ x: 7, y: 8 }], 0.5), { x: 7, y: 8 });
  });
});
