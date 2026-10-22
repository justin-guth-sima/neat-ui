import { colorOfText, drawMessages, overlaySettings, overlayState, VIEW } from '../spec-helpers';

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
