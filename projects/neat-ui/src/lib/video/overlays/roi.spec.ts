import type { NeatMetadataMessage } from '../sync/metadata-message';
import { OVERLAY_ROI_COLORS } from '../../theme/overlay-palette';
import type { NeatRoiPolygon } from './overlay-settings';
import {
  drawMessages,
  overlaySettings,
  overlayState,
  RecordingContext,
  texts,
} from './spec-helpers';

const INCLUSION_FILL = OVERLAY_ROI_COLORS.inclusion.fill;

function roiFills(ctx: RecordingContext): number {
  return ctx.ops('fill').filter((call) => call.fillStyle === INCLUSION_FILL).length;
}

const triangle: NeatRoiPolygon[] = [
  {
    type: 'inclusion',
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
  },
];

describe('ROI', () => {
  it('is drawn independently of per-type overlay visibility', () => {
    const detection: NeatMetadataMessage = {
      type: 'object-detection',
      data: { objects: [{ bbox: [10, 20, 30, 40], label: 'person', confidence: 1 }] },
    };
    const hiddenDetection = { 'object-detection': { visible: false } };

    const shown = drawMessages(
      overlayState(),
      overlaySettings({ general: { showRoi: true }, types: hiddenDetection, roi: triangle }),
      [detection],
    );
    expect(roiFills(shown)).toBe(1);
    expect(shown.ops('strokeRect')).toHaveLength(0);

    const hidden = drawMessages(
      overlayState(),
      overlaySettings({ general: { showRoi: false }, types: hiddenDetection, roi: triangle }),
      [detection],
    );
    expect(
      hidden.calls.map((call) => call.op),
      'nothing but the clear',
    ).toStrictEqual(['clearRect']);

    const hiddenClassification = drawMessages(
      overlayState(),
      overlaySettings({
        general: { showRoi: true },
        types: { classification: { visible: false } },
        roi: triangle,
      }),
      [{ type: 'classification', data: { top_classes: [{ label: 'person', confidence: 1 }] } }],
    );
    expect(texts(hiddenClassification)).toStrictEqual([]);
    expect(roiFills(hiddenClassification), 'classification does not draw the ROI').toBe(0);
  });

  it('is drawn once in any metadata order, and filtering still applies', () => {
    const square: NeatRoiPolygon[] = [
      {
        type: 'inclusion',
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 0, y: 0.5 },
        ],
      },
    ];
    const boxes = [
      [10, 20, 30, 40],
      [500, 300, 30, 40],
    ];
    const messages: NeatMetadataMessage[] = [
      {
        type: 'object-detection',
        data: { objects: boxes.map((bbox) => ({ bbox, label: 'person', confidence: 1 })) },
      },
      {
        type: 'segmentation',
        data: {
          segments: boxes.map((bbox) => ({
            bbox,
            mask_format: 'polygon',
            show_rectangle: true,
            mask: [
              [10, 20],
              [40, 20],
              [10, 60],
            ],
          })),
        },
      },
      { type: 'tracking', data: { tracks: boxes.map((bbox, id) => ({ bbox, id })) } },
    ];
    const settings = overlaySettings({ general: { showRoi: true }, roi: square });
    const state = overlayState();
    const orders = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ];
    orders.forEach((order, frame) => {
      const ctx = drawMessages(
        state,
        settings,
        order.map((index) => messages[index]),
        { now: frame * 33 },
      );
      expect(roiFills(ctx)).toBe(1);
      // The second box's centre lies outside the inclusion square in every type.
      expect(ctx.ops('strokeRect')).toHaveLength(3);
    });
  });

  it('is not suppressed by pose metadata first in the frame or by a frame that hides it', () => {
    const state = overlayState();
    const pose: NeatMetadataMessage = { type: 'pose-estimation', data: { poses: [] } };
    const detection: NeatMetadataMessage = { type: 'object-detection', data: { objects: [] } };
    const fills = [false, true, true].map((showRoi, frame) =>
      roiFills(
        drawMessages(
          state,
          overlaySettings({ general: { showRoi }, roi: triangle }),
          [pose, detection],
          {
            now: frame * 33,
          },
        ),
      ),
    );
    expect(fills).toStrictEqual([0, 1, 1]);
  });
});
