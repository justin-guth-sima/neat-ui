import { fitTransform } from './fit';

/** Where the transform puts a diagram point on the box: k times the point, moved by x and y. */
const onBox = (t: { k: number; x: number; y: number }, x: number, y: number) => ({
  x: t.k * x + t.x,
  y: t.k * y + t.y,
});

describe('fitTransform', () => {
  it('zooms a level to the box less its margin, the tighter axis deciding, and centres it', () => {
    const t = fitTransform({ x: 0, y: 0, w: 1000, h: 500 }, { w: 500, h: 500 });
    expect(t?.k).toBeCloseTo((500 - 48) / 1000, 10);
    // Its width fills the box between the margins; its height sits in the middle.
    expect(onBox(t!, 0, 0).x).toBeCloseTo(24, 10);
    expect(onBox(t!, 1000, 0).x).toBeCloseTo(476, 10);
    expect(onBox(t!, 500, 250).y).toBeCloseTo(250, 10);
  });

  it('centres a level that does not start at the origin', () => {
    const t = fitTransform({ x: -400, y: 200, w: 800, h: 400 }, { w: 1200, h: 900 });
    const centre = onBox(t!, 0, 400);
    expect(centre.x).toBeCloseTo(600, 10);
    expect(centre.y).toBeCloseTo(450, 10);
  });

  it('takes another margin', () => {
    const t = fitTransform({ x: 0, y: 0, w: 1000, h: 500 }, { w: 500, h: 500 }, 0);
    expect(t?.k).toBeCloseTo(0.5, 10);
  });

  it('keeps the zoom within its limits', () => {
    const box = { w: 500, h: 500 };
    expect(fitTransform({ x: 0, y: 0, w: 10, h: 10 }, box)?.k).toBe(3);
    expect(fitTransform({ x: 0, y: 0, w: 1e5, h: 1e5 }, box)?.k).toBe(0.2);
    expect(fitTransform({ x: 0, y: 0, w: 10, h: 10 }, box, 24, [0.5, 1])?.k).toBe(1);
    expect(fitTransform({ x: 0, y: 0, w: 1e5, h: 1e5 }, box, 24, [0.5, 1])?.k).toBe(0.5);
  });

  it('gives nothing for a box without a size (a hidden tab), to fit once it has one', () => {
    const bounds = { x: 0, y: 0, w: 1000, h: 500 };
    expect(fitTransform(bounds, { w: 0, h: 0 })).toBeNull();
    expect(fitTransform(bounds, { w: 500, h: 0 })).toBeNull();
    expect(fitTransform(bounds, { w: 0, h: 500 })).toBeNull();
  });

  it('stays a number for an empty level and for a box smaller than its margins', () => {
    const point = fitTransform({ x: 100, y: 100, w: 0, h: 0 }, { w: 500, h: 500 });
    expect(point?.k).toBe(3);
    expect(onBox(point!, 100, 100)).toEqual({ x: 250, y: 250 });
    const tiny = fitTransform({ x: 0, y: 0, w: 1000, h: 500 }, { w: 40, h: 40 });
    expect(tiny?.k).toBe(0.2);
    expect(Number.isFinite(tiny?.x) && Number.isFinite(tiny?.y)).toBe(true);
  });
});
