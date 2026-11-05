import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from '@sima/neat-ui';
import { zoomTransform } from 'd3-zoom';
import { NeatDiagramView } from '../diagram';
import type { Rect } from '../layout';
import { layoutEdges } from '../layout';
import type { NeatDiagram, NeatDiagramSet } from '../model';
import { resetReported } from '../report';
import { resize, stubResizeObserver } from '../resize-observer.testing';
import {
  DIAGRAM_MESSAGES_CONTEXT,
  DOT_FRAME_PROBE,
  type DiagramMessagesContext,
  type DiagramTransform,
  type MessagesLevel,
} from './context';
import { MAX_DOTS } from './dot-model';
import { EdgeGeometry } from './edge-geometry';
import { REFERENCE_ZOOM } from './dot-canvas';
import { MARK_MS, type NeatDiagramMessageSettings, NeatDiagramMessages } from './messages';
import type { NeatDiagramMessageStep } from './dot-model';

/** requestAnimationFrame under the test's control: a frame runs only when the test says so. */
class FakeAnimationFrames {
  readonly callbacks = new Map<number, FrameRequestCallback>();
  readonly cancelled: number[] = [];
  private nextId = 1;

  install(): void {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = this.nextId++;
      this.callbacks.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      this.cancelled.push(id);
      this.callbacks.delete(id);
    });
  }

  /** Runs one frame at `now`: every pending callback once, as the browser does. */
  run(now: number): void {
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of pending) callback(now);
  }
}

type Pixel = [number, number, number];

const ignore = (): void => undefined;

/** A dot drawn: its centre and size on the canvas (CSS px), its alpha and its sprite. */
interface Drawn {
  x: number;
  y: number;
  size: number;
  alpha: number;
  sprite: HTMLCanvasElement;
}

/** A box on the canvas, CSS px. */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A 2D context, as jsdom has none: it records the sprites drawn, and parses `#rrggbb` and the
 * layer's `rgb(r g b)` like a browser's, so the kit's colour probe resolves the theme's tokens.
 */
class FakeContext {
  readonly drawn: Drawn[] = [];
  readonly fills: string[] = [];
  /** Each path filled: its rule, the composite operation it was filled with, its round rects. */
  readonly filled: { rule: string; composite: string; rects: number }[] = [];
  /** Each path erased (filled with `destination-out`): its round rects' boxes, CSS px. */
  readonly erased: Box[][] = [];
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  private rects = 0;
  private boxes: Box[] = [];
  private style = '#000000';
  private pixel: Pixel = [0, 0, 0];

  get fillStyle(): string {
    return this.style;
  }

  set fillStyle(css: string) {
    this.fills.push(css);
    if (parse(css)) this.style = css;
  }

  drawImage(sprite: HTMLCanvasElement, x: number, y: number, w: number, h: number): void {
    this.drawn.push({ x: x + w / 2, y: y + h / 2, size: w, alpha: this.globalAlpha, sprite });
  }

  clearRect(): void {
    this.pixel = [0, 0, 0];
  }

  fillRect(): void {
    this.pixel = parse(this.style) ?? this.pixel;
  }

  getImageData(): { data: Uint8ClampedArray } {
    return { data: new Uint8ClampedArray([...this.pixel, 255]) };
  }

  beginPath(): void {
    this.rects = 0;
    this.boxes = [];
  }

  roundRect(x: number, y: number, w: number, h: number): void {
    this.rects++;
    this.boxes.push({ x, y, w, h });
  }

  fill(rule = 'nonzero'): void {
    this.filled.push({ rule, composite: this.globalCompositeOperation, rects: this.rects });
    if (this.globalCompositeOperation === 'destination-out') this.erased.push(this.boxes);
  }

  // What the layer draws besides its sprites: nothing these specs look at.
  readonly setTransform = ignore;
  readonly save = ignore;
  readonly restore = ignore;
  readonly rect = ignore;
  readonly arc = ignore;
  readonly scale = ignore;
}

function parse(css: string): Pixel | undefined {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(css);
  if (hex) return [1, 2, 3].map((i) => parseInt(hex[i], 16)) as Pixel;
  const rgb = /^rgb\((\d+) (\d+) (\d+)\)$/.exec(css);
  return rgb ? ([1, 2, 3].map((i) => Number(rgb[i])) as Pixel) : undefined;
}

