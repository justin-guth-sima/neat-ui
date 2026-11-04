import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
  type Signal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NeatOverlayColors } from '../overlays/colors';
import type { NeatOverlayState, NeatOverlayView } from '../overlays/draw-frame';
import { createOverlayState, drawFrame, resetOverlayState } from '../overlays/draw-frame';
import type { NeatOverlaySettings } from '../overlays/overlay-settings';
import { NEAT_OVERLAY_DEFAULTS } from '../overlays/overlay-settings';
import { letterbox } from '../overlays/letterbox';
import type { NeatMetadataMessage } from '../sync/metadata-message';
import { parseMetadataMessage } from '../sync/metadata-message';
import type {
  NeatHeldOverlays,
  NeatMetadataQueue,
  NeatMetadataQueueStats,
  NeatMetadataSnapshot,
} from '../sync/metadata-sync';
import {
  createMetadataQueue,
  enqueueMetadata,
  holdOverlays,
  metadataQueueSnapshot,
  resetLatenessWindow as resetQueueLatenessWindow,
  takeMetadataForFrame,
} from '../sync/metadata-sync';
import type { PresentedFrame } from './frame-loop';
import { startFrameLoop } from './frame-loop';
import type { NeatTileSource } from './tile-source';

/** A tile whose stream presents no frame for this long has stopped. */
export const NEAT_STREAM_STALE_MS = 1800;

const FRAME_STATS_INTERVAL_MS = 1000;
/** Beyond 2 device pixels per CSS pixel overlays look no sharper, but cost four times the fill. */
const MAX_CANVAS_DPR = 2;

/**
 * `empty` until the stream presents its first frame, `playing` while frames arrive, `stopped`
 * once none has arrived for the stale timeout (about 1.8 s); it plays again when frames return.
 */
export type NeatTileState = 'empty' | 'playing' | 'stopped';

/**
 * Where the shown image sits inside the tile, in CSS pixels from the tile's top-left corner: the
 * video without the bars `object-fit: contain` leaves around it.
 */
