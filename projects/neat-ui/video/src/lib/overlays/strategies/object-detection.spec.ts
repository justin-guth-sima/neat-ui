import { SIMA_PALETTE } from '@sima/neat-ui';
import type { NeatMetadataMessage } from '../../sync/metadata-message';
import {
  NEAT_OVERLAY_STYLE_FALLBACK_COLOR,
  OVERLAY_LABEL_PLATE_COLOR,
  OVERLAY_PALETTE,
} from '../../theme/overlay-palette';
import type { NeatOverlaySettings } from '../overlay-settings';
import {
  colorOfText,
  drawMessages,
  overlaySettings,
  overlayState,
  RecordingContext,
  VIEW,
} from '../spec-helpers';

const VIEW_720P = { ...VIEW, cssWidth: 1280, cssHeight: 720, videoWidth: 1280, videoHeight: 720 };

function detection(label: string, x = 0) {
  return { id: `${label}-${x}`, label, confidence: 0.9, bbox: [x, 10, 50, 50] };
}

function objects(list: ReturnType<typeof detection>[]): NeatMetadataMessage {
  return { type: 'object-detection', data: { objects: list } };
}

describe('object detection overlay', () => {
  const state = () => overlayState();
  const draw = (
    target: ReturnType<typeof overlayState>,
    message: NeatMetadataMessage,
    now = 0,
    settings: NeatOverlaySettings = overlaySettings(),
  ): RecordingContext => drawMessages(target, settings, [message], { now, view: VIEW_720P });

  it('colors each class distinctly and stably across frames', () => {
    const target = state();
    const list = [
      detection('car', 0),
      detection('person', 100),
      detection('bicycle', 200),
      detection('dog', 300),
    ];
    const frame1 = draw(target, objects(list));
    const frame2 = draw(target, objects([...list].reverse()), 16);
    const labels = ['car', 'person', 'bicycle', 'dog'];
    const colors1 = labels.map((label) => colorOfText(frame1, label));
    const colors2 = labels.map((label) => colorOfText(frame2, label));
    expect(new Set(colors1).size).toBe(4);
    expect(colors2).toStrictEqual(colors1);
    colors1.forEach((color) => expect(OVERLAY_PALETTE).toContain(color));
    expect(colors1).not.toContain(NEAT_OVERLAY_STYLE_FALLBACK_COLOR);
  });

  it('draws the box and label of one object in the same color', () => {
    const ctx = draw(state(), objects([detection('car'), detection('person', 100)]));
    const boxes = ctx.ops('strokeRect');
    const labels = ctx.ops('fillText');
    expect(boxes).toHaveLength(2);
    expect(labels).toHaveLength(2);
    expect(boxes[0].strokeStyle).toBe(labels[0].fillStyle);
    expect(boxes[1].strokeStyle).toBe(labels[1].fillStyle);
    expect(boxes[0].strokeStyle).not.toBe(boxes[1].strokeStyle);
  });

  it('honors per-label and default overrides', () => {
    const settings = overlaySettings({
      types: {
        'object-detection': {
          confidenceThreshold: 0,
          objects: [
            { label: 'person', color: SIMA_PALETTE.orange, style: 'dashed', width: 3 },
            { label: 'default', color: SIMA_PALETTE.blue, style: 'solid', width: 1 },
          ],
        },
      },
    });
    const ctx = draw(state(), objects([detection('person'), detection('car', 100)]), 0, settings);
    expect(colorOfText(ctx, 'person')).toBe(SIMA_PALETTE.orange);
    expect(colorOfText(ctx, 'car')).toBe(SIMA_PALETTE.blue);
  });

  it('keeps the identities on screen distinct when the palette is reused', () => {
    const target = state();
    const size = OVERLAY_PALETTE.length;
    const list: ReturnType<typeof detection>[] = [];
    for (let i = 0; i < size + 5; i += 1) list.push(detection(`class${i}`, i * 10));
    draw(target, objects(list));
    const lastFrame = draw(target, objects(list.slice(5)), 16);
    // "class1 (" avoids matching "class10".
    const colors = list.slice(5).map((entry) => colorOfText(lastFrame, `${entry.label} (`));
    expect(new Set(colors).size).toBe(size);
    expect(new Set(colors).size).toBe(new Set(OVERLAY_PALETTE).size);
  });
});

describe('the object detection caption', () => {
  it('shows the label alone for an object without a finite confidence', () => {
    const ctx = drawMessages(overlayState(), overlaySettings(), [
      {
        type: 'object-detection',
        data: {
          objects: [
            { label: 'car', confidence: 0.42, bbox: [0, 10, 50, 50] },
            { label: 'bus', bbox: [100, 10, 50, 50] },
            { label: 'van', confidence: Number.NaN, bbox: [200, 10, 50, 50] },
          ],
        },
      },
    ]);

    expect(ctx.ops('fillText').map((call) => call.args[0])).toEqual(['car (42%)', 'bus', 'van']);
  });
});