const contexts = new WeakMap<HTMLCanvasElement, FakeContext>();
const fakeOf = (canvas: HTMLCanvasElement) => contexts.get(canvas)!;

/** Every canvas gets a FakeContext of its own. */
function stubCanvas(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    let context = contexts.get(this);
    if (!context) contexts.set(this, (context = new FakeContext()));
    return context as unknown as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement['getContext']);
}

/** The colour a sprite's dot is filled with (its first fill; the second is its core). */
const colourOf = (sprite: HTMLCanvasElement) => fakeOf(sprite).fills[0];

/** The theme's colours as the kit's stylesheet sets them, in hex for the fake context to parse. */
const TOKENS = `
  :root {
    --muted-foreground: #808080;
    --neat-series-1: #0000ff; --neat-series-2: #000002; --neat-series-3: #ff0000;
    --neat-series-4: #000004; --neat-series-5: #000005; --neat-series-6: #000006;
    --neat-series-7: #000007; --neat-series-8: #000008;
  }
  :root.neat-dark { --neat-series-1: #00ff00; }
`;

/** Whether the reduced-motion query matches, read by the stubbed `matchMedia`. */
let reduced = false;

function stubMotion(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('reduce') && reduced;
    },
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

/**
 * A diagram of the layer's own context, as the benchmark gives one over another renderer: `in`
 * runs 300 units right into the detector, whose step `step` runs 300 units from it to `out`;
 * `elsewhere` is an edge of another level.
 */
class FakeDiagram implements DiagramMessagesContext {
  readonly level = signal<MessagesLevel>({
    key: '[]',
    edges: [
      {
        id: 'in',
        from: 'cam',
        to: 'detector',
        series: 1,
        points: [
          { x: 0, y: 0 },
          { x: 300, y: 0 },
        ],
      },
      {
        id: 'step',
        from: 'detector',
        to: 'out',
        line: 'dashed',
        points: [
          { x: 300, y: 100 },
          { x: 600, y: 100 },
        ],
      },
    ],
  });
  readonly covers = signal<readonly Rect[]>([]);
  readonly edgeIds = signal<ReadonlySet<string>>(new Set(['in', 'step', 'elsewhere']));
  readonly focus = signal<ReadonlySet<string> | null>(null);
  readonly listeners = new Set<() => void>();
  private current: DiagramTransform = { k: REFERENCE_ZOOM, x: 0, y: 0 };

  transform(): DiagramTransform {
    return this.current;
  }

