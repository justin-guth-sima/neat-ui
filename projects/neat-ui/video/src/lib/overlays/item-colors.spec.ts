import { computed } from '@angular/core';
import { SIMA_PALETTE } from '@sima/neat-ui';
import type { NeatMetadataMessage } from '../sync/metadata-message';
import { OVERLAY_NEUTRAL_COLOR } from '../theme/overlay-palette';
import { NeatOverlayColors } from './colors';
import { overlayColor, resetOverlayState } from './draw-frame';
import type { NeatOverlayIdentity, NeatOverlayType } from './item-colors';
import type { NeatOverlayClassStyle } from './overlay-settings';
import { colorOfText, drawMessages, overlaySettings, overlayState } from './spec-helpers';

function row(label: string, color: string): NeatOverlayClassStyle {
  return { label, color, style: 'solid', width: 3 };
}

const TRUCK = SIMA_PALETTE.orange;
const PERSON = SIMA_PALETTE.blue;

/** A truck row for the detections and a person row for the poses; no box filtering. */
const SETTINGS = overlaySettings({
  general: { showRoi: false, applyRoiFiltering: false },
  types: {
    'object-detection': { objects: [row('truck', TRUCK)] },
    'pose-estimation': { objects: [row('person', PERSON)] },
  },
});

function pose(id: string, label: string, x: number) {
  return {
    id,
    label,
    keypoints: [
      { name: 'wrist', x, y: 100, confidence: 0.9 },
      { name: 'thumb_tip', x: x + 30, y: 60, confidence: 0.9 },
    ],
  };
}

/** One message of each type, each item captioned so its drawn color can be found. */
const MESSAGES: NeatMetadataMessage[] = [
  {
    type: 'object-detection',
    data: {
      objects: [
        { label: 'car', confidence: 0.9, bbox: [10, 10, 50, 40] },
        { label: 'truck', confidence: 0.9, bbox: [100, 10, 50, 40] },
      ],
    },
  },
  {
    type: 'segmentation',
    data: {
      segments: [
        {
          id: 's1',
          label: 'road',
          confidence: 0.8,
          mask_format: 'polygon',
          mask: [
            [10, 300],
            [200, 300],
            [10, 400],
          ],
        },
      ],
    },
  },
  { type: 'classification', data: { top_classes: [{ label: 'cat', confidence: 0.7 }] } },
  {
    type: 'tracking',
    data: {
      tracks: [
        { id: 7, label: 'bike', confidence: 0.9, bbox: [300, 10, 50, 40] },
        { label: 'ghost', confidence: 0.9, bbox: [400, 10, 50, 40] },
      ],
    },
  },
  { type: 'pose-estimation', data: { poses: [pose('1', 'hand', 300), pose('2', 'person', 450)] } },
];

describe('the overlay color of an item', () => {
  it('is the color the overlay drew it in, for each type', () => {
    const state = overlayState();
    const ctx = drawMessages(state, SETTINGS, MESSAGES);
    const colorOf = (type: NeatOverlayType, item: NeatOverlayIdentity) =>
      overlayColor(state, SETTINGS, type, item);

    expect(colorOf('object-detection', { label: 'car' })).toBe(colorOfText(ctx, 'car ('));
    expect(colorOf('object-detection', { label: 'truck' })).toBe(colorOfText(ctx, 'truck ('));
    expect(colorOf('segmentation', { label: 'road' })).toBe(colorOfText(ctx, 'road ('));
    expect(colorOf('classification', { label: 'cat' })).toBe(colorOfText(ctx, 'cat ('));
    expect(colorOf('tracking', { id: 7 })).toBe(colorOfText(ctx, 'bike #7'));
    expect(colorOf('tracking', { id: '7' }), 'numeric and string ids are one track').toBe(
      colorOfText(ctx, 'bike #7'),
    );
    expect(colorOf('tracking', { label: 'ghost' })).toBe(colorOfText(ctx, 'ghost'));
    expect(colorOf('pose-estimation', { id: '1', label: 'hand' })).toBe(
      colorOfText(ctx, 'hand #1'),
    );
    expect(colorOf('pose-estimation', { id: '2', label: 'person' })).toBe(
      colorOfText(ctx, 'person #2'),
    );
  });

  it('is a style row’s color at once, the neutral color without an identity, else null until drawn', () => {
    const state = overlayState();
    expect(overlayColor(state, SETTINGS, 'object-detection', { label: 'truck' })).toBe(TRUCK);
    expect(overlayColor(state, SETTINGS, 'pose-estimation', { id: '9', label: 'person' })).toBe(
      PERSON,
    );
    expect(overlayColor(state, SETTINGS, 'tracking', {})).toBe(OVERLAY_NEUTRAL_COLOR);
    expect(overlayColor(state, SETTINGS, 'object-detection', { label: 'car' })).toBeNull();
    expect(overlayColor(state, SETTINGS, 'tracking', { id: 7 })).toBeNull();
    expect(overlayColor(state, SETTINGS, 'pose-estimation', { id: '1', label: 'hand' })).toBeNull();
  });

  it('goes by the settings it is given: a row of one type is not another’s', () => {
    const state = overlayState();
    drawMessages(state, SETTINGS, MESSAGES);
    const car = overlayColor(state, SETTINGS, 'object-detection', { label: 'car' });
    expect(overlayColor(state, SETTINGS, 'segmentation', { label: 'truck' })).not.toBe(TRUCK);
    const recolored = overlaySettings({
      types: { 'object-detection': { objects: [row('default', TRUCK)] } },
    });
    expect(overlayColor(state, recolored, 'object-detection', { label: 'car' })).toBe(TRUCK);
    expect(overlayColor(state, SETTINGS, 'object-detection', { label: 'car' })).toBe(car);
  });

  it('shares classes with every tile of the page, and keeps tracks to the tile', () => {
    const colors = new NeatOverlayColors();
    const first = overlayState(0, colors);
    const second = overlayState(1, colors);
    drawMessages(first, SETTINGS, MESSAGES);

    const car = overlayColor(first, SETTINGS, 'object-detection', { label: 'car' });
    expect(overlayColor(second, SETTINGS, 'object-detection', { label: 'car' })).toBe(car);
    expect(overlayColor(second, SETTINGS, 'tracking', { id: 7 })).toBeNull();

    resetOverlayState(first);
    expect(overlayColor(first, SETTINGS, 'tracking', { id: 7 }), 'a stopped stream').toBeNull();
    expect(overlayColor(first, SETTINGS, 'object-detection', { label: 'car' })).toBe(car);
  });

  it('follows as a signal: a computed that reads it updates once the overlay draws', () => {
    const state = overlayState();
    const track = computed(() => overlayColor(state, SETTINGS, 'tracking', { id: 7 }));
    const car = computed(() => overlayColor(state, SETTINGS, 'object-detection', { label: 'car' }));
    expect(track()).toBeNull();
    expect(car()).toBeNull();

    const ctx = drawMessages(state, SETTINGS, MESSAGES);
    expect(track()).toBe(colorOfText(ctx, 'bike #7'));
    expect(car()).toBe(colorOfText(ctx, 'car ('));

    resetOverlayState(state);
    expect(track()).toBeNull();
  });
});