describe('the object detection label', () => {
  const draw = (list: unknown[], view = VIEW): RecordingContext =>
    drawMessages(
      overlayState(),
      overlaySettings(),
      [{ type: 'object-detection', data: { objects: list } }],
      { view },
    );
  /** A plate's rectangle, `[x, y, width, height]`. */
  const plates = (ctx: RecordingContext) =>
    ctx.ops('fillRect').map((call) => call.args as number[]);

  it('sits on a label plate just above its box, after every box', () => {
    const ctx = draw([
      { label: 'car', confidence: 0.5, bbox: [100, 100, 50, 50] },
      { label: 'bus', confidence: 0.5, bbox: [120, 120, 50, 50] },
    ]);

    // Both boxes first, so the second box's line cannot cross the first label.
    expect(ctx.calls.map((call) => call.op).filter((op) => op !== 'clearRect')).toStrictEqual([
      'strokeRect',
      'strokeRect',
      'fillRect',
      'fillText',
      'fillRect',
      'fillText',
    ]);
    ctx.ops('fillRect').forEach((plate) => expect(plate.fillStyle).toBe(OVERLAY_LABEL_PLATE_COLOR));
    const boxes = ctx.ops('strokeRect');
    ctx.ops('fillText').forEach((label, i) => expect(label.fillStyle).toBe(boxes[i].strokeStyle));
    // "car (50%)" is 9 characters of 7 px with 4 px either side; its bottom 6 px above the box.
    expect(plates(ctx)[0]).toStrictEqual([100, 100 - 6 - 18, 9 * 7 + 8, 18]);
  });

  it('stays whole for a box at the picture’s top and right edges', () => {
    const ctx = draw([{ label: 'motorcycle', confidence: 0.66, bbox: [610, 0, 30, 60] }]);

    // "motorcycle (66%)" is 120 px wide: it moves left to end 2 px inside the right edge, and down
    // to start 2 px below the top, over the box.
    expect(plates(ctx)).toStrictEqual([[640 - 2 - 120, 2, 120, 18]]);
    expect(ctx.ops('fillText')[0].args).toStrictEqual(['motorcycle (66%)', 640 - 2 - 120 + 4, 17]);
  });

  it('stays whole in a mirrored view for a box the mirror puts at the left edge', () => {
    const ctx = draw([{ label: 'motorcycle', confidence: 0.66, bbox: [610, 100, 30, 60] }], {
      ...VIEW,
      mirror: true,
    });

    expect(plates(ctx)).toStrictEqual([[2, 100 - 6 - 18, 120, 18]]);
    // Right-aligned text ends 4 px inside its plate.
    expect(ctx.ops('fillText')[0].args[1]).toBe(2 + 120 - 4);
  });
});