  onTransform(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Pans or zooms: the new transform, then the hook, as d3-zoom's event does. */
  move(to: DiagramTransform): void {
    this.current = to;
    for (const listener of this.listeners) listener();
  }
}

let diagram: FakeDiagram;
const probed: [number, number][] = [];

/** One second per 300 units: `in` and `step` each take 1000 ms. */
const SETTINGS: NeatDiagramMessageSettings = { speed: 300, size: 1, every: 1, steps: true };
const STEPS: Record<string, NeatDiagramMessageStep> = {
  step: { from: 'detector', stage: 'infer' },
};

@Component({
  imports: [NeatDiagramMessages],
  providers: [
    { provide: DIAGRAM_MESSAGES_CONTEXT, useFactory: () => diagram },
    { provide: DOT_FRAME_PROBE, useValue: (ms: number, dots: number) => probed.push([ms, dots]) },
  ],
  template: `
    @if (shown()) {
      <neat-diagram-messages
        [steps]="steps()"
        [passive]="passive()"
        [colours]="colours()"
        [settings]="settings()"
      />
    }
  `,
})
class ContextHost {
  readonly shown = signal(true);
  readonly steps = signal(STEPS);
  readonly passive = signal<readonly string[]>([]);
  readonly colours = signal<Record<string, number>>({});
  readonly settings = signal(SETTINGS);
  readonly layer = viewChild(NeatDiagramMessages);
}

/** A 1000 × 1000 px layer: what each frame draws (since the last call) and the layer. */
async function renderLayer() {
  const fixture = TestBed.createComponent(ContextHost);
  await fixture.whenStable();
  const element = fixture.nativeElement.querySelector('neat-diagram-messages') as HTMLElement;
  resize(new Map([[element, { w: 1000, h: 400 }]]));
  const canvas = element.querySelector('canvas') as HTMLCanvasElement;
  const layer = fixture.componentInstance.layer()!;
  /** Runs a frame at `now` and answers the dots it drew. */
  const frame = (now: number): Drawn[] => {
    const context = fakeOf(canvas);
    const from = context?.drawn.length ?? 0;
    frames.run(now);
    return fakeOf(canvas)?.drawn.slice(from) ?? [];
  };
  return { fixture, element, canvas, layer, frame };
}

/** The size a dot of 1 kB (radius 2) is drawn at by a zoom of `k`: twice its radius. */
const SIZE_1KB = (k: number) => (2 * 2 * k) / REFERENCE_ZOOM;

let frames: FakeAnimationFrames;
let sheet: HTMLStyleElement;

describe('NeatDiagramMessages', () => {
  beforeEach(() => {
    frames = new FakeAnimationFrames();
    frames.install();
    stubCanvas();
    stubResizeObserver();
    reduced = false;
    stubMotion();
    vi.stubGlobal('devicePixelRatio', 2);
    probed.length = 0;
    diagram = new FakeDiagram();
    sheet = document.createElement('style');
    sheet.textContent = TOKENS;
    document.head.append(sheet);
    localStorage.clear();
  });

  afterEach(() => {
    sheet.remove();
    TestBed.inject(ThemeService).setScheme('light', { persist: false });
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('draws a pushed message as a dot along its edge, at its share of the travel time', async () => {
    const { layer, frame } = await renderLayer();
    layer.push('in', 1000, 0);

    const [dot, ...more] = frame(500);
    expect(more).toEqual([]);
    // Half of `in`'s 300 units, at the zoom the dots have their nominal size.
    expect(dot.x).toBeCloseTo(150 * REFERENCE_ZOOM);
    expect(dot.y).toBeCloseTo(0);
    expect(dot.size).toBeCloseTo(SIZE_1KB(REFERENCE_ZOOM));
    expect(dot.alpha).toBe(1);
    expect(colourOf(dot.sprite)).toBe('rgb(0 0 255)');
  });

  it('sizes the canvas to its own box at the device pixel ratio', async () => {
    const { layer, canvas, frame } = await renderLayer();
    layer.push('in', 1000, 0);
    frame(10);
    expect([canvas.width, canvas.height]).toEqual([2000, 800]);
  });

  it('draws nothing for an edge that is not drawn, and counts it all the same', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    const { layer, frame } = await renderLayer();
    const rate = layer.rate('elsewhere');
    expect(rate().msgsPerSec).toBe(0);

    layer.push('elsewhere', 2000);
    expect(() => layer.push('nowhere', 2000)).not.toThrow();

    expect(frame(10)).toEqual([]);
    vi.advanceTimersByTime(80);
    expect(rate()).toEqual({ msgsPerSec: 1, bytesPerSec: 2000, history: [] });
    // An id that names no edge of any level is not counted: its rates would only cost memory.
    expect(layer.rate('nowhere')().msgsPerSec).toBe(0);
  });

  it('counts every message on an edge in its rate, refreshed while it is read', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    const { layer } = await renderLayer();
    const rate = layer.rate('in');
    expect(rate()).toEqual({ msgsPerSec: 0, bytesPerSec: 0, history: [] });
    expect(layer.rate('in')).toBe(rate);

    layer.push('in', 1000);
    layer.push('in', 3000);
    vi.advanceTimersByTime(80);
    expect(rate()).toEqual({ msgsPerSec: 2, bytesPerSec: 4000, history: [] });

    // A message whose size is not a number still counts, as no bytes.
    layer.push('in', NaN);
    layer.push('in', -5);
    vi.advanceTimersByTime(80);
    expect(rate()).toEqual({ msgsPerSec: 4, bytesPerSec: 4000, history: [] });

    // A second on, the history has that second.
    vi.advanceTimersByTime(1000);
    expect(rate()).toEqual({ msgsPerSec: 0, bytesPerSec: 0, history: [4] });
  });

  it('sums the rate over several edges, and gives the same signal for the same ids', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    const { layer } = await renderLayer();
    const both = layer.rate(['in', 'elsewhere']);
    expect(layer.rate(['in', 'elsewhere'])).toBe(both);
    expect(layer.rate(['in', 'in', 'elsewhere'])).toBe(both);
    expect(layer.rate(['in'])).toBe(layer.rate('in'));
    expect(layer.rate(['elsewhere', 'in'])).not.toBe(both);

    layer.push('in', 1000);
    layer.push('in', 1000);
    vi.advanceTimersByTime(1000);
    // `elsewhere` starts a second later: nothing of it before its first second.
    layer.push('in', 100);
    layer.push('elsewhere', 200);
    layer.push('elsewhere', 300);
    layer.push('elsewhere', 400);
    vi.advanceTimersByTime(80);
    expect(both()).toEqual({ msgsPerSec: 4, bytesPerSec: 1000, history: [2] });

    vi.advanceTimersByTime(1000);
    const { history } = both();
    expect(history).toEqual([2, 4]);
    expect(layer.rate('in')().history).toEqual([2, 1]);
    expect(layer.rate('elsewhere')().history).toEqual([3]);

    // The same array while nothing changed, so a sparkline redraws once a second.
    vi.advanceTimersByTime(80);
    expect(both().history).toBe(history);
    expect(layer.rate([])()).toEqual({ msgsPerSec: 0, bytesPerSec: 0, history: [] });
    expect(layer.rate(['nowhere', 'in'])().msgsPerSec).toBe(layer.rate('in')().msgsPerSec);
  });

  it('stops refreshing the rates while nothing reads them, and starts again when read', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    const { layer } = await renderLayer();
    const rate = layer.rate('in');
    expect(vi.getTimerCount()).toBe(0);
    rate();
    expect(vi.getTimerCount()).toBe(1);

    // Read after the first refresh, not after the second: it stops there.
    vi.advanceTimersByTime(80);
    rate();
    vi.advanceTimersByTime(160);
    expect(vi.getTimerCount()).toBe(0);

    layer.push('in', 1000);
    expect(rate().msgsPerSec).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('starts a step dot once its input has arrived and the stage time has passed', async () => {
    const { layer, frame } = await renderLayer();
    layer.stageMs('detector', 'infer', 200);
    layer.push('in', 1000, 0);

    // `in` arrives at 1000; the step starts at 1200.
    expect(frame(1100)).toEqual([]);
    const [dot, ...more] = frame(1300);
    expect(more).toEqual([]);
    // A tenth of the way along `step`, in its input's colour.
    expect(dot.x).toBeCloseTo(330 * REFERENCE_ZOOM);
    expect(dot.y).toBeCloseTo(100 * REFERENCE_ZOOM);
    expect(colourOf(dot.sprite)).toBe('rgb(0 0 255)');
  });

  it('splits a stage over the steps that share it', async () => {
    const { fixture, layer, frame } = await renderLayer();
    fixture.componentInstance.steps.set({ step: { from: 'detector', stage: 'infer', shares: 2 } });
    await fixture.whenStable();
    layer.stageMs('detector', 'infer', 200);
    layer.push('in', 1000, 0);

    const [dot] = frame(1150);
    expect(dot.x).toBeCloseTo(315 * REFERENCE_ZOOM);
  });

  it('starts no step dots from a passive edge, nor with steps turned off', async () => {
    const { fixture, layer, frame } = await renderLayer();
    fixture.componentInstance.passive.set(['in']);
    await fixture.whenStable();
    layer.push('in', 1000, 0);
    expect(frame(1500)).toEqual([]);

    fixture.componentInstance.passive.set([]);
    fixture.componentInstance.settings.set({ ...SETTINGS, steps: false });
    await fixture.whenStable();
    layer.push('in', 1000, 2000);
    expect(frame(3500)).toEqual([]);
  });

  it("takes an edge's colour from `colours`, else its series, else the muted colour", async () => {
    const { fixture, layer, frame } = await renderLayer();
    fixture.componentInstance.steps.set({});
    fixture.componentInstance.colours.set({ in: 3 });
    await fixture.whenStable();
    layer.push('in', 1000, 0);
    layer.push('step', 1000, 0);

    const [onIn, onStep] = frame(500);
    expect(colourOf(onIn.sprite)).toBe('rgb(255 0 0)');
    expect(colourOf(onStep.sprite)).toBe('rgb(128 128 128)');
  });

  it('moves its dots with the transform, re-mapped in the frame the hook asks for', async () => {
    const { layer, frame } = await renderLayer();
    layer.push('in', 1000, 0);
    frame(500);

    diagram.move({ k: 1.5, x: 10, y: 20 });
    const [dot] = frame(500);
    expect(dot.x).toBeCloseTo(150 * 1.5 + 10);
    expect(dot.y).toBeCloseTo(20);
    expect(dot.size).toBeCloseTo(SIZE_1KB(1.5));
  });

  it('samples a new layout of the level, and clears its dots on another level', async () => {
    const { layer, frame } = await renderLayer();
    diagram.move({ k: 1, x: 0, y: 0 });
    layer.push('in', 1000, 0);
    frame(500);

    // The same level laid out anew: the dot runs on the new route.
    const [first, second] = diagram.level().edges;
    const moved = {
      ...first,
      points: [
        { x: 0, y: 50 },
        { x: 300, y: 50 },
      ],
    };
    diagram.level.set({ key: '[]', edges: [moved, second] });
    const [dot] = frame(500);
    expect(dot.y).toBeCloseTo(50);

    // Another level: no dot stays at a place of the last one.
    diagram.level.set({ key: '["detector"]', edges: [moved, second] });
    expect(frame(600)).toEqual([]);
  });

  it('fades the dots of edges out of focus, as the diagram fades the edges', async () => {
    const { fixture, layer, frame } = await renderLayer();
    fixture.componentInstance.steps.set({});
    await fixture.whenStable();
    diagram.focus.set(new Set(['step']));
    layer.push('in', 1000, 0);
    layer.push('step', 1000, 0);

    const [onIn, onStep] = frame(500);
    expect(onIn.alpha).toBe(0.25);
    expect(onStep.alpha).toBe(1);
  });

  it('keeps its dots behind the cards they enter, overlapping cards too', async () => {
    const { canvas, layer, frame } = await renderLayer();
    diagram.covers.set([
      { x: 300, y: -20, w: 120, h: 40 },
      { x: 400, y: -10, w: 120, h: 40 },
    ]);
    layer.push('in', 1000, 0);
    frame(500);
    // Erased after the dots, as one union of the cards: where two overlap stays erased.
    const erased = fakeOf(canvas).filled.filter((f) => f.composite === 'destination-out');
    expect(erased).toEqual([{ rule: 'nonzero', composite: 'destination-out', rects: 2 }]);
    expect(fakeOf(canvas).globalCompositeOperation).toBe('source-over');
  });

  it('recolours its dots in the frame after the colour scheme changes', async () => {
    const { fixture, layer, frame } = await renderLayer();
    layer.push('in', 1000, 0);
    expect(colourOf(frame(100)[0].sprite)).toBe('rgb(0 0 255)');

    TestBed.inject(ThemeService).setScheme('dark', { persist: false });
    await fixture.whenStable();
    expect(colourOf(frame(200)[0].sprite)).toBe('rgb(0 255 0)');
  });

  it('runs its frames only while something moves', async () => {
    const { fixture, layer, frame } = await renderLayer();
    fixture.componentInstance.steps.set({});
    await fixture.whenStable();
    expect(frame(0)).toEqual([]);
    expect(probed).toEqual([]);

    layer.push('in', 1000, 0);
    frame(500);
    expect(probed.map(([, dots]) => dots)).toEqual([1]);
    // The frame after the dot arrived clears it, and is the last.
    frame(1100);
    frame(1200);
    expect(probed.map(([, dots]) => dots)).toEqual([1, 0]);
    expect(probed.every(([ms]) => ms >= 0)).toBe(true);
  });

  it('runs no frame for the messages that get no dot (messages per dot above 1)', async () => {
    const { fixture, layer, frame } = await renderLayer();
    fixture.componentInstance.steps.set({});
    fixture.componentInstance.settings.set({ ...SETTINGS, every: 2 });
    await fixture.whenStable();
    // The first message gets a dot; the second, 900 ms on, does not and arrives at 1900.
    layer.push('in', 1000, 0);
    layer.push('in', 1000, 900);
    frame(500);
    expect(frames.callbacks.size).toBe(1);
    // The dot has arrived: the hidden one is still on its way, but nothing is left to draw.
    frame(1100);
    expect(frames.callbacks.size).toBe(0);
    expect(probed.map(([, dots]) => dots)).toEqual([1, 0]);
  });

  it('stops while the page is hidden, counting its messages without dots', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    let hidden = false;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    const { layer, frame } = await renderLayer();
    const rate = layer.rate('in');
    rate();
    layer.push('in', 1000, 0);

    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.callbacks.size).toBe(0);
    layer.push('in', 1000);
    vi.advanceTimersByTime(80);
    expect(rate().msgsPerSec).toBe(2);

    // Back: the dots from before are gone, the canvas is cleared, and new messages move again.
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frame(300)).toEqual([]);
    layer.push('in', 1000, 300);
    expect(frame(400)).toHaveLength(1);
  });

  it('stops its frames and timers when destroyed', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    const { fixture, layer } = await renderLayer();
    layer.rate('in')();
    layer.push('in', 1000, 0);
    expect(vi.getTimerCount()).toBe(1);

    fixture.componentInstance.shown.set(false);
    await fixture.whenStable();
    expect(vi.getTimerCount()).toBe(0);
    expect(diagram.listeners.size).toBe(0);
    frames.run(500);
    expect(probed).toEqual([]);
    expect(() => layer.push('in', 1000, 600)).not.toThrow();
    frames.run(700);
    expect(probed).toEqual([]);
  });

  it('cancels no frame it has not asked for, hidden or destroyed while idle', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const { fixture } = await renderLayer();
    document.dispatchEvent(new Event('visibilitychange'));
    fixture.componentInstance.shown.set(false);
    await fixture.whenStable();
    expect(frames.cancelled).not.toContain(0);
  });

  it('draws no travelling dots under reduced motion, a brief mark at the end instead', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    reduced = true;
    const { layer, frame } = await renderLayer();
    diagram.move({ k: 1, x: 0, y: 0 });
    const rate = layer.rate('in');
    layer.push('in', 1000, 0);

    const marks = [frame(50), frame(MARK_MS / 2)];
    for (const [mark, ...more] of marks) {
      expect(more).toEqual([]);
      // Its radius short of the end, where the card it enters would hide half of it.
      expect(mark.x).toBeCloseTo(300 - 2 / REFERENCE_ZOOM);
      expect(mark.y).toBeCloseTo(0);
    }
    expect(frame(MARK_MS + 50)).toEqual([]);
    vi.advanceTimersByTime(80);
    expect(rate().msgsPerSec).toBe(1);

    // Its dot and its step's are still due in the model, but nothing draws them: no more frames.
    const drawnFrames = probed.length;
    frames.run(MARK_MS + 100);
    expect(probed).toHaveLength(drawnFrames);
  });

  it('keeps at most MAX_DOTS through a burst, dropping the oldest, and counts every message', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    const { layer, frame } = await renderLayer();
    const rate = layer.rate('in');
    // Each message places two dots, its own and its step's: 20 000 for the pool's 16 384.
    for (let i = 0; i < 10_000; i++) layer.push('in', 1000, 0);

    const dots = frame(500);
    expect(dots.length).toBeLessThanOrEqual(MAX_DOTS);
    expect(dots).toHaveLength(10_000 - (20_000 - MAX_DOTS) / 2);
    expect(probed.at(-1)?.[1]).toBe(dots.length);
    // The second's count has every message (the rate's ring holds the latest 4096 of a window).
    vi.advanceTimersByTime(1080);
    expect(rate().history).toEqual([10_000]);
  });
});

