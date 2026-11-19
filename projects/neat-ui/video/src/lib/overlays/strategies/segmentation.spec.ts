import type { NeatMetadataMessage } from '../../sync/metadata-message';
import { OVERLAY_LABEL_PLATE_COLOR } from '../../theme/overlay-palette';
import { NeatOverlayColors } from '../colors';
import {
  drawMessages,
  overlaySettings,
  overlayState,
  RecordingMaskContext,
  VIEW,
} from '../spec-helpers';

function segmentation(segments: unknown[]): NeatMetadataMessage {
  return { type: 'segmentation', data: { segments } };
}

describe('segmentation overlay', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws segment rectangles only when show_rectangle is boolean true', () => {
    const settings = overlaySettings({ general: { showRoi: false } });
    const box = [10, 20, 30, 40];
    const masks = {
      polygon: {
        mask: [
          [10, 20],
          [40, 20],
          [10, 60],
        ],
      },
      rle: { bbox: box, mask: { size: [4, 3], counts: [0, 6, 6] } },
    };
    const cases: [unknown, unknown[]][] = [
      [undefined, []],
      [true, [box]],
      [false, []],
      ['true', []],
      [1, []],
    ];
    for (const [mask_format, segment] of Object.entries(masks)) {
      for (const [show_rectangle, expected] of cases) {
        const ctx = drawMessages(overlayState(), settings, [
          segmentation([{ ...segment, mask_format, show_rectangle }]),
        ]);
        expect(
          ctx.ops('strokeRect').map((call) => call.args),
          `${mask_format} show_rectangle=${JSON.stringify(show_rectangle)}`,
        ).toStrictEqual(expected);
      }
    }
  });

  it("uses one color for a segment's fill, outline, box and label", () => {
    const view = { ...VIEW, cssWidth: 1280, cssHeight: 720, videoWidth: 1280, videoHeight: 720 };
    const ctx = drawMessages(
      overlayState(),
      overlaySettings(),
      [
        segmentation([
          {
            id: 's1',
            label: 'car',
            confidence: 0.9,
            mask_format: 'polygon',
            mask: [
              [0, 0],
              [40, 0],
              [20, 40],
            ],
            show_rectangle: true,
          },
          {
            id: 's2',
            label: 'person',
            confidence: 0.9,
            mask_format: 'polygon',
            mask: [
              [100, 0],
              [140, 0],
              [120, 40],
            ],
            show_rectangle: true,
          },
        ]),
      ],
      { view },
    );
    const perSegment: { fill: string; outline?: string; box?: string }[] = [];
    let current: (typeof perSegment)[number] | null = null;
    for (const call of ctx.calls) {
      if (call.op === 'fill') {
        current = { fill: call.fillStyle };
        perSegment.push(current);
      } else if (call.op === 'stroke' && current) {
        current.outline = call.strokeStyle;
      } else if (call.op === 'strokeRect' && current) {
        current.box = call.strokeStyle;
      }
    }
    // The labels come after every segment's shapes, in the segments' order.
    const labels = ctx.ops('fillText').map((call) => call.fillStyle);
    expect(perSegment).toHaveLength(2);
    perSegment.forEach((segment, i) => {
      expect(segment.outline).toBe(segment.fill);
      expect(segment.box).toBe(segment.fill);
      expect(labels[i]).toBe(segment.fill);
    });
    expect(perSegment[0].fill).not.toBe(perSegment[1].fill);
  });

  it('stretches a decoded RLE mask over its bbox at the mask opacity', () => {
    const mask = new RecordingMaskContext();
    const state = overlayState(0, new NeatOverlayColors(), mask);
    const settings = overlaySettings({ types: { segmentation: { maskOpacity: 0.5 } } });
    const ctx = drawMessages(state, settings, [
      segmentation([
        {
          id: 1,
          label: 'car',
          mask_format: 'rle',
          bbox: [10, 20, 30, 40],
          mask: { size: [4, 3], counts: [0, 6, 6] },
        },
      ]),
    ]);

    expect(mask.masks.map(({ width, height }) => [width, height])).toStrictEqual([[3, 4]]);
    const alpha = Array.from(mask.masks[0].data.filter((_, i) => i % 4 === 3));
    expect(alpha.filter((value) => value === 255)).toHaveLength(6);
    const [image] = ctx.ops('drawImage');
    expect(image.args).toStrictEqual([mask.canvas, 10, 20, 30, 40]);
    expect(image.globalAlpha).toBe(0.5);
    expect(image.imageSmoothingEnabled).toBe(true);
  });

  it('an RLE mask over 2048×2048 is dropped with one warning per channel and id; boxes still draw', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const oversized = {
      id: 'huge',
      label: 'road',
      mask_format: 'rle',
      bbox: [0, 0, 100, 100],
      mask: { size: [2049, 2048], counts: [0, 10] },
    };
    const polygon = {
      id: 'ok',
      label: 'car',
      mask_format: 'polygon',
      show_rectangle: true,
      bbox: [10, 20, 30, 40],
      mask: [
        [10, 20],
        [40, 20],
        [10, 60],
      ],
    };
    const detection: NeatMetadataMessage = {
      type: 'object-detection',
      data: { objects: [{ label: 'person', confidence: 1, bbox: [200, 200, 20, 20] }] },
    };
    const mask = new RecordingMaskContext();
    for (const channel of [0, 1]) {
      const state = overlayState(channel, new NeatOverlayColors(), mask);
      for (let frame = 0; frame < 3; frame += 1) {
        const ctx = drawMessages(
          state,
          overlaySettings(),
          [segmentation([oversized, polygon]), detection],
          {
            now: frame * 33,
          },
        );
        expect(ctx.ops('strokeRect').map((call) => call.args)).toStrictEqual([
          [10, 20, 30, 40],
          [200, 200, 20, 20],
        ]);
        expect(ctx.ops('drawImage')).toHaveLength(0);
      }
    }
    expect(mask.masks, 'the oversized mask is never decoded').toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0][0])).toContain('"huge"');
    expect(String(warn.mock.calls[1][0])).toContain('channel 1');
  });
});

