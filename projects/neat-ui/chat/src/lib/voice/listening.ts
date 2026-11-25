import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  DestroyRef,
  ElementRef,
  inject,
  NgZone,
  type Signal,
  signal,
} from '@angular/core';
import { ɵreducedMotion, type ɵFrameClock } from '@sima/neat-ui';
import { CHAT_CLOCK } from '../chat-clock';
import type { NeatListeningMotion } from '../push-to-talk';
import { BoxWaveEngine } from './box-wave';
import { RadialEngine } from './radial';
import { RingWaveEngine } from './ring-wave';

/** What a listening engine works with: the host it draws in, its clock and document, the level. */
export interface ListeningHost {
  readonly host: HTMLElement;
  readonly clock: ɵFrameClock;
  readonly document: Document;
  /** The level now, 0 to 1, or null while there is none. */
  readonly level: () => number | null;
  /** Called when the engine's frames stop because nothing moves any more. */
  readonly stopped: () => void;
}

/**
 * The part of a listening motion that CSS cannot do: it draws the level into the elements the
 * template rendered for it, outside change detection, writing only attributes, inline `transform`
 * and `opacity`, and canvases. Internal.
 */
export interface ListeningEngine {
  /** Recording began (true) or ended (false): an end collapses or folds the visual, then stops. */
  recording(on: boolean): void;
  /** Whether something still moves. */
  moving(): boolean;
  destroy(): void;
}

/** The listening motions that have an engine, and how each is made. */
const ENGINES: Partial<Record<NeatListeningMotion, (host: ListeningHost) => ListeningEngine>> = {
  'ring-and-waveform': (host) => new RingWaveEngine(host),
  radial: (host) => new RadialEngine(host),
  'in-message-box': (host) => new BoxWaveEngine(host),
};

/** Whether a motion has an engine, so its elements stand in for the level meter. */
export function hasListeningEngine(motion: NeatListeningMotion): boolean {
  return ENGINES[motion] !== undefined;
}

/**
 * Runs the engine of the chosen listening motion over the host of the component that calls it, in
 * an injection context, and says whether one runs (the template renders the motion's elements only
 * then). An engine is made after a render once recording starts, never under reduced motion,
 * outside the zone; it hears when recording ends, and is dropped once nothing moves after that
 * and nothing `held` keeps it (the message box's waveform while the recording is transcribed),
 * and with the component. A motion changed while recording applies to the next recording.
 */
export function runListeningEngine(
  motion: Signal<NeatListeningMotion>,
  recording: Signal<boolean>,
  level: () => number | null,
  held: Signal<boolean> = signal(false),
): Signal<boolean> {
  const zone = inject(NgZone);
  const running = signal(false);
  let engine: ListeningEngine | null = null;
  let on = false;
  let holding = false;

  const drop = () => {
    engine?.destroy();
    engine = null;
  };
  const dropIfDone = () => {
    if (!engine || on || holding || engine.moving()) return;
    drop();
    zone.run(() => running.set(false));
  };
  const host: ListeningHost = {
    host: inject<ElementRef<HTMLElement>>(ElementRef).nativeElement,
    clock: inject(CHAT_CLOCK),
    document: inject(DOCUMENT),
    level,
    stopped: dropIfDone,
  };

  afterRenderEffect({
    mixedReadWrite: () => {
      const chosen = motion();
      const now = recording();
      holding = held();
      const changed = now !== on;
      on = now;
      zone.runOutsideAngular(() => {
        if (changed && on) {
          drop();
          const make = ENGINES[chosen];
          if (make && !ɵreducedMotion()) engine = make(host);
        }
        if (changed) engine?.recording(on);
        dropIfDone();
      });
      running.set(engine !== null);
    },
  });
  inject(DestroyRef).onDestroy(drop);
  return running.asReadonly();
}
