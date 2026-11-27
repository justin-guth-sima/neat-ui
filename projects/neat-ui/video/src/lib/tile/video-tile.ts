import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  isDevMode,
  NgZone,
  output,
  type Signal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NeatButton, NeatExpand, NeatIcon, type NeatTone, NeatTooltip } from '@sima/neat-ui';
import { NeatBadge } from '@sima/neat-ui/badge';
import { NeatOverlayColors } from '../overlays/colors';
import type { NeatOverlayState, NeatOverlayView } from '../overlays/draw-frame';
import {
  createOverlayState,
  drawFrame,
  overlayColor,
  resetOverlayState,
} from '../overlays/draw-frame';
import type { NeatOverlayIdentity, NeatOverlayType } from '../overlays/item-colors';
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
import type { DecodedFrame } from './frame-scheduler';
import { startFrameScheduler } from './frame-scheduler';
import type { NeatEncodedFrames, NeatTileSource } from './tile-source';

/** What a tile with bars says without video, while it has no `notice`. */
const NO_VIDEO_TEXT = 'No active video received';

/** A tile whose stream presents no frame for this long has stopped. */
export const NEAT_STREAM_STALE_MS = 1800;

const FRAME_STATS_INTERVAL_MS = 1000;
/** Beyond 2 device pixels per CSS pixel overlays look no sharper, but cost four times the fill. */
const MAX_CANVAS_DPR = 2;

/**
 * Where the tile's stream is: `empty`, `playing` or `stopped`.
 *
 * It is `empty` until the stream, or the run of encoded frames, presents its first frame, and
 * `playing` while frames arrive. It is `stopped` once none has arrived for the stale timeout, about
 * 1.8 s. It plays again when frames return.
 */
export type NeatTileState = 'empty' | 'playing' | 'stopped';

/**
 * Where the shown image sits inside the tile, in CSS pixels from the tile's top-left corner.
 *
 * It is the picture without the letterbox bars that `object-fit: contain` leaves around it.
 */
export interface NeatVideoBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What a failed browser call says, for a warning: a `DOMException`'s name and message, else the error. */
function reasonOf(error: unknown): unknown {
  return error instanceof DOMException ? `${error.name}: ${error.message}` : error;
}

