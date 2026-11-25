/**
 * A canvas the template rendered, found when it is there and kept at its laid-out size times the
 * device pixel ratio: measured once when found, then by a ResizeObserver where the browser has
 * one. Shared by the listening and speaking canvases. Internal.
 */
export class SizedCanvas {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private resizes: ResizeObserver | null = null;
  /** The canvas's size in CSS pixels, and the device pixel ratio it is drawn at. */
  width = 0;
  height = 0;
  ratio = 1;

  constructor(private readonly find: () => HTMLCanvasElement | null) {}

  /** The 2D context, its transform set to CSS pixels; null until the canvas is there. */
  draw(): CanvasRenderingContext2D | null {
    const canvas = this.canvas?.isConnected ? this.canvas : this.find();
    if (canvas !== this.canvas) this.attach(canvas);
    const context = this.context;
    if (!context) return null;
    context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    return context;
  }

  destroy(): void {
    this.resizes?.disconnect();
    this.resizes = null;
    this.context?.clearRect(0, 0, this.canvas?.width ?? 0, this.canvas?.height ?? 0);
    this.canvas = null;
    this.context = null;
  }

  private attach(canvas: HTMLCanvasElement | null): void {
    this.resizes?.disconnect();
    this.resizes = null;
    this.canvas = canvas;
    this.context = canvas?.getContext('2d') ?? null;
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    this.size(box.width, box.height);
    const view = canvas.ownerDocument.defaultView;
    if (view && typeof view.ResizeObserver === 'function') {
      this.resizes = new view.ResizeObserver(([entry]) =>
        this.size(entry.contentRect.width, entry.contentRect.height),
      );
      this.resizes.observe(canvas);
    }
  }

  private size(width: number, height: number): void {
    const canvas = this.canvas;
    if (!canvas) return;
    this.ratio = canvas.ownerDocument.defaultView?.devicePixelRatio || 1;
    this.width = width;
    this.height = height;
    canvas.width = Math.round(width * this.ratio);
    canvas.height = Math.round(height * this.ratio);
  }
}
