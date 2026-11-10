import { drawLevel, LABEL_CORNER, LABEL_GAP, labelCovers } from './drawing';
import type { NeatDiagram } from './model';

/** Two blocks joined straight across, the edge labelled at its middle, and one unlabelled. */
const LEVEL: NeatDiagram = {
  nodes: [
    { id: 'a', role: 'block', label: 'A', x: 0, y: 0, w: 100, h: 40 },
    { id: 'b', role: 'block', label: 'B', x: 300, y: 0, w: 100, h: 40 },
    { id: 'c', role: 'block', label: 'C', x: 300, y: 200, w: 100, h: 40 },
  ],
  edges: [
    { id: 'tokens', from: 'a', to: 'b', label: 'tokens' },
    { id: 'plain', from: 'a', to: 'c' },
  ],
};

describe('labelCovers', () => {
  const { edges } = drawLevel(LEVEL, new Set());
  /** Where the route puts the label: the middle of `tokens`, between the blocks. */
  const at = edges.find((edge) => edge.id === 'tokens')!.label!.at;

  it("is each measured label's border box, centred on its point, with the label's corner", () => {
    expect(at.x).toBeCloseTo(200);
    const [cover, ...more] = labelCovers(edges, new Map([['tokens', { w: 50, h: 18 }]]));
    expect(more).toEqual([]);
    expect(LABEL_CORNER).toBe(0.5);
    expect(cover).toEqual({ x: at.x - 25, y: at.y - 9, w: 50, h: 18, corner: 0.5 });
  });

  it('holds the label point and leaves the rest of the edge outside', () => {
    const [cover] = labelCovers(edges, new Map([['tokens', { w: 50, h: 18 }]]));
    const inside = (x: number, y: number) =>
      x >= cover.x && x <= cover.x + cover.w && y >= cover.y && y <= cover.y + cover.h;
    expect(inside(at.x, at.y)).toBe(true);
    expect(inside(at.x - 25, at.y)).toBe(true);
    expect(inside(at.x - 26, at.y)).toBe(false);
    expect(inside(at.x - 50, at.y)).toBe(false);
    expect(inside(at.x + 50, at.y)).toBe(false);
    expect(inside(at.x, at.y + 12)).toBe(false);
  });

  it('has nothing for a label not measured yet, nor for an edge without a label', () => {
    expect(labelCovers(edges, new Map())).toEqual([]);
    expect(labelCovers(edges, new Map([['plain', { w: 50, h: 18 }]]))).toEqual([]);
  });
});

describe('a label beside its line', () => {
  /** The `tokens` edge's label, its edge given more. */
  const labelled = (more: object) =>
    drawLevel(
      {
        ...LEVEL,
        edges: [{ ...LEVEL.edges[0], ...more }, LEVEL.edges[1]],
      },
      new Set(),
    ).edges;
  const on = labelled({}).find((edge) => edge.id === 'tokens')!.label!.at;

  it('stands a gap off the line on its side, its near edge at that point', () => {
    const edges = labelled({ labelSide: 'below' });
    const label = edges.find((edge) => edge.id === 'tokens')!.label!;
    expect(label.side).toBe('below');
    expect(label.at).toEqual({ x: on.x, y: on.y + LABEL_GAP });
    // Its top edge is at the point: the line, a gap above, stays clear of it.
    const [cover] = labelCovers(edges, new Map([['tokens', { w: 50, h: 18 }]]));
    expect(cover).toEqual({ x: on.x - 25, y: on.y + LABEL_GAP, w: 50, h: 18, corner: 0.5 });
    expect(cover.y).toBeGreaterThan(on.y);
  });

  it('moves further by its offset, and stays on the line for an unknown side', () => {
    const moved = labelled({ labelSide: 'left', labelOffset: { x: -10, y: 5 } });
    const label = moved.find((edge) => edge.id === 'tokens')!.label!;
    expect(label.at).toEqual({ x: on.x - LABEL_GAP - 10, y: on.y + 5 });
    const [cover] = labelCovers(moved, new Map([['tokens', { w: 50, h: 18 }]]));
    expect(cover.x + cover.w).toBeCloseTo(label.at.x);
    const odd = labelled({ labelSide: 'sideways' });
    expect(odd.find((edge) => edge.id === 'tokens')!.label).toEqual({
      text: 'tokens',
      at: on,
      side: 'on',
    });
  });
});
