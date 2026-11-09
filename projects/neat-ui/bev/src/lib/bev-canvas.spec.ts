import { BevCanvas, type BevInputs, type BevTheme } from './bev-canvas';
import { calls, type Recorded, type Recording, sets, stubCanvases } from './canvas.testing';
import { GRID_ALPHA, type LabelColours, type LabelLook, OBJECT_FILL_ALPHA } from './colours';
import { type BevView, defaultView, plotArea, spokeList } from './geometry';
import type { NeatBevFrame, NeatBevObject } from './model';

const THEME: BevTheme = {
  line: 'rgb(200 200 200)',
  strong: 'rgb(120 120 120)',
  text: 'rgb(90 90 90)',
  ego: 'rgb(10 10 10)',
  halo: 'rgb(255 255 255)',
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

/** A number as a pixel's byte stores it. */
const byte = (value: number): number => Uint8ClampedArray.of(value)[0];

const inputs = (over: Partial<BevInputs> = {}): BevInputs => ({
  shape: 'round',
  range: 60,
  sensors: [],
  spokes: spokeList(0),
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
    view = defaultView(plotArea(400, 400, 'round'), 60);
  });

  afterEach(() => vi.restoreAllMocks());

  const main = (): Recorded[] => recordingOf(canvas).log;
  /** The cached layer's recording: the first canvas the renderer made. */
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
    it('draws a ring per step inside the range, a strong ring at the range and the edge', () => {
      draw(null);
      const arcs = calls(layer(), 'arc').map((c) => c.args[2] as number);
      const ppm = view.ppm;
      // At 3.1 px per metre, rings 10 m apart would sit 31 px apart: the step grows to 20 m.
      // The clip, two rings, the range's ring, then the edge drawn outside the clip.
      expect(arcs.map((r) => Math.round(r / ppm))).toEqual([60, 20, 40, 60, 60]);
      expect(sets(layer(), 'strokeStyle')).toContain(THEME.strong);
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

    it('steps every 10 m once the zoom leaves room, and labels only the rings on the plot', () => {
      // Zoomed twice about the plot's centre, as d3-zoom's transform does it.
      draw(null, {}, -1, { ...view, k: 2, tx: -200, ty: -200 });
      const labels = calls(layer(), 'fillText').map((c) => c.args[0]);
      // Zoomed in twice, 30 m reach the edge: the rings beyond it are not labelled.
      expect(labels).toEqual(['10 m', '20 m', '30 m']);
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

    it('draws a sensor as a faint wedge from its origin', () => {
      draw(null, { sensors: [{ label: 'front', from: -0.5, to: 0.5, range: 30 }] });
      const wedge = calls(layer(), 'arc').find(
        (c) => Math.abs((c.args[2] as number) - 30 * view.ppm) < 1e-9,
      );
      expect(wedge?.args.slice(0, 2)).toEqual([200, 200]);
      // From the right edge to the left edge, anticlockwise on the screen.
      expect(wedge?.args[3]).toBeCloseTo(-Math.PI / 2 + 0.5);
      expect(wedge?.args[4]).toBeCloseTo(-Math.PI / 2 - 0.5);
      expect(wedge?.args[5]).toBe(true);
      expect(sets(layer(), 'fillStyle')).toContain('#front');
    });
  });

  describe('square', () => {
    beforeEach(() => {
      bev.size(600, 400);
      view = defaultView(plotArea(600, 400, 'square'), 60);
    });

    it('draws grid lines across the box every step, labelled at the edges, and no edge', () => {
      draw(null, { shape: 'square' });
      const labels = calls(layer(), 'fillText').map((c) => c.args[0]);
      expect(labels).toContain('20 m');
      expect(labels).not.toContain('0 m');
      // Across 400 px at 188/60 px per metre, every 20 m (10 m would be 31 px apart): -60 to 60.
      const horizontal = calls(layer(), 'moveTo').filter((c) => c.args[0] === 0);
      expect(horizontal).toHaveLength(7);
      // The clip is a rectangle, and there is no round edge.
      expect(calls(layer(), 'arc')).toHaveLength(0);
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

    it('draws a set of points as one path of small squares', () => {
      const xy = new Float32Array([1, 2, 3, 4, 5, 6]);
      draw({ points: [{ label: 'lidar', xy }] });
      const squares = calls(main(), 'rect').filter((c) => c.args[2] === 2);
      expect(squares).toHaveLength(3);
      expect(squares[0].args[0]).toBeCloseTo(200 - 2 * view.ppm - 1);
      expect(squares[0].args[1]).toBeCloseTo(200 - 1 * view.ppm - 1);
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
