import type { NeatMetadataMessage } from '../../sync/metadata-message';
import { OVERLAY_NEUTRAL_COLOR } from '../../theme/overlay-palette';
import { NEAT_OVERLAY_DEFAULTS, type NeatOverlaySettings } from '../overlay-settings';
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

const HAND_NAMES = [
  'wrist',
  ...['thumb', 'index_finger', 'middle_finger', 'ring_finger', 'pinky'].flatMap((finger) =>
    (finger === 'thumb' ? ['cmc', 'mcp', 'ip', 'tip'] : ['mcp', 'pip', 'dip', 'tip']).map(
      (joint) => `${finger}_${joint}`,
    ),
  ),
];

/** A MediaPipe hand: 21 landmarks along a diagonal, each with the extra `z` the model reports. */
function hand(id: string | undefined, originX: number, originY: number) {
  return {
    id,
    label: 'hand',
    keypoints: HAND_NAMES.map((name, i) => ({
      name,
      x: originX + i * 4,
      y: originY + i * 3,
      z: -0.02 * i,
      confidence: 0.9,
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

/**
 * The drawing calls by the color they draw in, each with its operations. The labels come after
 * every pose's shapes, so the calls are grouped by color rather than by their order.
 */
function poseGroups(ctx: RecordingContext): Set<string>[] {
  const groups = new Map<string, Set<string>>();
  for (const call of ctx.calls) {
    if (call.op === 'fillRect' || call.op === 'clearRect') continue; // label plate, frame clear
    const color =
      call.op === 'stroke' || call.op === 'strokeRect' ? call.strokeStyle : call.fillStyle;
    groups.set(color, (groups.get(color) ?? new Set()).add(call.op));
  }
  return [...groups.values()];
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
    // Three colors, each drawing a whole pose: no part of one pose is in another's color.
    const groups = poseGroups(ctx);
    expect(groups).toHaveLength(3);
    groups.forEach((ops) => {
      ['stroke', 'arc', 'fill', 'strokeRect', 'fillText'].forEach((op) =>
        expect(ops.has(op), `missing ${op}`).toBe(true),
      );
    });
    expect(colorOfText(ctx, 'person #pose_2')).toBe(ctx.ops('strokeRect')[1].strokeStyle);
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

  it('puts a joint name above its joint on screen when flipped', () => {
    const single = poses([{ keypoints: [{ name: 'nose', x: 20, y: 20, confidence: 1 }] }]);
    const settings = overlaySettings({
      types: { 'pose-estimation': { showKeypointLabels: true } },
    });
    const at = (flipVertical: boolean) =>
      drawMessages(overlayState(), settings, [single], {
        view: { ...VIEW_720P, flipVertical },
      }).ops('fillText')[0].args;

    expect(at(false)).toStrictEqual(['nose', 24, 16]);
    // The joint is drawn at 720 - 20 = 700; its name stands 4 px above it, not below.
    expect(at(true)).toStrictEqual(['nose', 24, 700 - 4]);
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

  describe('hands and per-label styles', () => {
    it("draws a hand's 21 links", () => {
      const ctx = draw(overlayState(), poses([hand('h', 100, 100)]));
      expect(ctx.ops('stroke')).toHaveLength(21);
    });

    it('draws a hand and a person in one message', () => {
      const ctx = draw(overlayState(), poses([hand('h', 100, 100), pose('p', 400, 150)]));
      // The person here has 7 named points: nose-eyes, nose-shoulders, shoulders-hips, hips.
      expect(ctx.ops('stroke')).toHaveLength(21 + 7);
      expect(ctx.ops('arc')).toHaveLength(21 + 7);
    });

    it('joins no link to an unnamed keypoint but still draws its joint', () => {
      const ctx = draw(
        overlayState(),
        poses([
          {
            label: 'hand',
            keypoints: [
              { name: 'wrist', x: 10, y: 10, confidence: 1 },
              { x: 20, y: 20, confidence: 1 },
              { name: 'thumb_cmc', x: 30, y: 30, confidence: 1 },
            ],
          },
        ]),
      );
      expect(ctx.ops('stroke')).toHaveLength(1);
      expect(ctx.ops('arc')).toHaveLength(3);
    });

    it('styles a pose by its label', () => {
      const person: NeatOverlaySettings['types']['pose-estimation']['objects'] = [
        { label: 'person', color: '#888888', style: 'solid', width: 1 },
      ];
      const ctx = draw(
        overlayState(),
        poses([hand('h', 100, 100), pose('p', 400, 150)]),
        0,
        overlaySettings({ types: { 'pose-estimation': { objects: person } } }),
      );
      const strokes = ctx.ops('stroke');
      const gray = strokes.filter((call) => call.strokeStyle === '#888888');
      expect(gray).toHaveLength(7);
      gray.forEach((call) => expect(call.lineWidth).toBe(1));
      const handStrokes = strokes.filter((call) => call.strokeStyle !== '#888888');
      expect(handStrokes).toHaveLength(21);
      handStrokes.forEach((call) => expect(call.lineWidth).not.toBe(1));
      expect(colorOfText(ctx, 'person #p')).toBe('#888888');
    });

    it('leaves boxes out when showBoxes is off', () => {
      const ctx = draw(
        overlayState(),
        poses([pose('p', 200, 150)]),
        0,
        overlaySettings({ types: { 'pose-estimation': { showBoxes: false } } }),
      );
      expect(ctx.ops('strokeRect')).toHaveLength(0);
      expect(texts(ctx)).toStrictEqual([]);
      expect(ctx.ops('stroke')).toHaveLength(7);
    });

    it('draws a COCO pose with boxes and no label rows by default', () => {
      const defaults = NEAT_OVERLAY_DEFAULTS.types['pose-estimation'];
      expect(defaults.showBoxes).toBe(true);
      expect(defaults.objects).toStrictEqual([]);
      const ctx = draw(overlayState(), poses([pose('p', 200, 150)]), 0, NEAT_OVERLAY_DEFAULTS);
      expect(ctx.ops('strokeRect')).toHaveLength(1);
      expect(texts(ctx)).toStrictEqual(['person #p']);
    });
  });
});
