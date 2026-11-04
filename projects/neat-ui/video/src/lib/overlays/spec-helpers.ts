/*
 * Test doubles for the overlay specs. Not exported from the public API, and free of test-runner
 * globals so the library build can type-check it.
 */
import type { NeatMetadataMessage } from '../sync/metadata-message';
import { NeatOverlayColors } from './colors';
import type { NeatOverlayItem, NeatOverlayState, NeatOverlayView } from './draw-frame';
import { createOverlayStateWithMasks, drawFrame } from './draw-frame';
import type { NeatOverlaySettings, NeatRoiPolygon } from './overlay-settings';
import type { MaskSurfaceFactory } from './rle';
import { NEAT_OVERLAY_DEFAULTS } from './overlay-settings';

/** The drawing state a real 2D context saves and restores, as recorded with every call. */
interface DrawState {
  strokeStyle: string;
  fillStyle: string;
  lineWidth: number;
  globalAlpha: number;
  font: string;
  textAlign: string;
  imageSmoothingEnabled: boolean;
  lineDash: number[];
  transform: number[];
}

export interface RecordedCall extends DrawState {
  op: string;
  args: unknown[];
}

/**
 * A 2D context that records every drawing call with the state in force at the time. `save` and
 * `restore` behave as on a real canvas, so a leak of state between overlays shows up.
 */
export class RecordingContext {
  readonly calls: RecordedCall[] = [];
  strokeStyle = '';
  fillStyle = '';
  lineWidth = 1;
  globalAlpha = 1;
  font = '';
  textAlign = 'start';
  imageSmoothingEnabled = false;
  globalCompositeOperation = 'source-over';
  lineDash: number[] = [];
  transform = [1, 0, 0, 1, 0, 0];
  private readonly stack: DrawState[] = [];

  constructor(readonly canvas: { width: number; height: number } = { width: 640, height: 480 }) {}

  get context(): CanvasRenderingContext2D {
    return this as unknown as CanvasRenderingContext2D;
  }

  ops(op: string): RecordedCall[] {
    return this.calls.filter((call) => call.op === op);
  }

  save(): void {
    this.stack.push(this.state());
  }

  restore(): void {
    const saved = this.stack.pop();
    if (saved) Object.assign(this, saved);
  }

  setLineDash(segments: number[]): void {
    this.lineDash = [...segments];
  }

  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.transform = [a, b, c, d, e, f];
  }

  measureText(text: string): { width: number } {
    return { width: text.length * 7 };
  }

  beginPath(): void {
    // Paths are not recorded; the stroke or fill that uses one is.
  }

  closePath(): void {
    // See beginPath.
  }

  moveTo(): void {
    // See beginPath.
  }

  lineTo(): void {
    // See beginPath.
  }

  clearRect(...args: unknown[]): void {
    this.record('clearRect', args);
  }

  strokeRect(...args: unknown[]): void {
    this.record('strokeRect', args);
  }

  fillRect(...args: unknown[]): void {
    this.record('fillRect', args);
  }

  fillText(...args: unknown[]): void {
    this.record('fillText', args);
  }

  stroke(...args: unknown[]): void {
    this.record('stroke', args);
  }

  fill(...args: unknown[]): void {
    this.record('fill', args);
  }

  arc(...args: unknown[]): void {
    this.record('arc', args);
  }

  drawImage(...args: unknown[]): void {
    this.record('drawImage', args);
  }

  private record(op: string, args: unknown[]): void {
    this.calls.push({ op, args, ...this.state() });
  }

  private state(): DrawState {
    return {
      strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle,
      lineWidth: this.lineWidth,
      globalAlpha: this.globalAlpha,
      font: this.font,
      textAlign: this.textAlign,
      imageSmoothingEnabled: this.imageSmoothingEnabled,
      lineDash: [...this.lineDash],
      transform: [...this.transform],
    };
  }
}

/**
 * A mask surface whose offscreen context records each mask it is given. Its `ImageData` is a plain
 * object, so no browser canvas or global `ImageData` is needed.
 */