export interface NeatVideoBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function sameVideoBox(a: NeatVideoBox | null, b: NeatVideoBox | null): boolean {
  if (a === null || b === null) return a === b;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/**
 * What the overlay drew for one presented frame: the messages matched to it, and the ones held
 * over from an earlier frame because this frame had none of their type (`held`).
 */
export interface NeatTileFrame {
  /** When the frame was presented, on the `performance.now()` clock. */
  readonly now: number;
  /** One message per type at most; empty when nothing matched and nothing is held. */
  readonly messages: readonly { readonly message: NeatMetadataMessage; readonly held: boolean }[];
}

/**
 * Called once for each frame the tile presents, after the overlay is drawn, outside Angular: it
 * runs up to the video's frame rate, so it must be cheap and should not touch Angular state per
 * call (write a signal at most when its value changes).
 */
export type NeatTileFrameListener = (frame: NeatTileFrame) => void;

/**
 * The tile's frame-sync counters and video state, as the app reports them (the `synchronization`
 * and `video` groups of vf's browser egress report). Counters are cumulative for the current
 * stream. Every count and pixel size is a whole number: vf parses them as integers and drops a
 * report with a fraction in one.
 */
export interface NeatFrameStats extends NeatMetadataQueueStats {
  timestampedPending: number;
  arrivalPending: number;
  recentLatenessMedianMs: number | null;
  recentLatenessMaxMs: number | null;
  /** Valid metadata messages received in the last second. */
  metadataMessagesPerSecond: number;
  /** The video element when the stats were taken. */
  video: {
    /** `HTMLMediaElement.readyState`, 0 to 4. */
    readyState: number;
    paused: boolean;
    /** Seconds, fractional. */
    currentTime: number;
    videoWidth: number;
    videoHeight: number;
    /** Whole milliseconds since the stream's last presented frame; null before its first. */
    lastFrameAgeMs: number | null;
    /** Whether the tile is `playing`. */
    active: boolean;
  };
}

/**
 * Plays a source's video with its metadata drawn as overlays, each frame with the metadata that
 * describes it. It fills the box it is given.
 *
 * The frame loop runs outside Angular and touches no signal: per frame it matches the queued
 * metadata to the presented frame, holds a type that is missing for a moment, and draws. The
 * component sees a state change and, at most once a second, `frameStats`. Inputs the loop needs
 * are copied into fields when they change, so a frame never reads an input or resolves settings.
 *
 * With `bars` on, a bar along the bottom shows `label`, `status` and the chips projected with
 * `neatTileChip`, and a tile without video says so. With `bars` off it is only video and overlay.
 *
 * Content projected with `neatTileOverlay` fills a layer over the tile, above the overlay canvas
 * and below the bar; `videoBox` says where the image is inside it and `barHeight` how tall the bar
 * is. Without video the layer stays above what covers the image and below the no-video note, which
 * lets pointer input through. The layer itself catches no pointer input, so the video under it
 * keeps its hits; its content takes them only where it sets `pointer-events: auto`.
 */
@Component({
  selector: 'neat-video-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-state]': 'state()',
    '[attr.data-selected]': 'selected() ? "" : null',
    '[attr.data-mirrored]': 'mirror() ? "" : null',
  },
  template: `
    <video #video class="video" autoplay playsinline [muted]="true"></video>
    <canvas #canvas class="overlay" aria-hidden="true"></canvas>
    <div class="overlay-slot"><ng-content select="[neatTileOverlay]" /></div>
    @if (bars()) {
      @if (state() !== 'playing') {
        <p class="no-video"><span class="no-video-text">No active video received</span></p>
      }
      <div #bar class="bar">
        <span class="label">{{ label() }}</span>
        <span class="status">{{ status() }}</span>
        <ng-content select="[neatTileChip]" />
      </div>
    }
  `,
  styleUrl: './video-tile.css',
})
export class NeatVideoTile {
  /**
   * Where the video and its metadata come from; `null` (the default) leaves the tile `empty`.
   * Give it the channel's source once it has one: the tile plays its stream and draws its metadata.
   */
  readonly source = input<NeatTileSource | null>(null);
  /** The channel's resolved overlay settings; a new object for each change. */
  readonly settings = input<NeatOverlaySettings>(NEAT_OVERLAY_DEFAULTS);
  /** How long metadata waits for its frame, in milliseconds; 0 waits indefinitely. */
  readonly retentionMs = input(0);
  /** The number overlay warnings name the tile by, such as the app's channel. */
  readonly channel = input(0);
  /** The bar's left text, such as the channel number. */
  readonly label = input('');
  /** The bar's status text. */
  readonly status = input<string | null>(null);
  /** Whether the bar along the bottom (`label`, `status`, chips) and the no-video note show. */
  readonly bars = input(true);
  /** Draws the kit's focus ring around the tile, for the tile the app has chosen. */
  readonly selected = input(false);
  /**
   * Shows the picture as in a mirror (a selfie view): the video and every overlay flip
   * horizontally, while overlay text (labels, plates) still reads left to right. The bar, the
   * no-video note and the `neatTileOverlay` layer are not flipped; content projected there reads
   * the app's own `mirror` value to follow. `videoBox` is the same with and without it. The
   * region-of-interest editor does not follow `mirror`: it works in the unflipped picture.
   */
  readonly mirror = input(false);
  /**
   * Called once for each presented frame with what the overlay drew (see `NeatTileFrame`), for an
   * app that acts on a frame's metadata (counting poses, say) in step with the picture. It runs
   * outside Angular; a listener that throws is logged once per tile and the frames keep drawing.
   */
  readonly frameListener = input<NeatTileFrameListener | null>(null);

  /** The tile's state each time it changes: `empty`, `playing` or `stopped`. */
  readonly stateChange = output<NeatTileState>();
  /** The frame-sync counters, once a second while there is a stream. */
  readonly frameStats = output<NeatFrameStats>();

  protected readonly state = signal<NeatTileState>('empty');

  private readonly box = signal<NeatVideoBox | null>(null, { equal: sameVideoBox });
  /**
   * Where the shown image sits in the tile. Non-null only while the tile is `playing` and the
   * video and the tile have a size: before the first frame the surface covers the video, and once
   * the stream is `stopped` the frozen frame is blurred and scaled up, so no box describes it.
   * Unlike the frame loop's fields it is a signal, for overlays that follow the image: it is
   * written only when the tile's state or the tile's or the video's size changes, never per frame,
   * and an unchanged box does not notify.
   */
  readonly videoBox: Signal<NeatVideoBox | null> = this.box.asReadonly();

