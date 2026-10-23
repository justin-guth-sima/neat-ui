/**
 * Ceiling on a decoded mask: 2048 * 2048 pixels is 16 MiB at 4 bytes each. A memory bound only. It
 * cannot tell a full-image mask sent by mistake from a large legitimate one, since the schema lets
 * a producer send at bbox resolution; that mistake is caught by the dropped-segment warning, not by
 * this number.
 */
export const MAX_RLE_MASK_PIXELS = 2048 * 2048;

/** Where RLE masks are decoded and tinted: an offscreen 2D context and the ImageData it takes. */
export interface MaskSurfaceFactory {
  createContext(): OffscreenCanvasRenderingContext2D;
  /** Wraps the decode buffer for `putImageData` without copying it. */
  wrapPixels(pixels: Uint8ClampedArray<ArrayBuffer>, width: number, height: number): ImageData;
}

const offscreenMaskSurface: MaskSurfaceFactory = {
  createContext() {
    const context = new OffscreenCanvas(1, 1).getContext('2d');
    if (!context) throw new Error('OffscreenCanvas has no 2d context');
    return context;
  },
  wrapPixels: (pixels, width, height) => new ImageData(pixels, width, height),
};

/**
 * Runs alternate over the mask flattened column-major and the first run is background. Fills a
 * zeroed buffer, leaving foreground pixels opaque black for the caller to tint.
 */
export function decodeRleMaskAlpha(
  pixels: Uint8ClampedArray,
  counts: readonly unknown[],
  maskWidth: number,
  maskHeight: number,
): Uint8ClampedArray {
  const total = maskWidth * maskHeight;
  let pos = 0;
  let foreground = false;

  for (let i = 0; i < counts.length && pos < total; i += 1) {
    const run = Number(counts[i]);
    const end = run > 0 ? Math.min(pos + run, total) : pos;
    if (foreground) {
      for (; pos < end; pos += 1) {
        pixels[((pos % maskHeight) * maskWidth + Math.floor(pos / maskHeight)) * 4 + 3] = 255;
      }
    } else {
      pos = end;
    }
    foreground = !foreground;
  }
  return pixels;
}

/**
 * One reusable surface for RLE masks. A segment is decoded, tinted and drawn before the next one is
 * touched, and drawing is synchronous, so one canvas and one pixel buffer serve every segment of
 * every tile. The context is created on the first mask, so a page without RLE masks never
 * allocates one.
 */
export class RleMaskCanvas {
  private context: OffscreenCanvasRenderingContext2D | null = null;
  /** Grows to the largest mask seen and is never shrunk; a view of it is handed out per mask. */
  private pixels = new Uint8ClampedArray(0);

  constructor(private readonly surface: MaskSurfaceFactory) {}

  /**
   * Decodes `counts` into a `width`×`height` mask tinted with `color` and returns the canvas that
   * holds it, ready to be drawn. The caller checks the size against MAX_RLE_MASK_PIXELS.
   */
  paint(counts: readonly unknown[], width: number, height: number, color: string): OffscreenCanvas {
    this.context ??= this.surface.createContext();
    const context = this.context;
    // Resizing a canvas clears it, so an unchanged size skips the assignment.
    if (context.canvas.width !== width) context.canvas.width = width;
    if (context.canvas.height !== height) context.canvas.height = height;

    // The decoder expects a zeroed buffer: a new one is, a reused one is cleared.
    const length = width * height * 4;
    if (this.pixels.length < length) this.pixels = new Uint8ClampedArray(length);
    else this.pixels.fill(0, 0, length);
    const pixels = this.pixels.subarray(0, length);
    decodeRleMaskAlpha(pixels, counts, width, height);

    // putImageData replaces every pixel, so the previous mask's tint does not show through.
    context.putImageData(this.surface.wrapPixels(pixels, width, height), 0, 0);
    context.save();
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = color;
    context.fillRect(0, 0, width, height);
    context.restore();
    return context.canvas;
  }
}

let pageMaskCanvas: RleMaskCanvas | null = null;

/** The page's one mask surface, shared by every tile; see RleMaskCanvas. */
export function sharedMaskCanvas(): RleMaskCanvas {
  pageMaskCanvas ??= new RleMaskCanvas(offscreenMaskSurface);
  return pageMaskCanvas;
}
