import { percentile } from './stats';

/*
 * The ring buffer behind the kit's `DOT_FRAME_PROBE` (design 1.3): the dot layer calls the probe
 * once per drawn frame with the draw's milliseconds and the dots it drew, and this keeps them in
 * two arrays allocated once. `record` is one function made once, taking no `this`, so the layer can
 * be handed it as it is and a frame allocates nothing. The draw time is the layer's script cost
 * only; with a software canvas some rasterising happens after it, so the frame time is what counts.
 * A raw-browser-API unit's sibling (AGENTS.md): no Angular, with specs.
 */

/** The probe's signature, as the kit's seam declares it (Task 3). */
export type DotFrameProbe = (drawMs: number, dotsDrawn: number) => void;

/** A phase's draws; every number is null where nothing was drawn, so it never reads as 0 ms. */
export interface DotProbeStats {
  readonly draws: number;
  readonly drawP50Ms: number | null;
  readonly drawP95Ms: number | null;
  readonly drawWorstMs: number | null;
  readonly dotsP50: number | null;
  readonly dotsMax: number | null;
  /** The layer drew as many dots as it ever does (`MAX_DOTS`), so the load was cut short. */
  readonly capped: boolean;
}

/** As many draws as a recorder has frames, since a probe call is at most one per frame. */
const DEFAULT_CAPACITY = 65536;

export class DotProbeBuffer {
  /** Draw milliseconds, a ring. */
  readonly times: Float64Array;
  /** Dots drawn, a ring in step with `times` (Uint32: a count, far below 2³²). */
  readonly dots: Uint32Array;
  private written = 0;

  constructor(private readonly capacity = DEFAULT_CAPACITY) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`a capacity of ${capacity} holds no draw`);
    }
    this.times = new Float64Array(capacity);
    this.dots = new Uint32Array(capacity);
  }

  /** Hand this to the layer as the probe. */
  readonly record: DotFrameProbe = (drawMs, dotsDrawn) => {
    const slot = this.written % this.capacity;
    this.times[slot] = drawMs;
    this.dots[slot] = dotsDrawn;
    this.written++;
  };

  /** Draws recorded since the last reset, the ones overwritten included. */
  get total(): number {
    return this.written;
  }

  /** Where a phase starts: pass it to `summarySince` when the phase ends. */
  mark(): number {
    return this.written;
  }

  reset(): void {
    this.written = 0;
  }

  /** The draws since `mark`; `maxDots` is the layer's cap, to say whether it was reached. */
  summarySince(mark: number, maxDots: number): DotProbeStats {
    const draws = this.written - mark;
    if (!(mark >= 0) || draws < 0) throw new RangeError(`mark ${mark} is not one this buffer gave`);
    if (draws > this.capacity) {
      throw new RangeError(`${draws} draws since the mark: the ring holds ${this.capacity}`);
    }
    if (draws === 0) {
      return {
        draws,
        drawP50Ms: null,
        drawP95Ms: null,
        drawWorstMs: null,
        dotsP50: null,
        dotsMax: null,
        capped: false,
      };
    }
    const times = new Float64Array(draws);
    const dots = new Float64Array(draws);
    for (let i = 0; i < draws; i++) {
      const slot = (mark + i) % this.capacity;
      times[i] = this.times[slot];
      dots[i] = this.dots[slot];
    }
    times.sort();
    dots.sort();
    const dotsMax = dots[draws - 1];
    return {
      draws,
      drawP50Ms: percentile(times, 50),
      drawP95Ms: percentile(times, 95),
      drawWorstMs: times[draws - 1],
      dotsP50: percentile(dots, 50),
      dotsMax,
      capped: dotsMax >= maxDots,
    };
  }
}
