import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
  viewChild,
  viewChildren,
} from '@angular/core';
import { ɵFrameLoop, type ɵFrameClock } from '@sima/neat-ui';
import { CHAT_CLOCK } from './chat-clock';
import { readingAt } from './reading-pace';

/**
 * How the transcript shows that the model reads a question's pictures, from the moment the reply
 * begins to wait until its first word (`NeatChatTranscript`'s `pictureMotion`):
 *
 * - `coming-into-focus`, the default: the picture starts blurred, gray and dim, and comes into
 *   focus tile by tile in a ragged sweep from left to right;
 * - `beam-and-patches`: a beam sweeps over the picture while its patches light up one by one;
 * - `viewfinder`: the picture dims and a viewfinder's brackets hop from region to region, the
 *   region's position in the picture's pixels above them;
 * - `none`: the picture stays as it is.
 *
 * With the transcript's `pictureFlight`, patches of the picture also fly into the reply's orb, where
 * the reply will come: every third tile revealed, or one from each region the viewfinder hops to.
 * Under reduced motion the picture stays as it is.
 */
export type NeatPictureMotion = 'coming-into-focus' | 'beam-and-patches' | 'viewfinder' | 'none';

/** Every picture motion, in the order a picker lists them. */
export const NEAT_PICTURE_MOTIONS: readonly NeatPictureMotion[] = [
  'coming-into-focus',
  'beam-and-patches',
  'viewfinder',
  'none',
];

/** About how many tiles a picture is cut into, square whatever its shape. */
const TILES = 140;
/** The tiles across and down of a picture not laid out (yet): the usual 14 × 10, of no size. */
const UNSIZED: TileGrid = { columns: 14, rows: 10, size: 0 };
/** How many columns of jitter the sweep's order has, so several tiles ease at once. */
const JITTER_COLUMNS = 3;
/** How long a patch stays lit before it is seen. */
const HOT_MS = 160;
/** How long a tile takes to ease to seen (its CSS transition). */
const EASE_MS = 450;
/** How often the viewfinder hops to another region. */
const HOP_MS = 330;
/** How long the viewfinder's brackets take to let go (their CSS transition). */
const LET_GO_MS = 320;
/** How long the overlay takes to fade out at the end (its CSS transition). */
const FADE_MS = 500;
/** How many patches fly at most at once, and which of the revealed ones fly: every third. */
const FLIES = 24;
const FLY_EVERY = 3;
/** How long a patch flies to the orb (its CSS transition, and a frame), and the orb stays hit. */
const FLY_MS = 560;
const HIT_MS = 120;
/** A flying patch's size, and a bracket's. */
const FLY_SIZE = 6;
const CORNER_SIZE = 12;

/** How many tiles across and down a reading has, and a tile's side in CSS pixels. */
export interface TileGrid {
  readonly columns: number;
  readonly rows: number;
  readonly size: number;
}

/**
 * The grid for a picture laid out `width` × `height`: square tiles of whole pixels, about 140 of
 * them, as many columns and rows as cover the picture, its edge cutting off the last ones, so no
 * tile is stretched whatever the picture's shape. Internal.
 */
export function tileGrid(width: number, height: number): TileGrid {
  if (!(width > 0 && height > 0)) return UNSIZED;
  const size = Math.max(1, Math.round(Math.sqrt((width * height) / TILES)));
  return { columns: Math.ceil(width / size), rows: Math.ceil(height / size), size };
}

/** A tile's square of the picture, which is drawn at its own size: an offset in pixels. */
function tilePosition(index: number, { columns, size }: TileGrid): string {
  const at = (cells: number) => (cells === 0 ? '0px' : `${-cells * size}px`);
  return `${at(index % columns)} ${at(Math.floor(index / columns))}`;
}

/**
 * A picture being read while its question's reply waits, laid over the picture in its frame
 * (`span.picture-frame` around the `img`, which it reads for the picture's own size): its tiles,
 * beam, viewfinder or flying patches as `motion` says, until `answered` (the reply's first word)
 * and the reading's end, when it fades out and emits `done`. One frame loop outside change
 * detection draws it. Internal to the transcript, which makes none under reduced motion.
 */