export class RecordingMaskContext implements MaskSurfaceFactory {
  readonly canvas = { width: 0, height: 0 };
  readonly masks: { width: number; height: number; data: Uint8ClampedArray }[] = [];
  fillStyle = '';
  globalCompositeOperation = 'source-over';

  /** How many contexts the surface was asked for. */
  contextsCreated = 0;

  createContext(): OffscreenCanvasRenderingContext2D {
    this.contextsCreated += 1;
    return this as unknown as OffscreenCanvasRenderingContext2D;
  }

  wrapPixels(pixels: Uint8ClampedArray<ArrayBuffer>, width: number, height: number): ImageData {
    return { width, height, data: pixels } as ImageData;
  }

  putImageData(image: ImageData): void {
    this.masks.push({ width: image.width, height: image.height, data: image.data.slice() });
  }

  save(): void {
    // The tint's composite mode is not asserted.
  }

  restore(): void {
    // See save.
  }

  fillRect(): void {
    // See save.
  }
}

type Types = NeatOverlaySettings['types'];
type Tracking = Types['tracking'];

export interface OverlaySettingsPatch {
  general?: Partial<NeatOverlaySettings['general']>;
  types?: {
    [K in Exclude<keyof Types, 'tracking'>]?: Partial<Types[K]>;
  } & {
    tracking?: Partial<Omit<Tracking, 'history'>> & { history?: Partial<Tracking['history']> };
  };
  roi?: NeatRoiPolygon[];
}

/** The defaults with the given fields replaced. */
export function overlaySettings(patch: OverlaySettingsPatch = {}): NeatOverlaySettings {
  const defaults = NEAT_OVERLAY_DEFAULTS;
  const types = patch.types ?? {};
  return {
    general: { ...defaults.general, ...patch.general },
    types: {
      'object-detection': { ...defaults.types['object-detection'], ...types['object-detection'] },
      segmentation: { ...defaults.types.segmentation, ...types.segmentation },
      tracking: {
        ...defaults.types.tracking,
        ...types.tracking,
        history: { ...defaults.types.tracking.history, ...types.tracking?.history },
      },
      'pose-estimation': { ...defaults.types['pose-estimation'], ...types['pose-estimation'] },
      classification: { ...defaults.types.classification, ...types.classification },
    },
    roi: patch.roi ?? defaults.roi,
  };
}

/** A 640×480 video shown 1:1, so video pixels and CSS pixels coincide. */
export const VIEW: NeatOverlayView = {
  cssWidth: 640,
  cssHeight: 480,
  dpr: 1,
  videoWidth: 640,
  videoHeight: 480,
  mirror: false,
};

export function fresh(message: NeatMetadataMessage): NeatOverlayItem {
  return { message, held: false };
}

/** An overlay state whose RLE masks are decoded on `mask`. */
export function overlayState(
  channel = 0,
  colors = new NeatOverlayColors(),
  mask = new RecordingMaskContext(),
): NeatOverlayState {
  return createOverlayStateWithMasks(channel, colors, mask);
}

export interface DrawOptions {
  now?: number;
  view?: NeatOverlayView;
  held?: boolean;
  /** Draw on this context instead of a new one, to follow state across frames. */
  ctx?: RecordingContext;
}

/** Draws one frame of `messages` and returns the context it drew on. */
export function drawMessages(
  state: NeatOverlayState,
  settings: NeatOverlaySettings,
  messages: NeatMetadataMessage[],
  { now = 0, view = VIEW, held = false, ctx }: DrawOptions = {},
): RecordingContext {
  const target =
    ctx ??
    new RecordingContext({ width: view.cssWidth * view.dpr, height: view.cssHeight * view.dpr });
  const items = messages.map((message) => ({ message, held }));
  drawFrame(target.context, view, items, state, settings, now);
  return target;
}

export function texts(ctx: RecordingContext): unknown[] {
  return ctx.ops('fillText').map((call) => call.args[0]);
}

/** The fill colour of the first label containing `needle`. */
export function colorOfText(ctx: RecordingContext, needle: string): string {
  const call = ctx.ops('fillText').find((entry) => String(entry.args[0]).includes(needle));
  if (!call) throw new Error(`expected a label containing "${needle}"`);
  return call.fillStyle;
}
