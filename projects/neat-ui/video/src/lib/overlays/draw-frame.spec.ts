import { SIMA_PALETTE } from '@sima/neat-ui';
import type { NeatMetadataMessage } from '../sync/metadata-message';
import { OVERLAY_PALETTE } from '../theme/overlay-palette';
import { NeatOverlayColors } from './colors';
import { drawFrame } from './draw-frame';
import {
  colorOfText,
  drawMessages,
  fresh,
  overlaySettings,
  overlayState,
  RecordingContext,
  texts,
  VIEW,
} from './spec-helpers';

const detection: NeatMetadataMessage = {
  type: 'object-detection',
  data: { objects: [{ label: 'person', confidence: 1, bbox: [10, 20, 30, 40] }] },
};

function detectionOf(...labels: string[]): NeatMetadataMessage {
  return {
    type: 'object-detection',
    data: {
      objects: labels.map((label, i) => ({ label, confidence: 0.9, bbox: [i * 100, 10, 50, 50] })),
    },
  };
}

const OVERLAY_TYPES = [
  'object-detection',
  'segmentation',
  'tracking',
  'pose-estimation',
  'classification',
];

describe('drawFrame', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('drawFrame scales the context by dpr and keeps lineWidth in CSS pixels', () => {
    const view = { ...VIEW, cssWidth: 320, cssHeight: 240, dpr: 2 };
    const ctx = drawMessages(overlayState(), overlaySettings(), [detection], { view });

    const [clear] = ctx.ops('clearRect');
    expect(clear.transform, 'the whole backing store is cleared').toStrictEqual([1, 0, 0, 1, 0, 0]);
    expect(clear.args).toStrictEqual([0, 0, 640, 480]);
    const [box] = ctx.ops('strokeRect');
    expect(box.transform).toStrictEqual([2, 0, 0, 2, 0, 0]);
    // The 640×480 video fills the 320×240 CSS box, so video pixels are halved.
    expect(box.args).toStrictEqual([5, 10, 15, 20]);
    expect(box.lineWidth).toBe(3);
    expect(ctx.ops('fillText')[0].font).toMatch(/^14px /);
  });

  it('an unknown message type draws nothing and warns once per channel', () => {
    const settings = overlaySettings();
    for (const channel of [0, 1]) {
      const state = overlayState(channel);
      for (let frame = 0; frame < 3; frame += 1) {
        const ctx = drawMessages(state, settings, [{ type: 'heatmap', data: { cells: [] } }], {
          now: frame * 33,
        });
        expect(ctx.calls.map((call) => call.op)).toStrictEqual(['clearRect']);
      }
    }
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[1][0])).toContain('channel 1');
    expect(String(warn.mock.calls[1][0])).toContain('heatmap');
  });

  it('a strategy that throws does not stop the other types in the same frame', () => {
    const state = overlayState();
    const messages: NeatMetadataMessage[] = [
      { type: 'object-detection', data: { objects: [null] } },
      { type: 'tracking', data: { tracks: [{ id: 1, bbox: [10, 20, 30, 40] }] } },
      { type: 'classification', data: { top_classes: [{ label: 'dog', confidence: 0.9 }] } },
    ];
    for (let frame = 0; frame < 2; frame += 1) {
      const ctx = drawMessages(state, overlaySettings(), messages, { now: frame * 33 });
      expect(ctx.ops('strokeRect').map((call) => call.args)).toStrictEqual([[10, 20, 30, 40]]);
      expect(texts(ctx)).toContain('dog (90%)');
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('object-detection');
  });

  it('restores canvas state even when a strategy throws', () => {
    const state = overlayState();
    const settings = overlaySettings({
      types: {
        'object-detection': {
          objects: [{ label: 'default', color: SIMA_PALETTE.blue, style: 'dashed', width: 1 }],
        },
      },
    });
    // The first object sets a dashed line; the second throws.
    const failingDetection: NeatMetadataMessage = {
      type: 'object-detection',
      data: { objects: [{ label: 'car', confidence: 1, bbox: [10, 20, 30, 40] }, null] },
    };
    // The joint sets a faded alpha and draws its dot; printing its name then throws. No JSON
    // payload can do this, but it is the one throw a pose reaches after setting the alpha.
    const failingPose: NeatMetadataMessage = {
      type: 'pose-estimation',
      data: {
        poses: [
          {
            keypoints: [
              {
                name: {
                  toString() {
                    throw new Error('unprintable name');
                  },
                },
                x: 20,
                y: 20,
                confidence: 0.5,
              },
            ],
          },
        ],
      },
    };
    const poseLabels = overlaySettings({
      types: {
        'object-detection': settings.types['object-detection'],
        'pose-estimation': { showKeypointLabels: true },
      },
    });
    const ctx = new RecordingContext();
    for (let i = 0; i < 3; i += 1) {
      expect(() =>
        drawMessages(state, poseLabels, [failingDetection, failingPose], { ctx }),
      ).not.toThrow();
    }
    expect(warn).toHaveBeenCalledTimes(2);
    expect(ctx.ops('strokeRect')[0].lineDash).toStrictEqual([6, 4]);
    expect(ctx.ops('fill')[0].globalAlpha, 'the joint was drawn faded').toBeLessThan(1);
    expect(ctx.lineDash).toStrictEqual([]);
    expect(ctx.globalAlpha).toBe(1);
  });

  it('skips auxiliary panel messages silently while the other types still draw', () => {
    const state = overlayState();
    const auxiliary: NeatMetadataMessage = {
      type: 'auxiliary-visualization',
      data: { id: 'pose-3d', renderer: 'blazepose-3d', payload: {} },
    };
    for (let frame = 0; frame < 3; frame += 1) {
      const ctx = drawMessages(state, overlaySettings(), [auxiliary, detection], {
        now: frame * 33,
      });
      expect(ctx.calls.map((call) => call.op)).toStrictEqual([
        'clearRect',
        'strokeRect',
        'fillRect',
        'fillText',
      ]);
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps a memory per warning kind, so many dropped segments cannot silence a failure', () => {
    const state = overlayState();
    // Each RLE segment without a bbox is dropped with its own warning, keyed by its id.
    const segments = Array.from({ length: 100 }, (_, id) => ({
      id,
      mask_format: 'rle',
      mask: { size: [2, 2], counts: [4] },
    }));
    drawMessages(state, overlaySettings(), [
      { type: 'segmentation', data: { segments } },
      { type: 'object-detection', data: { objects: [null] } },
      { type: 'heatmap' },
    ]);
    const messages: string[] = warn.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(messages.filter((message) => message.startsWith('segmentation:'))).toHaveLength(64);
    expect(messages.some((message) => message.includes('failed to draw object-detection'))).toBe(
      true,
    );
    expect(messages.some((message) => message.includes('"heatmap"'))).toBe(true);
  });

  it('unknown types cannot invoke inherited properties as drawing strategies', () => {
    const state = overlayState();
    for (const type of ['unknown', '__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      let ctx: RecordingContext | undefined;
      expect(() => (ctx = drawMessages(state, overlaySettings(), [{ type }]))).not.toThrow();
      expect(ctx?.calls.map((call) => call.op)).toStrictEqual(['clearRect']);
    }
  });

  it('never throws on malformed payloads, whatever the type', () => {
    // A throw would escape into the frame callback and stop every later frame's overlays.
    const state = overlayState();
    const payloads: unknown[] = [
      undefined,
      null,
      0,
      'text',
      [],
      {},
      { objects: 'x', segments: 'x', tracks: 'x', poses: 'x', top_classes: 'x' },
      { objects: [null], segments: [null], tracks: [null], poses: [null], top_classes: [null] },
    ];
    for (const type of OVERLAY_TYPES) {
      for (const data of payloads) {
        expect(() => drawMessages(state, overlaySettings(), [{ type, data }])).not.toThrow();
      }
    }
  });

  it('hiding object detection does not hide other types', () => {
    const settings = overlaySettings({
      general: { showRoi: false },
      types: { 'object-detection': { visible: false } },
    });
    const classification: NeatMetadataMessage = {
      type: 'classification',
      data: { top_classes: [{ label: 'dog', confidence: 0.9 }] },
    };
    const ctx = drawMessages(overlayState(), settings, [detection, classification]);
    expect(ctx.ops('strokeRect')).toHaveLength(0);
    expect(texts(ctx)).toStrictEqual(['dog (90%)']);
  });

  it('does not leak detection styles into pose skeletons or the next frame', () => {
    const pose: NeatMetadataMessage = {
      type: 'pose-estimation',
      data: {
        poses: [
          {
            keypoints: [
              { name: 'nose', x: 20, y: 20, confidence: 1 },
              { name: 'left_eye', x: 30, y: 30, confidence: 1 },
            ],
          },
        ],
      },
    };

    for (const [style, dash] of [
      ['dashed', [6, 4]],
      ['dotted', [2, 2]],
    ] as const) {
      const state = overlayState();
      const ctx = new RecordingContext();
      const settings = overlaySettings({
        general: { showRoi: false },
        types: {
          'object-detection': {
            objects: [{ label: 'default', color: SIMA_PALETTE.blue, style, width: 1 }],
          },
        },
      });
      drawMessages(state, settings, [detection, pose], { ctx });
      drawMessages(state, settings, [pose], { ctx, now: 33 });

      // Each pose strokes its skeleton and its box.
      const strokes = ctx.calls
        .filter((call) => call.op === 'stroke' || call.op === 'strokeRect')
        .map((call) => call.lineDash);
      expect(strokes).toStrictEqual([dash, [], [], [], []]);
      expect(ctx.lineDash).toStrictEqual([]);
    }
  });

  it('does not let a malformed pose stop tracking or later frames', () => {
    const state = overlayState(1);
    const ctx = new RecordingContext();
    const malformed: NeatMetadataMessage = {
      type: 'pose-estimation',
      data: { poses: [{ keypoints: {} }] },
    };
    const tracking: NeatMetadataMessage = {
      type: 'tracking',
      data: { tracks: [{ id: 1, bbox: [10, 20, 30, 40] }] },
    };
    const settings = overlaySettings({ general: { showRoi: false } });

    for (let frame = 0; frame < 2; frame += 1) {
      expect(() =>
        drawMessages(state, settings, [malformed, tracking], { ctx, now: frame * 33 }),
      ).not.toThrow();
    }
    expect(ctx.ops('strokeRect')).toHaveLength(2);
  });

  it('draws labels in the kit font, keeping it once read', () => {
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    try {
      const state = overlayState();
      const classification: NeatMetadataMessage = {
        type: 'classification',
        data: { top_classes: [{ label: 'dog', confidence: 0.9 }] },
      };
      const draw = () => {
        const ctx = new RecordingContext(canvas);
        drawFrame(
          ctx.context,
          VIEW,
          [fresh(detection), fresh(classification)],
          state,
          overlaySettings(),
          0,
        );
        return ctx.ops('fillText').map((call) => call.font);
      };

      expect(draw(), 'no token yet: the generic family').toStrictEqual([
        '14px sans-serif',
        '16px sans-serif',
      ]);
      canvas.style.setProperty('--font-sans', 'Inter, sans-serif');
      expect(draw(), 'a failed read is retried').toStrictEqual([
        '14px Inter, sans-serif',
        '16px Inter, sans-serif',
      ]);
      canvas.style.setProperty('--font-sans', 'Changed');
      expect(draw(), 'a successful read is not repeated on later frames').toStrictEqual([
        '14px Inter, sans-serif',
        '16px Inter, sans-serif',
      ]);
    } finally {
      canvas.remove();
    }
  });

  it('draws with the NeatOverlayColors it was given', () => {
    const colors = new NeatOverlayColors();
    const settings = overlaySettings();
    const first = drawMessages(overlayState(0, colors), settings, [detectionOf('car')]);
    const second = drawMessages(overlayState(1, colors), settings, [detectionOf('person', 'car')]);
    expect(colorOfText(second, 'car')).toBe(colorOfText(first, 'car'));
    expect(colorOfText(second, 'person'), 'car already holds the first slot').toBe(
      OVERLAY_PALETTE[1],
    );
  });

  it('uses the global line width for every overlay line unless a class row sets its own', () => {
    // Owner review (O4): boxes, segment outlines, track boxes and trails and pose skeletons
    // share one width; a class row's Thin/Thick still wins for that class.
    const settings = overlaySettings({
      general: { lineWidth: 5 },
      types: {
        'object-detection': {
          objects: [{ label: 'dog', color: SIMA_PALETTE.blue, style: 'solid', width: 1 }],
        },
        tracking: { history: { enabled: true } },
      },
    });
    const widths = (ctx: RecordingContext, op: string) => ctx.ops(op).map((call) => call.lineWidth);
    const state = overlayState();

    const detections = drawMessages(state, settings, [
      {
        type: 'object-detection',
        data: {
          objects: [
            { label: 'cat', confidence: 0.9, bbox: [10, 10, 50, 50] },
            { label: 'dog', confidence: 0.9, bbox: [100, 10, 50, 50] },
          ],
        },
      },
    ]);
    expect(widths(detections, 'strokeRect')).toStrictEqual([5, 1]);

    const segments = drawMessages(state, settings, [
      {
        type: 'segmentation',
        data: {
          segments: [
            {
              id: 1,
              label: 'cat',
              confidence: 0.9,
              mask_format: 'polygon',
              mask: [
                [10, 10],
                [60, 10],
                [60, 60],
              ],
            },
          ],
        },
      },
    ]);
    expect(widths(segments, 'stroke').length).toBeGreaterThan(0);
    widths(segments, 'stroke').forEach((width) => expect(width).toBe(5));

    drawMessages(state, settings, [
      { type: 'tracking', data: { tracks: [{ id: 7, bbox: [10, 10, 50, 50] }] } },
    ]);
    const tracks = drawMessages(
      state,
      settings,
      [{ type: 'tracking', data: { tracks: [{ id: 7, bbox: [30, 10, 50, 50] }] } }],
      { now: 40 },
    );
    expect(widths(tracks, 'strokeRect')).toStrictEqual([5]);
    expect(widths(tracks, 'stroke').length, 'the trail is drawn').toBeGreaterThan(0);
    widths(tracks, 'stroke').forEach((width) => expect(width).toBe(5));

    const poses = drawMessages(state, settings, [
      {
        type: 'pose-estimation',
        data: {
          poses: [
            {
              keypoints: [
                { name: 'nose', x: 30, y: 10, confidence: 0.9 },
                { name: 'left_eye', x: 25, y: 5, confidence: 0.9 },
                { name: 'right_eye', x: 35, y: 5, confidence: 0.9 },
              ],
            },
          ],
        },
      },
    ]);
    expect(widths(poses, 'stroke').length, 'the skeleton is drawn').toBeGreaterThan(0);
    widths(poses, 'stroke').forEach((width) => expect(width).toBe(5));
  });

  it('draws overlays 3 px wide with the default settings', () => {
    const ctx = drawMessages(overlayState(), overlaySettings(), [
      {
        type: 'object-detection',
        data: { objects: [{ label: 'cat', confidence: 0.9, bbox: [10, 10, 50, 50] }] },
      },
    ]);
    expect(ctx.ops('strokeRect').map((call) => call.lineWidth)).toStrictEqual([3]);
  });

  describe('in a mirrored view', () => {
    const mirrored = { ...VIEW, mirror: true };

    it('flips a box across the canvas, extending leftward from its mirrored corner', () => {
      const ctx = drawMessages(overlayState(), overlaySettings(), [detection], { view: mirrored });

      // Video pixels 10..40 of 640 are drawn at 600..630: the corner is at 630, the width -30.
      const [box] = ctx.ops('strokeRect');
      expect(box.args).toStrictEqual([630, 20, -30, 40]);
    });

    it('flips about the picture, not the canvas, when the video is letterboxed', () => {
      const view = { ...VIEW, cssWidth: 800, mirror: true };
      const ctx = drawMessages(overlayState(), overlaySettings(), [detection], { view });

      // The 640 px picture sits at 80..720; video x 10..40 is drawn at 80+600..80+630 flipped
      // within that: 800 - (80 + 10) = 710 for the corner.
      expect(ctx.ops('strokeRect')[0].args).toStrictEqual([710, 20, -30, 40]);
    });

    it('draws text right-aligned at its anchor and unflipped, and leaves other overlays alone', () => {
      const ctx = drawMessages(
        overlayState(),
        overlaySettings(),
        [
          detection,
          { type: 'classification', data: { top_classes: [{ label: 'cat', confidence: 0.5 }] } },
        ],
        { view: mirrored },
      );

      const labels = ctx.ops('fillText');
      expect(labels).toHaveLength(2);
      for (const label of labels) {
        expect(label.textAlign).toBe('right');
        expect(label.transform[0]).toBeGreaterThan(0);
      }
      // The classification list stands in the top-right corner, as the picture's top-left does:
      // its plate ends 8 px from the edge, its text 4 px inside the plate, on the plate's baseline.
      expect(labels[1].args).toStrictEqual(['cat (50%)', 628, 24]);
    });

    it('puts a label plate left of its anchor so it stays over the picture', () => {
      const tracks: NeatMetadataMessage = {
        type: 'tracking',
        data: { tracks: [{ id: 1, label: 'car', bbox: [100, 100, 50, 50] }] },
      };
      const ctx = drawMessages(overlayState(), overlaySettings(), [tracks], { view: mirrored });

      const [plate] = ctx.ops('fillRect');
      const [x, , width] = plate.args as number[];
      // The anchor is the box's mirrored corner at 540; the plate ends there.
      expect(x + width).toBe(540);
      expect(ctx.ops('fillText')[0].args[1]).toBe(540 - 4);
    });

    it('filters by the region of interest in the picture’s own sense', () => {
      const settings = overlaySettings({
        general: { applyRoiFiltering: true },
        roi: [
          {
            type: 'inclusion',
            points: [
              { x: 0, y: 0 },
              { x: 0.25, y: 0 },
              { x: 0.25, y: 1 },
              { x: 0, y: 1 },
            ],
          },
        ],
      });
      const both: NeatMetadataMessage = {
        type: 'object-detection',
        data: {
          objects: [
            { label: 'left', confidence: 1, bbox: [10, 20, 30, 40] },
            { label: 'right', confidence: 1, bbox: [500, 20, 30, 40] },
          ],
        },
      };
      const ctx = drawMessages(overlayState(), settings, [both], { view: mirrored });

      // The polygon and the box centers are mapped alike, so the left object stays, drawn right.
      expect(texts(ctx)).toStrictEqual(['left (100%)']);
      expect(ctx.ops('strokeRect')[0].args[0]).toBe(630);
    });
  });
});
