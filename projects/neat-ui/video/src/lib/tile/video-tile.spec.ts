import { afterEveryRender, Component, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { NeatTone } from '@sima/neat-ui';
import { OVERLAY_PALETTE } from '../theme/overlay-palette';
import type { NeatMetadataMessage } from '../sync/metadata-message';
import type { NeatOverlaySettings } from '../overlays/overlay-settings';
import { NEAT_OVERLAY_DEFAULTS } from '../overlays/overlay-settings';
import { letterbox } from '../overlays/letterbox';
import { mapRoi } from '../overlays/roi';
import { overlaySettings, RecordingContext } from '../overlays/spec-helpers';
import type { NeatEncodedFrame, NeatEncodedFrames, NeatTileSource } from './tile-source';
import type { NeatTileFrame, NeatTileFrameListener, NeatVideoBox } from './video-tile';
import { NEAT_STREAM_STALE_MS, NeatFrameStats, NeatTileState, NeatVideoTile } from './video-tile';

/** A source whose stream and metadata the test controls. */
class FakeSource implements NeatTileSource {
  readonly stream = signal<MediaStream | null>(null);
  readonly listeners = new Set<(text: string, receivedAt: number) => void>();

  onMetadata(listener: (text: string, receivedAt: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(message: NeatMetadataMessage | string): void {
    const text = typeof message === 'string' ? message : JSON.stringify(message);
    for (const listener of this.listeners) listener(text, performance.now());
  }
}

/** A source that may also have a run of encoded frames, which the test sets. */
class FakeFramesSource extends FakeSource {
  readonly frames = signal<NeatEncodedFrames | null>(null);
}

/** A run of encoded frames the test feeds; it takes any number of listeners, as a real run does. */
class FakeRun implements NeatEncodedFrames {
  readonly listeners = new Set<(frame: NeatEncodedFrame) => void>();

  onFrame(listener: (frame: NeatEncodedFrame) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** A frame arrives, due at once. */
  emit(rtpTimestamp: number | null): void {
    const frame = { data: new Blob(['jpeg']), rtpTimestamp, presentAt: performance.now() };
    for (const listener of this.listeners) listener(frame);
  }
}

/**
 * jsdom plays no media; a stand-in with one video track is enough for the tile to hand to the video
 * element. The track is a plain EventTarget, so a test can dispatch `unmute` on it.
 */
function fakeStream(id: string): MediaStream {
  const track = new EventTarget();
  return { id, getVideoTracks: () => [track] } as unknown as MediaStream;
}

const STREAM = fakeStream('a');
const STREAM_B = fakeStream('b');

type FrameCallback = (now: number, metadata: Partial<VideoFrameCallbackMetadata>) => void;

/**
 * requestVideoFrameCallback on every video element, which jsdom lacks, with frames the test
 * presents. The video reports a current frame and a 640×480 picture.
 */
class FakeVideoFrames {
  readonly callbacks = new Map<number, FrameCallback>();
  readonly canceled: number[] = [];
  private nextId = 1;

  install(): void {
    Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
      configurable: true,
      value: (callback: FrameCallback): number => {
        const id = this.nextId++;
        this.callbacks.set(id, callback);
        return id;
      },
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback', {
      configurable: true,
      value: (id: number): void => {
        this.canceled.push(id);
        this.callbacks.delete(id);
      },
    });
  }

  uninstall(): void {
    const prototype = HTMLVideoElement.prototype as unknown as Record<string, unknown>;
    delete prototype['requestVideoFrameCallback'];
    delete prototype['cancelVideoFrameCallback'];
  }

  /** Presents a frame, timed `ageMs` before now. */
  present(rtpTimestamp: number | null, ageMs = 0): void {
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    const metadata = rtpTimestamp === null ? {} : { rtpTimestamp };
    for (const callback of pending) callback(performance.now() - ageMs, metadata);
  }
}

/** A ResizeObserver that reports only when a test says so. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  /** What it was first asked to observe; `disconnect` empties `observed`. */
  target: Element | null = null;
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.target ??= target;
    this.observed.push(target);
  }

  disconnect(): void {
    this.observed.length = 0;
    this.disconnected = true;
  }

  resize(width: number, height: number): void {
    const entry = {
      target: this.observed[0],
      contentRect: { width, height },
      borderBoxSize: [{ inlineSize: width, blockSize: height }],
    };
    this.callback([entry as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

/** The observer that watches the tile's own size (the bar has one of its own). */
function hostObserver(): FakeResizeObserver {
  const found = FakeResizeObserver.instances.find((o) => o.target?.localName === 'neat-video-tile');
  if (!found) throw new Error('no observer on the tile');
  return found;
}

@Component({
  imports: [NeatVideoTile],
  template: `
    <neat-video-tile
      [source]="source()"
      [settings]="settings()"
      [retentionMs]="retentionMs()"
      [channel]="3"
      [label]="label()"
      [status]="status()"
      [bars]="bars()"
      [notice]="notice()"
      [noticeTone]="noticeTone()"
      [selected]="selected()"
      [mirror]="mirror()"
      [flipVertical]="flipVertical()"
      [frameListener]="frameListener()"
      [expandControl]="expandControl()"
      [(expanded)]="expanded"
      (stateChange)="states.push($event)"
      (frameStats)="stats.push($event)"
    >
      <span neatTileChip class="chip">Metadata late</span>
      <div neatTileOverlay class="projected-overlay"></div>
    </neat-video-tile>
  `,
})
class Host {
  readonly source = signal<NeatTileSource | null>(null);
  readonly settings = signal<NeatOverlaySettings>(NEAT_OVERLAY_DEFAULTS);
  readonly retentionMs = signal(0);
  readonly label = signal('3');
  readonly status = signal<string | null>('H.264 · 640×480 · 30.0 fps');
  readonly bars = signal(true);
  readonly notice = signal<string | null>(null);
  readonly noticeTone = signal<NeatTone>('warning');
  readonly selected = signal(false);
  readonly mirror = signal(false);
  readonly flipVertical = signal(false);
  readonly frameListener = signal<NeatTileFrameListener | null>(null);
  readonly expandControl = signal(false);
  readonly expanded = signal(false);
  readonly states: NeatTileState[] = [];
  readonly stats: NeatFrameStats[] = [];
  /** Application renders, whichever views they refresh. */
  renders = 0;

  constructor() {
    afterEveryRender(() => {
      this.renders += 1;
    });
  }
}

function detection(rtpTimestamp: number | null, bbox: number[]): NeatMetadataMessage {
  return {
    type: 'object-detection',
    data: { objects: [{ label: 'person', confidence: 0.9, bbox }] },
    ...(rtpTimestamp === null ? {} : { _insight: { rtp_timestamp: rtpTimestamp } }),
  };
}

function tracking(rtpTimestamp: number, ids: string[]): NeatMetadataMessage {
  return {
    type: 'tracking',
    data: { tracks: ids.map((id, i) => ({ id, bbox: [i * 100 + rtpTimestamp, 10, 50, 50] })) },
    _insight: { rtp_timestamp: rtpTimestamp },
  };
}

function classification(rtpTimestamp: number, label: string): NeatMetadataMessage {
  return {
    type: 'classification',
    data: { top_classes: [{ label, confidence: 0.8 }] },
    _insight: { rtp_timestamp: rtpTimestamp },
  };
}

/**
 * The rules of the document's stylesheets whose selector passes `test`, for what jsdom does not
 * compute (pseudo-element styles, a state the spec does not reach).
 */
function rulesFor(test: (selector: string) => boolean): CSSStyleRule[] {
  return Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
    .filter((rule) => test(rule.selectorText));
}

describe('NeatVideoTile', () => {
  let fixture: ComponentFixture<Host>;
  let source: FakeSource;
  let frames: FakeVideoFrames;
  let context: RecordingContext;
  let readyState: ReturnType<typeof vi.spyOn>;
  let videoWidth: ReturnType<typeof vi.spyOn>;
  let videoHeight: ReturnType<typeof vi.spyOn>;
  let play: ReturnType<typeof vi.spyOn>;

  const host = () => fixture.componentInstance;
  const tileElement = (): HTMLElement => fixture.nativeElement.querySelector('neat-video-tile');
  const tile = (): NeatVideoTile =>
    fixture.debugElement.children[0].componentInstance as NeatVideoTile;
  const tileState = () => tileElement().getAttribute('data-state');
  const video = (): HTMLVideoElement => tileElement().querySelector('video') as HTMLVideoElement;
  const canvas = (): HTMLCanvasElement =>
    tileElement().querySelector('canvas.overlay') as HTMLCanvasElement;
  const strokeRects = () => context.ops('strokeRect').map((call) => call.args);
  const texts = () => context.ops('fillText').map((call) => String(call.args[0]));

  /*
   * Time is fake, Angular's scheduler included, so the specs render explicitly: waiting for a
   * render the fake clock has not yet scheduled would never end.
   */
  function render(): void {
    fixture.detectChanges();
  }

  function advance(ms: number): void {
    vi.advanceTimersByTime(ms);
    render();
  }

  /** Presents a frame and forgets what earlier frames drew. */
  function present(rtpTimestamp: number | null, ageMs = 0): void {
    context.calls.length = 0;
    frames.present(rtpTimestamp, ageMs);
  }

  /** Lets settled promises (the video's play()) run their handlers. */
  async function flushPromises(): Promise<void> {
    for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
  }

  function create(made: FakeSource = new FakeSource()): void {
    fixture = TestBed.createComponent(Host);
    source = made;
    host().source.set(source);
    render();
    hostObserver().resize(640, 480);
  }

  function startStream(): void {
    source.stream.set(STREAM);
    render();
  }

  beforeEach(() => {
    // performance.now() is the frame clock. jsdom's own requestAnimationFrame loops on it, so it
    // is faked too, or a frozen clock would spin it forever.
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'performance',
        'requestAnimationFrame',
        'cancelAnimationFrame',
      ],
    });
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    frames = new FakeVideoFrames();
    frames.install();
    readyState = vi
      .spyOn(HTMLMediaElement.prototype, 'readyState', 'get')
      .mockReturnValue(HTMLMediaElement.HAVE_ENOUGH_DATA);
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    videoWidth = vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640);
    videoHeight = vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(480);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      context = new RecordingContext(this);
      return context.context;
    } as unknown as HTMLCanvasElement['getContext']);
  });

  afterEach(() => {
    // The fixture is torn down while the fakes it was built with still stand.
    TestBed.resetTestingModule();
    frames.uninstall();
    // The rest is undone in reverse order of setup. A stub of a global the fake clock replaced
    // (requestAnimationFrame in the fallback spec) remembers the clock's fake as the original, so
    // un-stubbing after useRealTimers() would put back a fake whose clock is gone: later spec files
    // in the same (non-isolated) worker would get a requestAnimationFrame that never fires.
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('starts empty, plays on the first presented frame, and goes stopped 1800 ms after the last one', () => {
    expect(NEAT_STREAM_STALE_MS).toBe(1800);
    create();
    expect(tileState()).toBe('empty');

    startStream();
    expect(tileState(), 'a stream alone shows no frame yet').toBe('empty');
    expect(video().srcObject).toBe(STREAM);

    present(1);
    render();
    expect(tileState()).toBe('playing');

    advance(1000);
    present(2);
    advance(NEAT_STREAM_STALE_MS - 1);
    expect(tileState()).toBe('playing');

    advance(1);
    expect(tileState()).toBe('stopped');
    expect(host().states).toStrictEqual(['playing', 'stopped']);
  });

  it('clears overlays, tracks and colors when stopped, and plays again when frames return', () => {
    create();
    startStream();
    source.send(tracking(1, ['a', 'b']));
    present(1);
    source.send(tracking(2, ['a', 'b']));
    present(2);
    expect(context.ops('stroke'), 'both tracks have a trail').toHaveLength(2);
    expect(context.ops('strokeRect').map((call) => call.strokeStyle)).toStrictEqual([
      OVERLAY_PALETTE[0],
      OVERLAY_PALETTE[1],
    ]);

    context.calls.length = 0;
    advance(NEAT_STREAM_STALE_MS);
    expect(tileState()).toBe('stopped');
    const [clear] = context.ops('clearRect');
    expect(clear.transform, 'the whole backing store is cleared').toStrictEqual([1, 0, 0, 1, 0, 0]);
    expect(clear.args).toStrictEqual([0, 0, 640, 480]);

    source.send(tracking(3, ['b']));
    present(3);
    render();

    expect(tileState()).toBe('playing');
    expect(host().states).toStrictEqual(['playing', 'stopped', 'playing']);
    expect(context.ops('stroke'), 'the trails were forgotten').toHaveLength(0);
    expect(
      context.ops('strokeRect').map((call) => call.strokeStyle),
      'track b takes the first color again',
    ).toStrictEqual([OVERLAY_PALETTE[0]]);
  });

  describe('in a hidden tab, where the browser presents no frames', () => {
    let hidden: ReturnType<typeof vi.spyOn>;

    /**
     * Plays a frame at t, hides the tab, and advances to t + 5 × 1800 ms: the stale check runs at
     * every multiple of 1800 ms after the frame, so the next one is due 1800 ms later.
     */
    function playThenHide(): void {
      hidden = vi.spyOn(Document.prototype, 'hidden', 'get').mockReturnValue(false);
      create();
      startStream();
      source.send(tracking(1, ['a']));
      present(1);
      render();
      hidden.mockReturnValue(true);
      context.calls.length = 0;
      advance(5 * NEAT_STREAM_STALE_MS);
    }

    it('stays playing and keeps its overlays while hidden', () => {
      playThenHide();

      expect(tileState()).toBe('playing');
      expect(context.ops('clearRect'), 'nothing is cleared while hidden').toHaveLength(0);
      expect(host().states).toStrictEqual(['playing']);
    });

    it('stays playing when the tab returns and frames resume, even if a check runs before the first', () => {
      playThenHide();
      // Visible 1 ms before the next check, which then runs before any frame is presented.
      advance(NEAT_STREAM_STALE_MS - 1);
      hidden.mockReturnValue(false);
      advance(1);
      expect(tileState()).toBe('playing');

      for (let frame = 2; frame <= 20; frame += 1) {
        advance(250);
        present(frame);
      }
      render();

      expect(tileState()).toBe('playing');
      expect(host().states, 'no state change at all').toStrictEqual(['playing']);
    });

    it('stops a stream that presents nothing one full period after the first check that sees the tab visible', () => {
      playThenHide();
      hidden.mockReturnValue(false);

      advance(NEAT_STREAM_STALE_MS);
      expect(tileState(), 'the first visible check only re-arms').toBe('playing');
      advance(NEAT_STREAM_STALE_MS - 1);
      expect(tileState()).toBe('playing');
      advance(1);

      expect(tileState()).toBe('stopped');
      expect(host().states).toStrictEqual(['playing', 'stopped']);
    });

    it('leaves no timer behind when destroyed while hidden', () => {
      playThenHide();

      fixture.destroy();

      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it('clears overlays, tracks and colors on a callback while the video holds no current frame', () => {
    create();
    startStream();
    source.send(tracking(1, ['a', 'b']));
    present(1);
    source.send(tracking(2, ['a', 'b']));
    present(2);
    expect(context.ops('stroke'), 'both tracks have a trail').toHaveLength(2);

    readyState.mockReturnValue(HTMLMediaElement.HAVE_METADATA);
    present(3);
    render();
    const [clear] = context.ops('clearRect');
    expect(clear.args).toStrictEqual([0, 0, 640, 480]);
    expect(tileState(), 'the state follows presented frames only').toBe('playing');

    readyState.mockReturnValue(HTMLMediaElement.HAVE_ENOUGH_DATA);
    source.send(tracking(4, ['b']));
    present(4);
    expect(context.ops('stroke'), 'the trails were forgotten').toHaveLength(0);
    expect(context.ops('strokeRect').map((call) => call.strokeStyle)).toStrictEqual([
      OVERLAY_PALETTE[0],
    ]);
  });

  it('forgets the old stream’s pending metadata, held overlays and tracks when the stream is swapped', () => {
    create();
    startStream();
    source.send(tracking(1, ['a', 'b']));
    present(1);
    source.send(tracking(2, ['a', 'b']));
    source.send(detection(2, [10, 10, 20, 20]));
    present(2);
    source.send(detection(99, [300, 300, 20, 20]));

    source.stream.set(STREAM_B);
    render();
    expect(video().srcObject).toBe(STREAM_B);
    expect(tile().snapshot().timestampedPending, 'A’s pending metadata is gone').toBe(0);

    present(3);
    expect(strokeRects(), 'nothing of A is held').toStrictEqual([]);
    present(99);
    expect(strokeRects(), 'A’s message for frame 99 never draws on B').toStrictEqual([]);

    source.send(tracking(100, ['b']));
    present(100);
    expect(context.ops('stroke'), 'A’s trails were forgotten').toHaveLength(0);
    expect(context.ops('strokeRect').map((call) => call.strokeStyle)).toStrictEqual([
      OVERLAY_PALETTE[0],
    ]);
  });

  it('expires metadata older than the retentionMs input before matching it', () => {
    create();
    host().retentionMs.set(100);
    startStream();
    source.send(detection(5, [10, 10, 20, 20]));

    advance(150);
    present(5);

    expect(strokeRects()).toStrictEqual([]);
    expect(tile().snapshot().expired).toBe(1);
  });

  it('draws the metadata matched to the presented frame’s rtpTimestamp and holds a missing type for 200 ms', () => {
    create();
    startStream();
    source.send(detection(1000, [10, 10, 20, 20]));
    source.send(classification(1000, 'cat'));
    source.send(detection(3000, [300, 300, 20, 20]));

    present(1000);
    expect(strokeRects()).toStrictEqual([[10, 10, 20, 20]]);
    expect(texts()).toContain('cat (80%)');

    advance(100);
    source.send(detection(2000, [100, 100, 20, 20]));
    present(2000);
    expect(strokeRects(), 'the new detection replaces the old one').toStrictEqual([
      [100, 100, 20, 20],
    ]);
    expect(texts(), 'the classification is held').toContain('cat (80%)');

    advance(150);
    present(2500);
    expect(strokeRects(), 'held 150 ms after it matched').toStrictEqual([[100, 100, 20, 20]]);
    expect(texts(), 'dropped 250 ms after it matched').not.toContain('cat (80%)');
  });

  it('falls back to requestAnimationFrame with arrival matching when requestVideoFrameCallback is missing', () => {
    frames.uninstall();
    const animationFrames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    let decoded = 0;
    Object.defineProperty(HTMLVideoElement.prototype, 'getVideoPlaybackQuality', {
      configurable: true,
      value: () => ({ totalVideoFrames: decoded }),
    });
    const runAnimationFrame = () => {
      context.calls.length = 0;
      for (const callback of animationFrames.splice(0)) callback(performance.now());
    };

    try {
      create();
      startStream();
      source.send(detection(777, [10, 10, 20, 20]));
      decoded = 1;
      runAnimationFrame();
      render();

      expect(tileState()).toBe('playing');
      expect(strokeRects()).toStrictEqual([[10, 10, 20, 20]]);
      const snapshot = tile().snapshot();
      expect(snapshot.arrivalFallbacks).toBe(1);
      expect(snapshot.timestampMatches).toBe(0);
    } finally {
      delete (HTMLVideoElement.prototype as unknown as Record<string, unknown>)[
        'getVideoPlaybackQuality'
      ];
    }
  });

  it('drops non-JSON metadata with a single warning and keeps drawing valid messages', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    create();
    startStream();

    source.send('not json');
    source.send('[]');
    source.send('{"type": 3}');
    source.send(detection(1, [10, 10, 20, 20]));
    present(1);

    expect(strokeRects()).toStrictEqual([[10, 10, 20, 20]]);
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toContain('channel 3');
    expect(tileState()).toBe('empty');
    render();
    expect(tileState()).toBe('playing');
  });

  it('with bars off renders no label, status or chip elements', () => {
    create();
    const bar = () => tileElement().querySelector('.bar');
    expect(bar()?.querySelector('.label')?.textContent).toBe('3');
    expect(bar()?.querySelector('.status')?.textContent).toBe('H.264 · 640×480 · 30.0 fps');
    expect(bar()?.querySelector('[neatTileChip]')?.textContent).toBe('Metadata late');
    expect(tileElement().querySelector('.no-video')?.textContent?.trim()).toBe(
      'No active video received',
    );

    host().bars.set(false);
    render();

    expect(
      Array.from(tileElement().children, (child) => child.className),
      'only the video, the frames and overlay canvases and the overlay layer',
    ).toStrictEqual(['video', 'frames', 'overlay', 'overlay-slot']);
    expect(tileElement().querySelector('[neatTileChip]')).toBeNull();
    expect(
      tileElement().querySelector('.projected-overlay'),
      'the overlay slot does not depend on the bars',
    ).not.toBeNull();
  });

  it('projects [neatTileOverlay] content into a layer after the canvas and before the bar', () => {
    create();
    const overlay = tileElement().querySelector('.projected-overlay') as HTMLElement;
    const layer = overlay.parentElement as HTMLElement;

    expect(layer.parentElement).toBe(tileElement());
    expect(layer.previousElementSibling).toBe(canvas());
    expect(
      layer.compareDocumentPosition(tileElement().querySelector('.bar') as Element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      'the bar follows the layer, so it paints above it',
    ).not.toBe(0);
    expect(layer.children, 'the layer holds only the projected content').toHaveLength(1);
    // Both layers over the video leave its hits alone: the canvas draws only, the layer's content opts in.
    expect(getComputedStyle(canvas()).pointerEvents).toBe('none');
    expect(
      getComputedStyle(layer).pointerEvents,
      'the empty layer lets pointer input reach the video under it; its content opts back in',
    ).toBe('none');
  });

  describe('without video, for overlay content that stays usable', () => {
    it('stacks the overlay layer above the empty surface, below the note, bar and ring', () => {
      create();
      const layer = (tileElement().querySelector('.projected-overlay') as HTMLElement)
        .parentElement as HTMLElement;
      const z = (element: Element) => Number(getComputedStyle(element).zIndex);

      const surface = rulesFor(
        (s) => s.includes('data-state') && s.includes('empty') && s.includes('::after'),
      );
      expect(surface, 'the empty surface rule').toHaveLength(1);
      expect(['', 'auto'], 'the surface stays in the base layer').toContain(
        surface[0].style.zIndex,
      );
      expect(z(layer)).toBe(1);
      // Same level as the layer and later in the document, so they paint above it.
      const note = tileElement().querySelector('.no-video') as Element;
      const bar = tileElement().querySelector('.bar') as Element;
      expect([z(note), z(bar)]).toEqual([1, 1]);
      expect(layer.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
      const ring = rulesFor((s) => s.includes('data-selected') && s.includes('::before'));
      expect(Number(ring[0].style.zIndex)).toBeGreaterThan(1);
    });

    it('lets pointer input through the no-video note to the overlay content under it', () => {
      create();
      const note = tileElement().querySelector('.no-video') as Element;

      expect(getComputedStyle(note).pointerEvents).toBe('none');
    });
  });

  describe('notice', () => {
    const noVideoNote = () => tileElement().querySelector('.no-video');
    const chip = () =>
      tileElement().querySelector<HTMLElement>('.picture .notice neat-status-chip');

    it('without video, says the notice centered in place of the no-video note, with or without bars', () => {
      create();
      host().notice.set('Board app not reachable');
      render();
      expect(noVideoNote()?.textContent?.trim()).toBe('Board app not reachable');

      host().bars.set(false);
      render();
      expect(noVideoNote()?.textContent?.trim(), 'a tile without bars says it too').toBe(
        'Board app not reachable',
      );
      expect(chip(), 'no chip without video').toBeNull();

      host().notice.set(null);
      render();
      expect(noVideoNote(), 'without bars or a notice the tile says nothing').toBeNull();
      host().bars.set(true);
      render();
      expect(noVideoNote()?.textContent?.trim()).toBe('No active video received');
    });

    it('dims a stopped frame by the theme’s token, not a literal', () => {
      create();
      // The stylesheet as the browser reads it back writes the attribute value in double quotes.
      const stopped = rulesFor((s) => s.includes('data-state="stopped"') && s.includes('.video'));
      expect(stopped.map((r) => r.cssText).join(' ')).toContain(
        'brightness(var(--neat-video-frost-brightness))',
      );
    });

    it('draws the note as an icon above the words, with no card: the icon is decorative and the words are the text', () => {
      create();
      host().notice.set('No signal');
      render();
      const note = noVideoNote() as Element;
      const icon = note.querySelector('neat-icon') as Element;
      expect(icon.getAttribute('data-icon')).toBe('video-off');
      expect(icon.querySelector('svg')?.getAttribute('aria-label'), 'decorative').toBeNull();
      expect(icon.querySelector('svg')?.getAttribute('role')).toBeNull();
      expect(note.querySelector('.no-video-text')?.textContent?.trim()).toBe('No signal');
      expect(noVideoNote()?.textContent?.trim(), 'the icon adds no words').toBe('No signal');
      expect(
        rulesFor((s) => s.includes('.no-video')).filter((r) => r.style.background),
        'no card behind the note',
      ).toEqual([]);
    });

    it('while video plays, is a chip of its tone on the picture, and nothing while null', () => {
      create();
      host().bars.set(false);
      startStream();
      present(1);
      render();
      expect(tileState()).toBe('playing');
      expect(noVideoNote()).toBeNull();
      expect(tileElement().querySelector('.picture'), 'nothing while all is well').toBeNull();

      host().notice.set('Inference stopped');
      render();
      expect(noVideoNote()).toBeNull();
      expect(chip()?.textContent?.trim()).toBe('Inference stopped');
      expect(chip()?.className, 'a warning by default').toContain('bg-warning');

      host().noticeTone.set('danger');
      render();
      expect(chip()?.className).toContain('bg-destructive');
    });

    it('goes back to the middle once the stream stops', () => {
      create();
      host().notice.set('Inference stopped');
      startStream();
      present(1);
      render();
      expect(chip()).not.toBeNull();

      advance(NEAT_STREAM_STALE_MS);
      expect(tileState()).toBe('stopped');
      expect(chip()).toBeNull();
      expect(noVideoNote()?.textContent?.trim()).toBe('Inference stopped');
    });

    it('sits on the picture, which follows videoBox, above the overlay layer, letting pointer input through', () => {
      create();
      host().notice.set('Inference stopped');
      startStream();
      present(1);
      render();
      const picture = tileElement().querySelector<HTMLElement>('.picture')!;
      hostObserver().resize(800, 300);
      render();
      // 640×480 letterboxed into 800×300: 400×300 in the middle.
      const { left, top, width, height } = picture.style;
      expect([left, top, width, height]).toEqual(['200px', '0px', '400px', '300px']);

      const layer = tileElement().querySelector('.overlay-slot')!;
      expect(layer.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
      expect(Number(getComputedStyle(picture).zIndex)).toBe(1);
      expect(getComputedStyle(picture).pointerEvents).toBe('none');
    });
  });

  describe('videoBox', () => {
    const resizeTile = (width: number, height: number) => hostObserver().resize(width, height);
    /** A stream whose first frame is presented: the tile is `playing`. */
    function startPlaying(): void {
      startStream();
      present(1);
    }
    /** The video reports a new size, as a browser does with a `resize` event. */
    function setVideoSize(width: number, height: number, event = 'resize'): void {
      videoWidth.mockReturnValue(width);
      videoHeight.mockReturnValue(height);
      video().dispatchEvent(new Event(event));
    }

    it('is null before the first frame, even with the stream and its metadata loaded', () => {
      create();
      startStream();
      setVideoSize(1280, 720, 'loadedmetadata');
      resizeTile(400, 300);

      expect(tileState()).toBe('empty');
      expect(tile().videoBox(), 'the empty surface covers the video').toBeNull();

      present(1);
      expect(tile().videoBox()).not.toBeNull();
    });

    it('is null while the tile is stopped, and comes back when frames return', () => {
      create();
      startPlaying();
      resizeTile(400, 300);
      const playingBox = tile().videoBox();
      expect(playingBox).toStrictEqual({ x: 0, y: 0, width: 400, height: 300 });

      advance(NEAT_STREAM_STALE_MS);
      expect(tileState()).toBe('stopped');
      expect(tile().videoBox(), 'the frozen frame is scaled up and covered').toBeNull();

      resizeTile(400, 150);
      expect(tile().videoBox(), 'a resize does not bring it back').toBeNull();

      present(2);
      render();
      expect(tileState()).toBe('playing');
      expect(tile().videoBox()).toStrictEqual({ x: 100, y: 0, width: 200, height: 150 });
    });

    it('is null before the video reports its size', () => {
      videoWidth.mockReturnValue(0);
      videoHeight.mockReturnValue(0);
      create();
      startPlaying();
      resizeTile(400, 300);

      expect(tile().videoBox()).toBeNull();

      setVideoSize(1280, 720, 'loadedmetadata');
      expect(tile().videoBox()).not.toBeNull();
    });

    it('a 1280×720 video in a 400×300 tile has videoBox {x: 0, y: 37.5, width: 400, height: 225}', () => {
      create();
      startPlaying();
      setVideoSize(1280, 720, 'loadedmetadata');
      resizeTile(400, 300);

      expect(tile().videoBox()).toStrictEqual({ x: 0, y: 37.5, width: 400, height: 225 });
    });

    it('a 640×480 video in a 400×150 tile has videoBox {x: 100, y: 0, width: 200, height: 150}', () => {
      create();
      startPlaying();
      resizeTile(400, 150);

      expect(tile().videoBox()).toStrictEqual({ x: 100, y: 0, width: 200, height: 150 });
    });

    it('videoBox follows a tile resize and a video resolution change, and goes null when the source is removed', () => {
      create();
      startPlaying();
      resizeTile(400, 300);
      expect(tile().videoBox()).toStrictEqual({ x: 0, y: 0, width: 400, height: 300 });

      resizeTile(400, 150);
      expect(tile().videoBox()).toStrictEqual({ x: 100, y: 0, width: 200, height: 150 });

      setVideoSize(1280, 720);
      const widened = tile().videoBox();
      expect(widened?.x).toBeCloseTo(66.667, 3);
      expect(widened?.y).toBe(0);
      expect(widened?.width).toBeCloseTo(266.667, 3);
      expect(widened?.height).toBe(150);

      source.stream.set(null);
      render();
      expect(tile().videoBox()).toBeNull();

      resizeTile(400, 300);
      expect(tile().videoBox(), 'a tile resize does not bring a removed source back').toBeNull();
    });

    it('videoBox does not notify when the tile resizes to the same box', () => {
      create();
      startPlaying();
      resizeTile(400, 300);
      const before = tile().videoBox();

      resizeTile(400, 300);
      expect(tile().videoBox()).toBe(before);

      // The video repeating its size is no change either.
      setVideoSize(640, 480);
      expect(tile().videoBox()).toBe(before);
    });

    it('has no box in a tile without size, whose editor surface would be empty', () => {
      create();
      startPlaying();
      resizeTile(0, 0);

      expect(tile().videoBox()).toBeNull();
    });

    it('agrees with the canvas mapping: the unit square maps onto the box', () => {
      create();
      startPlaying();
      setVideoSize(1280, 720, 'loadedmetadata');
      resizeTile(400, 300);
      const box = tile().videoBox() as NeatVideoBox;
      const corners = mapRoi(
        [
          {
            type: 'inclusion',
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          },
        ],
        1280,
        720,
        letterbox(1280, 720, 400, 300),
      ).polygons[0].points;

      expect(corners[0][0]).toBeCloseTo(box.x, 9);
      expect(corners[0][1]).toBeCloseTo(box.y, 9);
      expect(corners[1][0]).toBeCloseTo(box.x + box.width, 9);
      expect(corners[1][1]).toBeCloseTo(box.y + box.height, 9);
    });

    it('is not computed per frame', () => {
      create();
      startPlaying();
      resizeTile(400, 300);
      const before = tile().videoBox();

      // The loop reads the video's size every frame; a size change without an event stays unseen.
      videoWidth.mockReturnValue(1280);
      videoHeight.mockReturnValue(720);
      present(1);

      expect(tile().videoBox()).toBe(before);
    });
  });

  it('reflects its state and selection on its host for styling', () => {
    create();
    expect(tileElement().hasAttribute('data-selected')).toBe(false);

    host().selected.set(true);
    render();

    expect(tileElement().hasAttribute('data-selected')).toBe(true);
    expect(tileState()).toBe('empty');
  });

  it('neat-video-tile computes border-radius 0px on the host and its selection ring', () => {
    create();

    // jsdom resolves no initial values, so a square corner computes to '' here and '0px' in a
    // browser; anything else (`var(--radius)`, a length, `inherit`) is a rounded one.
    const square = ['', '0px'];
    expect(square).toContain(getComputedStyle(tileElement()).borderRadius);

    // jsdom has no styles for pseudo-elements, so the ring's own rule is read from the stylesheet.
    // It takes its radius from the host or sets one; it must do neither.
    const ringRules = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .filter(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule &&
          rule.selectorText.includes('data-selected') &&
          rule.selectorText.includes('::before'),
      );
    expect(ringRules, 'the selection ring rule').toHaveLength(1);
    expect(ringRules[0].style.borderRadius).toBe('');
  });

  it('runs its frame loop outside Angular: 100 frames trigger no change detection on the host', async () => {
    create();
    startStream();
    // Advancing a little past a frame runs whatever render it scheduled (on a timer, or on a
    // microtask right after another render) without reaching the stats or stale timers.
    const renders = host().renders;
    present(0);
    await vi.advanceTimersByTimeAsync(20);
    expect(host().renders, 'the state change renders').toBeGreaterThan(renders);
    const playingRenders = host().renders;

    for (let frame = 1; frame <= 100; frame += 1) {
      source.send(detection(frame, [frame, 10, 20, 20]));
      present(frame);
    }
    await vi.advanceTimersByTimeAsync(20);

    expect(strokeRects(), 'the last frame drew').toStrictEqual([[100, 10, 20, 20]]);
    expect(host().renders).toBe(playingRenders);
  });

  it('stops its frame loop and unsubscribes metadata on destroy and when the stream becomes null', () => {
    create();
    startStream();
    present(1);
    render();
    expect(source.listeners.size).toBe(1);
    const [pending] = frames.callbacks.keys();

    source.stream.set(null);
    render();

    expect(source.listeners.size).toBe(0);
    expect(frames.canceled).toStrictEqual([pending]);
    expect(frames.callbacks.size).toBe(0);
    expect(video().srcObject).toBeNull();
    expect(tileState()).toBe('empty');
    expect(host().states).toStrictEqual(['playing', 'empty']);

    startStream();
    expect(source.listeners.size).toBe(1);
    expect(frames.callbacks.size).toBe(1);

    fixture.destroy();

    expect(source.listeners.size).toBe(0);
    expect(frames.callbacks.size).toBe(0);
    expect(vi.getTimerCount(), 'no stale check or stats timer is left').toBe(0);
    expect(hostObserver().disconnected).toBe(true);
  });

  it('plays again when the video track unmutes, until the stream is gone', () => {
    create();
    startStream();
    expect(play).toHaveBeenCalledTimes(1);
    const [track] = STREAM.getVideoTracks();

    track.dispatchEvent(new Event('unmute'));
    expect(play).toHaveBeenCalledTimes(2);

    source.stream.set(null);
    render();
    track.dispatchEvent(new Event('unmute'));
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('warns once when the video refuses to play, but not when a newer stream interrupted it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    play.mockRejectedValue(new DOMException('The play() request was interrupted', 'AbortError'));
    create();
    startStream();
    await flushPromises();
    expect(warn).not.toHaveBeenCalled();

    play.mockRejectedValue(new DOMException('play() is not allowed', 'NotAllowedError'));
    source.stream.set(STREAM_B);
    render();
    STREAM_B.getVideoTracks()[0].dispatchEvent(new Event('unmute'));
    await flushPromises();

    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toContain('channel 3');
    expect(String(warn.mock.calls[0][0])).toContain('NotAllowedError');
  });

  it('resetLatenessWindow forgets the late outcomes measured so far', () => {
    create();
    startStream();
    present(1000);
    for (let late = 0; late < 10; late += 1) source.send(detection(900 + late, [10, 10, 20, 20]));
    expect(tile().snapshot().recentLateShare).toBe(1);

    tile().resetLatenessWindow();

    expect(tile().snapshot().recentLateShare).toBeNull();
    expect(tile().snapshot().late, 'the cumulative counter stays').toBe(10);
  });

  it('emits frame stats once per second with the queue counters, the message rate and the video', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(false);
    vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'get').mockReturnValue(12.48);
    create();
    advance(3000);
    expect(host().stats, 'nothing to report without a stream').toStrictEqual([]);

    startStream();
    source.send(detection(1, [10, 10, 20, 20]));
    source.send(detection(null, [10, 10, 20, 20]));
    present(1);
    // Frame times are fractional; the age is reported in whole milliseconds.
    present(2, 0.4);
    advance(999);
    expect(host().stats).toStrictEqual([]);

    advance(1);
    expect(host().stats).toStrictEqual([
      {
        timestampMatches: 1,
        arrivalFallbacks: 1,
        frameMisses: 0,
        expired: 0,
        evicted: 0,
        late: 0,
        untimestampedReceived: 1,
        timestampedPending: 0,
        arrivalPending: 0,
        recentLatenessMedianMs: null,
        recentLatenessMaxMs: null,
        metadataMessagesPerSecond: 2,
        video: {
          readyState: HTMLMediaElement.HAVE_ENOUGH_DATA,
          paused: false,
          currentTime: 12.48,
          videoWidth: 640,
          videoHeight: 480,
          lastFrameAgeMs: 1000,
          active: true,
        },
      },
    ]);

    advance(1000);
    expect(host().stats).toHaveLength(2);
    expect(host().stats[1].metadataMessagesPerSecond).toBe(0);
    expect(host().stats[1].video.lastFrameAgeMs).toBe(2000);

    source.stream.set(STREAM_B);
    render();
    advance(1000);
    const [latest] = host().stats.slice(-1);
    expect(latest.video.lastFrameAgeMs, 'no frame of the new stream yet').toBeNull();
    expect(latest.video.active).toBe(false);
  });

  it('sizes the canvas backing store from its box at devicePixelRatio, capped at 2', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    create();
    startStream();
    hostObserver().resize(320, 240);
    expect(hostObserver().observed).toStrictEqual([tileElement()]);
    expect([canvas().width, canvas().height]).toStrictEqual([640, 480]);

    source.send(detection(1, [10, 10, 20, 20]));
    present(1);

    const [box] = context.ops('strokeRect');
    expect(box.transform).toStrictEqual([2, 0, 0, 2, 0, 0]);
    // The 640×480 video fills the 320×240 box, so video pixels are halved.
    expect(box.args).toStrictEqual([5, 5, 10, 10]);
  });

  it('draws each frame with the settings in force when it is presented', () => {
    create();
    startStream();
    host().settings.set(overlaySettings({ types: { 'object-detection': { visible: false } } }));
    render();

    source.send(detection(1, [10, 10, 20, 20]));
    present(1);

    expect(strokeRects()).toStrictEqual([]);
  });

  describe('mirror', () => {
    /** The rules of the tile's stylesheet that name `data-mirrored` alone, without the flip. */
    const mirrorRules = (): CSSStyleRule[] =>
      rulesFor((s) => s.includes('data-mirrored') && !s.includes('data-flipped'));

    it('mirror flips a pose’s geometry, not its text', () => {
      create();
      startStream();
      host().mirror.set(true);
      host().settings.set(
        overlaySettings({ types: { 'pose-estimation': { showKeypointLabels: true } } }),
      );
      render();
      hostObserver().resize(1000, 480);
      videoWidth.mockReturnValue(1000);
      videoHeight.mockReturnValue(480);

      source.send({
        type: 'pose-estimation',
        data: {
          poses: [{ id: 1, keypoints: [{ name: 'nose', x: 100, y: 50, confidence: 0.9 }] }],
        },
        _insight: { rtp_timestamp: 1 },
      });
      present(1);

      const [joint] = context.ops('arc');
      expect(joint.args[0], 'x 100 in a 1000 px video is drawn at 900').toBe(900);
      const [label] = context.ops('fillText');
      expect(label.args[0]).toBe('nose');
      expect(label.transform[0], 'the label is drawn upright, not through a flip').toBeGreaterThan(
        0,
      );
      expect(label.textAlign, 'it reads away from its anchor, back over the picture').toBe('right');
    });

    it('mirror sets data-mirrored and the stylesheet flips only the video', () => {
      create();
      expect(tileElement().hasAttribute('data-mirrored')).toBe(false);

      host().mirror.set(true);
      render();
      expect(tileElement().hasAttribute('data-mirrored')).toBe(true);

      const rules = mirrorRules();
      expect(rules, 'one rule states the mirror').toHaveLength(1);
      expect(rules[0].selectorText).toMatch(/^\[data-mirrored\].*\.video\b/);
      expect(rules[0].style.transform).toBe('scaleX(-1)');
    });

    it('videoBox is the same with and without mirror', () => {
      create();
      startStream();
      present(1);
      hostObserver().resize(400, 150);
      const plain = tile().videoBox();
      expect(plain).toStrictEqual({ x: 100, y: 0, width: 200, height: 150 });

      host().mirror.set(true);
      render();
      expect(tile().videoBox()).toStrictEqual(plain);
    });
  });

  describe('flipVertical', () => {
    it('flipVertical sets data-flipped and the stylesheet flips only the video', () => {
      create();
      expect(tileElement().hasAttribute('data-flipped')).toBe(false);

      host().flipVertical.set(true);
      render();
      expect(tileElement().hasAttribute('data-flipped')).toBe(true);

      const flip = rulesFor((s) => s.includes('data-flipped') && !s.includes('data-mirrored'));
      expect(flip, 'one rule states the flip').toHaveLength(1);
      expect(flip[0].selectorText).toMatch(/^\[data-flipped\].*\.video\b/);
      expect(flip[0].style.transform).toBe('scaleY(-1)');

      const both = rulesFor((s) => s.includes('data-flipped') && s.includes('data-mirrored'));
      expect(both, 'one rule states the two together').toHaveLength(1);
      expect(both[0].selectorText).toMatch(/\.video\b/);
      expect(both[0].style.transform).toBe('scale(-1, -1)');
    });

    it('flips a pose’s geometry, not its text', () => {
      create();
      startStream();
      host().flipVertical.set(true);
      host().settings.set(
        overlaySettings({ types: { 'pose-estimation': { showKeypointLabels: true } } }),
      );
      render();
      hostObserver().resize(1000, 480);
      videoWidth.mockReturnValue(1000);
      videoHeight.mockReturnValue(480);

      source.send({
        type: 'pose-estimation',
        data: {
          poses: [{ id: 1, keypoints: [{ name: 'nose', x: 100, y: 50, confidence: 0.9 }] }],
        },
        _insight: { rtp_timestamp: 1 },
      });
      present(1);

      const [joint] = context.ops('arc');
      expect(joint.args.slice(0, 2), 'y 50 in a 480 px video is drawn at 430').toStrictEqual([
        100, 430,
      ]);
      const [label] = context.ops('fillText');
      expect(label.args[0]).toBe('nose');
      expect(label.transform[3], 'the label is drawn upright, not through a flip').toBeGreaterThan(
        0,
      );
      expect(label.args[2], 'it stands above its joint on screen').toBeLessThan(430);
      expect(label.textAlign).toBe('left');
    });

    it('videoBox is the same with and without flipVertical', () => {
      create();
      startStream();
      present(1);
      hostObserver().resize(400, 150);
      const plain = tile().videoBox();
      expect(plain).toStrictEqual({ x: 100, y: 0, width: 200, height: 150 });

      host().flipVertical.set(true);
      render();
      expect(tile().videoBox()).toStrictEqual(plain);
    });

    it('a stopped, flipped tile keeps the frost’s scale beside the flip’s transform', () => {
      create();
      host().flipVertical.set(true);
      startStream();
      present(1);
      render();
      advance(NEAT_STREAM_STALE_MS);
      expect(tileState()).toBe('stopped');
      expect(tileElement().hasAttribute('data-flipped')).toBe(true);

      // The stopped rule scales through the separate `scale` property and sets no `transform`, so
      // it composes with the orientation's transform instead of replacing it.
      const stopped = rulesFor((s) => s.includes('data-state="stopped"') && s.includes('.video'));
      expect(stopped).toHaveLength(1);
      expect(stopped[0].cssText).toMatch(/\bscale: 1\.07\b/);
      expect(stopped[0].style.transform).toBe('');
    });
  });

  describe('frameListener', () => {
    let frames_: NeatTileFrame[];

    beforeEach(() => {
      frames_ = [];
    });

    function listen(listener: NeatTileFrameListener = (frame) => frames_.push(frame)): void {
      host().frameListener.set(listener);
      render();
    }

    const pose = (rtpTimestamp: number): NeatMetadataMessage => ({
      type: 'pose-estimation',
      data: { poses: [] },
      _insight: { rtp_timestamp: rtpTimestamp },
    });

    it('frameListener gets each frame’s matched messages with held flags', () => {
      create();
      startStream();
      listen();

      source.send(pose(1));
      present(1);
      expect(frames_).toHaveLength(1);
      expect(frames_[0].now).toBe(performance.now());
      expect(frames_[0].messages.map(({ message, held }) => [message.type, held])).toStrictEqual([
        ['pose-estimation', false],
      ]);
      const fresh = frames_[0].messages[0].message;

      present(2);
      expect(frames_).toHaveLength(2);
      expect(frames_[1].messages).toStrictEqual([{ message: fresh, held: true }]);
    });

    it('a frame with nothing matched calls the listener with no messages', () => {
      create();
      startStream();
      listen();

      present(1);

      expect(frames_).toHaveLength(1);
      expect(frames_[0].messages).toStrictEqual([]);
    });

    it('is called after the frame is drawn, and once per presented frame', () => {
      create();
      startStream();
      const drawnAtCall: number[] = [];
      listen(() => drawnAtCall.push(context.ops('strokeRect').length));

      source.send(detection(1, [10, 10, 20, 20]));
      present(1);
      present(2);

      expect(drawnAtCall).toStrictEqual([1, 1]);
    });

    it('a listener that throws is logged once and the frames keep drawing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      create();
      startStream();
      listen(() => {
        throw new Error('boom');
      });

      source.send(detection(1, [10, 10, 20, 20]));
      present(1);
      expect(strokeRects()).toHaveLength(1);
      source.send(detection(2, [30, 30, 20, 20]));
      present(2);

      expect(strokeRects(), 'the second frame still drew').toHaveLength(1);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('frameListener');
    });
  });

  describe('colorOf', () => {
    it('gives each track the color the overlay drew it in, in the frame listener already', () => {
      create();
      startStream();
      const seen: (string | null)[][] = [];
      host().frameListener.set(() =>
        seen.push(['a', 'b'].map((id) => tile().colorOf('tracking', { id }))),
      );
      render();

      source.send(tracking(1, ['a', 'b']));
      present(1);

      const drawn = context.ops('strokeRect').map((call) => call.strokeStyle);
      expect(seen).toStrictEqual([drawn]);
      expect(tile().colorOf('tracking', { id: 'c' }), 'a track not drawn has none').toBeNull();
    });

    it('is followed by a computed: a color drawn, then taken back when the stream stops', () => {
      create();
      startStream();
      const color = computed(() => tile().colorOf('tracking', { id: 'a' }));
      expect(color()).toBeNull();

      source.send(tracking(1, ['a']));
      present(1);
      expect(color()).toBe(OVERLAY_PALETTE[0]);

      advance(NEAT_STREAM_STALE_MS);
      expect(tileState()).toBe('stopped');
      expect(color()).toBeNull();
    });

    it('gives a style row’s color at once, and follows the settings', () => {
      create();
      const color = computed(() => tile().colorOf('object-detection', { label: 'person' }));
      expect(color()).toBeNull();

      const row = { label: 'person', color: OVERLAY_PALETTE[5], style: 'solid', width: 3 } as const;
      host().settings.set(overlaySettings({ types: { 'object-detection': { objects: [row] } } }));
      render();
      expect(color()).toBe(OVERLAY_PALETTE[5]);
    });
  });

  describe('expandControl', () => {
    const button = () => tileElement().querySelector<HTMLButtonElement>('button.expand');

    it('gives the tile no button of its own by default', () => {
      create();

      expect(button()).toBeNull();
    });

    it('shows the tile over the window from its button, named for the tile, and puts it back', () => {
      create();
      host().expandControl.set(true);
      render();
      expect(button()?.getAttribute('aria-label')).toBe('Expand 3');

      button()!.click();
      render();
      expect(host().expanded()).toBe(true);
      expect(tileElement().hasAttribute('data-neat-expanded')).toBe(true);
      expect(button()?.getAttribute('aria-label')).toBe('Close');

      button()!.click();
      render();
      expect(host().expanded()).toBe(false);
      expect(tileElement().hasAttribute('data-neat-expanded')).toBe(false);
    });

    it('follows the app’s own state, with or without the button', () => {
      create();

      host().expanded.set(true);
      render();
      expect(tileElement().hasAttribute('data-neat-expanded')).toBe(true);
      tileElement().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      render();
      expect(host().expanded()).toBe(false);
    });

    it('is named "Expand" alone for a tile without a label', () => {
      create();
      host().expandControl.set(true);
      render();
      host().label.set('');
      render();

      expect(button()?.getAttribute('aria-label')).toBe('Expand');
    });
  });

  describe('encoded frames', () => {
    interface FakeBitmap {
      readonly width: number;
      readonly height: number;
      readonly close: ReturnType<typeof vi.fn>;
    }

    let framesSource: FakeFramesSource;
    /** The frames canvas's context; the overlay canvas's stays `context`. */
    let picture: RecordingContext;
    let animationFrames: Map<number, FrameRequestCallback>;
    /** createImageBitmap, which decodes at once to a picture of `pictureSize`. */
    let decode: ReturnType<typeof vi.fn>;
    let bitmaps: FakeBitmap[];
    let pictureSize: { width: number; height: number };

    const framesCanvas = (): HTMLCanvasElement =>
      tileElement().querySelector('canvas.frames') as HTMLCanvasElement;

    /** A frame of `run` arrives, is chosen on the next animation frame, decodes and is drawn. */
    async function showFrame(run: FakeRun, rtpTimestamp: number | null): Promise<void> {
      context.calls.length = 0;
      picture.calls.length = 0;
      run.emit(rtpTimestamp);
      runAnimationFrames();
      await flushPromises();
      render();
    }

    function runAnimationFrames(): void {
      const pending = [...animationFrames.values()];
      animationFrames.clear();
      for (const callback of pending) callback(performance.now());
    }

    /** Plays `run` from a tile made with a source that has frames. */
    function startFrames(run: FakeRun): void {
      create((framesSource = new FakeFramesSource()));
      framesSource.frames.set(run);
      render();
    }

    beforeEach(() => {
      // The video element reports no picture: in frames mode the size is the decoded frame's.
      videoWidth.mockReturnValue(0);
      videoHeight.mockReturnValue(0);
      animationFrames = new Map();
      let nextFrame = 1;
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        animationFrames.set(nextFrame, callback);
        return nextFrame++;
      });
      vi.stubGlobal('cancelAnimationFrame', (id: number) => animationFrames.delete(id));
      bitmaps = [];
      pictureSize = { width: 640, height: 480 };
      decode = vi.fn(() => {
        const bitmap: FakeBitmap = { ...pictureSize, close: vi.fn() };
        bitmaps.push(bitmap);
        return Promise.resolve(bitmap);
      });
      vi.stubGlobal('createImageBitmap', decode);
      vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(function (
        this: HTMLCanvasElement,
      ) {
        const recording = new RecordingContext(this);
        if (this.classList.contains('frames')) picture = recording;
        else context = recording;
        return recording.context;
      } as unknown as HTMLCanvasElement['getContext']);
    });

    it('plays a source’s frames: data-frames is set and the frames canvas takes the picture’s size', async () => {
      const run = new FakeRun();
      create((framesSource = new FakeFramesSource()));
      expect(tileElement().hasAttribute('data-frames')).toBe(false);

      framesSource.frames.set(run);
      render();
      expect(tileElement().hasAttribute('data-frames')).toBe(true);
      expect(tileState(), 'a run alone shows no frame yet').toBe('empty');
      expect(play, 'the video plays nothing').not.toHaveBeenCalled();

      await showFrame(run, 1);
      expect(tileState()).toBe('playing');
      expect([framesCanvas().width, framesCanvas().height]).toStrictEqual([640, 480]);
      const [draw] = picture.ops('drawImage');
      expect(draw.args[0]).toBe(bitmaps[0]);
      expect(draw.args.slice(1)).toStrictEqual([0, 0]);
      expect(bitmaps[0].close, 'the scheduler closes it once drawn').toHaveBeenCalledOnce();

      // The stylesheet shows the frames canvas in place of the video, and only in frames mode.
      const display = (test: (selector: string) => boolean) =>
        rulesFor(test).map((rule) => rule.style.display);
      expect(display((s) => s.includes('[data-frames]') && /\.video\b/.test(s))).toStrictEqual([
        'none',
      ]);
      expect(
        display((s) => s.includes(':not([data-frames])') && /\.frames\b/.test(s)),
      ).toStrictEqual(['none']);

      framesSource.frames.set(null);
      render();
      expect(tileElement().hasAttribute('data-frames')).toBe(false);
      expect(tileState()).toBe('empty');
    });

    it('videoBox follows the picture’s size and the tile’s', async () => {
      const run = new FakeRun();
      startFrames(run);
      hostObserver().resize(400, 150);
      expect(tile().videoBox(), 'no frame drawn yet').toBeNull();

      await showFrame(run, 1);
      expect(tile().videoBox()).toStrictEqual({ x: 100, y: 0, width: 200, height: 150 });

      hostObserver().resize(800, 300);
      expect(tile().videoBox()).toStrictEqual({ x: 200, y: 0, width: 400, height: 300 });
    });

    it('matches metadata by the frame’s rtpTimestamp, holding a missing type as for a stream', async () => {
      const run = new FakeRun();
      startFrames(run);
      source.send(detection(1000, [10, 10, 20, 20]));
      source.send(classification(1000, 'cat'));
      source.send(detection(3000, [300, 300, 20, 20]));

      await showFrame(run, 1000);
      expect(strokeRects()).toStrictEqual([[10, 10, 20, 20]]);
      expect(texts()).toContain('cat (80%)');

      advance(100);
      source.send(detection(2000, [100, 100, 20, 20]));
      await showFrame(run, 2000);
      expect(strokeRects(), 'the new detection replaces the old one').toStrictEqual([
        [100, 100, 20, 20],
      ]);
      expect(texts(), 'the classification is held').toContain('cat (80%)');

      advance(150);
      await showFrame(run, 2500);
      expect(strokeRects(), 'held 150 ms after it matched').toStrictEqual([[100, 100, 20, 20]]);
      expect(texts(), 'dropped 250 ms after it matched').not.toContain('cat (80%)');
      expect(tile().snapshot().timestampMatches).toBe(2);
    });

    it('goes stopped 1800 ms after the last drawn frame, and plays again when frames return', async () => {
      const run = new FakeRun();
      startFrames(run);
      await showFrame(run, 1);
      expect(tileState()).toBe('playing');

      advance(1000);
      await showFrame(run, 2);
      advance(NEAT_STREAM_STALE_MS - 1);
      expect(tileState()).toBe('playing');

      advance(1);
      expect(tileState()).toBe('stopped');

      // The last frame stays on its canvas, frosted as the video's would be.
      const stopped = rulesFor((s) => s.includes('data-state="stopped"') && /\.frames\b/.test(s));
      expect(stopped).toHaveLength(1);
      expect(stopped[0].style.filter).toContain('blur(9px)');

      await showFrame(run, 3);
      expect(tileState()).toBe('playing');
      expect(host().states).toStrictEqual(['playing', 'stopped', 'playing']);
    });

    it('resets the queue and the overlays from stream to frames to stream', async () => {
      videoWidth.mockReturnValue(640);
      videoHeight.mockReturnValue(480);
      create((framesSource = new FakeFramesSource()));
      startStream();
      source.send(detection(1, [10, 10, 20, 20]));
      present(1);
      expect(strokeRects()).toStrictEqual([[10, 10, 20, 20]]);
      source.send(detection(99, [300, 300, 20, 20]));

      const run = new FakeRun();
      framesSource.stream.set(null);
      framesSource.frames.set(run);
      render();
      expect(video().srcObject).toBeNull();
      expect(host().states).toStrictEqual(['playing', 'empty']);
      expect(tile().snapshot().timestampedPending, 'the stream’s pending metadata is gone').toBe(0);

      await showFrame(run, 3);
      expect(strokeRects(), 'nothing of the stream is held').toStrictEqual([]);
      await showFrame(run, 99);
      expect(strokeRects(), 'the stream’s message for 99 never draws').toStrictEqual([]);
      source.send(detection(100, [50, 50, 20, 20]));
      await showFrame(run, 100);
      expect(strokeRects()).toStrictEqual([[50, 50, 20, 20]]);
      source.send(detection(200, [60, 60, 20, 20]));

      framesSource.frames.set(null);
      framesSource.stream.set(STREAM_B);
      render();
      expect(video().srcObject).toBe(STREAM_B);
      expect(run.listeners.size, 'the run is left').toBe(0);
      expect(tileElement().hasAttribute('data-frames')).toBe(false);
      expect(host().states).toStrictEqual(['playing', 'empty', 'playing', 'empty']);

      present(4);
      expect(strokeRects(), 'nothing of the frames is held').toStrictEqual([]);
      present(200);
      expect(strokeRects(), 'the frames’ message for 200 never draws').toStrictEqual([]);
      render();
      expect(tileState()).toBe('playing');
    });

    it('draws and decodes nothing for a run it has left', async () => {
      const first = new FakeRun();
      startFrames(first);
      await showFrame(first, 1);

      // A decode in flight when the run is left draws nothing once it finishes.
      first.emit(2);
      runAnimationFrames();
      expect(decode).toHaveBeenCalledTimes(2);
      const second = new FakeRun();
      framesSource.frames.set(second);
      render();
      picture.calls.length = 0;
      await flushPromises();
      expect(picture.ops('drawImage'), 'the frame in flight is not drawn').toHaveLength(0);
      expect(bitmaps[1].close).toHaveBeenCalledOnce();

      expect(first.listeners.size).toBe(0);
      first.emit(3);
      runAnimationFrames();
      await flushPromises();
      expect(decode, 'nothing of the old run is decoded').toHaveBeenCalledTimes(2);
      expect(tileState()).toBe('empty');

      await showFrame(second, 4);
      expect(decode).toHaveBeenCalledTimes(3);
      expect(picture.ops('drawImage')).toHaveLength(1);
      expect(tileState()).toBe('playing');
    });

    it('follows a picture size change within one run', async () => {
      const widths = vi.spyOn(HTMLCanvasElement.prototype, 'width', 'set');
      const run = new FakeRun();
      startFrames(run);
      hostObserver().resize(400, 300);
      const resizes = () => widths.mock.contexts.filter((c) => c === framesCanvas()).length;
      // `videoBox` keeps its object for an equal box, so only a count of the work shows whether an
      // unchanged picture leaves it alone.
      const measure = vi.spyOn(
        tile() as unknown as { updateVideoBox: () => void },
        'updateVideoBox',
      );

      await showFrame(run, 1);
      const small = tile().videoBox();
      const measuredForFirst = measure.mock.calls.length;
      expect(measuredForFirst, 'the first picture measures the box').toBeGreaterThan(0);
      await showFrame(run, 2);
      expect(small).toStrictEqual({ x: 0, y: 0, width: 400, height: 300 });
      expect(measure, 'an unchanged picture leaves the box').toHaveBeenCalledTimes(
        measuredForFirst,
      );
      expect(resizes(), 'the canvas is sized once for the first picture').toBe(1);

      pictureSize = { width: 1280, height: 720 };
      await showFrame(run, 3);
      const large = tile().videoBox();
      await showFrame(run, 4);
      expect([framesCanvas().width, framesCanvas().height]).toStrictEqual([1280, 720]);
      expect(large).toStrictEqual({ x: 0, y: 37.5, width: 400, height: 225 });
      expect(tile().videoBox()).toBe(large);
      expect(resizes(), 'and once again for the new size').toBe(2);
    });

    it('flips the frames canvas by CSS and the overlay’s geometry, not its text, for mirror and flipVertical', async () => {
      const run = new FakeRun();
      startFrames(run);
      host().mirror.set(true);
      host().flipVertical.set(true);
      host().settings.set(
        overlaySettings({ types: { 'pose-estimation': { showKeypointLabels: true } } }),
      );
      render();
      hostObserver().resize(1000, 480);
      pictureSize = { width: 1000, height: 480 };

      // The stylesheet's orientation rules turn the frames canvas as they turn the video.
      const turned = (test: (selector: string) => boolean) =>
        rulesFor((s) => test(s) && /\.frames\b/.test(s) && /\.video\b/.test(s)).map(
          (rule) => rule.style.transform,
        );
      expect(
        turned((s) => s.includes('data-mirrored') && !s.includes('data-flipped')),
      ).toStrictEqual(['scaleX(-1)']);
      expect(
        turned((s) => s.includes('data-flipped') && !s.includes('data-mirrored')),
      ).toStrictEqual(['scaleY(-1)']);
      expect(
        turned((s) => s.includes('data-flipped') && s.includes('data-mirrored')),
      ).toStrictEqual(['scale(-1, -1)']);

      source.send({
        type: 'pose-estimation',
        data: {
          poses: [{ id: 1, keypoints: [{ name: 'nose', x: 100, y: 50, confidence: 0.9 }] }],
        },
        _insight: { rtp_timestamp: 1 },
      });
      await showFrame(run, 1);

      const [joint] = context.ops('arc');
      expect(joint.args.slice(0, 2), 'turned both ways: (900, 430)').toStrictEqual([900, 430]);
      const [label] = context.ops('fillText');
      expect(label.args[0]).toBe('nose');
      expect(label.transform[0], 'the label is upright, not through a flip').toBeGreaterThan(0);
      expect(label.transform[3]).toBeGreaterThan(0);
    });

    it('a stopped, flipped frames canvas keeps the frost’s scale beside the flip’s transform', async () => {
      const run = new FakeRun();
      startFrames(run);
      host().flipVertical.set(true);
      await showFrame(run, 1);
      advance(NEAT_STREAM_STALE_MS);
      expect(tileState()).toBe('stopped');
      expect(tileElement().hasAttribute('data-flipped')).toBe(true);

      // One rule scales both pictures through `scale`; none sets a `transform` the flip would lose.
      const stopped = rulesFor(
        (s) => s.includes('data-state="stopped"') && /\.frames\b/.test(s) && /\.video\b/.test(s),
      );
      expect(stopped).toHaveLength(1);
      expect(stopped[0].cssText).toMatch(/\bscale: 1\.07\b/);
      expect(stopped[0].style.transform).toBe('');
      const flip = rulesFor(
        (s) => s.includes('data-flipped') && !s.includes('data-mirrored') && /\.frames\b/.test(s),
      );
      expect(flip).toHaveLength(1);
      expect(flip[0].style.transform).toBe('scaleY(-1)');
    });

    it('shows the notice as a chip on the picture, and the expand control, while frames play', async () => {
      const run = new FakeRun();
      startFrames(run);
      host().bars.set(false);
      host().expandControl.set(true);
      host().notice.set('Inference stopped');
      render();
      const note = () => tileElement().querySelector('.no-video');
      const chip = () =>
        tileElement().querySelector<HTMLElement>('.picture .notice neat-status-chip');
      expect(note()?.textContent?.trim(), 'without a frame it is the note').toBe(
        'Inference stopped',
      );

      await showFrame(run, 1);
      expect(note()).toBeNull();
      expect(chip()?.textContent?.trim()).toBe('Inference stopped');

      const button = tileElement().querySelector<HTMLButtonElement>('button.expand');
      expect(button?.getAttribute('aria-label')).toBe('Expand 3');
      button!.click();
      render();
      expect(host().expanded()).toBe(true);
      expect(tileElement().hasAttribute('data-neat-expanded')).toBe(true);
    });

    it('plays the stream when both are set, and warns once in dev mode', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const run = new FakeRun();
      create((framesSource = new FakeFramesSource()));
      framesSource.stream.set(STREAM);
      framesSource.frames.set(run);
      render();

      expect(video().srcObject, 'the stream plays').toBe(STREAM);
      expect(tileElement().hasAttribute('data-frames')).toBe(false);
      expect(run.listeners.size, 'the run is not played').toBe(0);
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        'video: channel 3 has both a stream and encoded frames; it plays the stream',
      );

      // A run that changes beside the stream, and the stream swapped for another, say nothing more.
      framesSource.frames.set(new FakeRun());
      framesSource.stream.set(STREAM_B);
      render();
      expect(video().srcObject).toBe(STREAM_B);
      expect(warn).toHaveBeenCalledOnce();
    });

    it('warns once when a frame does not decode, and draws the next one', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const run = new FakeRun();
      startFrames(run);
      decode.mockRejectedValueOnce(new DOMException('bad jpeg', 'InvalidStateError'));
      await showFrame(run, 1);
      expect(picture.ops('drawImage'), 'the broken frame draws nothing').toHaveLength(0);
      expect(tileState()).toBe('empty');
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        'video: channel 3 cannot decode a frame (InvalidStateError: bad jpeg); ' +
          'later ones are skipped silently',
      );

      await showFrame(run, 2);
      expect(picture.ops('drawImage'), 'the next frame draws').toHaveLength(1);
      expect(tileState()).toBe('playing');

      decode.mockRejectedValueOnce(new Error('again'));
      await showFrame(run, 3);
      expect(warn, 'later failures are silent').toHaveBeenCalledOnce();
    });

    it('reports frameStats in frames mode: readyState 0 then 4, not paused, currentTime 0, the picture’s size', async () => {
      // The video element says otherwise on every count; frames mode must not read it.
      vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(true);
      vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'get').mockReturnValue(12.48);
      readyState.mockReturnValue(HTMLMediaElement.HAVE_NOTHING);
      videoWidth.mockReturnValue(7);
      videoHeight.mockReturnValue(7);
      const run = new FakeRun();
      startFrames(run);

      advance(1000);
      expect(host().stats).toHaveLength(1);
      expect(host().stats[0].video).toStrictEqual({
        readyState: 0,
        paused: false,
        currentTime: 0,
        videoWidth: 0,
        videoHeight: 0,
        lastFrameAgeMs: null,
        active: false,
      });

      await showFrame(run, 1);
      readyState.mockReturnValue(HTMLMediaElement.HAVE_NOTHING);
      advance(1000);
      expect(host().stats).toHaveLength(2);
      expect(host().stats[1].video).toStrictEqual({
        readyState: 4,
        paused: false,
        currentTime: 0,
        videoWidth: 640,
        videoHeight: 480,
        lastFrameAgeMs: 1000,
        active: true,
      });
    });

    it('runs its frame work outside Angular: 100 frames trigger no change detection on the host', async () => {
      const run = new FakeRun();
      startFrames(run);
      await showFrame(run, 0);
      await vi.advanceTimersByTimeAsync(20);
      const playingRenders = host().renders;

      for (let frame = 1; frame <= 100; frame += 1) {
        context.calls.length = 0;
        source.send(detection(frame, [frame, 10, 20, 20]));
        run.emit(frame);
        runAnimationFrames();
        await flushPromises();
      }
      await vi.advanceTimersByTimeAsync(20);

      expect(decode.mock.calls.length, 'every frame was decoded and drawn').toBe(101);
      expect(strokeRects(), 'the last frame drew').toStrictEqual([[100, 10, 20, 20]]);
      expect(host().renders).toBe(playingRenders);
    });
  });

  describe('barHeight', () => {
    const barObserver = (): FakeResizeObserver => {
      const found = FakeResizeObserver.instances
        .slice()
        .reverse()
        .find((o) => o.target?.classList.contains('bar'));
      if (!found) throw new Error('no observer on the bar');
      return found;
    };

    it('reports the bar’s measured height, and 0 without a bar', () => {
      create();
      expect(tile().barHeight(), 'nothing measured yet').toBe(0);

      const first = barObserver();
      first.resize(300, 28);
      expect(tile().barHeight()).toBe(28);

      host().bars.set(false);
      render();
      expect(tile().barHeight()).toBe(0);
      expect(first.disconnected).toBe(true);

      host().bars.set(true);
      render();
      barObserver().resize(300, 32);
      expect(tile().barHeight()).toBe(32);
    });
  });
});