function sameVideoBox(a: NeatVideoBox | null, b: NeatVideoBox | null): boolean {
  if (a === null || b === null) return a === b;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/**
 * What the overlay drew for one presented frame.
 *
 * It holds the messages matched to the frame. It also holds the ones held over from an earlier
 * frame because this frame had none of their type, marked `held`.
 */
export interface NeatTileFrame {
  /** When the frame was presented, on the `performance.now()` clock. */
  readonly now: number;
  /** One message per type at most; empty when nothing matched and nothing is held. */
  readonly messages: readonly { readonly message: NeatMetadataMessage; readonly held: boolean }[];
}

/**
 * Called once for each frame the tile presents, after the overlay is drawn, outside Angular.
 *
 * It runs up to the video's frame rate. So it must be cheap, and should not touch Angular state
 * per call: write a signal at most when its value changes.
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
  /**
   * The picture's state when the stats were taken: the video element's, or, while the tile draws
   * encoded frames, the frames canvas's: `readyState` is 4 once a frame is drawn and 0 before,
   * `paused` is false, `currentTime` is 0, and `videoWidth` and `videoHeight` are the picture's.
   */
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
 * Plays a source's video, with its metadata drawn over it as overlays.
 *
 * ```html
 * <neat-video-tile [source]="source" label="1" status="640×360 · 30 fps" />
 * ```
 *
 * Each frame is drawn with the metadata that describes it. The tile fills the box it is given.
 *
 * It plays a source's stream, or draws its encoded frames (`NeatTileSource.frames`) for video the
 * browser cannot play as a stream: each frame is decoded and drawn on a canvas in the video's
 * place, under the overlays. The app sets nothing for it; the source says which it has.
 *
 * With `bars` on, a bar along the bottom shows `label`, `status` and the chips projected with
 * `neatTileChip`, and a tile without video says so. With `bars` off it is only video and overlay.
 *
 * `notice` says what keeps the stream from showing as it should, with or without bars:
 *
 * ```html
 * <neat-video-tile [source]="source" [bars]="false" [notice]="trouble()" />
 * ```
 *
 * Without video it is centered over the tile, in place of the no-video note, in the same look.
 * While video plays it is a solid badge in the picture's top-right corner.
 *
 * Content projected with `neatTileOverlay` fills a layer over the tile, above the overlay canvas
 * and below the bar. `videoBox` says where the image is inside it, and `barHeight` how tall the
 * bar is.
 *
 * Without video, the layer stays above what covers the image and below the no-video note, which
 * lets pointer input through. The layer itself catches no pointer input, so the video under it
 * keeps its hits. Its content takes them only where it sets `pointer-events: auto`.
 *
 * With `expandControl` on, a button in the tile's top-left corner shows it over the whole window
 * and puts it back (`NeatExpand`, which the tile carries itself). It shows while the pointer is
 * over the tile or the button has the keyboard's focus, and always while the tile is expanded:
 *
 * ```html
 * <neat-video-tile [source]="source" label="Camera 1" expandControl />
 * ```
 *
 * The tile's own `expanded` model is that state, so an app can open the tile from a control of its
 * own and follow it: `[(expanded)]="large"`. Do not put `neatExpand` on a tile as well: Angular
 * refuses a directive twice on one element in dev mode. The same live tile is shown, so the video plays on and
 * the overlays take the new size.
 *
 * The frame loop, and for encoded frames their decoding, runs outside Angular and touches no
 * signal. Per frame, it matches the queued metadata to the presented frame, holds a type that is
 * missing for a moment, and draws. The component sees a state change and, at most once a second,
 * `frameStats`. Inputs the loop needs are copied into fields when they change, so a frame never
 * reads an input or resolves settings.
 *
 * @input expanded Whether the tile is shown over the whole window (`NeatExpand`), false by default.
 * Bind it two-way to open the tile from the app's own control and follow it: the tile's button and
 * Escape change it too. `expandControl` gives the tile a button of its own.
 */
@Component({
  selector: 'neat-video-tile',
  imports: [NeatBadge, NeatButton, NeatIcon, NeatTooltip],
  hostDirectives: [{ directive: NeatExpand, inputs: ['expanded'], outputs: ['expandedChange'] }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-state]': 'state()',
    '[attr.data-selected]': 'selected() ? "" : null',
    '[attr.data-mirrored]': 'mirror() ? "" : null',
    '[attr.data-flipped]': 'flipVertical() ? "" : null',
    '[attr.data-frames]': 'playsFrames() ? "" : null',
  },
  template: `
    <video #video class="video" autoplay playsinline [muted]="true"></video>
    <canvas #frames class="frames" aria-hidden="true"></canvas>
    <canvas #canvas class="overlay" aria-hidden="true"></canvas>
    <div class="overlay-slot"><ng-content select="[neatTileOverlay]" /></div>
    @if (state() !== 'playing') {
      @if (noVideoText(); as text) {
        <p class="no-video">
          <neat-icon class="no-video-icon" name="video-off" [size]="22" />
          <span class="no-video-text">{{ text }}</span>
        </p>
      }
    } @else if (notice(); as notice) {
      @let picture = videoBox();
      <div
        class="picture"
        [style.left.px]="picture?.x"
        [style.top.px]="picture?.y"
        [style.width.px]="picture?.width"
        [style.height.px]="picture?.height"
      >
        <p class="notice">
          <neat-badge variant="solid" [tone]="noticeTone()">{{ notice }}</neat-badge>
        </p>
      </div>
    }
    @if (bars()) {
      <div #bar class="bar">
        <span class="label">{{ label() }}</span>
        <span class="status">{{ status() }}</span>
        <ng-content select="[neatTileChip]" />
      </div>
    }
    @if (expandControl()) {
      <button
        neatButton
        class="expand"
        type="button"
        variant="secondary"
        size="small"
        iconOnly
        neatTooltipPosition="bottom"
        [attr.aria-label]="expandLabel()"
        [neatTooltip]="expandLabel()"
        (click)="expand.toggle()"
      >
        <neat-icon [name]="expand.expanded() ? 'close' : 'expand-window'" [size]="16" />
      </button>
    }
  `,
  styleUrl: './video-tile.css',
})
export class NeatVideoTile {
  /**
   * Where the video and its metadata come from; `null` (the default) leaves the tile `empty`.
   * Give it the channel's source once it has one: the tile plays its stream or draws its encoded
   * frames, and draws its metadata.
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
  /**
   * Whether the bar along the bottom (`label`, `status`, chips) and the no-video note show. A
   * `notice` shows either way.
   */
  readonly bars = input(true);
  /**
   * What keeps the stream from showing as it should, in words, or null (the default) while all is
   * well: a failure, a server out of reach, a stream being waited for.
   *
   * Without video, the tile says it centered over itself, under a "no video" icon and with no
   * card behind it, in place of the no-video note. It does so with or without `bars`, so a tile
   * without bars can say "No signal".
   *
   * While video plays, it is a solid badge of `noticeTone` in the picture's top-right corner,
   * where it covers little of the picture. It sits above the `neatTileOverlay` layer and lets
   * pointer input through. The tile does not announce it: say a change that matters in the page's
   * text as well, such as a callout.
   */
  readonly notice = input<string | null>(null);
  /**
   * The tone of the notice's badge while video plays: `warning` by default, since a notice says
   * that something is not as it should be. Without video the notice has no badge, and its
   * words say it.
   */
  readonly noticeTone = input<NeatTone>('warning');
  /** Draws the kit's focus ring around the tile, for the tile the app has chosen. */
  readonly selected = input(false);
  /**
   * Shows the picture as in a mirror, for a selfie view.
   *
   * The video and every overlay flip horizontally, while overlay text, such as labels and plates,
   * still reads left to right. Together with `flipVertical` it is the picture turned 180°. The
   * bar, the no-video note and the `neatTileOverlay` layer are not flipped. Content projected there
   * reads the app's own `mirror` value to follow. `videoBox` is the same with and without it. The
   * region-of-interest editor does not follow `mirror`: it works in the unflipped picture.
   */
  readonly mirror = input(false);
  /**
   * Shows the picture flipped top to bottom, for a camera mounted upside down.
   *
   * The video and every overlay flip vertically, while overlay text, such as labels and plates,
   * stays upright: a box's label stands above the box as it shows on screen. Together with
   * `mirror` it is the picture turned 180°. The bar, the no-video note and the `neatTileOverlay`
   * layer are not flipped. Content projected there reads the app's own `flipVertical` value to
   * follow. `videoBox` is the same with and without it. The region-of-interest editor does not
   * follow `flipVertical`: it works in the unflipped picture.
   */
  readonly flipVertical = input(false);
  /**
   * Called once for each presented frame, with what the overlay drew (`NeatTileFrame`).
   *
   * It is for an app that acts on a frame's metadata in step with the picture, such as counting
   * poses. It runs outside Angular. A listener that throws is logged once per tile, and the frames
   * keep drawing.
   */
  readonly frameListener = input<NeatTileFrameListener | null>(null);
  /**
   * Gives the tile a button that shows it over the whole window and puts it back, off by default.
   *
   * The button sits in the tile's top-left corner. It shows while the pointer is over the tile or
   * the button has the keyboard's focus, and always while the tile is expanded. It is named
   * "Expand" and the tile's `label` ("Expand Camera 1") while the tile is in its place, and "Close"
   * while it is expanded. Escape closes the tile too.
   */
  readonly expandControl = input(false, { transform: booleanAttribute });

