/**
 * Ceiling on a decoded mask: 2048 * 2048 pixels is 16 MiB at 4 bytes each. A memory bound only. It
 * cannot tell a full-image mask sent by mistake from a large legitimate one, since the schema lets
 * a producer send at bbox resolution; that mistake is caught by the dropped-segment warning, not by
 * this number.
 */
export const MAX_RLE_MASK_PIXELS = 2048 * 2048;

/** Creates the offscreen 2D context RLE masks are decoded and tinted on. */
export type MaskContextFactory = () => OffscreenCanvasRenderingContext2D;

export const offscreenMaskContext: MaskContextFactory = () => {
  const context = new OffscreenCanvas(1, 1).getContext('2d');
  if (!context) throw new Error('OffscreenCanvas has no 2d context');
  return context;
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
 * One reusable surface for a channel's RLE masks. A segment is decoded, tinted and drawn before
 * the next one is touched, so one canvas and one pixel buffer serve every segment. The context is
 * created on the first mask, so a channel without RLE masks never allocates one.
 */
export class RleMaskCanvas {
  private context: OffscreenCanvasRenderingContext2D | null = null;
  private image: ImageData | null = null;

  constructor(private readonly createContext: MaskContextFactory) {}

  /**
   * Decodes `counts` into a `width`×`height` mask tinted with `color` and returns the canvas that
   * holds it, ready to be drawn. The caller checks the size against MAX_RLE_MASK_PIXELS.
   */
  paint(counts: readonly unknown[], width: number, height: number, color: string): OffscreenCanvas {
    this.context ??= this.createContext();
    const context = this.context;
    // Resizing a canvas clears it, so an unchanged size skips the assignment.
    if (context.canvas.width !== width) context.canvas.width = width;
    if (context.canvas.height !== height) context.canvas.height = height;

    // The buffer is reused while the size holds; the decoder expects it zeroed.
    let image = this.image;
    if (image?.width === width && image.height === height) image.data.fill(0);
    else image = this.image = context.createImageData(width, height);
    decodeRleMaskAlpha(image.data, counts, width, height);

    // putImageData replaces every pixel, so the previous mask's tint does not show through.
    context.putImageData(image, 0, 0);
    context.save();
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = color;
    context.fillRect(0, 0, width, height);
    context.restore();
    return context.canvas;
  }
}
