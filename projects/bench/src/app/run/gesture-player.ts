import { type DiagramTransform, ZOOM_LIMITS } from '@bench/diagram-seam';

/*
 * The gestures a phase replays (design 2.3): a drag along a Lissajous path, a wheel in and out,
 * and a wheel out to the zoom limit. The player computes where the pointer is, and how far the
 * wheel has turned, as a function of time and not of frames, so a slow machine gets fewer events
 * along the same path. It hands the events to a `GestureTarget`: `domGestures` dispatches them as
 * synthetic mouse and wheel events on the renderer's zoom box, which both d3-zoom renderers (the
 * kit's box, vflow's root SVG) handle through the same library; `reducerGestures` applies them to
 * the pure reducers below and writes the result through a setter, for the host that has no zoom
 * box of its own (`none`, whose transform setter is not reactive, so the floor stays a floor).
 * A raw-browser-API unit (AGENTS.md): no Angular, no signals, with specs.
 */

/** A box on the page in client px, as `getBoundingClientRect` reports it. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Where a gesture lands. Points are client px. */
export interface GestureTarget {
  /** The zoom box: pointer paths are a share of it, the zoom centres on it. */
  rect(): Box;
  /** The transform the box shows now. */
  transform(): DiagramTransform;
  press(x: number, y: number): void;
  drag(x: number, y: number): void;
  release(x: number, y: number): void;
  /** `box` is the zoom box as it was when the gesture began, for a target that needs it. */
  wheel(x: number, y: number, deltaY: number, box: Box): void;
}

/** d3-zoom's wheel delta for a wheel in pixels: log2 of the scale factor per px of `deltaY`. */
const WHEEL_LOG2_PER_PX = 0.002;

/** A pan moves the content by the pointer's movement. */
export function panned(t: DiagramTransform, dx: number, dy: number): DiagramTransform {
  return { k: t.k, x: t.x + dx, y: t.y + dy };
}

/**
 * A wheel of `deltaY` px with the cursor at `at` (px in the box): `k' = clamp(k · 2^(-deltaY ×
 * 0.002))`, the diagram point under the cursor staying under it. d3-zoom's own rule for a wheel
 * event (its default wheel delta, ctrl not held), so the `none` host moves as the others do.
 */
export function zoomedAbout(
  t: DiagramTransform,
  at: { readonly x: number; readonly y: number },
  deltaY: number,
): DiagramTransform {
  const k = Math.min(
    Math.max(t.k * 2 ** (-deltaY * WHEEL_LOG2_PER_PX), ZOOM_LIMITS[0]),
    ZOOM_LIMITS[1],
  );
  if (k === t.k) return t;
  return { k, x: at.x - ((at.x - t.x) / t.k) * k, y: at.y - ((at.y - t.y) / t.k) * k };
}

/**
 * The synthetic events on a d3-zoom box: the press on it, the moves and the release on `view`.
 * `read` says what the box shows now (the transform is the renderer's, written to its DOM).
 */
export function domGestures(
  box: Element,
  read: () => DiagramTransform,
  view = box.ownerDocument.defaultView,
): GestureTarget {
  if (!view) throw new Error('the zoom box is not in a document with a window');
  // `view` must be set: d3-zoom subscribes its drag listeners to `event.view`.
  const mouse = (type: string, x: number, y: number, buttons: number): MouseEvent =>
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view,
      clientX: x,
      clientY: y,
      button: 0,
      buttons,
    });
  return {
    rect: () => box.getBoundingClientRect(),
    transform: read,
    press: (x, y) => box.dispatchEvent(mouse('mousedown', x, y, 1)),
    drag: (x, y) => view.dispatchEvent(mouse('mousemove', x, y, 1)),
    release: (x, y) => view.dispatchEvent(mouse('mouseup', x, y, 0)),
    wheel: (x, y, deltaY) =>
      box.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          view,
          clientX: x,
          clientY: y,
          deltaY,
          deltaMode: 0,
        }),
      ),
  };
}

/**
 * The same gestures on the reducers: each drag and wheel computes the next transform from `read`
 * and hands it to `write`. No events, no change detection: whatever `write` costs is the floor.
 */
export function reducerGestures(
  rect: () => Box,
  read: () => DiagramTransform,
  write: (t: DiagramTransform) => void,
): GestureTarget {
  let last: { x: number; y: number } | null = null;
  return {
    rect,
    transform: read,
    press: (x, y) => (last = { x, y }),
    drag: (x, y) => {
      // A pointer that is not down moves nothing.
      if (!last) return;
      write(panned(read(), x - last.x, y - last.y));
      last = { x, y };
    },
    release: () => (last = null),
    // The player measured the box when the gesture began: a rect per wheel event would be layout
    // work that the floor is there to exclude.
    wheel: (x, y, deltaY, { left, top }) => {
      write(zoomedAbout(read(), { x: x - left, y: y - top }, deltaY));
    },
  };
}

