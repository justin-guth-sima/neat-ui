import { drawLevel, fitTransform, levelExtent } from '@bench/diagram-seam';
import { D1, synthDiagram } from '../synth/synth-diagram';
import { NOTE_BOX } from './bench-note';
import { sceneOf, startTransform } from './scene';

describe('sceneOf', () => {
  const synth = synthDiagram(D1, 3);
  const overview = synth.diagram.overview;
  const scene = sceneOf(synth);

  it('draws the level as the kit does: its routes, end markers and colors', () => {
    expect(scene.drawn).toEqual(drawLevel(overview, new Set()));
  });

  it('gives the dot layer every drawn edge with its route, ends, series and line', () => {
    expect(scene.level.edges).toEqual(
      scene.drawn.edges.map(({ id, edge, line, points }) => ({
        id,
        from: edge.from,
        to: edge.to,
        series: edge.series,
        line,
        points,
      })),
    );
    expect(scene.level.edges).toHaveLength(D1.edges);
    expect(scene.edgeIds).toEqual(new Set(overview.edges.map((edge) => edge.id)));
  });

  it('places every note at the note box, centered off its edge as the kit centers it', () => {
    expect(scene.notes.size).toBe(D1.notes);
    for (const note of overview.notes ?? []) {
      const { box, anchor } = scene.notes.get(note.id)!;
      expect(box.w).toBe(NOTE_BOX.w);
      expect(box.h).toBe(NOTE_BOX.h);
      expect(box.x + box.w / 2).toBeCloseTo(anchor.x);
      expect(box.y + box.h / 2).toBeCloseTo(anchor.y + (note.dy ?? 0));
    }
  });

  it('lets the dots pass behind the blocks and the notes, as the kit does', () => {
    const blocks = overview.nodes.filter((node) => node.role === 'block');
    expect(scene.covers).toEqual([
      ...scene.drawn.front.filter(({ node }) => node.role === 'block').map(({ rect }) => rect),
      ...[...scene.notes.values()].map(({ box }) => box),
    ]);
    expect(scene.covers).toHaveLength(blocks.length + D1.notes);
  });

  it('frames the nodes, the routes and the notes, as the kit fits them', () => {
    expect(scene.extent).toEqual(
      levelExtent(
        scene.drawn,
        [...scene.notes.values()].map(({ box }) => box),
      ),
    );
  });
});

describe('startTransform', () => {
  const scene = sceneOf(synthDiagram(D1, 3));

  it('is the kit’s fit of the scene in the box', () => {
    const box = { w: 1920, h: 1080 };
    expect(startTransform(scene, box)).toEqual(fitTransform(scene.extent!, box));
  });

  it('is null for a box without a size, which is fitted once it has one', () => {
    expect(startTransform(scene, { w: 0, h: 0 })).toBeNull();
  });
});
