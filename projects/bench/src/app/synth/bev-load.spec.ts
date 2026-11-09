import { BEV_LOAD, BevLoad } from './bev-load';

describe('BevLoad', () => {
  it('holds the spec’s budget: 100 objects, 30,000 points, 4 lines and a 128 × 128 grid', () => {
    const frame = new BevLoad().frameAt(0);
    expect(frame.objects).toHaveLength(BEV_LOAD.objects);
    expect(frame.points?.[0].xy.length).toBe(BEV_LOAD.points * 2);
    expect(frame.lines).toHaveLength(BEV_LOAD.lines);
    const [grid] = frame.grids!;
    expect([grid.columns, grid.rows, grid.cells.length]).toEqual([128, 128, 128 * 128]);
  });

  it('draws the same load for the same seed', () => {
    expect(new BevLoad(7).frameAt(1.5).objects).toEqual(new BevLoad(7).frameAt(1.5).objects);
  });

  it('moves the objects on, keeps them in the view, and keeps the grid and the point buffer', () => {
    const load = new BevLoad();
    const first = load.frameAt(0);
    const later = load.frameAt(2);
    expect(later).not.toBe(first);
    expect(later.objects![0].x).not.toBe(first.objects![0].x);
    for (const object of later.objects!) {
      expect(Math.abs(object.x)).toBeLessThanOrEqual(BEV_LOAD.range);
      expect(Math.abs(object.y)).toBeLessThanOrEqual(BEV_LOAD.range);
    }
    expect(later.grids![0]).toBe(first.grids![0]);
    expect(later.points![0].xy).toBe(first.points![0].xy);
  });
});