@Component({
  selector: 'neat-chat-picture-reading',
  templateUrl: './picture-reading.html',
  styleUrl: './picture-reading.css',
  host: {
    'aria-hidden': 'true',
    '[attr.data-motion]': 'motion()',
    '[style.--picture]': 'pictureUrl()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PictureReading {
  /** How the picture is read; `none` makes no reading. */
  readonly motion = input.required<Exclude<NeatPictureMotion, 'none'>>();
  /** The picture's address, the `img`'s `src`. */
  readonly src = input.required<string>();
  /** Whether the reply's first word came: the reading finishes. */
  readonly answered = input(false);
  /** Whether patches fly into the reply's orb as the picture is read. */
  readonly flight = input(false);
  /** The reply's orb, where the patches fly; null once it is gone. */
  readonly target = input<() => HTMLElement | null>(() => null);
  /** The reading is over and has faded out: the plain picture shows. */
  readonly done = output<void>();

  protected readonly flySlots = Array.from({ length: FLIES }, (_, i) => i);

  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly finder = viewChild<ElementRef<HTMLElement>>('finder');
  private readonly corners = viewChildren<ElementRef<HTMLElement>>('corner');
  private readonly label = viewChild<ElementRef<HTMLElement>>('label');
  private readonly flies = viewChildren<ElementRef<HTMLElement>>('fly');

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const clock = inject(CHAT_CLOCK);
    const document = inject(DOCUMENT);
    const zone = inject(NgZone);
    let loop: ReadingLoop | null = null;
    let destroyed = false;
    afterNextRender(() => {
      const finder = this.finder()?.nativeElement;
      const label = this.label()?.nativeElement;
      const stage = this.stage().nativeElement;
      const begin = () => {
        if (destroyed) return;
        loop = new ReadingLoop(
          this.motion(),
          {
            host,
            stage,
            finder:
              finder && label
                ? {
                    box: finder,
                    corners: this.corners().map((corner) => corner.nativeElement),
                    label,
                  }
                : null,
            flies: this.flies().map((fly) => fly.nativeElement),
            picture: () => host.parentElement?.querySelector('img') ?? null,
            target: () => this.target()(),
          },
          { clock, document, random: Math.random },
          () => zone.run(() => this.done.emit()),
        );
        if (this.answered()) loop.answer();
      };
      // The tiles are cut to the picture's laid-out shape, which it has once it has loaded.
      const picture = host.parentElement?.querySelector('img');
      zone.runOutsideAngular(() => {
        if (!picture || picture.complete || picture.naturalWidth > 0) begin();
        else {
          picture.addEventListener('load', begin, { once: true });
          picture.addEventListener('error', begin, { once: true });
        }
      });
    });
    effect(() => {
      if (this.answered()) zone.runOutsideAngular(() => loop?.answer());
    });
    inject(DestroyRef).onDestroy(() => {
      destroyed = true;
      loop?.destroy();
    });
  }

  protected pictureUrl(): string {
    return `url(${JSON.stringify(this.src())})`;
  }
}

/** The elements the loop draws in, which the template rendered for it. */
interface ReadingParts {
  readonly host: HTMLElement;
  /** Where the tiles go, in a grid of `--columns` × `--rows` set on the host. */
  readonly stage: HTMLElement;
  readonly finder: {
    readonly box: HTMLElement;
    /** Top left, top right, bottom left, bottom right. */
    readonly corners: readonly HTMLElement[];
    readonly label: HTMLElement;
  } | null;
  readonly flies: readonly HTMLElement[];
  /** The picture, for its own size. */
  readonly picture: () => HTMLImageElement | null;
  /** Where the patches fly. */
  readonly target: () => HTMLElement | null;
}

interface ReadingDeps {
  readonly clock: ɵFrameClock;
  readonly document: Document;
  readonly random: () => number;
}

/**
 * The reading's frames: it cuts the picture into its tiles (`tileGrid`, for the picture's shape),
 * then reveals them at the pace, a round after another while the board reads, with each patch's
 * 160 ms lit, the viewfinder's hops, the flights and the end. Nothing is allocated per frame or per
 * tile: the order and the times are typed arrays. No frames while the page is hidden. Internal,
 * and exported for the spec only through the component.
 */
export class ReadingLoop {
  private readonly startedAt: number;
  private answeredAt: number | null = null;
  private readonly grid: TileGrid;
  private readonly total: number;
  private readonly tiles: HTMLElement[] = [];
  /** The tiles in the order they are revealed: by column, with jitter, drawn anew each round. */
  private readonly order: Uint16Array;
  private readonly revealedAt: Float64Array;
  /** The round shown, and how many tiles of its order are revealed and have cooled from hot. */
  private round = 0;
  private shown = 0;
  private cooled = 0;
  private nextHop = Number.NEGATIVE_INFINITY;
  private readonly landsAt = new Float64Array(FLIES).fill(Number.NaN);
  private hitUntil = Number.NaN;
  /** When the overlay begins to fade out, and when it is gone. */
  private endsAt = Number.NaN;
  private doneAt = Number.NaN;
  private finished = false;
  private readonly frames: ɵFrameLoop;

  constructor(
    private readonly motion: Exclude<NeatPictureMotion, 'none'>,
    private readonly parts: ReadingParts,
    private readonly deps: ReadingDeps,
    private readonly onDone: () => void,
  ) {
    this.startedAt = deps.clock.now();
    this.grid = tileGrid(parts.host.clientWidth, parts.host.clientHeight);
    this.total = this.grid.columns * this.grid.rows;
    this.order = new Uint16Array(this.total);
    this.revealedAt = new Float64Array(this.total);
    const { style } = parts.host;
    style.setProperty('--columns', String(this.grid.columns));
    style.setProperty('--rows', String(this.grid.rows));
    style.setProperty('--tile', `${this.grid.size}px`);
    style.setProperty('--picture-width', `${parts.host.clientWidth}px`);
    style.setProperty('--picture-height', `${parts.host.clientHeight}px`);
    if (motion !== 'viewfinder') {
      // Angular scopes the component's styles by an attribute on the elements its template made;
      // the tiles are made here, so they take the stage's.
      const scope = [...parts.stage.attributes].find((a) => a.name.startsWith('_ngcontent'));
      for (let i = 0; i < this.total; i++) {
        const tile = deps.document.createElement('b');
        if (scope) tile.setAttribute(scope.name, '');
        tile.className = 'tile';
        tile.style.backgroundPosition = tilePosition(i, this.grid);
        parts.stage.append(tile);
        this.tiles.push(tile);
      }
    }
    this.shuffle();
    parts.host.setAttribute('data-reading', '');
    this.frames = new ɵFrameLoop(
      deps,
      () => this.frame(deps.clock.now()),
      () => !this.finished,
    );
    this.frames.start();
  }

  /** The reply's first word came: the reading finishes. */
  answer(): void {
    if (this.answeredAt !== null) return;
    this.answeredAt = this.deps.clock.now();
    // The beam stops, and the viewfinder's brackets and dim let go, before the overlay fades.
    this.parts.host.removeAttribute('data-reading');
    if (this.motion === 'viewfinder') this.endsAt = this.answeredAt + LET_GO_MS;
    this.frames.start();
  }

  destroy(): void {
    this.frames.destroy();
    this.parts.target()?.removeAttribute('data-hit');
  }

  /** Draws the order the tiles are revealed in: by column, with a few columns of jitter. */
  private shuffle(): void {
    const keys = new Float64Array(this.total);
    for (let i = 0; i < this.total; i++) {
      keys[i] = (i % this.grid.columns) + this.deps.random() * JITTER_COLUMNS;
      this.order[i] = i;
    }
    this.order.sort((a, b) => keys[a] - keys[b]);
  }

  /** A new round: every tile back to unseen, in a new order. */
  private startRound(round: number): void {
    this.round = round;
    for (const tile of this.tiles) tile.classList.remove('hot', 'seen');
    this.shown = 0;
    this.cooled = 0;
    this.shuffle();
  }

  private frame(now: number): void {
    if (this.motion !== 'viewfinder') this.reveal(now);
    else if (this.answeredAt === null) this.hop(now);
    this.land(now);
    this.end(now);
  }

  private reveal(now: number): void {
    const moment = readingAt(this.total, this.startedAt, this.answeredAt, now);
    if (moment.round > this.round) this.startRound(moment.round);
    const patches = this.motion !== 'coming-into-focus';
    for (; this.shown < moment.shown; this.shown++) {
      const index = this.order[this.shown];
      const tile = this.tiles[index];
      this.revealedAt[index] = now;
      if (this.shown % FLY_EVERY === 0) this.flyFromTile(index);
      if (!patches) {
        tile.classList.add('seen');
        this.cooled++;
        continue;
      }
      tile.classList.add('hot');
    }
    // Patches cool in the order they lit up, so the cooled ones are a prefix of the order.
    while (this.cooled < this.shown && now - this.revealedAt[this.order[this.cooled]] >= HOT_MS) {
      const tile = this.tiles[this.order[this.cooled]];
      tile.classList.remove('hot');
      tile.classList.add('seen');
      this.cooled++;
    }
    // Only the round the first word came in ends the reading; the others start over.
    const last = this.answeredAt !== null;
    if (last && this.cooled === this.total && Number.isNaN(this.endsAt)) this.endsAt = now + EASE_MS;
  }

  private hop(now: number): void {
    const finder = this.parts.finder;
    if (!finder || now < this.nextHop) return;
    this.nextHop = now + HOP_MS;
    const { host } = this.parts;
    const width = host.clientWidth;
    const height = host.clientHeight;
    // The mockup's region: 1/6 to 1/2 of the width, 3/16 to 9/16 of the height.
    const w = round(width * (1 / 6 + this.deps.random() / 3));
    const h = round(height * (3 / 16 + (this.deps.random() * 3) / 8));
    const x = round(this.deps.random() * (width - w));
    const y = round(this.deps.random() * (height - h));
    finder.box.style.transform = translate(x, y);
    const [, topRight, bottomLeft, bottomRight] = finder.corners;
    topRight.style.transform = translate(w - CORNER_SIZE, 0);
    bottomLeft.style.transform = translate(0, h - CORNER_SIZE);
    bottomRight.style.transform = translate(w - CORNER_SIZE, h - CORNER_SIZE);
    // The region's top left in the picture's own pixels, the size it was taken at.
    const picture = this.parts.picture();
    const scaleX = picture?.naturalWidth && width ? picture.naturalWidth / width : 1;
    const scaleY = picture?.naturalHeight && height ? picture.naturalHeight / height : 1;
    finder.label.textContent = `${Math.round(x * scaleX)},${Math.round(y * scaleY)}`;
    this.fly(x + w / 2, y + h / 2);
  }

  /** Sends a patch from the center of tile `index`. */
  private flyFromTile(index: number): void {
    const { columns, size } = this.grid;
    this.fly(((index % columns) + 0.5) * size, (Math.floor(index / columns) + 0.5) * size);
  }

  /**
   * Sends a patch from `x`, `y` (in the host) to the target, with flight, if the target is there
   * and a patch is free.
   */
  private fly(x: number, y: number): void {
    const target = this.parts.target();
    const slot = this.landsAt.findIndex(Number.isNaN);
    const fly = this.parts.flies[slot];
    if (!target || !fly) return;
    const { host } = this.parts;
    const half = FLY_SIZE / 2;
    const fromX = x - half;
    const fromY = y - half;
    const box = host.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const toX = to.left + to.width / 2 - box.left - half;
    const toY = to.top + to.height / 2 - box.top - half;
    // Shown at its tile with no transition for a moment, then flown by the CSS transition.
    fly.setAttribute('data-start', '');
    fly.setAttribute('data-flying', '');
    fly.style.transform = translate(fromX, fromY);
    fly.style.opacity = '1';
    commitStyles(fly);
    fly.removeAttribute('data-start');
    fly.style.transform = `${translate(toX, toY)} scale(0.6)`;
    fly.style.opacity = '0.2';
    this.landsAt[slot] = this.deps.clock.now() + FLY_MS;
  }

  private land(now: number): void {
    for (let slot = 0; slot < FLIES; slot++) {
      if (!(now >= this.landsAt[slot])) continue;
      this.landsAt[slot] = Number.NaN;
      const fly = this.parts.flies[slot];
      fly.removeAttribute('data-flying');
      fly.style.opacity = '0';
      const target = this.parts.target();
      if (target) {
        target.setAttribute('data-hit', '');
        this.hitUntil = now + HIT_MS;
      }
    }
    if (now >= this.hitUntil) {
      this.hitUntil = Number.NaN;
      this.parts.target()?.removeAttribute('data-hit');
    }
  }

  private end(now: number): void {
    if (now >= this.endsAt && Number.isNaN(this.doneAt)) {
      this.parts.host.setAttribute('data-ending', '');
      this.parts.host.removeAttribute('data-reading');
      this.doneAt = now + FADE_MS;
    }
    if (now >= this.doneAt && !this.finished) {
      this.finished = true;
      this.destroy();
      this.onDone();
    }
  }
}

/** Reads the layout, so the start transform is drawn before the flight's own replaces it. */
function commitStyles(element: HTMLElement): void {
  element.getBoundingClientRect();
}

function translate(x: number, y: number): string {
  return `translate(${round(x)}px, ${round(y)}px)`;
}

/** A length to a hundredth of a pixel, so a transform reads cleanly. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
