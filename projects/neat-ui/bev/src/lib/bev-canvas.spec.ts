import { BevCanvas, type BevInputs, type BevTheme, packRgb } from './bev-canvas';
import { calls, type Recorded, type Recording, sets, stubCanvases } from './canvas.testing';
import {
  GRID_ALPHA,
  type LabelColours,
  type LabelLook,
  OBJECT_FILL_ALPHA,
  SENSOR_FILL_ALPHA,
} from './colours';
import { bevPlot, type BevView, defaultView, spokeList } from './geometry';
import type { NeatBevFrame, NeatBevObject } from './model';

const THEME: BevTheme = {
  line: 'rgb(200 200 200)',
  strong: 'rgb(120 120 120)',
  text: 'rgb(90 90 90)',
  ego: 'rgb(10 10 10)',
  halo: 'rgb(255 255 255)',
  surface: [1, 1, 1],
  font: '12px sans-serif',
};

/** Each label's look, as the page's class colours would give it. */
function colours(looks: Record<string, Partial<LabelLook>> = {}): LabelColours {
  const held = new Map<string, LabelLook>();
  return {
    of(label: string): LabelLook {
      let look = held.get(label);
      if (!look) {
        look = { colour: `#${label}`, rgb: [1, 0.5, 0], style: null, width: 2, ...looks[label] };
        held.set(label, look);
      }
      return look;
    },
  } as unknown as LabelColours;
}

/** Each straight segment drawn, a `moveTo` and the `lineTo` after it: x0, y0, x1, y1. */
function segments(log: readonly Recorded[]): (readonly [number, number, number, number])[] {
  const found: (readonly [number, number, number, number])[] = [];
  let from: readonly unknown[] | null = null;
  for (const entry of log) {
    if (entry.name === 'moveTo') from = entry.args;
    else if (entry.name === 'lineTo' && from) {
      found.push([from[0], from[1], entry.args[0], entry.args[1]] as [
        number,
        number,
        number,
        number,
      ]);
      from = null;
    }
  }
  return found;
}

/** A number as a pixel's byte stores it. */
const byte = (value: number): number => Uint8ClampedArray.of(value)[0];

const inputs = (over: Partial<BevInputs> = {}): BevInputs => ({
  plot: bevPlot('round', 60),
  sensors: [],
  spokes: spokeList(0),
  outline: true,
  overflow: 'clip',
  guides: 'over',
  ...over,
});

const car = (x: number, y: number, yaw = 0): NeatBevObject => ({
  x,
  y,
  length: 4,
  width: 2,
  yaw,
  label: 'car',
});

describe('packRgb', () => {
  it('packs an opaque colour as the pixel word the buffer holds, red first in memory', () => {
    const bytes = new Uint8Array(new Uint32Array([packRgb([1, 0.5, 0])]).buffer);
    expect([...bytes]).toEqual([255, 128, 0, 255]);
  });
});