  /** The tile's state each time it changes: `empty`, `playing` or `stopped`. */
  readonly stateChange = output<NeatTileState>();
  /** The frame-sync counters, once a second while there is a stream or a run of encoded frames. */
  readonly frameStats = output<NeatFrameStats>();

  protected readonly state = signal<NeatTileState>('empty');
  /** Whether the tile draws encoded frames rather than playing a stream. */
  protected readonly playsFrames = signal(false);
  /** The tile's own `NeatExpand`, which `expandControl`'s button drives. */
  protected readonly expand = inject(NeatExpand, { self: true });
  protected readonly expandLabel = computed(() => {
    if (this.expand.expanded()) return 'Close';
    return this.label() ? `Expand ${this.label()}` : 'Expand';
  });
  /** What the tile says without video: the notice, else the no-video note with bars. */
  protected readonly noVideoText = computed(
    () => this.notice() ?? (this.bars() ? NO_VIDEO_TEXT : null),
  );

  private readonly box = signal<NeatVideoBox | null>(null, { equal: sameVideoBox });
  /**
   * Where the shown image sits in the tile.
   *
   * It is non-null only while the tile is `playing` and the video and the tile have a size. Before
   * the first frame, the surface covers the video. Once the stream is `stopped`, the frozen frame
   * is blurred and scaled up. So no box describes either.
   *
   * It is a signal, for overlays that follow the image. It is written only when the tile's state or
   * the tile's or the picture's size changes, never per frame. An unchanged box does not notify.
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
  private readonly framesElement = viewChild.required<ElementRef<HTMLCanvasElement>>('frames');
  private readonly barElement = viewChild<ElementRef<HTMLElement>>('bar');
  private readonly colors = inject(NeatOverlayColors);
  /** A new state per channel starts with no tracks, track colors or warnings of its own. */
  private readonly overlay = computed(() => createOverlayState(this.channel(), this.colors));
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
  /** The frames canvas's context, taken on the first run of encoded frames. */
  private framesContext: CanvasRenderingContext2D | null = null;
  /**
   * The shown picture's size in either mode, 0 before it is known: the video's, or the last drawn
   * frame's.
   */
  private pictureWidth = 0;
  private pictureHeight = 0;
  /** The canvas's CSS size and pixel ratio; the video size is filled in per frame. */
  private readonly view: NeatOverlayView = {
    cssWidth: 0,
    cssHeight: 0,
    dpr: 1,
    videoWidth: 0,
    videoHeight: 0,
    mirror: false,
    flipVertical: false,
  };