  private readonly barSize = signal(0);
  /**
   * The height in CSS pixels of the bar along the bottom as laid out, 0 while `bars` is off. For
   * content projected with `neatTileOverlay` that keeps clear of the bar without copying its
   * styling. It changes only when the bar's size does, never per frame.
   */
  readonly barHeight: Signal<number> = this.barSize.asReadonly();

  private readonly videoElement = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly canvasElement = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly barElement = viewChild<ElementRef<HTMLElement>>('bar');
  private readonly colors = inject(NeatOverlayColors);
  private readonly zone = inject(NgZone);
  private readonly document = inject(DOCUMENT);

  // What the frame loop reads. Plain fields, written when the inputs change, never signals.
  private frameSettings: NeatOverlaySettings = NEAT_OVERLAY_DEFAULTS;
  private frameRetentionMs = 0;
  private frameListenerFn: NeatTileFrameListener | null = null;
  private overlayState: NeatOverlayState | null = null;
  private currentState: NeatTileState = 'empty';

  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  /** The canvas's CSS size and pixel ratio; the video size is filled in per frame. */
  private readonly view: NeatOverlayView = {
    cssWidth: 0,
    cssHeight: 0,
    dpr: 1,
    videoWidth: 0,
    videoHeight: 0,
    mirror: false,
  };

  private playing: { source: NeatTileSource; stream: MediaStream; stop: () => void } | null = null;
  private queue: NeatMetadataQueue = createMetadataQueue();
  private readonly held: NeatHeldOverlays = new Map();
  /** When the current stream last presented a frame; null until its first. */
  private lastFrameAt: number | null = null;
  private staleTimer: ReturnType<typeof setTimeout> | null = null;
  /** The last stale check found the tab hidden, so the frame time it would judge is from before. */
  private staleCheckSawHidden = false;
  private messagesThisSecond = 0;
  private warnedUnreadable = false;
  private warnedPlayback = false;
  private warnedListener = false;
  private destroyed = false;

  constructor() {
    effect(() => {
      this.frameSettings = this.settings();
      this.frameRetentionMs = this.retentionMs();
      this.view.mirror = this.mirror();
      this.frameListenerFn = this.frameListener();
    });
    // After render, so the bar `bars` adds is in the document. The query is read untracked: it
    // only changes with `bars`, and tracking it would reschedule this on every teardown too.
    afterRenderEffect((onCleanup) => {
      this.bars();
      const bar = untracked(this.barElement)?.nativeElement;
      if (bar === undefined) {
        this.barSize.set(0);
        return;
      }
      const observer = this.zone.runOutsideAngular(
        () =>
          new ResizeObserver((entries) => {
            this.barSize.set(entries[entries.length - 1].borderBoxSize[0].blockSize);
          }),
      );
      observer.observe(bar);
      onCleanup(() => observer.disconnect());
    });
    effect(() => {
      // A new state starts with no tracks, track colours or warnings of its own.
      this.overlayState = createOverlayState(this.channel(), this.colors);
    });

    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.canvas = this.canvasElement().nativeElement;
      // The canvas is sized here and nowhere per frame: a resize replaces its backing store.
      const observer = this.zone.runOutsideAngular(
        () =>
          new ResizeObserver((entries) => {
            const { width, height } = entries[entries.length - 1].contentRect;
            this.view.cssWidth = width;
            this.view.cssHeight = height;
            this.sizeCanvas(currentDpr());
            this.updateVideoBox();
          }),
      );
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());

