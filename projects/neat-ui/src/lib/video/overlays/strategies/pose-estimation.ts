import type { DrawStrategy } from '../draw-context';
import { drawLabelPlate, identityColor } from '../draw-context';

interface Keypoint {
  name?: unknown;
  /** Video pixels. */
  x: number;
  y: number;
  confidence?: unknown;
}

/** The fields of a `pose-estimation` payload this overlay reads. */
interface PoseData {
  poses?: readonly ({ id?: unknown; label?: unknown; keypoints?: unknown } | null)[];
}

const COCO_SKELETON: readonly (readonly [string, string])[] = [
  ['nose', 'left_eye'],
  ['nose', 'right_eye'],
  ['left_eye', 'left_ear'],
  ['right_eye', 'right_ear'],
  ['nose', 'left_shoulder'],
  ['nose', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
];

/** Joints at or below this confidence are drawn faded but left out of the person's box. */
const KEYPOINT_MIN_CONFIDENCE = 0.3;
const BOX_PADDING = 8;

/** Fades a link or joint with its confidence instead of dropping it at a threshold. */
function confidenceAlpha(confidence: unknown): number {
  const value = Number.isFinite(Number(confidence)) ? Number(confidence) : 1;
  return 0.18 + 0.82 * Math.min(1, Math.max(0, value));
}

function hasId(id: unknown): boolean {
  return id !== null && id !== undefined && id !== '';
}

/** Skeletons, joints and a labelled box per person, all in the pose id's colour. */
export const drawPoseEstimation: DrawStrategy = (dc, data) => {
  const poses = (data as PoseData | null | undefined)?.poses;
  const type = dc.settings.types['pose-estimation'];
  if (!poses || !type.visible) return;

  const { ctx, box } = dc;
  const at = (kp: Keypoint): [number, number] => [
    kp.x * box.scaleX + box.offsetX,
    kp.y * box.scaleY + box.offsetY,
  ];
  ctx.lineWidth = dc.settings.general.lineWidth;
  ctx.setLineDash([]);
  ctx.font = dc.fonts.label;

  for (const pose of poses) {
    if (!Array.isArray(pose?.keypoints)) continue;
    const color = identityColor(dc, 'pose', pose.id);
    const keypoints = (pose.keypoints as (Keypoint | null)[]).filter((kp): kp is Keypoint =>
      Boolean(kp),
    );
    const byName = new Map(keypoints.map((kp) => [kp.name, kp]));
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    for (const [a, b] of COCO_SKELETON) {
      const from = byName.get(a);
      const to = byName.get(b);
      if (!from || !to) continue;
      ctx.beginPath();
      ctx.moveTo(...at(from));
      ctx.lineTo(...at(to));
      ctx.globalAlpha = confidenceAlpha(
        Math.min(Number(from.confidence ?? 1), Number(to.confidence ?? 1)),
      );
      ctx.stroke();
    }

    for (const kp of keypoints) {
      ctx.globalAlpha = confidenceAlpha(kp.confidence);
      if (type.showKeypoints) {
        ctx.beginPath();
        ctx.arc(...at(kp), 3, 0, 2 * Math.PI);
        ctx.fill();
      }
      if (type.showKeypointLabels) {
        ctx.fillText(
          String(kp.name),
          (kp.x + 4) * box.scaleX + box.offsetX,
          (kp.y - 4) * box.scaleY + box.offsetY,
        );
      }
    }
    ctx.globalAlpha = 1;

    // The box and its label frame only the joints the model is fairly sure of.
    const confident = keypoints.filter((kp) => Number(kp.confidence) > KEYPOINT_MIN_CONFIDENCE);
    if (confident.length < 2) continue;
    const xs = confident.map((kp) => kp.x);
    const ys = confident.map((kp) => kp.y);
    const left = Math.min(...xs) - BOX_PADDING;
    const top = Math.min(...ys) - BOX_PADDING;
    const width = Math.max(...xs) - Math.min(...xs) + BOX_PADDING * 2;
    const height = Math.max(...ys) - Math.min(...ys) + BOX_PADDING * 2;
    const boxLeft = left * box.scaleX + box.offsetX;
    const boxTop = top * box.scaleY + box.offsetY;
    ctx.strokeRect(boxLeft, boxTop, width * box.scaleX, height * box.scaleY);

    const label = `${pose.label || 'pose'}${hasId(pose.id) ? ` #${pose.id}` : ''}`;
    drawLabelPlate(dc, label, boxLeft, boxTop - 6, color);
  }
};