describe('the segmentation caption', () => {
  it('shows the label alone for a segment without a finite confidence, which still draws', () => {
    const triangle = (x: number) => [
      [x, 0],
      [x + 40, 0],
      [x + 20, 40],
    ];
    const ctx = drawMessages(
      overlayState(),
      overlaySettings({ types: { segmentation: { confidenceThreshold: 0.5 } } }),
      [
        segmentation([
          { label: 'road', confidence: 0.75, mask_format: 'polygon', mask: triangle(0) },
          { label: 'sky', mask_format: 'polygon', mask: triangle(100) },
          { label: 'tree', confidence: Number.NaN, mask_format: 'polygon', mask: triangle(200) },
        ]),
      ],
      { view: VIEW },
    );

    expect(ctx.ops('fillText').map((call) => call.args[0])).toEqual(['road (75%)', 'sky', 'tree']);
  });
});

describe('the segmentation label', () => {
  it('sits on a label plate just above its segment’s box, after every mask', () => {
    const triangle = (x: number) => [
      [x, 100],
      [x + 40, 100],
      [x + 20, 140],
    ];
    const ctx = drawMessages(overlayState(), overlaySettings(), [
      segmentation([
        { label: 'road', confidence: 0.75, mask_format: 'polygon', mask: triangle(100) },
        { label: 'tree', confidence: 0.5, mask_format: 'polygon', mask: triangle(120) },
      ]),
    ]);

    // Both masks first, so the second mask cannot tint the first label.
    expect(ctx.calls.map((call) => call.op).filter((op) => op !== 'clearRect')).toStrictEqual([
      'fill',
      'stroke',
      'fill',
      'stroke',
      'fillRect',
      'fillText',
      'fillRect',
      'fillText',
    ]);
    ctx.ops('fillRect').forEach((plate) => expect(plate.fillStyle).toBe(OVERLAY_LABEL_PLATE_COLOR));
    const masks = ctx.ops('fill');
    ctx.ops('fillText').forEach((label, i) => expect(label.fillStyle).toBe(masks[i].fillStyle));
    // "road (75%)" is 10 characters of 7 px with 4 px either side; its bottom 6 px above the box
    // the polygon's bounds make.
    expect(ctx.ops('fillRect')[0].args).toStrictEqual([100, 100 - 6 - 18, 10 * 7 + 8, 18]);
  });
});