/**
 * A camera feeding a decoder on the overview, the edge labelled; the decoder opens a level with
 * its steps.
 */
const SYSTEM: NeatDiagramSet = {
  overview: {
    nodes: [
      { id: 'camera', role: 'block', label: 'Camera', x: 0, y: 0, w: 120, h: 40 },
      {
        id: 'decode',
        role: 'block',
        label: 'Decode',
        opens: 'decode',
        x: 400,
        y: 0,
        w: 120,
        h: 40,
      },
    ],
    edges: [{ id: 'frames', from: 'camera', to: 'decode', series: 1, label: 'frames' }],
  },
  levels: {
    decode: {
      nodes: [
        { id: 'parse', role: 'block', label: 'Parse', x: 0, y: 0, w: 120, h: 40 },
        { id: 'scale', role: 'block', label: 'Scale', x: 300, y: 0, w: 120, h: 40 },
      ],
      edges: [{ id: 'parsed', from: 'parse', to: 'scale', series: 2 }],
    },
  },
};

@Component({
  imports: [NeatDiagramView, NeatDiagramMessages],
  template: `
    <neat-diagram [diagram]="diagram" label="A system" [(level)]="level">
      <neat-diagram-messages [settings]="settings" />
    </neat-diagram>
  `,
})
class DiagramHost {
  readonly diagram = SYSTEM;
  readonly level = signal<string[]>([]);
  readonly settings = SETTINGS;
  readonly layer = viewChild.required(NeatDiagramMessages);
}

