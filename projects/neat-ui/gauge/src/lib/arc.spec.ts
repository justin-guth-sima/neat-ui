import {
  ARC_RADIUS,
  arcPath,
  GAUGE_CENTER,
  gaugeShare,
  pointAt,
  validRange,
  ZONE_RADIUS,
  zoneArcs,
} from './arc';

/** The arc's start (bottom left, 225° from up) and end (bottom right, 135°) on the arc's circle. */
const R = ARC_RADIUS * Math.SQRT1_2;
const START = { x: GAUGE_CENTER.x - R, y: GAUGE_CENTER.y + R };
const END = { x: GAUGE_CENTER.x + R, y: GAUGE_CENTER.y + R };
const round = (n: number) => +n.toFixed(2);

describe('the gauge arc', () => {
  it('sweeps 270° clockwise from bottom left (225° from up) to bottom right (135°)', () => {
    const at = (share: number) => {
      const { x, y } = pointAt(share, ARC_RADIUS);
      return { x: round(x), y: round(y) };
    };
    expect(at(0)).toEqual({ x: round(START.x), y: round(START.y) });
    // A third of the way is the top left (315°), half way straight up, two thirds the top right.
    expect(at(1 / 3)).toEqual({ x: round(START.x), y: round(GAUGE_CENTER.y - R) });
    expect(at(0.5)).toEqual({ x: GAUGE_CENTER.x, y: GAUGE_CENTER.y - ARC_RADIUS });
    expect(at(2 / 3)).toEqual({ x: round(END.x), y: round(GAUGE_CENTER.y - R) });
    expect(at(1)).toEqual({ x: round(END.x), y: round(END.y) });
  });

  it('draws the value from the start to its angle, as one clockwise arc, the long way past half the sweep', () => {
    const [sx, sy] = [round(START.x), round(START.y)];
    // A quarter of the sweep is 67.5°, the short way; half is 135°, still short; the full sweep
    // is 270°, the long way round.
    expect(arcPath(0, 0.5, ARC_RADIUS)).toBe(
      `M ${sx} ${sy} A 80 80 0 0 1 ${GAUGE_CENTER.x} ${GAUGE_CENTER.y - ARC_RADIUS}`,
    );
    expect(arcPath(0, 1, ARC_RADIUS)).toBe(
      `M ${sx} ${sy} A 80 80 0 1 1 ${round(END.x)} ${round(END.y)}`,
    );
    expect(arcPath(0, 0.7, ARC_RADIUS)).toMatch(/^M [\d.]+ [\d.]+ A 80 80 0 1 1 /);
  });

  it('draws nothing for an empty arc, and keeps the ends within the sweep', () => {
    expect(arcPath(0, 0, ARC_RADIUS)).toBe('');
    expect(arcPath(0.6, 0.4, ARC_RADIUS)).toBe('');
    expect(arcPath(-1, 2, ARC_RADIUS)).toBe(arcPath(0, 1, ARC_RADIUS));
  });

  it('places a value along the sweep, 0 at min and 1 at max, held to the range', () => {
    expect(gaugeShare(30, 0, 60)).toBe(0.5);
    expect(gaugeShare(85, 0, 110)).toBeCloseTo(85 / 110);
    expect(gaugeShare(-5, 10, 20)).toBe(0);
    expect(gaugeShare(10, 10, 20)).toBe(0);
    expect(gaugeShare(25, 10, 20)).toBe(1);
    expect(gaugeShare(20, 10, 20)).toBe(1);
    expect(arcPath(0, gaugeShare(0, 0, 60)!, ARC_RADIUS)).toBe('');
  });

  it('gives no share, so no arc, for a missing value, one that is no finite number, or a range that is none', () => {
    for (const value of [null, undefined, Number.NaN, Infinity, -Infinity]) {
      expect(gaugeShare(value, 0, 60), String(value)).toBeNull();
    }
    for (const [min, max] of [
      [60, 60],
      [60, 0],
      [Number.NaN, 60],
      [0, Number.NaN],
      [0, Infinity],
    ]) {
      expect(validRange(min, max), `${min}..${max}`).toBe(false);
      expect(gaugeShare(30, min, max), `${min}..${max}`).toBeNull();
    }
    expect(validRange(0, 60)).toBe(true);
    expect(validRange(-40, -10)).toBe(true);
  });
});

describe('the gauge zones', () => {
  const zoneArc = (from: number, to: number) => arcPath(from, to, ZONE_RADIUS);

  it('draws warning from its start to the danger start, and danger from its start to max, outside the arc', () => {
    expect(zoneArcs({ warning: 85, danger: 100 }, 0, 110)).toEqual([
      { zone: 'warning', path: zoneArc(85 / 110, 100 / 110) },
      { zone: 'danger', path: zoneArc(100 / 110, 1) },
    ]);
    expect(ZONE_RADIUS).toBeGreaterThan(ARC_RADIUS);
  });

  it('runs a lone zone to max, and leaves out a zone that starts at or past max or is no number', () => {
    expect(zoneArcs({ warning: 40 }, 0, 60)).toEqual([
      { zone: 'warning', path: zoneArc(40 / 60, 1) },
    ]);
    expect(zoneArcs({ danger: 50 }, 0, 60)).toEqual([
      { zone: 'danger', path: zoneArc(50 / 60, 1) },
    ]);
    expect(zoneArcs({ warning: 60, danger: 70 }, 0, 60)).toEqual([]);
    expect(zoneArcs({ warning: Number.NaN, danger: 50 }, 0, 60)).toEqual([
      { zone: 'danger', path: zoneArc(50 / 60, 1) },
    ]);
    // A zone below min starts at min.
    expect(zoneArcs({ warning: -10 }, 0, 60)).toEqual([{ zone: 'warning', path: zoneArc(0, 1) }]);
  });

  it('draws no warning arc when danger starts first, and no zones without zones or a range', () => {
    expect(zoneArcs({ warning: 50, danger: 40 }, 0, 60)).toEqual([
      { zone: 'danger', path: zoneArc(40 / 60, 1) },
    ]);
    expect(zoneArcs(null, 0, 60)).toEqual([]);
    expect(zoneArcs({}, 0, 60)).toEqual([]);
    expect(zoneArcs({ warning: 40 }, 60, 0)).toEqual([]);
  });
});
