import type { NeatOverlaySettings } from '../overlay-settings';
import type { DrawContext, DrawStrategy, TrackTrail } from '../draw-context';
import { drawLabelPlate, identityColor, percent } from '../draw-context';
import { drawRoiOnce, passesRoiFilter } from '../roi';

interface Track {
  id?: unknown;
  label?: unknown;
  confidence?: unknown;
  /** `[x, y, width, height]` in video pixels. */
  bbox: [number, number, number, number];
}

/** The fields of a `tracking` payload this overlay reads. */
interface TrackingData {
  tracks?: unknown;
}

type HistorySettings = NeatOverlaySettings['types']['tracking']['history'];

/** Whether a label shows `#id`. */
function hasId(id: unknown): boolean {
  return id !== null && id !== undefined && id !== '';
}

/** Whether a track keeps a trail. Unlike a label, an empty-string id still identifies one. */
function isIdentified(track: Track): boolean {
  return track.id !== null && track.id !== undefined;
}

function isDrawable(track: unknown): track is Track {
  const bbox = (track as Partial<Track> | null | undefined)?.bbox;
  return Array.isArray(bbox) && bbox.length >= 4 && bbox.slice(0, 4).every(Number.isFinite);
}

/**
 * Appends each track's center to its trail and drops the trails of tracks gone for longer than
 * `lostTrackTtlMs`. With history off, every trail is dropped.
 */
function updateTrackHistory(
  history: Map<string, TrackTrail>,
  tracks: readonly Track[],
  now: number,
  settings: HistorySettings,
): void {
  if (!settings.enabled) {
    history.clear();
    return;
  }
  // A trail length below one would make slice(-0) keep every point, growing without bound.
  const trailLength = Math.max(1, settings.trailLength);
  const current = new Set<string>();
  for (const track of tracks) {
    if (!isIdentified(track)) continue;
    const key = String(track.id);
    const [x, y, width, height] = track.bbox;
    current.add(key);
    const trail = history.get(key) ?? { points: [], lastSeen: now };
    trail.points = [...trail.points, { x: x + width / 2, y: y + height / 2 }].slice(-trailLength);
    trail.lastSeen = now;
    history.set(key, trail);
  }
  for (const [key, trail] of history) {
    if (!current.has(key) && now - trail.lastSeen > settings.lostTrackTtlMs) history.delete(key);
  }
}

function drawTrail(
  dc: DrawContext,
  points: readonly { x: number; y: number }[],
  color: string,
  alpha: number,
): void {
  if (points.length < 2) return;
  const { ctx, box } = dc;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = dc.settings.general.lineWidth;
  ctx.globalAlpha = alpha;
  ctx.setLineDash([]);
  ctx.beginPath();
  points.forEach((point, i) => {
    const x = point.x * box.scaleX + box.offsetX;
    const y = point.y * box.scaleY + box.offsetY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

/** Boxes with labeled plates and fading trails, each in its track id's color. */
export const drawTracking: DrawStrategy = (dc, data) => {
  const tracks = (data as TrackingData | null | undefined)?.tracks;
  if (!Array.isArray(tracks)) return;

  const { ctx, box, settings } = dc;
  const type = settings.types.tracking;
  const visible = tracks.filter(
    (track): track is Track =>
      isDrawable(track) &&
      // Negated so a non-numeric confidence passes, as the comparison's coercion has it.
      !(Number(track.confidence ?? 1) < type.confidenceThreshold) &&
      passesRoiFilter(dc.roi, track.bbox, box, settings.general.applyRoiFiltering),
  );

  if (settings.general.showRoi) drawRoiOnce(ctx, dc.roi);
  if (!type.visible) {
    // Trails would otherwise reappear stale when the type is shown again.
    dc.trackHistory.clear();
    return;
  }
  // A held message repeats an earlier frame; recording it again would add a stale trail point.
  if (!dc.held) updateTrackHistory(dc.trackHistory, visible, dc.now, type.history);

  // Resolve each id once per frame, so a track's trail and box always agree even when the
  // allocator has to share slots above the palette size.
  const frameColors = new Map<string, string>();
  const trackColor = (id: unknown): string => {
    if (id === null || id === undefined) return identityColor(dc, 'track', id);
    const key = String(id);
    let color = frameColors.get(key);
    if (color === undefined) {
      color = identityColor(dc, 'track', id);
      frameColors.set(key, color);
    }
    return color;
  };

  if (type.history.enabled) {
    const active = new Set(visible.filter(isIdentified).map((track) => String(track.id)));
    for (const [key, trail] of dc.trackHistory) {
      drawTrail(dc, trail.points, trackColor(key), active.has(key) ? 0.72 : 0.35);
    }
  }

  for (const track of visible) {
    const [x, y, w, h] = track.bbox;
    const color = trackColor(track.id);
    const left = x * box.scaleX + box.offsetX;
    const top = y * box.scaleY + box.offsetY;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = settings.general.lineWidth;
    ctx.setLineDash([]);
    ctx.strokeRect(left, top, w * box.scaleX, h * box.scaleY);

    const idText = hasId(track.id) ? ` #${track.id}` : '';
    const confidence =
      typeof track.confidence === 'number' ? ` (${percent(track.confidence)}%)` : '';
    drawLabelPlate(dc, `${track.label || 'track'}${idText}${confidence}`, left, top - 6, color);
  }
};
