import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  NgZone,
  type Signal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { neatThemeColors } from '@sima/neat-ui';
import { DIAGRAM_MESSAGES_CONTEXT, DOT_FRAME_PROBE, type MessagesEdge } from './context';
import { DotCanvas, type DotMark } from './dot-canvas';
import {
  chainOf,
  DotEvery,
  DotModel,
  dotRadius,
  MAX_DOTS,
  type NeatDiagramMessageStep,
  travelTime,
} from './dot-model';
import { EdgeGeometry } from './edge-geometry';
import { EdgeRates } from './rates';

/** How the layer animates its dots: tuning only, the numbers count every message regardless. */
export interface NeatDiagramMessageSettings {
  /** How fast a dot moves along any edge, in diagram units per second: a long edge takes longer. */
  readonly speed: number;
  /** A factor on each dot's radius (which grows with its message's size). */
  readonly size: number;
  /**
   * Messages per dot, a whole number: each edge shows a dot for every Nth message on it (1: every
   * message), so a busy edge shows gaps instead of a solid band.
   */
  readonly every: number;
  /** Whether dots go on through the blocks' steps (the layer's `steps`). */
  readonly steps: boolean;
}

/** The demo's settings: its median overview edge takes about 1.2 s at this speed. */
export const MESSAGE_DEFAULTS: NeatDiagramMessageSettings = Object.freeze({
  speed: 270,
  size: 1,
  every: 1,
  steps: true,
});

/** An edge's messages and bytes per second over the last second, and its messages per second. */
export interface NeatDiagramEdgeRate {
  readonly msgsPerSec: number;
  readonly bytesPerSec: number;
  /** Messages in each whole second before this one, oldest first, at most the last 60. */
  readonly history: readonly number[];
}

/** How long a message's mark shows at its edge's end under reduced motion. */
export const MARK_MS = 400;

/** How often the rates read are refreshed (about 12 Hz: they still read as live). */
const NUMBERS_MS = 80;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * The dots' colours, by colour number (0 the muted colour of an edge without a series, 1 to 8 the
 * series): the tokens `lineColour` in drawing.ts draws the edges in, so a dot is its edge's colour.
 */
const PALETTE_TOKENS = {
  muted: '--muted-foreground',
  ...Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => [`series${i + 1}`, `--neat-series-${i + 1}`]),
  ),
} as Record<string, string>;
const PALETTE_ORDER = ['muted', ...Array.from({ length: 8 }, (_, i) => `series${i + 1}`)];

const NO_CHAIN: ReadonlyMap<string, readonly string[]> = new Map();

const isSeries = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 8;

/** An edge's dots' colour number: the app's choice, else the edge's series as it is drawn. */
function colourOf(edge: MessagesEdge, chosen: unknown): number {
  if (isSeries(chosen)) return chosen;
  return edge.line !== 'ghost' && isSeries(edge.series) ? edge.series : 0;
}

const sameRate = (a: NeatDiagramEdgeRate, b: NeatDiagramEdgeRate) =>
  a.msgsPerSec === b.msgsPerSec && a.bytesPerSec === b.bytesPerSec && a.history === b.history;

/**
 * The messages moving through a diagram, projected into it:
 *
 * ```html
 * <neat-diagram [diagram]="system" label="The demo's system">
 *   <neat-diagram-messages [steps]="steps" [settings]="settings()" />
 * </neat-diagram>
 * ```
 *
 * The app feeds it by id: `push(edgeId, bytes)` for each message on an edge, and
 * `stageMs(nodeId, stage, ms)` for the stage times its step dots take. A message on an edge drawn
 * now is a dot along it, sized by its bytes, as long on its way as the edge's length at `speed`
 * (every Nth message with `every`); its colour is its edge's (`colours` picks another series). A
 * step (`steps`, keyed by edge id) is an edge inside a block that no message feeds: a dot arriving
 * at its start goes on along it once the stage's time has passed, and so on along the chain, so the
 * dots inside a block follow its real input and its measured stages. A `passive` edge's messages
 * end where it enters, starting no steps.
 *
 * `rate(edgeId)` is the edge's messages and bytes per second and its history, for the notes an app
 * fills, refreshed at 12 Hz while something reads it. Every edge of every level counts, so a level
 * opens with its numbers; an id that is no edge of the diagram is not counted at all, so the rates'
 * memory stays bounded by the diagram's edges.
 *
 * All dots are drawn on one canvas over the drawing, sized to this element's box (it fills the
 * diagram's), at the device's pixel ratio, scaled with the zoom and behind the cards; dots of
 * edges out of focus fade with them. The frames run only while a dot is on its way and stop while
 * the page is hidden (its messages then still count, without dots). Under reduced motion no dot
 * travels: each message shows as a brief mark at its edge's end.
 */
