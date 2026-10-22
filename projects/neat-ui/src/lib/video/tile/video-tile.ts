import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NeatOverlayColors } from '../overlays/colors';
import type { NeatOverlayState, NeatOverlayView } from '../overlays/draw-frame';
import { createOverlayState, drawFrame, resetOverlayState } from '../overlays/draw-frame';
import type { NeatOverlaySettings } from '../overlays/overlay-settings';
import { NEAT_OVERLAY_DEFAULTS } from '../overlays/overlay-settings';
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
 * once none has arrived for `NEAT_STREAM_STALE_MS`; it plays again when frames return.
 */
export type NeatTileState = 'empty' | 'playing' | 'stopped';

/**
 * The tile's frame-sync counters, as the app reports them (the `synchronization` group of vf's
 * browser egress report). Counters are cumulative for the current stream.
 */
export interface NeatFrameStats extends NeatMetadataQueueStats {
  timestampedPending: number;
  arrivalPending: number;
  recentLatenessMedianMs: number | null;
  recentLatenessMaxMs: number | null;
  /** Valid metadata messages received in the last second. */
  metadataMessagesPerSecond: number;
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
 */
@Component({
  selector: 'neat-video-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-state]': 'state()',
    '[attr.data-selected]': 'selected() ? "" : null',
  },
  template: `
    <video #video class="video" autoplay playsinline [muted]="true"></video>
    <canvas #canvas class="overlay" aria-hidden="true"></canvas>
    @if (bars()) {
      @if (state() !== 'playing') {
        <p class="no-video">No video</p>
      }
      <div class="bar">
        <span class="label">{{ label() }}</span>
        <span class="status">{{ status() }}</span>
        <ng-content select="[neatTileChip]" />
      </div>
    }
  `,
  styleUrl: './video-tile.css',
})
export class NeatVideoTile {
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
  readonly bars = input(true);
  readonly selected = input(false);

  readonly stateChange = output<NeatTileState>();
  /** The frame-sync counters, once a second while there is a stream. */
  readonly frameStats = output<NeatFrameStats>();

  protected readonly state = signal<NeatTileState>('empty');

  private readonly videoElement = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly canvasElement = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly colors = inject(NeatOverlayColors);
  private readonly zone = inject(NgZone);

  // What the frame loop reads. Plain fields, written when the inputs change, never signals.
  private frameSettings: NeatOverlaySettings = NEAT_OVERLAY_DEFAULTS;
  private frameRetentionMs = 0;
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
  };

  private playing: { source: NeatTileSource; stream: MediaStream; stop: () => void } | null = null;
  private queue: NeatMetadataQueue = createMetadataQueue();
  private readonly held: NeatHeldOverlays = new Map();
  private lastFrameAt = 0;
  private staleTimer: ReturnType<typeof setTimeout> | null = null;
  private messagesThisSecond = 0;
  private warnedUnreadable = false;
  private destroyed = false;

  constructor() {
    effect(() => {
      this.frameSettings = this.settings();
      this.frameRetentionMs = this.retentionMs();
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
          }),
      );
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
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

  private play(source: NeatTileSource | null, stream: MediaStream | null): void {
    if (this.playing?.source === source && this.playing.stream === stream) return;
    this.stop();
    if (source === null || stream === null) return;

    const video = this.videoElement().nativeElement;
    // Taken on the first stream, so a tile that never plays holds no canvas context.
    this.context ??= this.canvasElement().nativeElement.getContext('2d');
    this.queue = createMetadataQueue();
    this.messagesThisSecond = 0;
    video.srcObject = stream;
    // Muted autoplay is allowed everywhere; a rejection means the stream was replaced first.
    video.play().catch(() => undefined);
    const unsubscribe = source.onMetadata((text, receivedAt) => this.receive(text, receivedAt));
    const stopTimers = this.zone.runOutsideAngular(() => {
      const stopFrames = startFrameLoop(video, (frame) => this.present(frame, video));
      const statsTimer = setInterval(() => this.reportFrameStats(), FRAME_STATS_INTERVAL_MS);
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
        video.srcObject = null;
      },
    };
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
    const ctx = this.context;
    if (ctx === null || this.overlayState === null) return;
    // A window moved to a screen of another density changes the ratio without a resize.
    const dpr = currentDpr();
    if (dpr !== this.view.dpr) this.sizeCanvas(dpr);
    this.view.videoWidth = video.videoWidth;
    this.view.videoHeight = video.videoHeight;
    drawFrame(
      ctx,
      this.view,
      items.map((item) => ({ message: item.data, held: item.held === true })),
      this.overlayState,
      this.frameSettings,
      now,
    );
  }

  /**
   * One timer at a time, re-armed for the remainder instead of on every frame, so a stream that
   * plays costs one timeout per stale period.
   */
  private checkStale(): void {
    const idle = performance.now() - this.lastFrameAt;
    if (idle < NEAT_STREAM_STALE_MS) {
      this.staleTimer = setTimeout(() => this.checkStale(), NEAT_STREAM_STALE_MS - idle);
      return;
    }
    this.staleTimer = null;
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
    if (!this.destroyed) this.stateChange.emit(next);
  }

  private reportFrameStats(): void {
    const snapshot = metadataQueueSnapshot(this.queue);
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
    });
    this.messagesThisSecond = 0;
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
