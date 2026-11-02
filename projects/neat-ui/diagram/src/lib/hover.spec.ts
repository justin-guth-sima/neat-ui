import { focusedParts, highlighted, placeTip, TIP_GAP } from './hover';
import type { NeatDiagram } from './model';

/** Camera → Decode → Sink, a note on each edge and one on a point of its own. */
const LEVEL: NeatDiagram = {
  nodes: [
    { id: 'camera', role: 'block', label: 'Camera', x: 0, y: 0, w: 100, h: 40 },
    { id: 'decode', role: 'block', label: 'Decode', x: 200, y: 0, w: 100, h: 40 },
    { id: 'sink', role: 'block', label: 'Sink', x: 400, y: 0, w: 100, h: 40 },
  ],
  edges: [
    { id: 'frames', from: 'camera', to: 'decode' },
    { id: 'images', from: 'decode', to: 'sink' },
  ],
  notes: [
    { id: 'rate', edges: ['frames'] },
    { id: 'both', edges: ['frames', 'images'] },
    { id: 'point', anchor: { x: 0, y: 100 } },
  ],
};

const sorted = (set: ReadonlySet<string> | undefined) => [...(set ?? [])].sort();

describe('focusedParts', () => {
  it('is null while nothing is in focus: nothing is dimmed', () => {
    expect(focusedParts(LEVEL, null)).toBeNull();
  });

  it('puts a block in focus with the edges that enter or leave it, and their notes', () => {
    const parts = focusedParts(LEVEL, { kind: 'block', id: 'sink' });
    expect(sorted(parts?.nodes)).toEqual(['sink']);
    expect(sorted(parts?.edges)).toEqual(['images']);
    expect(sorted(parts?.notes)).toEqual(['both']);

    const middle = focusedParts(LEVEL, { kind: 'block', id: 'decode' });
    expect(sorted(middle?.nodes)).toEqual(['decode']);
    expect(sorted(middle?.edges)).toEqual(['frames', 'images']);
    expect(sorted(middle?.notes)).toEqual(['both', 'rate']);
  });

  it('puts an edge in focus with its ends and its notes', () => {
    const parts = focusedParts(LEVEL, { kind: 'edge', id: 'frames' });
    expect(sorted(parts?.nodes)).toEqual(['camera', 'decode']);
    expect(sorted(parts?.edges)).toEqual(['frames']);
    expect(sorted(parts?.notes)).toEqual(['both', 'rate']);
  });

  it('dims everything else for a part the level no longer has (a poll removed it)', () => {
    const parts = focusedParts(LEVEL, { kind: 'edge', id: 'gone' });
    expect(sorted(parts?.nodes)).toEqual([]);
    expect(sorted(parts?.edges)).toEqual(['gone']);
    expect(sorted(parts?.notes)).toEqual([]);
  });
});

describe('placeTip', () => {
  const box = { w: 800, h: 600 };
  const size = { w: 200, h: 100 };

  it('puts the tip below and right of the pointer, a gap away', () => {
    expect(placeTip({ x: 100, y: 50 }, size, box)).toEqual({
      left: 100 + TIP_GAP,
      top: 50 + TIP_GAP,
    });
  });

  it('puts it left of or above the pointer where it would leave the box', () => {
    expect(placeTip({ x: 700, y: 550 }, size, box)).toEqual({
      left: 700 - TIP_GAP - 200,
      top: 550 - TIP_GAP - 100,
    });
  });

  it('keeps it inside the box where neither side has room', () => {
    expect(placeTip({ x: 120, y: 60 }, size, { w: 260, h: 140 })).toEqual({ left: 60, top: 40 });
    // A tip larger than the box starts at its corner.
    expect(placeTip({ x: 50, y: 50 }, size, { w: 100, h: 80 })).toEqual({ left: 0, top: 0 });
  });
});

describe('highlighted', () => {
  const block = { kind: 'block', id: 'decode' } as const;
  const edge = { kind: 'edge', id: 'frames' } as const;

  it('lets nothing through for none', () => {
    expect(highlighted(block, 'none')).toBeNull();
    expect(highlighted(edge, 'none')).toBeNull();
  });

  it('lets an edge through, not a block, for edges', () => {
    expect(highlighted(edge, 'edges')).toBe(edge);
    expect(highlighted(block, 'edges')).toBeNull();
  });

  it('lets both through for all, and nothing in focus stays nothing', () => {
    expect(highlighted(block, 'all')).toBe(block);
    expect(highlighted(edge, 'all')).toBe(edge);
    expect(highlighted(null, 'all')).toBeNull();
  });
});
