import { ɵFrameLoop } from '@sima/neat-ui';
import type { ListeningEngine, ListeningHost } from './listening';

/** How far the ring swells at full level. */
const RING_SWELL = 0.45;

/**
 * The ring round push-to-talk's button (moments mockup, listening A): it swells with the level and
 * fades as it grows, and rests on release. Internal.
 */
export class RingEngine implements ListeningEngine {
  private on = false;
  private ring: HTMLElement | null = null;
  private readonly frames: ɵFrameLoop;

  constructor(private readonly deps: ListeningHost) {
    this.frames = new ɵFrameLoop(
      deps,
      () => this.frame(),
      () => this.on,
    );
  }

  recording(on: boolean): void {
    this.on = on;
    this.find();
    if (!on) this.rest();
    this.frames.start();
  }

  moving(): boolean {
    return this.frames.active;
  }

  destroy(): void {
    this.frames.destroy();
  }

  private frame(): void {
    if (!this.on) return;
    this.find();
    if (!this.ring) return;
    const scale = 1 + (this.deps.level() ?? 0) * RING_SWELL;
    this.ring.style.transform = `scale(${round(scale)})`;
    this.ring.style.opacity = String(round(1.6 - scale));
  }

  /** Released: the ring at rest. */
  private rest(): void {
    if (!this.ring) return;
    this.ring.style.transform = 'scale(1)';
    this.ring.style.opacity = '0.6';
  }

  /** The ring, once the template has rendered it. */
  private find(): void {
    if (this.ring?.isConnected) return;
    this.ring = this.deps.host.querySelector<HTMLElement>('.ring');
  }
}

/** A number short enough for a style, without float noise. */
function round(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}