describe('NeatDiagramMessages in neat-diagram', () => {
  beforeEach(() => {
    frames = new FakeAnimationFrames();
    frames.install();
    stubCanvas();
    stubResizeObserver();
    reduced = false;
    stubMotion();
    sheet = document.createElement('style');
    sheet.textContent = TOKENS;
    document.head.append(sheet);
  });

  afterEach(() => {
    sheet.remove();
    resetReported();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderDiagram() {
    const fixture = TestBed.createComponent(DiagramHost);
    await fixture.whenStable();
    const host = fixture.nativeElement.querySelector('neat-diagram') as HTMLElement;
    for (const [name, value] of [
      ['clientWidth', 800],
      ['clientHeight', 600],
    ] as const) {
      Object.defineProperty(host, name, { configurable: true, value });
    }
    const element = host.querySelector('neat-diagram-messages') as HTMLElement;
    resize(
      new Map([
        [host, { w: 800, h: 600 }],
        [element, { w: 800, h: 600 }],
      ]),
    );
    await fixture.whenStable();
    const canvas = element.querySelector('canvas') as HTMLCanvasElement;
    const frame = (now: number): Drawn[] => {
      const from = fakeOf(canvas)?.drawn.length ?? 0;
      frames.run(now);
      return fakeOf(canvas)?.drawn.slice(from) ?? [];
    };
    return { fixture, host, element, layer: fixture.componentInstance.layer(), frame };
  }

  /** Where `share` of `edge` of `level` is on the canvas, through the diagram's transform. */
  function onScreen(host: HTMLElement, level: NeatDiagram, edge: string, share: number) {
    const geometry = EdgeGeometry.fromPoints(layoutEdges(level).get(edge)!.points);
    const at = geometry.at(share, { x: 0, y: 0 });
    const { k, x, y } = zoomTransform(host);
    return { x: at.x * k + x, y: at.y * k + y };
  }

  it('draws over the drawing, under the level bar, without catching the pointer', async () => {
    const { host, element } = await renderDiagram();
    expect(element.parentElement).toBe(host);
    expect(element.previousElementSibling?.classList).toContain('content');
    expect(element.getAttribute('aria-hidden')).toBe('true');
  });

  it("puts a message's dot on its edge's drawn route, through the diagram's transform", async () => {
    const { host, layer, frame } = await renderDiagram();
    const length = EdgeGeometry.fromPoints(
      layoutEdges(SYSTEM.overview).get('frames')!.points,
    ).length;
    const travel = (length / SETTINGS.speed) * 1000;
    layer.push('frames', 1000, 0);

    const [dot] = frame(travel / 2);
    const expected = onScreen(host, SYSTEM.overview, 'frames', 0.5);
    expect(dot.x).toBeCloseTo(expected.x);
    expect(dot.y).toBeCloseTo(expected.y);
  });

  it('moves the dots with a pan, in the next frame', async () => {
    const { host, layer, frame } = await renderDiagram();
    layer.push('frames', 1000, 0);
    const [before] = frame(100);

    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    const [after] = frame(100);
    expect(after.x - before.x).toBeCloseTo(48);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('draws the edges of the level shown, clearing the dots of the last', async () => {
    const { fixture, host, layer, frame } = await renderDiagram();
    layer.push('frames', 1000, 0);
    layer.push('parsed', 1000, 0);
    expect(frame(100)).toHaveLength(1);

    fixture.componentInstance.level.set(['decode']);
    await fixture.whenStable();
    expect(frame(150)).toEqual([]);

    layer.push('parsed', 1000, 200);
    const [dot] = frame(200);
    const expected = onScreen(host, SYSTEM.levels!['decode'], 'parsed', 0);
    expect(dot.x).toBeCloseTo(expected.x);
    expect(dot.y).toBeCloseTo(expected.y);
  });

  /** `frames` runs straight from (120, 20) to (400, 20): its label is centred on (260, 20). */
  const LABEL_AT = { x: 260, y: 20 };
  /** The label's border box as a browser measures it (diagram units: a zoom does not change it). */
  const LABEL_SIZE = { w: 44, h: 18 };

  /** Measures the edge label as a browser would after layout. */
  async function measureLabel(fixture: { whenStable(): Promise<unknown> }, host: HTMLElement) {
    const label = host.querySelector('.edge-label[data-edge="frames"]') as HTMLElement;
    resize(new Map([[label, LABEL_SIZE]]));
    await fixture.whenStable();
  }

  /** The label's box, 2 px clear of its border all round, on the canvas through the transform. */
  function labelOnScreen(host: HTMLElement): Box {
    const { k, x, y } = zoomTransform(host);
    return {
      x: (LABEL_AT.x - LABEL_SIZE.w / 2 - 2) * k + x,
      y: (LABEL_AT.y - LABEL_SIZE.h / 2 - 2) * k + y,
      w: (LABEL_SIZE.w + 4) * k,
      h: (LABEL_SIZE.h + 4) * k,
    };
  }

  /** The boxes erased in the last frame. */
  const lastErased = (element: HTMLElement) =>
    fakeOf(element.querySelector('canvas')!).erased.at(-1) ?? [];

  /** Whether the dot's whole square lies inside `box`: erased, nothing of it is left. */
  const covered = (dot: Drawn, box: Box) =>
    dot.x - dot.size / 2 >= box.x &&
    dot.x + dot.size / 2 <= box.x + box.w &&
    dot.y - dot.size / 2 >= box.y &&
    dot.y + dot.size / 2 <= box.y + box.h;

  /** Whether any of the dot's square lies inside `box`. */
  const touches = (dot: Drawn, box: Box) =>
    dot.x + dot.size / 2 > box.x &&
    dot.x - dot.size / 2 < box.x + box.w &&
    dot.y + dot.size / 2 > box.y &&
    dot.y - dot.size / 2 < box.y + box.h;

  /** How long a message takes along `frames`. */
  const framesTravel = () =>
    (EdgeGeometry.fromPoints(layoutEdges(SYSTEM.overview).get('frames')!.points).length /
      SETTINGS.speed) *
    1000;

  it('erases a dot that runs through an edge label, 2 px clear of its border', async () => {
    const { fixture, host, element, layer, frame } = await renderDiagram();
    await measureLabel(fixture, host);
    layer.push('frames', 1000, 0);

    // Halfway, the dot is at the label's centre: drawn, then erased with the label's box.
    const [dot] = frame(framesTravel() / 2);
    const label = labelOnScreen(host);
    const erased = lastErased(element);
    expect(erased).toHaveLength(3);
    const box = erased.find((b) => Math.abs(b.x - label.x) < 1e-6)!;
    expect(box.x).toBeCloseTo(label.x);
    expect(box.y).toBeCloseTo(label.y);
    expect(box.w).toBeCloseTo(label.w);
    expect(box.h).toBeCloseTo(label.h);
    expect(covered(dot, box)).toBe(true);
  });

  it('leaves the dots away from the labels and cards as they are', async () => {
    const { fixture, host, element, layer, frame } = await renderDiagram();
    await measureLabel(fixture, host);
    layer.push('frames', 1000, 0);

    // A tenth of the way, the dot is between the camera and the label: nothing erases it.
    const [dot] = frame(framesTravel() / 10);
    expect(dot).toBeDefined();
    expect(lastErased(element).filter((box) => touches(dot, box))).toEqual([]);
  });

  it("keeps an edge label's box on the label through a zoom and a pan", async () => {
    const { fixture, host, element, layer, frame } = await renderDiagram();
    await measureLabel(fixture, host);
    layer.push('frames', 1000, 0);
    const before = zoomTransform(host);

    host.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    const after = zoomTransform(host);
    expect(after.k).not.toBeCloseTo(before.k);

    const [dot] = frame(framesTravel() / 2);
    const label = labelOnScreen(host);
    const box = lastErased(element).find((b) => Math.abs(b.x - label.x) < 1e-6)!;
    expect(box).toBeDefined();
    expect(box.y).toBeCloseTo(label.y);
    expect(box.w).toBeCloseTo(label.w);
    expect(box.h).toBeCloseTo(label.h);
    expect(covered(dot, box)).toBe(true);
  });

  it('erases nothing for an edge label not measured yet', async () => {
    const { element, layer, frame } = await renderDiagram();
    layer.push('frames', 1000, 0);
    frame(100);
    expect(lastErased(element)).toHaveLength(2);
  });

  it("keeps the dots behind the level's blocks", async () => {
    const { element, layer, frame } = await renderDiagram();
    layer.push('frames', 1000, 0);
    frame(100);
    // The level's two blocks, erased from the dots in one union.
    const erased = fakeOf(element.querySelector('canvas')!).filled.filter(
      (f) => f.composite === 'destination-out',
    );
    expect(erased.map((f) => f.rects)).toEqual([2]);
  });
});