  /** What plays: the source and its stream or its run of frames, the other null. */
  private playing: {
    source: NeatTileSource;
    stream: MediaStream | null;
    frames: NeatEncodedFrames | null;
    stop: () => void;
  } | null = null;
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
  private warnedBoth = false;
  private warnedDecode = false;
  private warnedListener = false;
  private destroyed = false;

  constructor() {
    effect(() => {
      this.frameSettings = this.settings();
      this.frameRetentionMs = this.retentionMs();
      this.view.mirror = this.mirror();
      this.view.flipVertical = this.flipVertical();
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
      this.overlayState = this.overlay();
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
      const onVideoSize = () => {
        if (!this.playing?.stream) return;
        this.setPictureSize(video.videoWidth, video.videoHeight);
        this.updateVideoBox();
      };
      this.zone.runOutsideAngular(() => {
        video.addEventListener('loadedmetadata', onVideoSize);
        video.addEventListener('resize', onVideoSize);
      });
      destroyRef.onDestroy(() => {
        video.removeEventListener('loadedmetadata', onVideoSize);
        video.removeEventListener('resize', onVideoSize);
      });
    });

    // Runs after render, so the video element and the frames canvas exist when the first stream
    // or run of frames arrives.
    afterRenderEffect(() => {
      const source = this.source();
      const stream = source?.stream() ?? null;
      const frames = source?.frames?.() ?? null;
      untracked(() => this.play(source, stream, frames));
    });

    destroyRef.onDestroy(() => {
      // Outputs are already closed; stopping must not emit a state change.
      this.destroyed = true;
      this.stop();
    });
  }