describe('the object detection overlay with oriented boxes', () => {
  const SHIP = {
    label: 'ship',
    confidence: 0.91,
    bbox: [558, 300, 164, 121],
    oriented_bbox: [640, 360, 160, 50, 0.5],
  };
  const VIEW_720P = {
    ...VIEW,
    cssWidth: 1280,
    cssHeight: 720,
    videoWidth: 1280,
    videoHeight: 720,
  };
  const draw = (list: unknown[], view = VIEW_720P, settings = overlaySettings()) =>
    drawMessages(
      overlayState(),
      settings,
      [{ type: 'object-detection', data: { objects: list } }],
      { view },
    );
  const plates = (ctx: RecordingContext) =>
    ctx.ops('fillRect').map((call) => call.args as number[]);

  function corners(cx: number, cy: number, w: number, h: number, angle: number) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ].map(([dx, dy]) => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]);
  }

  it('strokes the upstream ship as one closed path through the rotated corners', () => {
    const ctx = draw([SHIP]);

    expect(ctx.ops('strokeRect')).toHaveLength(0);
    expect(ctx.ops('stroke')).toHaveLength(1);
    const expected = corners(640, 360, 160, 50, 0.5);
    ctx.path.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(expected[i][0], 6);
      expect(y).toBeCloseTo(expected[i][1], 6);
    });
    expect(ctx.path).toHaveLength(4);
    // A positive angle turns the box clockwise on screen: the first corner (top-left) moves up
    // and right of where an upright box has it, the second one down.
    expect(ctx.path[1][1]).toBeGreaterThan(ctx.path[0][1]);
  });

  it('turns a 100 by 40 box a quarter turn clockwise about (200, 100), corners written out', () => {
    const ctx = draw([
      { label: 'ship', bbox: [180, 50, 40, 100], oriented_bbox: [200, 100, 100, 40, Math.PI / 2] },
    ]);

    const expected = [
      [220, 50],
      [220, 150],
      [180, 150],
      [180, 50],
    ];
    expect(ctx.path).toHaveLength(4);
    ctx.path.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(expected[i][0], 9);
      expect(y).toBeCloseTo(expected[i][1], 9);
    });
  });

  it('maps the corners through the letterbox, scale and offsets each on its own axis', () => {
    // A 1280 by 720 frame on a 640 by 480 canvas: scale 0.5, bars 60 px above and below.
    const view = { ...VIEW, videoWidth: 1280, videoHeight: 720 };
    const ctx = draw(
      [
        {
          label: 'ship',
          bbox: [180, 50, 40, 100],
          oriented_bbox: [200, 100, 100, 40, Math.PI / 2],
        },
      ],
      view,
    );

    const expected = [
      [110, 85],
      [110, 135],
      [90, 135],
      [90, 85],
    ];
    ctx.path.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(expected[i][0], 9);
      expect(y).toBeCloseTo(expected[i][1], 9);
    });
    // The topmost corners are the first and the last, at the same height: the left one labels.
    expect(plates(ctx)[0].slice(0, 2)).toStrictEqual([90, 85 - 6 - 18]);
  });

  it.each([
    ['four numbers', [1, 2, 3, 4]],
    ['a NaN', [640, 360, 160, 50, Number.NaN]],
    ['a string', 'x'],
    ['null', null],
  ])('draws the upright bbox for an oriented_bbox of %s', (_, oriented) => {
    const ctx = draw([{ ...SHIP, oriented_bbox: oriented }]);

    expect(ctx.ops('strokeRect').map((call) => call.args)).toStrictEqual([[558, 300, 164, 121]]);
    expect(ctx.ops('stroke')).toHaveLength(0);
  });

  it('labels at the topmost corner, upright, its plate above the corner', () => {
    const ctx = draw([SHIP]);

    const top = corners(640, 360, 160, 50, 0.5).reduce((a, b) => (b[1] < a[1] ? b : a));
    // "ship (91%)" is 10 characters: 78 px wide.
    expect(plates(ctx)).toStrictEqual([[top[0], top[1] - 6 - 18, 78, 18]]);
  });

  it('labels a box at angle 0 where an upright box with that extent is labeled', () => {
    const upright = draw([{ label: 'ship', confidence: 0.91, bbox: [560, 335, 160, 50] }]);
    const turned = draw([
      {
        label: 'ship',
        confidence: 0.91,
        bbox: [560, 335, 160, 50],
        oriented_bbox: [640, 360, 160, 50, 0],
      },
    ]);

    expect(plates(turned)).toStrictEqual(plates(upright));
    expect(turned.ops('fillText')[0].args).toStrictEqual(upright.ops('fillText')[0].args);
  });

  it('labels a mirrored box at the same frame corner, the plate ending at it', () => {
    const mirrored = { ...VIEW_720P, mirror: true };
    const ctx = draw([SHIP], mirrored);
    const top = corners(640, 360, 160, 50, 0.5).reduce((a, b) => (b[1] < a[1] ? b : a));

    // The mirror maps frame x to 1280 - x; the plate ends at that point.
    expect(plates(ctx)).toStrictEqual([[1280 - top[0] - 78, top[1] - 6 - 18, 78, 18]]);

    const flat = draw(
      [{ label: 'ship', bbox: [560, 335, 160, 50], oriented_bbox: [640, 360, 160, 50, 0] }],
      mirrored,
    );
    const upright = draw([{ label: 'ship', bbox: [560, 335, 160, 50] }], mirrored);
    expect(plates(flat)).toStrictEqual(plates(upright));
  });

  it('keeps reading bbox for the region filter', () => {
    // The region is the picture's top-left quarter: the bbox lies outside it, the rotated box in it.
    const settings = overlaySettings({
      general: { applyRoiFiltering: true, showRoi: false },
      roi: [
        {
          type: 'inclusion',
          points: [
            { x: 0, y: 0 },
            { x: 0.5, y: 0 },
            { x: 0.5, y: 0.5 },
            { x: 0, y: 0.5 },
          ],
        },
      ],
    });
    const outside = { ...SHIP, bbox: [900, 500, 100, 100], oriented_bbox: [100, 100, 80, 40, 0.3] };
    const inside = { ...SHIP, bbox: [50, 50, 100, 100], oriented_bbox: [900, 500, 80, 40, 0.3] };

    const ctx = draw([outside, inside], VIEW_720P, settings);

    // Only the second, whose bbox is in the region, is drawn, as its rotated box.
    expect(ctx.ops('stroke')).toHaveLength(1);
    expect(ctx.ops('fillText')).toHaveLength(1);
    expect(ctx.path[0][0]).toBeGreaterThan(800);
  });
});