@Component({
  selector: 'neat-diagram-messages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: '<canvas #canvas></canvas>',
  styleUrl: './messages.css',
})
export class NeatDiagramMessages {
  /** The steps, keyed by edge id: whose stage times each and what follows it. */
  readonly steps = input<Readonly<Record<string, NeatDiagramMessageStep>>>({});
  /** Edges whose messages end where they enter, starting no step dots (a side input). */
  readonly passive = input<readonly string[]>([]);
  /** A series (1 to 8) per edge id for its dots, in place of the edge's own colour. */
  readonly colours = input<Readonly<Record<string, number>>>({});
  readonly settings = input<NeatDiagramMessageSettings>(MESSAGE_DEFAULTS);

  private readonly diagram = inject(DIAGRAM_MESSAGES_CONTEXT);
  private readonly probe = inject(DOT_FRAME_PROBE, { optional: true });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly canvasElement = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  /** Read again on a scheme change, so the next frame paints the new colours. */
  private readonly theme = neatThemeColors(PALETTE_TOKENS, () => this.host);
  private readonly palette = computed(() => {
    const colours = this.theme();
    return PALETTE_ORDER.map((name) => colours[name]);
  });
  /** Read by the canvas once it has a box to draw in: resolving the colours draws on a canvas. */
  private readonly readPalette = () => this.palette();

  private readonly rates = new EdgeRates();
  /** The rates hear every dot placed, step dots and dots the pool drops included. */
  private readonly model = new DotModel(MAX_DOTS, (edge, atMs, bytes) =>
    this.rates.count(edge, bytes, atMs),
  );
  private readonly every = new DotEvery();
  /** The latest stage times, by node and stage. */
  private readonly stages = new Map<string, Map<string, number>>();
  /** Under reduced motion, each drawn edge's latest message, shown at its end. */
  private readonly marks = new Map<string, DotMark>();
  private marksUntil = -Infinity;
  /** Its `matches` is read at each frame, so a setting changed on an open page applies. */
  private readonly motion: MediaQueryList | null =
    typeof matchMedia === 'function' ? matchMedia(REDUCED_MOTION) : null;
  private canvas: DotCanvas | null = null;
  private frame = 0;
  /** The latest time drawn for, so a frame never goes back. */
  private lastNow = -Infinity;
  private destroyed = false;

  /** What the model was last given: the level's key, its chain and travel times. */
  private levelKey: string | null = null;
  private chainGiven: ReadonlyMap<string, readonly string[]> | null = null;
  private travelGiven: ReadonlyMap<string, number> | null = null;

  /** Ticks at 12 Hz while the rates are read (`rate`); each rate signal reads it. */
  private readonly numbers = signal(0);
  private numbersTimer: ReturnType<typeof setInterval> | undefined;
  /** Whether a rate signal was read since the last tick. */
  private numbersRead = false;
  private readonly rateSignals = new Map<string, Signal<NeatDiagramEdgeRate>>();

