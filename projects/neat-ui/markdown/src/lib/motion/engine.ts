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
import { CloudEngine } from './cloud';
import { sanitizedCloudBox, type NeatCloudBox } from './cloud-box';
import { DecryptEngine } from './decrypt';
import { ExplosionEngine } from './explosion';
import { MOTION_CLOCK } from './motion-clock';
import type { NeatTextMotion } from './text-motions';

/**
 * The part of a text motion that CSS cannot do: it reads the pieces the template rendered and
 * writes only text, attributes and inline styles into elements the template rendered empty for
 * it, outside change detection. Internal.
 */
export interface MotionEngine {
  /**
   * After each render of the host. `epoch` changes when the pieces start again (a text written
   * anew): what still moves of the earlier ones goes at once.
   */
  rendered(streaming: boolean, epoch: number): void;
  /** Whether something still moves: a piece, a particle, a flight or a fade. */
  moving(): boolean;
  destroy(): void;
}

/** What an engine works with: the host, its clock and random, and the document it is in. */
export interface MotionHost {
  readonly host: HTMLElement;
  readonly clock: ɵFrameClock;
  readonly random: () => number;
  readonly document: Document;
  /** Called when the engine's frames stop because nothing moves any more. */
  readonly stopped: () => void;
}

/** What an engine is made with beyond its host: the settings of the motions that have one. */
interface EngineSettings {
  readonly cloudWords: number;
  readonly cloudBox: NeatCloudBox;
}

/** The motions that have an engine, and how each is made. */
const ENGINES: Partial<
  Record<NeatTextMotion, (deps: MotionHost, settings: EngineSettings) => MotionEngine>
> = {
  decrypt: (deps) => new DecryptEngine(deps),
  'reverse-explosion': (deps) => new ExplosionEngine(deps),
  'word-cloud': (deps, { cloudWords, cloudBox }) => new CloudEngine(deps, cloudWords, cloudBox),
};

/** Whether the settings an engine was made with are these (the box already sanitized). */
function sameSettings(a: EngineSettings, b: EngineSettings | null): boolean {
  return (
    b !== null &&
    a.cloudWords === b.cloudWords &&
    a.cloudBox.width === b.cloudBox.width &&
    a.cloudBox.height === b.cloudBox.height &&
    a.cloudBox.x === b.cloudBox.x &&
    a.cloudBox.y === b.cloudBox.y
  );
}

/**
 * Runs the engine of the chosen motion over the host of the component that calls it, in an
 * injection context, and says whether one runs. An engine is made after a render while the text
 * streams (never under reduced motion), outside the zone, and made anew when `motion` or its
 * settings change, the old one destroyed first. It hears of every render that `changes` reports,
 * with the pieces' epoch. Once the text no longer streams and nothing of it moves, it is destroyed,
 * so a finished reply keeps no engine, listener or layer; it also goes with the component.
 */
export function runMotionEngine(
  motion: Signal<NeatTextMotion>,
  streaming: Signal<boolean>,
  changes: Signal<{ readonly epoch: number }>,
  cloudWords: Signal<number>,
  cloudBox: Signal<NeatCloudBox>,
): Signal<boolean> {
  const zone = inject(NgZone);
  const running = signal(false);
  let engine: MotionEngine | null = null;
  let made: NeatTextMotion | null = null;
  let madeWith: EngineSettings | null = null;
  let live = false;

  const drop = () => {
    engine?.destroy();
    engine = null;
    made = null;
    madeWith = null;
  };
  /** The text is finished and nothing moves: the engine and its layer go. */
  const dropIfDone = () => {
    if (!engine || live || engine.moving()) return;
    drop();
    zone.run(() => running.set(false));
  };
  const deps: MotionHost = {
    host: inject<ElementRef<HTMLElement>>(ElementRef).nativeElement,
    clock: inject(MOTION_CLOCK),
    random: Math.random,
    document: inject(DOCUMENT),
    stopped: dropIfDone,
  };

  afterRenderEffect({
    mixedReadWrite: () => {
      const chosen = motion();
      const settings: EngineSettings = {
        cloudWords: cloudWords(),
        cloudBox: sanitizedCloudBox(cloudBox()),
      };
      const { epoch } = changes();
      live = streaming();
      zone.runOutsideAngular(() => {
        if (engine && (chosen !== made || !sameSettings(settings, madeWith))) drop();
        const make = ENGINES[chosen];
        if (!engine && live && make && !ɵreducedMotion()) {
          engine = make(deps, settings);
          made = chosen;
          madeWith = settings;
        }
        engine?.rendered(live, epoch);
        dropIfDone();
      });
      running.set(engine !== null);
    },
  });
  inject(DestroyRef).onDestroy(drop);
  return running.asReadonly();
}