      // The video's size is known after its metadata loads and changes with the stream's
      // resolution; the element's own events are the only times it is read besides the frames.
      const video = this.videoElement().nativeElement;
      const onVideoSize = () => this.updateVideoBox();
      this.zone.runOutsideAngular(() => {
        video.addEventListener('loadedmetadata', onVideoSize);
        video.addEventListener('resize', onVideoSize);
      });
      destroyRef.onDestroy(() => {
        video.removeEventListener('loadedmetadata', onVideoSize);
        video.removeEventListener('resize', onVideoSize);
      });
    });

    // Runs after render, so the video element exists when the first stream arrives.
    afterRenderEffect(() => {
      const source = this.source();
      const stream = source?.stream() ?? null;
      untracked(() => this.play(source, stream));
    });

    destroyRef.onDestroy(() => {
      // Outputs are already closed; stopping must not emit a state change.
      this.destroyed = true;
      this.stop();
    });
  }

  /** The metadata queue's counters and lateness window, for the app's lateness notice. */
  snapshot(): NeatMetadataSnapshot {
    return metadataQueueSnapshot(this.queue);
  }

  /**
   * Forgets the lateness measured so far, as after the app changes the video sync buffer: what was
   * measured belongs to the old buffer. The cumulative counters stay.
   */
  resetLatenessWindow(): void {
    resetQueueLatenessWindow(this.queue);
  }

  private play(source: NeatTileSource | null, stream: MediaStream | null): void {
    if (this.playing?.source === source && this.playing.stream === stream) return;
    this.stop();
    if (source === null || stream === null) return;

    const video = this.videoElement().nativeElement;
    // Taken on the first stream, so a tile that never plays holds no canvas context.
    this.context ??= this.canvasElement().nativeElement.getContext('2d');
    this.queue = createMetadataQueue();
    this.lastFrameAt = null;
    this.staleCheckSawHidden = false;
    this.messagesThisSecond = 0;
    video.srcObject = stream;
    this.startPlayback(video);
    // A track that was muted (no media flowing) may leave the element paused; play on unmute.
    const replay = () => this.startPlayback(video);
    const tracks = stream.getVideoTracks();
    for (const track of tracks) track.addEventListener('unmute', replay);
    const unsubscribe = source.onMetadata((text, receivedAt) => this.receive(text, receivedAt));
    const stopTimers = this.zone.runOutsideAngular(() => {
      const stopFrames = startFrameLoop(
        video,
        (frame) => this.present(frame, video),
        () => this.clearOverlays(),
      );
      const statsTimer = setInterval(() => this.reportFrameStats(video), FRAME_STATS_INTERVAL_MS);
      return () => {
        stopFrames();
        clearInterval(statsTimer);
      };
    });
    this.playing = {
      source,
      stream,
      stop: () => {
        stopTimers();
        unsubscribe();
        for (const track of tracks) track.removeEventListener('unmute', replay);
        video.srcObject = null;
      },
    };
  }

  /**
   * Muted autoplay is allowed everywhere, so a rejection is either an AbortError (a newer stream or
   * a pause interrupted it, which is expected) or a real refusal that would leave the tile empty for
   * good, such as NotAllowedError or NotSupportedError. Those are logged, once per tile.
   */
  private startPlayback(video: HTMLVideoElement): void {
    video.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (this.warnedPlayback) return;
      this.warnedPlayback = true;
      const reason = error instanceof DOMException ? `${error.name}: ${error.message}` : error;
      console.warn(`video: channel ${this.channel()} cannot play its stream (${reason})`);
    });
  }

  private stop(): void {
    if (this.playing === null) return;
    this.playing.stop();
    this.playing = null;
    if (this.staleTimer !== null) clearTimeout(this.staleTimer);
    this.staleTimer = null;
    this.clearOverlays();
    this.setState('empty');
  }

  private receive(text: string, receivedAt: number): void {
    const message = parseMetadataMessage(text);
    if (message === null) {
      if (!this.warnedUnreadable) {
        this.warnedUnreadable = true;
        console.warn(
          `metadata: channel ${this.channel()} dropped a message that is not a JSON ` +
            'object with a string "type"; later ones are dropped silently',
        );
      }
      return;
    }
    this.messagesThisSecond += 1;
    enqueueMetadata(this.queue, message, receivedAt);
  }

  private present({ now, rtpTimestamp }: PresentedFrame, video: HTMLVideoElement): void {
    this.lastFrameAt = now;
    this.setState('playing');
    this.staleTimer ??= setTimeout(() => this.checkStale(), NEAT_STREAM_STALE_MS);

    const items = holdOverlays(
      this.held,
      takeMetadataForFrame(this.queue, rtpTimestamp, this.frameRetentionMs, now),
      now,
    );
    const messages = items.map((item) => ({ message: item.data, held: item.held === true }));
    const ctx = this.context;
    if (ctx !== null && this.overlayState !== null) {
      // A window moved to a screen of another density changes the ratio without a resize.
      const dpr = currentDpr();
      if (dpr !== this.view.dpr) this.sizeCanvas(dpr);
      this.view.videoWidth = video.videoWidth;
      this.view.videoHeight = video.videoHeight;
      drawFrame(ctx, this.view, messages, this.overlayState, this.frameSettings, now);
    }
    this.notifyListener({ now, messages });
  }

  private notifyListener(frame: NeatTileFrame): void {
    const listener = this.frameListenerFn;
    if (listener === null) return;
    try {
      listener(frame);
    } catch (error) {
      if (this.warnedListener) return;
      this.warnedListener = true;
      console.warn(
        `video: channel ${this.channel()} frameListener threw; later errors are dropped silently`,
        error,
      );
    }
  }

  /**
   * One timer at a time, re-armed for the remainder instead of on every frame, so a stream that
   * plays costs one timeout per stale period. A hidden tab presents no frames, so the check waits
   * there instead of stopping a stream that is still running. The first check after the tab
   * returns waits a full period too: the last frame time is from before the tab was hidden, and a
   * check right after the return, before the first new frame, would stop a live stream. A dead one
   * stops a period later.
   */
  private checkStale(): void {
    this.staleTimer = null;
    // Armed by a presented frame and cleared with its stream, so a frame time is always known.
    if (this.lastFrameAt === null) return;
    const idle = performance.now() - this.lastFrameAt;
    if (this.document.hidden || this.staleCheckSawHidden) {
      this.staleCheckSawHidden = this.document.hidden;
      this.staleTimer = setTimeout(() => this.checkStale(), NEAT_STREAM_STALE_MS);
      return;
    }
    if (idle < NEAT_STREAM_STALE_MS) {
      this.staleTimer = setTimeout(() => this.checkStale(), NEAT_STREAM_STALE_MS - idle);
      return;
    }
    this.clearOverlays();
    this.setState('stopped');
  }

  /** Forgets what was drawn: the canvas, held overlays, track trails and track colours. */
  private clearOverlays(): void {
    const ctx = this.context;
    if (ctx !== null) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    this.held.clear();
    if (this.overlayState !== null) resetOverlayState(this.overlayState);
  }

  private setState(next: NeatTileState): void {
    if (this.currentState === next) return;
    this.currentState = next;
    this.state.set(next);
    this.updateVideoBox();
    if (!this.destroyed) this.stateChange.emit(next);
  }

  private reportFrameStats(video: HTMLVideoElement): void {
    const snapshot = metadataQueueSnapshot(this.queue);
    const lastFrameAt = this.lastFrameAt;
    this.frameStats.emit({
      timestampMatches: snapshot.timestampMatches,
      arrivalFallbacks: snapshot.arrivalFallbacks,
      frameMisses: snapshot.frameMisses,
      expired: snapshot.expired,
      evicted: snapshot.evicted,
      late: snapshot.late,
      untimestampedReceived: snapshot.untimestampedReceived,
      timestampedPending: snapshot.timestampedPending,
      arrivalPending: snapshot.arrivalPending,
      recentLatenessMedianMs: snapshot.recentLatenessMedianMs,
      recentLatenessMaxMs: snapshot.recentLatenessMaxMs,
      metadataMessagesPerSecond: this.messagesThisSecond,
      video: {
        readyState: video.readyState,
        paused: video.paused,
        currentTime: video.currentTime,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        lastFrameAgeMs: lastFrameAt === null ? null : Math.round(performance.now() - lastFrameAt),
        active: this.currentState === 'playing',
      },
    });
    this.messagesThisSecond = 0;
  }

  /** Called when the tile or the video changes size or the tile's state changes, never per frame. */
  private updateVideoBox(): void {
    if (this.currentState !== 'playing') {
      this.box.set(null);
      return;
    }
    const { videoWidth, videoHeight } = this.videoElement().nativeElement;
    const { cssWidth, cssHeight } = this.view;
    if (!videoWidth || !videoHeight || !cssWidth || !cssHeight) {
      this.box.set(null);
      return;
    }
    const { scaleX, scaleY, offsetX, offsetY } = letterbox(
      videoWidth,
      videoHeight,
      cssWidth,
      cssHeight,
    );
    this.box.set({
      x: offsetX,
      y: offsetY,
      width: scaleX * videoWidth,
      height: scaleY * videoHeight,
    });
  }

  private sizeCanvas(dpr: number): void {
    const canvas = this.canvas;
    if (canvas === null) return;
    this.view.dpr = dpr;
    canvas.width = Math.round(this.view.cssWidth * dpr);
    canvas.height = Math.round(this.view.cssHeight * dpr);
  }
}

function currentDpr(): number {
  return Math.min(MAX_CANVAS_DPR, window.devicePixelRatio || 1);
}