  /** Each drawn edge's shape, sampled once per layout (a new level value). */
  private readonly geometry = computed(
    () =>
      new Map(
        this.diagram.level().edges.map((edge) => [edge.id, EdgeGeometry.fromPoints(edge.points)]),
      ),
  );
  private readonly speed = computed(() => this.settings().speed);
  private readonly travel = computed(() => {
    const speed = this.speed();
    const travel = new Map<string, number>();
    for (const [id, edge] of this.geometry()) travel.set(id, travelTime(edge.length, speed));
    return travel;
  });
  private readonly stepsOn = computed(() => this.settings().steps);
  /** What follows each drawn edge: the steps leaving the node it enters, unless it is passive. */
  private readonly chain = computed(() => {
    if (!this.stepsOn()) return NO_CHAIN;
    const next = chainOf(this.diagram.level().edges, this.steps());
    for (const id of this.passive()) next.delete(id);
    return next;
  });
  private readonly edgeColours = computed(() => {
    const chosen = this.colours();
    return new Map(
      this.diagram
        .level()
        .edges.map((edge) => [
          edge.id,
          colourOf(edge, Object.hasOwn(chosen, edge.id) ? chosen[edge.id] : undefined),
        ]),
    );
  });

  constructor() {
    const stopTransform = this.diagram.onTransform(this.wake);
    let observer: ResizeObserver | null = null;
    // The canvas and the observer once rendered; the listeners outside the zone, as the frames.
    afterNextRender(() =>
      this.zone.runOutsideAngular(() => {
        if (this.destroyed) return;
        this.canvas = new DotCanvas(this.canvasElement().nativeElement, this.host);
        observer = new ResizeObserver((entries) => {
          const box = entries.at(-1)?.borderBoxSize?.[0];
          if (!box) return;
          this.canvas?.size(box.inlineSize, box.blockSize);
          this.wake();
        });
        observer.observe(this.host);
        this.document.addEventListener('visibilitychange', this.visibility);
      }),
    );
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      stopTransform();
      observer?.disconnect();
      this.document.removeEventListener('visibilitychange', this.visibility);
      clearInterval(this.numbersTimer);
      this.numbersTimer = undefined;
      this.model.clear();
    });
  }

  /**
   * A message of `bytes` on `edgeId`, starting at `atMs` (on the `performance.now()` clock; now
   * by default, or a little later to spread a batch received together). Counted in the edge's
   * rate, and drawn as a dot while the edge is drawn. A size that is not a number counts as no
   * bytes; an id that is no edge of the diagram is ignored.
   */
  push(edgeId: string, bytes: number, atMs: number = performance.now()): void {
    if (this.destroyed) return;
    untracked(() => {
      if (!this.diagram.edgeIds().has(edgeId)) return;
      const size = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
      const drawn = this.sync().has(edgeId);
      if (!drawn || this.document.hidden) {
        this.rates.count(edgeId, size, atMs);
        return;
      }
      this.every.set(this.settings().every);
      const colour = this.edgeColours().get(edgeId) ?? 0;
      this.model.spawn(edgeId, atMs, size, colour, this.every.take(edgeId));
      if (this.motion?.matches) this.mark(edgeId, atMs, size, colour);
      this.request();
    });
  }

  /**
   * The time `stage` of `nodeId` takes now, in ms: what a step dot timed by it waits before it
   * starts (`steps`). A time that is not a number, or below 0, forgets the stage's time.
   */
  stageMs(nodeId: string, stage: string, ms: number): void {
    const stages = this.stages.get(nodeId) ?? new Map<string, number>();
    this.stages.set(nodeId, stages);
    if (Number.isFinite(ms) && ms >= 0) stages.set(stage, ms);
    else stages.delete(stage);
  }

  /**
   * `edgeId`'s messages and bytes per second over the last second and its history, refreshed at
   * 12 Hz while something reads it (a template, an effect); the same signal for the same id.
   */
  rate(edgeId: string): Signal<NeatDiagramEdgeRate> {
    let rate = this.rateSignals.get(edgeId);
    if (!rate) {
      rate = computed(
        () => {
          this.numbers();
          this.numbersWanted();
          const now = performance.now();
          const { msgsPerSec, bytesPerSec } = this.rates.snapshot(edgeId, now);
          return { msgsPerSec, bytesPerSec, history: this.rates.history(edgeId, now) };
        },
        { equal: sameRate },
      );
      this.rateSignals.set(edgeId, rate);
    }
    return rate;
  }

  /**
   * Keeps the 12 Hz tick going while the rates are read. A tick nobody read since the last stops
   * it; the tick left the signals stale, so the next read computes afresh and starts it again.
   */
  private numbersWanted(): void {
    this.numbersRead = true;
    if (this.numbersTimer !== undefined || this.destroyed) return;
    this.numbersTimer = this.zone.runOutsideAngular(() =>
      setInterval(() => {
        if (!this.numbersRead) {
          clearInterval(this.numbersTimer);
          this.numbersTimer = undefined;
          return;
        }
        this.numbersRead = false;
        this.numbers.update((n) => n + 1);
      }, NUMBERS_MS),
    );
  }

  /**
   * Gives the model what the level and the inputs say, when they have changed: another level
   * clears the dots (its edges are other edges), the chain and the travel times follow the
   * layout and the settings. Answers the drawn edges' shapes. Called by each push and frame, so
   * a push right after a change of level already goes by the new one.
   */
  private sync(): ReadonlyMap<string, EdgeGeometry> {
    const level = this.diagram.level();
    if (level.key !== this.levelKey) {
      if (this.levelKey !== null) this.clear();
      this.levelKey = level.key;
    }
    const chain = this.chain();
    if (chain !== this.chainGiven) {
      this.model.setChain(chain, this.stageDelay);
      this.chainGiven = chain;
    }
    const travel = this.travel();
    if (travel !== this.travelGiven) {
      this.model.setTravel(travel);
      this.travelGiven = travel;
    }
    return this.geometry();
  }

  /** A step's wait: its stage's latest time, split evenly over the steps that share it. */
  private readonly stageDelay = (step: string): number => {
    const steps = this.steps();
    if (!Object.hasOwn(steps, step)) return 0;
    const { from, stage, shares } = steps[step];
    const ms = this.stages.get(from)?.get(stage) ?? 0;
    return shares !== undefined && Number.isFinite(shares) && shares > 0 ? ms / shares : ms;
  };

  private mark(edge: string, at: number, bytes: number, colour: number): void {
    let mark = this.marks.get(edge);
    if (!mark) this.marks.set(edge, (mark = { edge, at, r: 0, colour }));
    mark.at = at;
    mark.r = dotRadius(bytes);
    mark.colour = colour;
    this.marksUntil = Math.max(this.marksUntil, at + MARK_MS);
  }

  private clear(): void {
    this.model.clear();
    this.marks.clear();
    this.marksUntil = -Infinity;
  }

  /** Whether a dot or a mark still has to be drawn after `now`. */
  private busy(now: number): boolean {
    return this.model.size > 0 || this.marksUntil > now;
  }

  /** A frame, unless one is coming, the page is hidden or the layer is gone. */
  private request(): void {
    if (this.frame !== 0 || this.destroyed || this.document.hidden) return;
    this.frame = this.zone.runOutsideAngular(() => requestAnimationFrame(this.tick));
  }

  /** A new transform or box: drawn again in the next frame, if anything is on the canvas. */
  private readonly wake = (): void => {
    if (this.busy(this.lastNow)) this.request();
  };

  private readonly visibility = (): void => {
    if (this.document.hidden) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      // What was on its way while the page was away would all come at once, long after.
      this.clear();
    } else {
      // One frame clears what was drawn before the page was hidden.
      this.request();
    }
  };

  private readonly tick = (time: number): void => {
    this.frame = 0;
    if (this.destroyed) return;
    const started = this.probe ? performance.now() : 0;
    const drawn = this.draw(time);
    if (drawn !== null) this.probe?.(performance.now() - started, drawn);
    if (this.busy(this.lastNow)) this.request();
  };

  /** This frame's dots or marks; null while there is nothing to draw on. */
  private draw(time: number): number | null {
    const now = Math.max(time, this.lastNow);
    this.lastNow = now;
    const geometry = this.sync();
    const dots = this.model.advance(now);
    const ratio =
      typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
    const canvas = this.canvas;
    if (!canvas?.begin(ratio, this.readPalette, geometry, this.diagram.transform())) return null;
    const size = this.settings().size;
    const scale = Number.isFinite(size) && size > 0 ? size : 1;
    const focus = this.diagram.focus();
    const covers = this.diagram.covers();
    return this.motion?.matches
      ? canvas.drawMarks(this.marks.values(), now - MARK_MS, now, scale, focus, covers)
      : canvas.drawDots(dots, scale, focus, covers);
  }
}
