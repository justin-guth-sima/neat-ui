import type { NeatMetadataMessage } from '../sync/metadata-message';
import type { ColorAllocator, NeatOverlayColors } from './colors';
import type { DrawContext, DrawStrategy, OverlayFonts, TrackTrail } from './draw-context';
import { letterbox } from './letterbox';
import type { NeatOverlaySettings } from './overlay-settings';
import type { MaskContextFactory } from './rle';
import { offscreenMaskContext, RleMaskCanvas } from './rle';
import { mapRoi } from './roi';
import { drawClassification } from './strategies/classification';
import { drawObjectDetection } from './strategies/object-detection';
import { drawPoseEstimation } from './strategies/pose-estimation';
import { drawSegmentation } from './strategies/segmentation';
import { drawTracking } from './strategies/tracking';

/** The overlay canvas and the video under it, as drawFrame needs them. */
export interface NeatOverlayView {
  /** The canvas's CSS size; the video is contained in it. */
  cssWidth: number;
  cssHeight: number;
  /** Device pixels per CSS pixel the canvas's backing store is sized with. */
  dpr: number;
  /** The video's intrinsic size, the space metadata coordinates are in. 0 before it is known. */
  videoWidth: number;
  videoHeight: number;
}

/** One message to draw; `held` marks one repeated from an earlier frame. */
export interface NeatOverlayItem {
  message: NeatMetadataMessage;
  held: boolean;
}

/**
 * A channel's drawing memory across frames: track trails, its track and pose colours, the
 * warnings it has given. Create it with `createOverlayState` and pass it to `drawFrame`.
 */
export interface NeatOverlayState {
  readonly __neatOverlayState: never;
}

/** What a `NeatOverlayState` holds. Internal: callers see the state only through this module. */
interface OverlayState {
  readonly channel: number;
  readonly colors: ColorAllocator;
  readonly trackHistory: Map<string, TrackTrail>;
  readonly masks: RleMaskCanvas;
  /** Warning keys already logged; kept across resets so a restarting stream does not repeat them. */
  readonly warned: Set<string>;
  fonts: OverlayFonts | null;
}

/** The only place the opaque handle is opened. */
function stateOf(state: NeatOverlayState): OverlayState {
  return state as unknown as OverlayState;
}

const STRATEGIES: ReadonlyMap<string, DrawStrategy> = new Map([
  ['object-detection', drawObjectDetection],
  ['segmentation', drawSegmentation],
  ['tracking', drawTracking],
  ['pose-estimation', drawPoseEstimation],
  ['classification', drawClassification],
]);

/**
 * Bounds the warning memory. Keys include producer-chosen types and segment ids; the memory stops
 * growing instead of flushing, since flushing would let a key warn a second time.
 */
const WARNING_MEMORY_LIMIT = 64;

/** Used when the canvas is not an element in the document, so the kit font cannot be read. */
const FALLBACK_FONT_FAMILY = 'sans-serif';

/**
 * A channel's overlay state. Class colours come from `colors`, shared with every tile created
 * with the same instance. `createMaskContext` makes the surface RLE masks are decoded on; the
 * default is an OffscreenCanvas, created on the first RLE mask.
 */
export function createOverlayState(
  channel: number,
  colors: NeatOverlayColors,
  createMaskContext: MaskContextFactory = offscreenMaskContext,
): NeatOverlayState {
  const state: OverlayState = {
    channel,
    colors: colors.createAllocator(),
    trackHistory: new Map(),
    masks: new RleMaskCanvas(createMaskContext),
    warned: new Set(),
    fonts: null,
  };
  return state as unknown as NeatOverlayState;
}

/** Forgets the channel's track trails and its track and pose colours, as after the stream stops. */
export function resetOverlayState(handle: NeatOverlayState): void {
  const state = stateOf(handle);
  state.trackHistory.clear();
  state.colors.clear();
}

function warnOnce(state: OverlayState, key: string, message: string, ...details: unknown[]): void {
  if (state.warned.has(key) || state.warned.size >= WARNING_MEMORY_LIMIT) return;
  state.warned.add(key);
  console.warn(message, ...details);
}

/**
 * The kit font, read once per state: reading a computed style forces a style recalculation,
 * which a frame path must not pay for. The canvas is in the document by the first drawn frame.
 */
function fontsFor(state: OverlayState, canvas: CanvasRenderingContext2D['canvas']): OverlayFonts {
  if (!state.fonts) {
    const family =
      (canvas instanceof HTMLCanvasElement
        ? getComputedStyle(canvas).getPropertyValue('--font-sans').trim()
        : '') || FALLBACK_FONT_FAMILY;
    state.fonts = { label: `14px ${family}`, large: `16px ${family}` };
  }
  return state.fonts;
}

/**
 * Clears the overlay and draws `items` over a video shown with `object-fit: contain`. The context
 * is scaled by `view.dpr`, so every line width, font size and offset is in CSS pixels. A message
 * of an unknown type, or one whose strategy throws, is skipped with one warning per channel and
 * type; the frame's other messages still draw.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  view: NeatOverlayView,
  items: readonly NeatOverlayItem[],
  handle: NeatOverlayState,
  settings: NeatOverlaySettings,
  now: number,
): void {
  const state = stateOf(handle);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  if (items.length === 0) return;

  const box = letterbox(view.videoWidth, view.videoHeight, view.cssWidth, view.cssHeight);
  // Shared by every message of the frame, so the ROI is mapped and drawn once.
  const frame: Omit<DrawContext, 'held'> = {
    ctx,
    channel: state.channel,
    settings,
    box,
    roi: mapRoi(settings.roi, view.videoWidth, view.videoHeight, box),
    colors: state.colors,
    fonts: fontsFor(state, ctx.canvas),
    now,
    trackHistory: state.trackHistory,
    masks: state.masks,
    warnOnce: (key, message) => warnOnce(state, key, message),
  };

  for (const { message, held } of items) {
    const { type } = message;
    const draw = STRATEGIES.get(type);
    if (!draw) {
      warnOnce(
        state,
        `unknown:${type}`,
        `metadata: channel ${state.channel} has no overlay for type "${type}"`,
      );
      continue;
    }
    // The queue yields one message per type and frame, so skipping this one skips the type.
    ctx.save();
    try {
      draw({ ...frame, held }, message.data);
    } catch (error) {
      warnOnce(
        state,
        `failed:${type}`,
        `metadata: channel ${state.channel} failed to draw ${type}`,
        error,
      );
    } finally {
      ctx.restore();
    }
  }
}
