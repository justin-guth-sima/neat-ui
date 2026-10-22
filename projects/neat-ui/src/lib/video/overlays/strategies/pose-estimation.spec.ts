import type { NeatMetadataMessage } from '../../sync/metadata-message';
import { OVERLAY_NEUTRAL_COLOR } from '../../../theme/overlay-palette';
import type { NeatOverlaySettings } from '../overlay-settings';
import {
  colorOfText,
  drawMessages,
  overlaySettings,
  overlayState,
  RecordingContext,
  texts,
  VIEW,
} from '../spec-helpers';

const VIEW_720P = { ...VIEW, cssWidth: 1280, cssHeight: 720, videoWidth: 1280, videoHeight: 720 };

function pose(id: string | undefined, originX: number, originY: number) {
  const points: Record<string, [number, number]> = {
    nose: [0, 0],
    left_eye: [-5, -5],
    right_eye: [5, -5],
    left_shoulder: [-20, 30],
    right_shoulder: [20, 30],
    left_hip: [-15, 90],
    right_hip: [15, 90],
  };
  return {
    id,
    label: 'person',
    keypoints: Object.entries(points).map(([name, [dx, dy]]) => ({
      name,
      x: originX + dx,
      y: originY + dy,
      confidence: 0.95,
    })),
  };
}

function poses(list: unknown[]): NeatMetadataMessage {
  return { type: 'pose-estimation', data: { poses: list } };
}

function draw(
  state: ReturnType<typeof overlayState>,
  message: NeatMetadataMessage,
  now = 0,
  settings: NeatOverlaySettings = overlaySettings(),
): RecordingContext {
  return drawMessages(state, settings, [message], { now, view: VIEW_720P });
}

// Splits the recorded calls into one group per pose, using the label as the group end.
function poseGroups(ctx: RecordingContext) {
  const groups: { colors: Set<string>; ops: Set<string> }[] = [];
  let current = { colors: new Set<string>(), ops: new Set<string>() };
  for (const call of ctx.calls) {
    if (call.op === 'fillRect' || call.op === 'clearRect') continue; // label plate, frame clear
    current.ops.add(call.op);
    current.colors.add(
      call.op === 'stroke' || call.op === 'strokeRect' ? call.strokeStyle : call.fillStyle,
    );
    if (call.op === 'fillText' && String(call.args[0]).startsWith('person')) {
      groups.push(current);
      current = { colors: new Set(), ops: new Set() };
    }
  }
  return groups;
}

describe('pose estimation overlay', () => {
  it('makes landmark names opt-in while joint markers remain configurable', () => {
    const single = poses([{ keypoints: [{ name: 'nose', x: 20, y: 20, confidence: 1 }] }]);

    const clean = draw(
      overlayState(),
      single,
      0,
      overlaySettings({
        types: { 'pose-estimation': { showKeypoints: true, showKeypointLabels: false } },
      }),
    );
    expect(clean.ops('fill')).toHaveLength(1);
    expect(texts(clean)).toStrictEqual([]);

    const labeled = draw(
      overlayState(),
      single,
      0,
      overlaySettings({
        types: { 'pose-estimation': { showKeypoints: false, showKeypointLabels: true } },
      }),
    );
    expect(labeled.ops('fill')).toHaveLength(0);
    expect(texts(labeled)).toStrictEqual(['nose']);
  });

  it('fades low-confidence links instead of dropping them at the draw threshold', () => {
    const ctx = draw(
      overlayState(),
      poses([
        {
          keypoints: [
            { name: 'left_shoulder', x: 20, y: 20, confidence: 0 },
            { name: 'left_elbow', x: 30, y: 30, confidence: 0 },
          ],
        },
      ]),
    );

    const strokes = ctx.ops('stroke');
    expect(strokes).toHaveLength(1);
    expect(strokes[0].globalAlpha).toBeGreaterThan(0);
    expect(strokes[0].globalAlpha).toBeLessThan(1);
  });

  it('draws nothing when hidden', () => {
    const ctx = draw(
      overlayState(),
      poses([pose('a', 200, 150)]),
      0,
      overlaySettings({ types: { 'pose-estimation': { visible: false } } }),
    );
    expect(ctx.calls.map((call) => call.op)).toStrictEqual(['clearRect']);
  });

  it('colors each person distinctly and draws every part in that color', () => {
    const ctx = draw(
      overlayState(),
      poses([pose('pose_1', 200, 150), pose('pose_2', 600, 150), pose('pose_3', 1000, 150)]),
    );
    const groups = poseGroups(ctx);
    expect(groups).toHaveLength(3);
    groups.forEach((group) => {
      expect(group.colors.size, 'skeleton, keypoints, names, box and label share one color').toBe(
        1,
      );
      ['stroke', 'arc', 'fill', 'strokeRect', 'fillText'].forEach((op) =>
        expect(group.ops.has(op), `missing ${op}`).toBe(true),
      );
    });
    const colors = groups.map((group) => [...group.colors][0]);
    expect(new Set(colors).size).toBe(3);
    expect(colorOfText(ctx, 'person #pose_2')).toBe(colors[1]);
  });

  it("keeps a person's color across frames", () => {
    const state = overlayState();
    const first = draw(state, poses([pose('a', 200, 150), pose('b', 600, 150)]));
    const second = draw(state, poses([pose('b', 610, 150), pose('a', 210, 150)]), 33);
    expect(colorOfText(second, '#a')).toBe(colorOfText(first, '#a'));
    expect(colorOfText(second, '#b')).toBe(colorOfText(first, '#b'));
  });

  it('draws a pose without an id in the neutral color with a plain label', () => {
    const anonymous: Partial<ReturnType<typeof pose>> = pose(undefined, 200, 150);
    delete anonymous.id;
    const ctx = draw(overlayState(), poses([anonymous]));
    const label = ctx.ops('fillText').find((call) => String(call.args[0]).startsWith('person'));
    expect(label?.args[0]).toBe('person');
    expect(label?.fillStyle).toBe(OVERLAY_NEUTRAL_COLOR);
  });

  it('frames the confident keypoints with padding', () => {
    const ctx = draw(overlayState(), poses([pose('p', 200, 150)]));
    const box = ctx.ops('strokeRect')[0];
    expect(box).toBeDefined();
    const [x, y, w, h] = box.args;
    expect(x).toBe(200 - 20 - 8);
    expect(y).toBe(150 - 5 - 8);
    expect(w).toBe(40 + 16);
    expect(h).toBe(95 + 16);
  });
});
