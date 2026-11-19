import type { NeatMetadataMessage } from '../../sync/metadata-message';
import { OVERLAY_NEUTRAL_COLOR, OVERLAY_PALETTE } from '../../theme/overlay-palette';
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

function track(id: string | undefined, label = 'person', x = 0) {
  return { id, label, confidence: 0.9, bbox: [x, 10, 80, 130] };
}

function tracking(tracks: unknown[]): NeatMetadataMessage {
  return { type: 'tracking', data: { tracks } };
}

function draw(
  state: ReturnType<typeof overlayState>,
  message: NeatMetadataMessage,
  now = 0,
  settings: NeatOverlaySettings = overlaySettings(),
): RecordingContext {
  return drawMessages(state, settings, [message], { now, view: VIEW_720P });
}

describe('tracking overlay', () => {
  it('clears its saved trails when hidden', () => {
    const shown = overlaySettings({ general: { showRoi: false } });
    const hidden = overlaySettings({
      general: { showRoi: false },
      types: { tracking: { visible: false } },
    });
    const at = (x: number) => tracking([{ id: 1, bbox: [x, 20, 30, 40] }]);

    const kept = overlayState();
    draw(kept, at(10), 1, shown);
    expect(
      draw(kept, at(20), 3, shown).ops('stroke'),
      'a trail joins the two positions',
    ).toHaveLength(1);

    const cleared = overlayState();
    draw(cleared, at(10), 1, shown);
    expect(draw(cleared, at(15), 2, hidden).calls.map((call) => call.op)).toStrictEqual([
      'clearRect',
    ]);
    expect(draw(cleared, at(20), 3, shown).ops('stroke'), 'the trail starts afresh').toHaveLength(
      0,
    );
  });

  it('records no trail point for a held frame', () => {
    // A held message repeats an earlier frame; recording it would add a stale trail point.
    const state = overlayState();
    const message = tracking([{ id: 1, bbox: [10, 20, 30, 40] }]);
    draw(state, message, 0);
    const held = drawMessages(state, overlaySettings(), [message], {
      now: 16,
      held: true,
      view: VIEW_720P,
    });
    expect(held.ops('strokeRect'), 'the held box is drawn').toHaveLength(1);
    expect(held.ops('stroke'), 'one recorded point makes no trail yet').toHaveLength(0);
  });

  it('colors by track id, stable across frames, with trails matching boxes', () => {
    const state = overlayState();
    const tracks = [
      track('1', 'person', 0),
      track('2', 'person', 200),
      track('3', 'forklift', 400),
    ];
    let firstColors: string[] | null = null;
    let last: RecordingContext | null = null;
    for (let frame = 0; frame < 5; frame += 1) {
      const moved = tracks.map((entry) => ({
        ...entry,
        bbox: [entry.bbox[0] + frame * 5, 10, 80, 130],
      }));
      last = draw(state, tracking(moved), frame * 33);
      const colors = ['#1', '#2', '#3'].map((needle) =>
        colorOfText(last as RecordingContext, needle),
      );
      expect(new Set(colors).size).toBe(3);
      if (firstColors === null) firstColors = colors;
      else expect(colors).toStrictEqual(firstColors);
    }
    const trails = (last as RecordingContext).ops('stroke');
    expect(trails, 'one trail per track once history exists').toHaveLength(3);
    const boxes = (last as RecordingContext).ops('strokeRect');
    expect(trails.map((call) => call.strokeStyle).sort()).toStrictEqual(
      boxes.map((call) => call.strokeStyle).sort(),
    );
  });

  it('gives the trail and box of a track one color even past the palette size', () => {
    const state = overlayState();
    const count = OVERLAY_PALETTE.length + 1;
    const tracks: ReturnType<typeof track>[] = [];
    for (let i = 0; i < count; i += 1) tracks.push(track(String(i + 1), 'person', i * 20));
    draw(state, tracking(tracks));
    const moved = tracks.map((entry) => ({ ...entry, bbox: [entry.bbox[0] + 5, 10, 80, 130] }));
    const ctx = draw(state, tracking(moved), 33);
    // History entries and visible tracks are both walked in first-seen order.
    const trails = ctx.ops('stroke').map((call) => call.strokeStyle);
    const boxes = ctx.ops('strokeRect').map((call) => call.strokeStyle);
    expect(trails).toHaveLength(count);
    expect(trails).toStrictEqual(boxes);
  });

  it('keeps colors stable across frames', () => {
    const state = overlayState();
    const first = draw(state, tracking([track('1'), track('2', 'person', 200)]));
    const second = draw(state, tracking([track('2', 'person', 210), track('1', 'person', 10)]), 33);
    expect(colorOfText(second, '#1')).toBe(colorOfText(first, '#1'));
    expect(colorOfText(second, '#2')).toBe(colorOfText(first, '#2'));
    expect(colorOfText(first, '#1')).not.toBe(colorOfText(first, '#2'));
  });

  it('draws a track without an id in the neutral color', () => {
    const ctx = draw(
      overlayState(),
      tracking([{ label: 'person', confidence: 0.9, bbox: [0, 10, 80, 130] }]),
    );
    expect(colorOfText(ctx, 'person')).toBe(OVERLAY_NEUTRAL_COLOR);
  });
});

describe('the tracking label', () => {
  it('shows a confidence only when it is a finite number', () => {
    const ctx = draw(
      overlayState(),
      tracking([
        { ...track('1', 'car'), confidence: 0.5 },
        { ...track('2', 'bus', 100), confidence: Number.NaN },
        { ...track('3', 'van', 200), confidence: undefined },
      ]),
    );

    expect(ctx.ops('fillText').map((call) => call.args[0])).toEqual([
      'car #1 (50%)',
      'bus #2',
      'van #3',
    ]);
  });

  it('is drawn after every box, as every box overlay’s label is', () => {
    const ctx = draw(overlayState(), tracking([track('1', 'car'), track('2', 'bus', 40)]));

    expect(ctx.calls.map((call) => call.op).filter((op) => op !== 'clearRect')).toStrictEqual([
      'strokeRect',
      'strokeRect',
      'fillRect',
      'fillText',
      'fillRect',
      'fillText',
    ]);
  });
});
