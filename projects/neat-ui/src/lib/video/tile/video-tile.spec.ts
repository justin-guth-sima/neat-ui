import { afterEveryRender, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OVERLAY_PALETTE } from '../../theme/overlay-palette';
import type { NeatMetadataMessage } from '../sync/metadata-message';
import type { NeatOverlaySettings } from '../overlays/overlay-settings';
import { NEAT_OVERLAY_DEFAULTS } from '../overlays/overlay-settings';
import { overlaySettings, RecordingContext } from '../overlays/spec-helpers';
import type { NeatTileSource } from './tile-source';
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

/** jsdom plays no media; a stand-in object is enough for the tile to hand to the video element. */
const STREAM = { id: 'stream' } as unknown as MediaStream;

type FrameCallback = (now: number, metadata: Partial<VideoFrameCallbackMetadata>) => void;

/**
 * requestVideoFrameCallback on every video element, which jsdom lacks, with frames the test
 * presents. The video reports a current frame and a 640×480 picture.
 */
class FakeVideoFrames {
  readonly callbacks = new Map<number, FrameCallback>();
  readonly cancelled: number[] = [];
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
        this.cancelled.push(id);
        this.callbacks.delete(id);
      },
    });
  }

  uninstall(): void {
    const prototype = HTMLVideoElement.prototype as unknown as Record<string, unknown>;
    delete prototype['requestVideoFrameCallback'];
    delete prototype['cancelVideoFrameCallback'];
  }

  present(rtpTimestamp: number | null): void {
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    const metadata = rtpTimestamp === null ? {} : { rtpTimestamp };
    for (const callback of pending) callback(performance.now(), metadata);
  }
}

/** A ResizeObserver that reports only when a test says so. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  disconnect(): void {
    this.observed.length = 0;
  }

  resize(width: number, height: number): void {
    const entry = { target: this.observed[0], contentRect: { width, height } };
    this.callback([entry as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

@Component({
  imports: [NeatVideoTile],
  template: `
    <neat-video-tile
      [source]="source()"
      [settings]="settings()"
      [channel]="3"
      label="3"
      [status]="status()"
      [bars]="bars()"
      [selected]="selected()"
      (stateChange)="states.push($event)"
      (frameStats)="stats.push($event)"
    >
      <span neatTileChip class="chip">Metadata late</span>
    </neat-video-tile>
  `,
})
class Host {
  readonly source = signal<NeatTileSource | null>(null);
  readonly settings = signal<NeatOverlaySettings>(NEAT_OVERLAY_DEFAULTS);
  readonly status = signal<string | null>('H.264 · 640×480 · 30.0 fps');
  readonly bars = signal(true);
  readonly selected = signal(false);
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

describe('NeatVideoTile', () => {
  let fixture: ComponentFixture<Host>;
  let source: FakeSource;
  let frames: FakeVideoFrames;
  let context: RecordingContext;

  const host = () => fixture.componentInstance;
  const tileElement = (): HTMLElement => fixture.nativeElement.querySelector('neat-video-tile');
  const tile = (): NeatVideoTile =>
    fixture.debugElement.children[0].componentInstance as NeatVideoTile;
  const tileState = () => tileElement().getAttribute('data-state');
  const video = (): HTMLVideoElement => tileElement().querySelector('video') as HTMLVideoElement;
  const canvas = (): HTMLCanvasElement =>
    tileElement().querySelector('canvas') as HTMLCanvasElement;
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
  function present(rtpTimestamp: number | null): void {
    context.calls.length = 0;
    frames.present(rtpTimestamp);
  }

  function create(): void {
    fixture = TestBed.createComponent(Host);
    source = new FakeSource();
    host().source.set(source);
    render();
    FakeResizeObserver.instances[0].resize(640, 480);
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
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(
      HTMLMediaElement.HAVE_ENOUGH_DATA,
    );
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640);
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(480);
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it('clears overlays, tracks and colours when stopped, and plays again when frames return', () => {
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
      'track b takes the first colour again',
    ).toStrictEqual([OVERLAY_PALETTE[0]]);
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
    expect(tileElement().querySelector('.no-video')?.textContent).toBe('No video');

    host().bars.set(false);
    render();

    expect(Array.from(tileElement().children, (child) => child.tagName)).toStrictEqual([
      'VIDEO',
      'CANVAS',
    ]);
    expect(tileElement().querySelector('[neatTileChip]')).toBeNull();
  });

  it('reflects its state and selection on its host for styling', () => {
    create();
    expect(tileElement().hasAttribute('data-selected')).toBe(false);

    host().selected.set(true);
    render();

    expect(tileElement().hasAttribute('data-selected')).toBe(true);
    expect(tileState()).toBe('empty');
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
    expect(frames.cancelled).toStrictEqual([pending]);
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
  });

  it('emits frame stats once per second with the queue counters and the message rate', () => {
    create();
    advance(3000);
    expect(host().stats, 'nothing to report without a stream').toStrictEqual([]);

    startStream();
    source.send(detection(1, [10, 10, 20, 20]));
    source.send(detection(null, [10, 10, 20, 20]));
    present(1);
    present(2);
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
      },
    ]);

    advance(1000);
    expect(host().stats).toHaveLength(2);
    expect(host().stats[1].metadataMessagesPerSecond).toBe(0);
  });

  it('sizes the canvas backing store from its box at devicePixelRatio, capped at 2', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    create();
    startStream();
    FakeResizeObserver.instances[0].resize(320, 240);
    expect(FakeResizeObserver.instances[0].observed).toStrictEqual([tileElement()]);
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
});
