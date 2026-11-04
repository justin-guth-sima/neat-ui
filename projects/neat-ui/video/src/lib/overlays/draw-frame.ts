import type { NeatMetadataMessage } from '../sync/metadata-message';
import type { ColorAllocator, NeatOverlayColors } from './colors';
import { createColorAllocator } from './colors';
import type { DrawContext, DrawStrategy, OverlayFonts, TrackTrail } from './draw-context';
import { letterbox, mirrorLetterbox } from './letterbox';
import type { NeatOverlaySettings } from './overlay-settings';
import type { MaskSurfaceFactory } from './rle';
import { RleMaskCanvas, sharedMaskCanvas } from './rle';
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
  /**
   * Whether the picture is shown mirrored. Geometry is flipped across the canvas; text is not, so
   * it stays readable.
   */
  mirror: boolean;
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
  /**
   * Warning keys already logged, per kind; kept across resets so a restarting stream does not
   * repeat them.
   */
  readonly warned: Record<WarningKind, Set<string>>;
  /** Null until the kit font has been read. */
  fonts: OverlayFonts | null;
}

/**
 * Unknown types, failed strategies, and a strategy's own warnings (dropped segments). Each kind
 * has its own memory, so producer-chosen segment ids cannot silence a failing strategy.
 */
type WarningKind = 'unknown' | 'failed' | 'strategy';

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
 * Messages of this type feed the auxiliary panel (plan 2b), not the overlay; they are skipped
 * without a warning, which would otherwise fire on every stream that sends them.
 */
const AUXILIARY_METADATA_TYPE = 'auxiliary-visualization';

/**
 * Bounds each kind's warning memory. Keys include producer-chosen types and segment ids; the
 * memory stops growing instead of flushing, since flushing would let a key warn a second time.
 */
const WARNING_MEMORY_LIMIT = 64;

/** Used while the kit font cannot be read: the canvas is not in the document, or has no token. */
const FALLBACK_FONTS: OverlayFonts = fontsOf('sans-serif');

function fontsOf(family: string): OverlayFonts {
  return { label: `14px ${family}`, large: `16px ${family}` };
}

/**
 * A channel's overlay state. Class colours come from `colors`, shared with every tile created
 * with the same instance; RLE masks are decoded on the page's one offscreen surface.
 */
export function createOverlayState(channel: number, colors: NeatOverlayColors): NeatOverlayState {
  return newOverlayState(channel, colors, sharedMaskCanvas());
}

/**
 * Internal, for specs: a state whose RLE masks are decoded on a surface of its own, made by
 * `surface`, instead of the page's OffscreenCanvas.
 */
export function createOverlayStateWithMasks(
  channel: number,
  colors: NeatOverlayColors,
  surface: MaskSurfaceFactory,
): NeatOverlayState {
  return newOverlayState(channel, colors, new RleMaskCanvas(surface));
}

function newOverlayState(
  channel: number,
  colors: NeatOverlayColors,
  masks: RleMaskCanvas,
): NeatOverlayState {
  const state: OverlayState = {
    channel,
    colors: createColorAllocator(colors),
    trackHistory: new Map(),
    masks,
    warned: { unknown: new Set(), failed: new Set(), strategy: new Set() },
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

function warnOnce(
  state: OverlayState,
  kind: WarningKind,
  key: string,
  message: string,
  ...details: unknown[]
): void {
  const warned = state.warned[kind];
  if (warned.has(key) || warned.size >= WARNING_MEMORY_LIMIT) return;
  warned.add(key);
  console.warn(message, ...details);
}

/**
 * The kit font. Reading a computed style forces a style recalculation, which a frame path must not
 * pay for, so a value once read is kept for the state's life. A failed read (the canvas not yet in
 * the document, or no token) is not kept, so it is retried on the next frame.
 */
function fontsFor(state: OverlayState, canvas: CanvasRenderingContext2D['canvas']): OverlayFonts {
  if (state.fonts) return state.fonts;
  const family =
    canvas instanceof HTMLCanvasElement
      ? getComputedStyle(canvas).getPropertyValue('--font-sans').trim()
      : '';
  if (!family) return FALLBACK_FONTS;
  state.fonts = fontsOf(family);
  return state.fonts;
}

/**
 * Clears the overlay and draws `items` over a video shown with `object-fit: contain`. The context
 * is scaled by `view.dpr`, so every line width, font size and offset is in CSS pixels. A message
 * of an unknown type, or one whose strategy throws, is skipped with one warning per channel and
 * type; the frame's other messages still draw. Auxiliary-panel messages are skipped silently.
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

  const contained = letterbox(view.videoWidth, view.videoHeight, view.cssWidth, view.cssHeight);
  // The one place a mirrored view differs: strategies read the mapping and draw as they always do.
  const box = view.mirror ? mirrorLetterbox(contained, view.cssWidth) : contained;
  // Shared by every message of the frame, so the ROI is mapped and drawn once.
  const frame: Omit<DrawContext, 'held'> = {
    ctx,
    channel: state.channel,
    settings,
    box,
    mirrored: view.mirror,
    roi: mapRoi(settings.roi, view.videoWidth, view.videoHeight, box),
    colors: state.colors,
    fonts: fontsFor(state, ctx.canvas),
    now,
    trackHistory: state.trackHistory,
    masks: state.masks,
    warnOnce: (key, message) => warnOnce(state, 'strategy', key, message),
  };

  for (const { message, held } of items) {
    const { type } = message;
    if (type === AUXILIARY_METADATA_TYPE) continue;
    const draw = STRATEGIES.get(type);
    if (!draw) {
      warnOnce(
        state,
        'unknown',
        type,
        `metadata: channel ${state.channel} has no overlay for type "${type}"`,
      );
      continue;
    }
    // The queue yields one message per type and frame, so skipping this one skips the type.
    ctx.save();
    // Text anchored at a mirrored point reads away from the picture's edge, not into it.
    ctx.textAlign = view.mirror ? 'right' : 'left';
    try {
      draw({ ...frame, held }, message.data);
    } catch (error) {
      warnOnce(
        state,
        'failed',
        type,
        `metadata: channel ${state.channel} failed to draw ${type}`,
        error,
      );
    } finally {
      ctx.restore();
    }
  }
}