describe('BevCanvas', () => {
  let recordingOf: (canvas: HTMLCanvasElement) => Recording;
  let canvas: HTMLCanvasElement;
  let created: HTMLCanvasElement[];
  let bev: BevCanvas;
  let view: BevView;

  beforeEach(() => {
    recordingOf = stubCanvases();
    canvas = document.createElement('canvas');
    created = [];
    bev = new BevCanvas(canvas, () => {
      const made = document.createElement('canvas');
      created.push(made);
      return made;
    });
    bev.size(400, 400);
    view = defaultView(400, 400, bevPlot('round', 60));
  });

  afterEach(() => vi.restoreAllMocks());

  const main = (): Recorded[] => recordingOf(canvas).log;
  /** The layer over the data: the first canvas the renderer made, while nothing goes under. */
  const layer = (): Recorded[] => recordingOf(created[0]).log;
  const draw = (frame: NeatBevFrame | null, over: Partial<BevInputs> = {}, hover = -1, at = view) =>
    bev.draw(2, at, inputs(over), THEME, colours(), frame, hover);

  it('draws nothing without a box or a scale', () => {
    bev.size(0, 0);
    expect(draw(null)).toBe(false);
    bev.size(400, 400);
    expect(bev.draw(2, { ...view, ppm: 0 }, inputs(), THEME, colours(), null, -1)).toBe(false);
    expect(draw(null)).toBe(true);
  });

  it('sizes the canvas to the box at the pixel ratio', () => {
    draw(null);
    expect([canvas.width, canvas.height]).toEqual([800, 800]);
  });

  describe('round', () => {
    it('draws a ring per step inside the range, and the outline at the range', () => {
      draw(null);
      const arcs = calls(layer(), 'arc').map((c) => c.args[2] as number);
      const ppm = view.ppm;
      // At 3.1 px per metre, rings 10 m apart would sit 31 px apart: the step grows to 20 m.
      // The clip, two rings, then the outline drawn outside the clip.
      expect(arcs.map((r) => Math.round(r / ppm))).toEqual([60, 20, 40, 60]);
      expect(sets(layer(), 'strokeStyle')).toContain(THEME.strong);
    });

    it('leaves the outline out when asked', () => {
      draw(null, { outline: false });
      const arcs = calls(layer(), 'arc').map((c) => Math.round((c.args[2] as number) / view.ppm));
      expect(arcs).toEqual([60, 20, 40]);
      expect(sets(layer(), 'strokeStyle')).not.toContain(THEME.strong);
    });

    it('zooms the circle with the view: its clip and outline grow past the box', () => {
      draw(null, {}, -1, { ...view, k: 2, tx: -200, ty: -200 });
      const arcs = calls(layer(), 'arc');
      for (const arc of [arcs[0], arcs.at(-1)!]) {
        expect(arc.args.slice(0, 2)).toEqual([200, 200]);
        expect(arc.args[2]).toBeCloseTo(60 * view.ppm * 2);
      }
      expect(calls(main(), 'arc')[0].args[2]).toBeCloseTo(60 * view.ppm * 2);
    });

    it('runs the rings on to the corners of the box with overflow visible, and clips nothing', () => {
      draw(null, { overflow: 'visible' });
      expect(calls(layer(), 'clip')).toHaveLength(0);
      expect(calls(main(), 'clip')).toHaveLength(0);
      const radii = calls(layer(), 'arc').map((c) => Math.round((c.args[2] as number) / view.ppm));
      // The corners lie 200·√2 px out, 90 m at 3.1 px per metre: rings to 80 m, the outline at 60.
      expect(radii).toEqual([20, 40, 60, 80, 60]);
      const labels = calls(layer(), 'fillText').map((c) => c.args[0]);
      expect(labels).toEqual(['20 m', '40 m', '60 m', '80 m']);
    });

    it('labels the rings in metres halfway between forward and left', () => {
      draw(null);
      const labels = calls(layer(), 'fillText');
      expect(labels.map((c) => c.args[0])).toEqual(['20 m', '40 m', '60 m']);
      const [, x, y] = labels[0].args as [string, number, number];
      // Up and to the left of the vehicle, equally far.
      expect(200 - x).toBeCloseTo(200 - y);
      expect(200 - x).toBeGreaterThan(0);
    });

    it('steps every 10 m once the zoom leaves room, and labels only the rings in the box', () => {
      // Zoomed twice about the plot's centre, as d3-zoom's transform does it.
      draw(null, {}, -1, { ...view, k: 2, tx: -200, ty: -200 });
      const labels = calls(layer(), 'fillText').map((c) => c.args[0]);
      // Halfway between forward and left the box's corner is 43 m out: 50 m and 60 m are not.
      expect(labels).toEqual(['10 m', '20 m', '30 m', '40 m']);
    });

    it('puts the labels towards the box once the vehicle is panned out of it', () => {
      // Zoomed four times and panned so that the vehicle lies 200 px below the box.
      draw(null, {}, -1, { ...view, k: 4, tx: -600, ty: -200 });
      const labels = calls(layer(), 'fillText');
      expect(labels.length).toBeGreaterThan(0);
      // Straight ahead of the vehicle, up the box's middle.
      for (const label of labels) expect(label.args[1]).toBeCloseTo(200);
    });

    it('draws a label on the edge whole, outside the clip', () => {
      draw(null);
      const log = layer();
      const restored = log.findIndex((entry) => entry.name === 'restore');
      const lastLabel = log.map((entry) => entry.name).lastIndexOf('fillText');
      expect(lastLabel).toBeGreaterThan(restored);
    });

    it('draws the spokes from the centre to the range, the first straight ahead', () => {
      draw(null, { spokes: spokeList(12) });
      expect(
        calls(layer(), 'moveTo').filter((c) => c.args[0] === 200 && c.args[1] === 200),
      ).toHaveLength(12);
      const ends = calls(layer(), 'lineTo');
      expect(ends).toHaveLength(12);
      expect(ends[0].args[0]).toBeCloseTo(200);
      expect(ends[0].args[1]).toBeCloseTo(200 - 60 * view.ppm);
    });

    it('draws a spoke from a mount point to the outer ring', () => {
      draw(null, { spokes: spokeList([{ angle: 1, origin: { x: 1.5, y: 0.5 } }]) });
      const [from] = calls(layer(), 'moveTo').slice(-1);
      expect(from.args[0]).toBeCloseTo(200 - 0.5 * view.ppm);
      expect(from.args[1]).toBeCloseTo(200 - 1.5 * view.ppm);
      const [end] = calls(layer(), 'lineTo');
      const [x, y] = end.args as [number, number];
      expect(Math.hypot(x - 200, y - 200)).toBeCloseTo(60 * view.ppm);
    });

    it('draws the edges of a sensor from its origin, and its arc when it has its own range', () => {
      draw(null, {
        sensors: [
          { label: 'front', from: -0.5, to: 0.5, range: 30 },
          { label: 'back', from: 2.5, to: 3.5 },
        ],
      });
      const wedge = calls(layer(), 'arc').find(
        (c) => Math.abs((c.args[2] as number) - 30 * view.ppm) < 1e-9,
      );
      expect(wedge?.args.slice(0, 2)).toEqual([200, 200]);
      // Back from the left edge to the right edge, clockwise on the screen.
      expect(wedge?.args[3]).toBeCloseTo(-Math.PI / 2 - 0.5);
      expect(wedge?.args[4]).toBeCloseTo(-Math.PI / 2 + 0.5);
      expect(wedge?.args[5]).toBe(false);
      // The back sensor reaches the range, where the outline is: no arc of its own.
      expect(
        calls(layer(), 'arc').map((c) => Math.round((c.args[2] as number) / view.ppm)),
      ).toEqual([60, 20, 40, 30, 60]);
      expect(sets(layer(), 'strokeStyle')).toEqual(expect.arrayContaining(['#front', '#back']));
      expect(sets(layer(), 'fillStyle')).not.toContain('#front');
      // Nothing goes under the data: one layer only.
      expect(created).toHaveLength(1);
    });

    it('fills a sensor that asks, faintly and under the data', () => {
      draw(
        { objects: [car(10, 0)] },
        { sensors: [{ label: 'front', from: -0.5, to: 0.5, fill: true }] },
      );
      const [under, over] = created;
      const fills = recordingOf(under).log;
      expect(sets(fills, 'fillStyle')).toEqual(['#front']);
      expect(sets(fills, 'globalAlpha')).toContain(SENSOR_FILL_ALPHA);
      expect(sets(recordingOf(over).log, 'strokeStyle')).toContain('#front');
      const log = main();
      const images = log.filter((entry) => entry.name === 'drawImage');
      const firstFill = log.findIndex((entry) => entry.name === 'fill');
      expect(images[0].args[0]).toBe(under);
      expect(log.indexOf(images[0])).toBeLessThan(firstFill);
      expect(log.indexOf(images.at(-1)!)).toBeGreaterThan(firstFill);
      expect(images.at(-1)!.args[0]).toBe(over);
    });
  });

  describe('guides', () => {
    it('lie over the data by default, and under it when asked, their labels on top', () => {
      draw({ objects: [car(10, 0)] }, { guides: 'under' });
      const [under, over] = created;
      expect(calls(recordingOf(under).log, 'arc').length).toBeGreaterThan(1);
      expect(calls(recordingOf(under).log, 'fillText')).toHaveLength(0);
      expect(calls(recordingOf(over).log, 'arc')).toHaveLength(0);
      expect(calls(recordingOf(over).log, 'fillText').length).toBeGreaterThan(0);
      const log = main();
      const firstFill = log.findIndex((entry) => entry.name === 'fill');
      const images = calls(log, 'drawImage').map((c) => log.indexOf(c));
      expect(images[0]).toBeLessThan(firstFill);
      expect(images.at(-1)).toBeGreaterThan(firstFill);
    });
  });

  describe('rect', () => {
    const rect = (back: number, front: number, right: number, left: number) =>
      bevPlot('rect', 60, { x: [back, front], y: [right, left] });

    beforeEach(() => {
      bev.size(600, 400);
      view = defaultView(600, 400, bevPlot('rect', 60));
    });

    it('draws grid lines inside the rectangle every step, labelled at its edges, and its outline', () => {
      draw(null, { plot: bevPlot('rect', 60) });
      const labels = calls(layer(), 'fillText').map((c) => c.args[0]);
      expect(labels).toContain('20 m');
      expect(labels).not.toContain('0 m');
      // 376 px for 120 m, every 20 m (10 m would be 31 px apart): -60 to 60, from the left edge.
      const left = 300 - 60 * view.ppm;
      const horizontal = segments(layer()).filter(([x0, y0, , y1]) => x0 === left && y0 === y1);
      expect(horizontal).toHaveLength(7);
      // The clip and the outline are the rectangle; nothing is round.
      const rects = calls(layer(), 'rect');
      expect(rects).toHaveLength(2);
      expect(rects[1].args[0]).toBeCloseTo(left);
      expect(rects[1].args[2]).toBeCloseTo(120 * view.ppm);
      expect(calls(layer(), 'arc')).toHaveLength(0);
      // The labels sit along the rectangle's left edge.
      const columns = calls(layer(), 'fillText').filter((c) => c.args[0] === '20 m');
      expect(columns.some((c) => c.args[1] === left + 4)).toBe(true);
    });

    it('fills the box with lines and no outline: overflow visible, outline off', () => {
      draw(null, { plot: bevPlot('rect', 60), overflow: 'visible', outline: false });
      const horizontal = calls(layer(), 'moveTo').filter((c) => c.args[0] === 0);
      const vertical = calls(layer(), 'moveTo').filter((c) => c.args[1] === 0);
      expect(horizontal).toHaveLength(7);
      // 600 px across, every 62.7 px from the middle: 9 lines.
      expect(vertical).toHaveLength(9);
      expect(calls(layer(), 'rect')).toHaveLength(0);
      expect(calls(layer(), 'clip')).toHaveLength(0);
    });

    it('fits off-centre bounds, the vehicle off the middle, spokes to their edges', () => {
      bev.size(400, 400);
      const plot = rect(-20, 80, -30, 30);
      view = defaultView(400, 400, plot);
      draw(null, { plot, spokes: spokeList(2) });
      // 100 m along in 376 px: the vehicle 30 m below the middle.
      expect(view.ppm).toBeCloseTo(3.76);
      const ends = calls(layer(), 'lineTo').slice(-2);
      expect(ends[0].args[1]).toBeCloseTo(12);
      expect(ends[1].args[1]).toBeCloseTo(388);
    });
  });

  describe('the cached layer', () => {
    it('is drawn once for an unchanged view, inputs and theme', () => {
      const same = inputs();
      bev.draw(2, view, same, THEME, colours(), null, -1);
      bev.draw(2, view, same, THEME, colours(), { objects: [car(5, 0)] }, -1);
      expect(bev.layerDraws).toBe(1);
    });

    it('is drawn again for a new view, new inputs, a new theme or a new size', () => {
      const same = inputs();
      const look = colours();
      bev.draw(2, view, same, THEME, look, null, -1);
      bev.draw(2, { ...view, k: 2 }, same, THEME, look, null, -1);
      bev.draw(2, { ...view, k: 2 }, inputs(), THEME, look, null, -1);
      bev.draw(2, { ...view, k: 2 }, same, { ...THEME }, look, null, -1);
      bev.size(500, 400);
      bev.draw(2, { ...view, k: 2 }, same, THEME, look, null, -1);
      expect(bev.layerDraws).toBe(5);
    });

    it('is drawn again when a sensor label changes colour', () => {
      const same = inputs({ sensors: [{ label: 'front', from: 0, to: 1 }] });
      bev.draw(2, view, same, THEME, colours(), null, -1);
      bev.draw(2, view, same, THEME, colours({ front: { colour: '#other' } }), null, -1);
      expect(bev.layerDraws).toBe(2);
    });
  });

  describe('a frame', () => {
    it('draws a grid with row 0 forward and column 0 left, in its colour', () => {
      const cells = new Uint8Array([255, 0, 0, 0, 0, 128]); // 3 columns, 2 rows
      draw({ grids: [{ label: 'road', cells, columns: 3, rows: 2, x: [-20, 20], y: [-30, 30] }] });
      // The layer is the first canvas made, the grid's the second.
      const pixels = calls(recordingOf(created[1]).log, 'putImageData')[0].args[0] as ImageData;
      expect([...pixels.data.slice(0, 4)]).toEqual([255, 128, 0, byte(255 * GRID_ALPHA)]);
      expect(pixels.data[4 * 5 + 3]).toBe(byte(128 * GRID_ALPHA));
      expect(pixels.data[4 * 1 + 3]).toBe(0);
      const [image] = calls(main(), 'drawImage').filter((c) => c.args[0] === created[1]);
      // Its top left is the forward-left corner.
      expect(image.args[1]).toBeCloseTo(200 - 30 * view.ppm);
      expect(image.args[2]).toBeCloseTo(200 - 20 * view.ppm);
      expect(image.args[3]).toBeCloseTo(60 * view.ppm);
      expect(image.args[4]).toBeCloseTo(40 * view.ppm);
    });

    it('lays the backing of every grid, opaque in the surface, before any tint', () => {
      const cells = new Uint8Array([255, 0, 128, 0]); // 2 columns, 2 rows
      const grid = { label: 'road', cells, columns: 2, rows: 2, x: [-1, 1], y: [-1, 1] } as const;
      draw({ grids: [grid, { ...grid, label: 'parking' }] });
      // The layer, then each grid's tint and backing.
      const [, roadTint, roadBacking, parkTint, parkBacking] = created;
      const backing = calls(recordingOf(roadBacking).log, 'putImageData')[0].args[0] as ImageData;
      expect([...backing.data.slice(0, 4)]).toEqual([255, 255, 255, 255]);
      expect(backing.data[4 * 2 + 3]).toBe(128);
      expect(backing.data[4 * 1 + 3]).toBe(0);
      const order = calls(main(), 'drawImage').map((c) => c.args[0]);
      expect(order.slice(0, 4)).toEqual([roadBacking, parkBacking, roadTint, parkTint]);
    });

    it('draws a grid as its tint alone without a surface colour', () => {
      const grid = {
        label: 'road',
        cells: new Uint8Array([255]),
        columns: 1,
        rows: 1,
        x: [-1, 1],
        y: [-1, 1],
      } as const;
      bev.draw(2, view, inputs(), { ...THEME, surface: null }, colours(), { grids: [grid] }, -1);
      expect(calls(main(), 'drawImage').map((c) => c.args[0])).toEqual([created[1], created[0]]);
    });

    it('paints a grid again only for a new cells array', () => {
      const grid = {
        label: 'road',
        cells: new Uint8Array(4),
        columns: 2,
        rows: 2,
        x: [-1, 1],
        y: [-1, 1],
      } as const;
      draw({ grids: [grid] });
      draw({ grids: [grid] });
      draw({ grids: [{ ...grid, cells: new Uint8Array(4) }] });
      expect(calls(recordingOf(created[1]).log, 'putImageData')).toHaveLength(2);
    });

    it('draws an object as a filled, outlined box with a heading line', () => {
      draw({ objects: [car(10, 0)] });
      const log = main();
      const firstCorner = calls(log, 'moveTo').find(
        (c) => Math.abs((c.args[1] as number) - (200 - 12 * view.ppm)) < 1e-9,
      );
      // Front left: 12 m forward, 1 m left.
      expect(firstCorner?.args[0]).toBeCloseTo(200 - 1 * view.ppm);
      expect(sets(log, 'globalAlpha')).toContain(OBJECT_FILL_ALPHA);
      expect(sets(log, 'fillStyle')).toContain('#car');
      // The heading runs from the centre to the front edge's middle.
      const heading = calls(log, 'lineTo').find(
        (c) =>
          Math.abs((c.args[0] as number) - 200) < 1e-9 &&
          Math.abs((c.args[1] as number) - (200 - 12 * view.ppm)) < 1e-9,
      );
      expect(heading).toBeDefined();
    });

    it('outlines the hovered object wider, on top', () => {
      draw({ objects: [car(10, 0), car(-10, 0)] }, {}, 0);
      const widths = sets(main(), 'lineWidth');
      expect(widths.at(-2)).toBe(4);
    });

    it('writes points as squares of whole device pixels into a buffer, put over the plot', () => {
      const xy = new Float32Array([1, 2, 3, 4, 5, 6]);
      draw({ points: [{ label: 'lidar', xy }] });
      // The layer is the first canvas made, the points' buffer the second.
      const buffer = created[1];
      const [put] = calls(recordingOf(buffer).log, 'putImageData');
      const image = put.args[0] as ImageData;
      // At ratio 2 the circle's square, 376 px inside the 12 px inset, is 752 device pixels.
      expect([image.width, image.height]).toEqual([752, 752]);
      expect(calls(main(), 'drawImage').find((c) => c.args[0] === buffer)?.args).toEqual([
        buffer,
        24,
        24,
      ]);
      const words = new Uint32Array(image.data.buffer);
      const word = packRgb([1, 0.5, 0]);
      // The first point, 1 m forward and 2 m left: a 4 px square (2 CSS px) around it.
      const x = Math.round(376 - 2 * view.ppm * 2);
      const y = Math.round(376 - 1 * view.ppm * 2);
      expect(words[y * 752 + x]).toBe(word);
      expect(words[(y - 2) * 752 + x - 2]).toBe(word);
      expect(words[(y + 2) * 752 + x]).toBe(0);
      expect(words.filter((w) => w === word)).toHaveLength(3 * 16);
    });

    it('covers the whole box with the buffer when overflow is visible', () => {
      draw(
        { points: [{ label: 'lidar', xy: new Float32Array([62, 0]) }] },
        { overflow: 'visible' },
      );
      const image = calls(recordingOf(created[1]).log, 'putImageData')[0].args[0] as ImageData;
      expect([image.width, image.height]).toEqual([800, 800]);
      // 62 m ahead lies beyond the range, still in the box: drawn.
      expect(new Uint32Array(image.data.buffer).filter((w) => w !== 0)).toHaveLength(16);
    });

    it("sizes the points' buffer to the plot in a wide box, and clears it each frame", () => {
      bev.size(600, 400);
      const wide = defaultView(600, 400, bevPlot('round', 60));
      const xy = new Float32Array([1, 2]);
      draw({ points: [{ label: 'lidar', xy }] }, {}, -1, wide);
      draw(
        {
          points: [
            { label: 'lidar', xy: new Float32Array(0) },
            { label: 'lidar', xy },
          ],
        },
        {},
        -1,
        wide,
      );
      const buffer = created.at(-1)!;
      const puts = calls(recordingOf(buffer).log, 'putImageData');
      const image = puts.at(-1)!.args[0] as ImageData;
      expect([image.width, image.height]).toEqual([752, 752]);
      expect(
        calls(main(), 'drawImage')
          .filter((c) => c.args[0] === buffer)
          .at(-1)?.args,
      ).toEqual([buffer, 224, 24]);
      expect(new Uint32Array(image.data.buffer).filter((w) => w !== 0)).toHaveLength(16);
    });

    it('draws a line in its style, closing it when asked', () => {
      const xy = new Float32Array([0, 0, 10, 0, 10, 10]);
      draw({ lines: [{ label: 'lane', xy, closed: true, style: 'dashed' }] });
      const dashes = calls(main(), 'setLineDash').map((c) => c.args[0]);
      expect(dashes).toContainEqual([6, 4]);
      expect(calls(main(), 'closePath').length).toBeGreaterThan(0);
    });

    it("lets the label style row win over the line's own style", () => {
      const xy = new Float32Array([0, 0, 10, 0]);
      bev.draw(
        2,
        view,
        inputs(),
        THEME,
        colours({ lane: { style: 'dotted' } }),
        {
          lines: [{ label: 'lane', xy, style: 'dashed' }],
        },
        -1,
      );
      const dashes = calls(main(), 'setLineDash').map((c) => c.args[0]);
      expect(dashes).toContainEqual([2, 2]);
      expect(dashes).not.toContainEqual([6, 4]);
    });

    it('draws the vehicle as a marker pointing forward', () => {
      draw(null);
      const tip = calls(main(), 'moveTo').at(-1);
      expect(tip?.args).toEqual([200, 191]);
    });
  });
});
