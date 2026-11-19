import { SIMA_PALETTE } from '@sima/neat-ui';
import type { NeatMetadataMessage } from '@sima/neat-ui/video';
import { CanvasSource, FRAMES_PER_SECOND, HEIGHT, WIDTH } from './canvas-source';

/** MediaPipe's hand landmarks in snake case, wrist first, then the thumb and the four fingers. */
export const HAND_LANDMARKS: readonly string[] = [
  'wrist',
  ...['thumb', 'index_finger', 'middle_finger', 'ring_finger', 'pinky'].flatMap((finger) =>
    (finger === 'thumb' ? ['cmc', 'mcp', 'ip', 'tip'] : ['mcp', 'pip', 'dip', 'tip']).map(
      (joint) => `${finger}_${joint}`,
    ),
  ),
];

/** COCO's body keypoints as `[name, dx, dy]` from the person's nose, in video pixels. */
const PERSON_POINTS: readonly (readonly [string, number, number])[] = [
  ['nose', 0, 0],
  ['left_eye', -6, -6],
  ['right_eye', 6, -6],
  ['left_ear', -13, -3],
  ['right_ear', 13, -3],
  ['left_shoulder', -28, 30],
  ['right_shoulder', 28, 30],
  ['left_elbow', -40, 70],
  ['right_elbow', 40, 70],
  ['left_wrist', -44, 108],
  ['right_wrist', 44, 108],
  ['left_hip', -20, 100],
  ['right_hip', 20, 100],
  ['left_knee', -22, 150],
  ['right_knee', 22, 150],
  ['left_ankle', -24, 200],
  ['right_ankle', 24, 200],
];

/** Each finger's knuckle on the palm, and the direction it points, in degrees from straight up. */
const FINGERS = [
  { base: [-20, -14], angle: -55, lengths: [16, 14, 12] },
  { base: [-18, -48], angle: -8, lengths: [22, 15, 12] },
  { base: [-3, -52], angle: 0, lengths: [25, 17, 13] },
  { base: [12, -48], angle: 7, lengths: [22, 15, 12] },
  { base: [26, -40], angle: 16, lengths: [17, 12, 10] },
] as const;

/** One MediaPipe hand with its wrist at (x, y); `curl` bends the fingers, 0 straight to 1 fist. */
export function handPose(id: string, x: number, y: number, curl: number): unknown {
  const keypoints = [{ name: 'wrist', x, y, z: 0, confidence: 0.97 }];
  FINGERS.forEach((finger, f) => {
    let [px, py] = [x + finger.base[0], y + finger.base[1]];
    let angle = finger.angle;
    // The thumb starts at its CMC joint on the palm; the other fingers at their MCP knuckle.
    const joints = f === 0 ? ['cmc', 'mcp', 'ip', 'tip'] : ['mcp', 'pip', 'dip', 'tip'];
    const name = ['thumb', 'index_finger', 'middle_finger', 'ring_finger', 'pinky'][f];
    joints.forEach((joint, j) => {
      if (j > 0) {
        angle += curl * 38 * (f === 0 ? 0.5 : 1);
        const rad = (angle * Math.PI) / 180;
        px += Math.sin(rad) * finger.lengths[j - 1];
        py -= Math.cos(rad) * finger.lengths[j - 1];
      }
      keypoints.push({ name: `${name}_${joint}`, x: px, y: py, z: -0.01 * j, confidence: 0.95 });
    });
  });
  return { id, label: 'hand', keypoints };
}

export function personPose(id: string, x: number, y: number): unknown {
  return {
    id,
    label: 'person',
    keypoints: PERSON_POINTS.map(([name, dx, dy]) => ({
      name,
      x: x + dx,
      y: y + dy,
      confidence: 0.9,
    })),
  };
}

/** The pose message for animation frame `frame`: two hands that open and close, and a person. */
export function poseMessage(frame: number): NeatMetadataMessage {
  const t = frame / FRAMES_PER_SECOND;
  const curl = (phase: number) => 0.5 + 0.5 * Math.sin(t * 2 + phase);
  return {
    type: 'pose-estimation',
    data: {
      poses: [
        personPose('1', 470 + 20 * Math.sin(t * 0.7), 70),
        handPose('1', 110, 270 + 8 * Math.sin(t * 1.3), curl(0)),
        handPose('2', 280, 280 + 8 * Math.sin(t * 1.1 + 1), curl(2)),
      ],
    },
  };
}

/** A dark canvas stream with, for each frame, two hands and a person moving over it. */
export class PoseSource extends CanvasSource {
  private frame = 0;

  protected paint(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = SIMA_PALETTE.text;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    this.send(poseMessage(this.frame));
    this.frame += 1;
  }
}
