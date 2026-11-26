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
import { BoxWaveEngine } from './box-wave';
import { RadialEngine } from './radial';
import { RingEngine } from './ring';

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

/**
 * What a listening motion draws, and where: the ring round push-to-talk's button and the radial
 * bars are push-to-talk's, the waveform where the text was is the message box's. Internal.
 */
export type ListeningDrawing = 'ring' | 'radial' | 'box-wave';

/** How each drawing's engine is made. */
const ENGINES: Record<ListeningDrawing, (host: ListeningHost) => ListeningEngine> = {
  ring: (host) => new RingEngine(host),
  radial: (host) => new RadialEngine(host),
  'box-wave': (host) => new BoxWaveEngine(host),
};


/**
 * Runs the engine of the chosen listening motion over the host of the component that calls it, in
 * an injection context, and says whether one runs (the template renders the motion's elements only
 * then). An engine is made after a render once recording starts, never under reduced motion,
 * outside the zone; it hears when recording ends, and is dropped once nothing moves after that
 * and nothing `held` keeps it (the message box's waveform while the recording is transcribed),
 * and with the component. A motion changed while recording applies to the next recording.
 */
export function runListeningEngine(
  drawing: Signal<ListeningDrawing | null>,
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
      const chosen = drawing();
      const now = recording();
      holding = held();
      const changed = now !== on;
      on = now;
      zone.runOutsideAngular(() => {
        if (changed && on) {
          drop();
          if (chosen && !ɵreducedMotion()) engine = ENGINES[chosen](host);
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