  /**
   * The color the overlay draws `item` of `type` in, for a swatch beside the video; null while it
   * has none.
   *
   * ```html
   * <neat-video-tile #tile [source]="source" />
   * @for (track of tracks(); track track.id) {
   *   @if (tile.colorOf('tracking', track); as color) {
   *     <neat-swatch [color]="color" />
   *   }
   *   #{{ track.id }}
   * }
   * ```
   *
   * It follows the overlay's own rule. A track goes by its id. A detection, a segment or a
   * classification goes by its label's style row, else its class. A pose goes by its label's style
   * row, else its id.
   *
   * A class has one color on every tile of the page, and in the bird's-eye view. A track's and a
   * pose's color belong to this tile.
   *
   * It is null for an item the overlay has not drawn yet, and for one it has forgotten. A track
   * gone for about 5 s may give its color to another, and a stopped stream forgets its tracks. A
   * style row's color it gives at once.
   *
   * It reads signals, so a template or a `computed` that calls it updates when a color is given or
   * taken back, and when `settings` change. Asking records no draw, so it keeps no color alive.
   */
  colorOf(type: NeatOverlayType, item: NeatOverlayIdentity): string | null {
    return overlayColor(this.overlay(), this.settings(), type, item);
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

  /**
   * Plays the source's stream or its run of frames; any change stops what played (the tile goes
   * `empty`, the overlays are cleared and the metadata queue starts anew) and starts the other.
   */
  private play(
    source: NeatTileSource | null,
    stream: MediaStream | null,
    frames: NeatEncodedFrames | null,
  ): void {
    // A source that has both plays its stream, so a run that changes beside it changes nothing.
    const run = stream === null ? frames : null;
    if (stream !== null && frames !== null && !this.warnedBoth && isDevMode()) {
      this.warnedBoth = true;
      console.warn(
        `video: channel ${this.channel()} has both a stream and encoded frames; it plays the stream`,
      );
    }
    const playing = this.playing;
    if (playing?.source === source && playing.stream === stream && playing.frames === run) return;
    this.stop();
    if (source === null) return;
    let stopPicture: () => void;
    if (stream !== null) stopPicture = this.playStream(stream);
    else if (run !== null) stopPicture = this.playFrames(run);
    else return;

    // Taken on the first playback, so a tile that never plays holds no canvas context.
    this.context ??= this.canvasElement().nativeElement.getContext('2d');
    this.queue = createMetadataQueue();
    this.lastFrameAt = null;
    this.staleCheckSawHidden = false;
    this.messagesThisSecond = 0;
    const unsubscribe = source.onMetadata((text, receivedAt) => this.receive(text, receivedAt));
    const statsTimer = this.zone.runOutsideAngular(() =>
      setInterval(() => this.reportFrameStats(), FRAME_STATS_INTERVAL_MS),
    );
    this.playing = {
      source,
      stream,
      frames: run,
      stop: () => {
        stopPicture();
        clearInterval(statsTimer);
        unsubscribe();
      },
    };
  }

  /** Plays `stream` in the video element; returns what stops it. */
  private playStream(stream: MediaStream): () => void {
    const video = this.videoElement().nativeElement;
    video.srcObject = stream;
    this.startPlayback(video);
    // A track that was muted (no media flowing) may leave the element paused; play on unmute.
    const replay = () => this.startPlayback(video);
    const tracks = stream.getVideoTracks();
    for (const track of tracks) track.addEventListener('unmute', replay);
    const stopFrames = this.zone.runOutsideAngular(() =>
      startFrameLoop(
        video,
        (frame) => {
          this.setPictureSize(video.videoWidth, video.videoHeight);
          this.present(frame);
        },
        () => this.clearOverlays(),
      ),
    );
    return () => {
      stopFrames();
      for (const track of tracks) track.removeEventListener('unmute', replay);
      video.srcObject = null;
    };
  }

  /** Draws `run`'s frames on the frames canvas as they are decoded; returns what stops it. */
  private playFrames(run: NeatEncodedFrames): () => void {
    // Taken on the first run, as the overlay's is on the first playback.
    this.framesContext ??= this.framesElement().nativeElement.getContext('2d');
    this.playsFrames.set(true);
    const stopFrames = this.zone.runOutsideAngular(() =>
      startFrameScheduler(
        run,
        (frame) => this.drawPicture(frame),
        (error) => this.warnDecode(error),
      ),
    );
    return () => {
      stopFrames();
      this.playsFrames.set(false);
    };
  }

  /** A frame that does not decode is skipped and the next one is decoded; the first is said. */
  private warnDecode(error: unknown): void {
    if (this.warnedDecode) return;
    this.warnedDecode = true;
    console.warn(
      `video: channel ${this.channel()} cannot decode a frame (${reasonOf(error)}); ` +
        'later ones are skipped silently',
    );
  }

  private setPictureSize(width: number, height: number): void {
    this.pictureWidth = width;
    this.pictureHeight = height;
  }

  /**
   * Draws a decoded frame and presents it, synchronously: the scheduler closes the bitmap once this
   * returns. The canvas's backing store is the picture's own size, set only when that changes.
   */
  private drawPicture({ bitmap, rtpTimestamp, now }: DecodedFrame): void {
    if (bitmap.width !== this.pictureWidth || bitmap.height !== this.pictureHeight) {
      this.setPictureSize(bitmap.width, bitmap.height);
      const canvas = this.framesElement().nativeElement;
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      this.updateVideoBox();
    }
    this.framesContext?.drawImage(bitmap, 0, 0);
    this.present({ now, rtpTimestamp });
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
      console.warn(`video: channel ${this.channel()} cannot play its stream (${reasonOf(error)})`);
    });
  }

  private stop(): void {
    if (this.playing === null) return;
    this.playing.stop();
    this.playing = null;
    this.setPictureSize(0, 0);
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

  /** Matches and draws the overlays for a frame of the picture that was just shown. */
  private present({ now, rtpTimestamp }: PresentedFrame): void {
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
      this.view.videoWidth = this.pictureWidth;
      this.view.videoHeight = this.pictureHeight;
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

  /** Forgets what was drawn: the canvas, held overlays, track trails and track colors. */
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

  /**
   * The `video` group of the stats: the element's own state for a stream; for frames, which have no
   * element to ask, what the tile knows (`NeatFrameStats`).
   */
  private pictureStats(lastFrameAt: number | null): NeatFrameStats['video'] {
    const base = {
      lastFrameAgeMs: lastFrameAt === null ? null : Math.round(performance.now() - lastFrameAt),
      active: this.currentState === 'playing',
    };
    if (this.playing?.frames) {
      return {
        readyState: lastFrameAt === null ? 0 : HTMLMediaElement.HAVE_ENOUGH_DATA,
        paused: false,
        currentTime: 0,
        videoWidth: this.pictureWidth,
        videoHeight: this.pictureHeight,
        ...base,
      };
    }
    const video = this.videoElement().nativeElement;
    return {
      readyState: video.readyState,
      paused: video.paused,
      currentTime: video.currentTime,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      ...base,
    };
  }

  private reportFrameStats(): void {
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
      video: this.pictureStats(lastFrameAt),
    });
    this.messagesThisSecond = 0;
  }

  /**
   * Called when the tile or the picture changes size or the tile's state changes, never per frame.
   */
  private updateVideoBox(): void {
    if (this.currentState !== 'playing') {
      this.box.set(null);
      return;
    }
    const { pictureWidth, pictureHeight } = this;
    const { cssWidth, cssHeight } = this.view;
    if (!pictureWidth || !pictureHeight || !cssWidth || !cssHeight) {
      this.box.set(null);
      return;
    }
    const { scaleX, scaleY, offsetX, offsetY } = letterbox(
      pictureWidth,
      pictureHeight,
      cssWidth,
      cssHeight,
    );
    this.box.set({
      x: offsetX,
      y: offsetY,
      width: scaleX * pictureWidth,
      height: scaleY * pictureHeight,
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
