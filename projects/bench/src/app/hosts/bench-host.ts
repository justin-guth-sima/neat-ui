import { afterNextRender, DestroyRef, inject, Injectable } from '@angular/core';
import type { DiagramTransform } from '@bench/diagram-seam';
import type { GestureTarget } from '../run/gesture-player';

/*
 * What a run needs of the host on screen (design 2.3), whichever it is: where its gestures go,
 * the transform it should start from, and a way back to it. The hosts register themselves once
 * rendered; the run waits for one, drives it, and never imports a host.
 */
export interface BenchHost {
  readonly id: 'kit' | 'vflow' | 'none';
  /** The zoom box's gestures: synthetic events on d3-zoom's element, or the pure reducers. */
  readonly gestures: GestureTarget;
  /** The kit's fit of the current diagram in the box: where every host starts. Null unsized. */
  startTransform(): DiagramTransform | null;
  /** Puts the view back at the start transform; the host may take a few frames to get there. */
  fit(): void;
}

@Injectable({ providedIn: 'root' })
export class BenchHosts {
  private host: BenchHost | null = null;
  private waiting: ((host: BenchHost) => void)[] = [];

  /** The host on screen now, if any. */
  get current(): BenchHost | null {
    return this.host;
  }

  /** Registers the host that is drawn; the returned function takes it off again. */
  register(host: BenchHost): () => void {
    this.host = host;
    for (const resolve of this.waiting.splice(0)) resolve(host);
    return () => {
      // A host that came after has replaced this one: leave it.
      if (this.host === host) this.host = null;
    };
  }

  /** The host on screen, now or once it renders. */
  whenHost(): Promise<BenchHost> {
    const host = this.host;
    return host ? Promise.resolve(host) : new Promise((resolve) => this.waiting.push(resolve));
  }
}

/**
 * Registers a host once it has rendered (call in its constructor): its zoom box exists by then,
 * and `make` may read it. The host goes off the registry with the component.
 */
export function registerBenchHost(make: () => BenchHost): void {
  const hosts = inject(BenchHosts);
  const destroyRef = inject(DestroyRef);
  afterNextRender(() => {
    const unregister = hosts.register(make());
    destroyRef.onDestroy(unregister);
  });
}

/** The harness's bounds for "the same start transform" (design 2.3): 1 % in scale, 2 px. */
const START_SCALE_TOLERANCE = 0.01;
const START_SHIFT_TOLERANCE_PX = 2;

/** Whether `now` is the start transform, within the bounds; false while there is no start. */
export function startMatches(now: DiagramTransform, start: DiagramTransform | null): boolean {
  return (
    start !== null &&
    Math.abs(now.k - start.k) <= START_SCALE_TOLERANCE * start.k &&
    Math.abs(now.x - start.x) <= START_SHIFT_TOLERANCE_PX &&
    Math.abs(now.y - start.y) <= START_SHIFT_TOLERANCE_PX
  );
}

const TRANSFORM = /^translate\(\s*(\S+?)(?:px)?\s*,\s*(\S+?)(?:px)?\s*\)\s*scale\(\s*(\S+?)\s*\)$/;

/**
 * The transform a zoom box shows, from the text its renderer writes: the kit's
 * `translate(Xpx, Ypx) scale(K)` on its content's style, d3-zoom's `translate(X,Y) scale(K)` on
 * vflow's viewport group. The identity where there is none yet, as d3-zoom's own is; text that is
 * not this form throws, since reading it as the identity would hide a renderer that changed it.
 */
export function readTransform(text: string | null | undefined): DiagramTransform {
  if (!text) return { k: 1, x: 0, y: 0 };
  const match = TRANSFORM.exec(text.trim());
  const [x, y, k] = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [];
  if (x === undefined || y === undefined || k === undefined || [x, y, k].some(Number.isNaN)) {
    throw new Error(`cannot read a transform from "${text}"`);
  }
  return { k, x, y };
}