/** The pan's swing, as a share of the box either way. */
const PAN_SWING = 0.4;
/** How far the zoom phase wheels in, as a multiple of the start's scale (design 2.3). */
const ZOOM_IN = 2.5;
/** The zoomed-out phase reaches its limit within this share of the phase, then holds. */
const ZOOM_OUT_RAMP = 0.2;

interface Point {
  readonly x: number;
  readonly y: number;
}

type Plan =
  | { readonly kind: 'idle' }
  /** A drag from `from` along a 1:2 Lissajous of the box's size, back at `from` at the end. */
  | { readonly kind: 'pan'; readonly from: Point; readonly w: number; readonly h: number }
  /** A wheel at `at` in `box` (as it was at the start): the zoom's log2 in the phase, from 0. */
  | {
      readonly kind: 'wheel';
      readonly at: Point;
      readonly box: Box;
      readonly log2At: (u: number) => number;
    };

/**
 * Plays one phase's gesture, a frame at a time: `begin` at the phase's start, `frame` on each
 * animation frame (its position comes from `nowMs`), `end` where the phase ends. Made per step,
 * since the empty spot to press on belongs to the step's diagram.
 */
export class GesturePlayer {
  private plan: Plan = { kind: 'idle' };
  private phase: string | null = null;
  private since = 0;
  private ms = 1;
  /** The log2 of zoom already wheeled, so each event carries only the new turn. */
  private wheeled = 0;

  /** `freeSpot` is a point in diagram units that no node covers (`SynthDiagram.freeSpot`). */
  constructor(
    private readonly target: GestureTarget,
    private readonly freeSpot: Point,
  ) {}

  begin(phase: string, nowMs: number, durationMs: number): void {
    if (this.phase !== null) throw new Error(`the ${this.phase} gesture is still playing`);
    if (!(durationMs > 0)) throw new RangeError(`a gesture of ${durationMs} ms`);
    const box = this.target.rect();
    const t = this.target.transform();
    const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    switch (phase) {
      case 'idle':
        this.plan = { kind: 'idle' };
        break;
      case 'pan': {
        // The empty spot as drawn now, held inside the box: a pointer can only press on it.
        const from = {
          x: clamp(box.left + t.x + this.freeSpot.x * t.k, box.left, box.left + box.width),
          y: clamp(box.top + t.y + this.freeSpot.y * t.k, box.top, box.top + box.height),
        };
        this.plan = { kind: 'pan', from, w: box.width, h: box.height };
        this.target.press(from.x, from.y);
        break;
      }
      case 'zoom': {
        // In to 2.5× the start (the limit at most), then back out: the start again at the end.
        const peak = Math.log2(Math.min(t.k * ZOOM_IN, ZOOM_LIMITS[1]) / t.k);
        this.plan = {
          kind: 'wheel',
          at: centre,
          box,
          log2At: (u) => peak * (1 - Math.abs(2 * u - 1)),
        };
        break;
      }
      case 'zoomed-out': {
        // One octave past the limit, which the zoom's clamp turns into exactly the limit.
        const out = Math.log2(ZOOM_LIMITS[0] / t.k);
        const to = out < 0 ? out - 1 : 0;
        this.plan = {
          kind: 'wheel',
          at: centre,
          box,
          log2At: (u) => to * Math.min(1, u / ZOOM_OUT_RAMP),
        };
        break;
      }
      default:
        throw new Error(`no gesture for the phase ${phase}`);
    }
    this.phase = phase;
    this.since = nowMs;
    this.ms = durationMs;
    this.wheeled = 0;
  }

  /** The gesture as it is at `nowMs`: one drag or wheel event, or none while it does not move. */
  frame(nowMs: number): void {
    this.play(clamp((nowMs - this.since) / this.ms, 0, 1));
  }

  /** The gesture's last position and release, then it is over. */
  end(): void {
    if (this.phase === null) return;
    const { plan } = this;
    this.play(1);
    if (plan.kind === 'pan') this.target.release(plan.from.x, plan.from.y);
    this.plan = { kind: 'idle' };
    this.phase = null;
  }

  private play(u: number): void {
    const { plan } = this;
    if (plan.kind === 'pan') {
      this.target.drag(
        plan.from.x + PAN_SWING * plan.w * Math.sin(2 * Math.PI * u),
        plan.from.y + PAN_SWING * plan.h * Math.sin(4 * Math.PI * u),
      );
    } else if (plan.kind === 'wheel') {
      const log2 = plan.log2At(u);
      if (log2 !== this.wheeled) {
        this.target.wheel(
          plan.at.x,
          plan.at.y,
          -(log2 - this.wheeled) / WHEEL_LOG2_PER_PX,
          plan.box,
        );
        this.wheeled = log2;
      }
    }
  }
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), high);
