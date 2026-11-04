import { signal } from '@angular/core';
import { SIMA_PALETTE } from '@sima/neat-ui';
import type { NeatMetadataMessage, NeatTileSource } from '@sima/neat-ui/video';

const WIDTH = 640;
const HEIGHT = 360;
const FRAMES_PER_SECOND = 30;

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

/**
 * A `NeatTileSource` for the showcase: a dark canvas stream and, for each frame, a
 * `pose-estimation` message with two hands and a person moving over it. As in the test pattern
 * source, the canvas stream carries no RTP timestamps, so the tile matches metadata by arrival.
 */
export class PoseSource implements NeatTileSource {
  readonly stream = signal<MediaStream | null>(null);

  private readonly listeners = new Set<(text: string, receivedAt: number) => void>();
  private context: CanvasRenderingContext2D | null = null;
  private animation = 0;
  private lastPaintAt = 0;
  private frame = 0;

  onMetadata(listener: (text: string, receivedAt: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Starts the stream; does nothing where canvases cannot be streamed (as in unit tests). */
  start(document: Document): void {
    const canvas = document.createElement('canvas');
    if (typeof canvas.captureStream !== 'function') return;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.context = canvas.getContext('2d');
    if (this.context === null) return;
    this.stream.set(canvas.captureStream(FRAMES_PER_SECOND));
    const loop = (now: number) => {
      this.animation = requestAnimationFrame(loop);
      if (now - this.lastPaintAt < 1000 / FRAMES_PER_SECOND) return;
      this.lastPaintAt = now;
      this.paint();
    };
    this.animation = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.animation);
    for (const track of this.stream()?.getTracks() ?? []) track.stop();
    this.stream.set(null);
    this.listeners.clear();
  }

  private paint(): void {
    const ctx = this.context;
    if (ctx === null) return;
    ctx.fillStyle = SIMA_PALETTE.text;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const text = JSON.stringify(poseMessage(this.frame));
    const receivedAt = performance.now();
    for (const listener of this.listeners) listener(text, receivedAt);
    this.frame += 1;
  }
}
