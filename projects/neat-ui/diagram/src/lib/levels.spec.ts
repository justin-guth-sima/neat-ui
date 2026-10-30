import { walkLevels } from './levels';
import type { NeatDiagram, NeatDiagramSet } from './model';

const block = (id: string, label: string, opens?: string) =>
  ({ id, role: 'block', label, opens, x: 0, y: 0, w: 100, h: 40 }) as const;

const STAGES: NeatDiagram = { nodes: [block('resize', 'Resize', 'inner')], edges: [] };
const INNER: NeatDiagram = { nodes: [block('tile', 'Tile')], edges: [] };
/** Opened by no block: no path the user can click leads to it. */
const ORPHAN: NeatDiagram = { nodes: [], edges: [] };

const SET: NeatDiagramSet = {
  overview: { nodes: [block('decode', 'Decode', 'stages'), block('sink', 'Sink')], edges: [] },
  levels: { stages: STAGES, inner: INNER, orphan: ORPHAN },
};

describe('walkLevels', () => {
  it('shows the overview for the empty path', () => {
    expect(walkLevels(SET, [])).toEqual({ path: [], openers: [], shown: SET.overview });
  });

  it('follows the path to the level at its end, with the block that opens each level', () => {
    const walked = walkLevels(SET, ['stages', 'inner']);
    expect(walked.path).toEqual(['stages', 'inner']);
    expect(walked.openers.map((node) => node.label)).toEqual(['Decode', 'Resize']);
    expect(walked.shown).toBe(INNER);
  });

  it('cuts a stale path to its longest valid start', () => {
    // A level that does not exist (a route from an older diagram) ...
    expect(walkLevels(SET, ['stages', 'gone', 'inner']).path).toEqual(['stages']);
    expect(walkLevels(SET, ['gone']).path).toEqual([]);
    // ... or one that exists but no block of the level before it opens.
    expect(walkLevels(SET, ['inner']).path).toEqual([]);
    expect(walkLevels(SET, ['stages', 'orphan']).shown).toBe(STAGES);
    expect(walkLevels({ overview: SET.overview }, ['stages']).shown).toBe(SET.overview);
    // An id that is a key of every object is not a level.
    const odd: NeatDiagramSet = {
      ...SET,
      overview: { nodes: [block('x', 'X', 'toString')], edges: [] },
    };
    expect(walkLevels(odd, ['toString']).path).toEqual([]);
  });

  it('takes no node but a block as a level’s opener', () => {
    const framed: NeatDiagramSet = {
      ...SET,
      overview: { nodes: [{ ...block('decode', 'Decode', 'stages'), role: 'frame' }], edges: [] },
    };
    expect(walkLevels(framed, ['stages']).path).toEqual([]);
  });
});
