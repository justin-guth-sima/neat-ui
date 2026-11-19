import { OVERLAY_LABEL_PLATE_COLOR } from '../../theme/overlay-palette';
import {
  colorOfText,
  drawMessages,
  overlaySettings,
  overlayState,
  texts,
  VIEW,
} from '../spec-helpers';

const VIEW_720P = { ...VIEW, cssWidth: 1280, cssHeight: 720, videoWidth: 1280, videoHeight: 720 };

describe('classification overlay', () => {
  it('keeps one color per class across detection, segmentation and classification on a channel', () => {
    const state = overlayState();
    const settings = overlaySettings();
    const draw = (type: string, data: unknown) =>
      drawMessages(state, settings, [{ type, data }], { view: VIEW_720P });

    const detectionCalls = draw('object-detection', {
      objects: [
        { id: 'person-0', label: 'person', confidence: 0.9, bbox: [0, 10, 50, 50] },
        { id: 'car-100', label: 'car', confidence: 0.9, bbox: [100, 10, 50, 50] },
      ],
    });
    const segmentationCalls = draw('segmentation', {
      segments: [
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
        },
        {
          id: 's2',
          label: 'truck',
          confidence: 0.9,
          mask_format: 'polygon',
          mask: [
            [100, 0],
            [140, 0],
            [120, 40],
          ],
        },
      ],
    });
    const classificationCalls = draw('classification', {
      top_classes: [
        { label: 'truck', confidence: 0.8 },
        { label: 'person', confidence: 0.1 },
        { label: 'boat', confidence: 0.05 },
      ],
    });
    expect(colorOfText(segmentationCalls, 'car')).toBe(colorOfText(detectionCalls, 'car'));
    expect(colorOfText(classificationCalls, 'person')).toBe(colorOfText(detectionCalls, 'person'));
    expect(colorOfText(classificationCalls, 'truck')).toBe(colorOfText(segmentationCalls, 'truck'));
    const classificationColors = ['truck', 'person', 'boat'].map((label) =>
      colorOfText(classificationCalls, label),
    );
    expect(new Set(classificationColors).size).toBe(3);
  });
});

describe('the classification list', () => {
  const draw = (topClasses: unknown[], view = VIEW) =>
    drawMessages(
      overlayState(),
      overlaySettings(),
      [{ type: 'classification', data: { top_classes: topClasses } }],
      { view },
    );

  it('shows a class alone when its confidence is missing or not a finite number', () => {
    const ctx = draw([
      { label: 'cat', confidence: 0.87 },
      { label: 'dog' },
      { label: 'fox', confidence: Number.NaN },
    ]);

    expect(texts(ctx)).toEqual(['cat (87%)', 'dog', 'fox']);
  });

  it('puts each class on a label plate, the plates stacked without overlapping', () => {
    const ctx = draw([
      { label: 'cat', confidence: 0.6 },
      { label: 'dog', confidence: 0.3 },
      { label: 'fox', confidence: 0.1 },
    ]);
    const plates = ctx.ops('fillRect');

    expect(plates.map((plate) => plate.fillStyle)).toEqual(
      Array(3).fill(OVERLAY_LABEL_PLATE_COLOR),
    );
    const rows = plates.map(({ args: [, y, , height] }) => [y as number, height as number]);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i][0]).toBeGreaterThanOrEqual(rows[i - 1][0] + rows[i - 1][1]);
    }
    // Each text in its class color on top of its plate, in the larger overlay font.
    expect(ctx.calls.map((call) => call.op).filter((op) => op !== 'clearRect')).toEqual([
      'fillRect',
      'fillText',
      'fillRect',
      'fillText',
      'fillRect',
      'fillText',
    ]);
    expect(ctx.ops('fillText').every((call) => call.font.startsWith('16px'))).toBe(true);
  });

  it('keeps its rows apart on a picture shown small, in the picture’s corner', () => {
    const small = { ...VIEW, cssWidth: 320, cssHeight: 240, videoWidth: 1920, videoHeight: 1080 };
    const ctx = draw(
      [
        { label: 'cat', confidence: 0.6 },
        { label: 'dog', confidence: 0.3 },
      ],
      small,
    );
    const [first, second] = ctx.ops('fillRect').map(({ args }) => args as number[]);
    const pictureTop = (240 - (320 * 1080) / 1920) / 2;

    expect(second[1]).toBeGreaterThanOrEqual(first[1] + first[3]);
    expect(first[0]).toBe(8);
    expect(first[1]).toBe(pictureTop + 8);
  });
});
