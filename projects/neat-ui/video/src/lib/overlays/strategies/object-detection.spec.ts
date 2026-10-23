import type { NeatMetadataMessage } from '../../sync/metadata-message';
import { NEAT_OVERLAY_STYLE_FALLBACK_COLOR, OVERLAY_PALETTE } from '../../theme/overlay-palette';
import { SIMA_PALETTE } from '@sima/neat-ui';
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
