import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  DestroyRef,
  ElementRef,
  inject,
  NgZone,
  type Signal,
} from '@angular/core';
import { ɵreducedMotion, type ɵFrameClock } from '@sima/neat-ui';
import { CloudEngine } from './cloud';
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
  /** After each render of the host. */
  rendered(streaming: boolean): void;
  destroy(): void;
}

/** What an engine works with: the host, its clock and random, and the document it is in. */
export interface MotionHost {
  readonly host: HTMLElement;
  readonly clock: ɵFrameClock;
  readonly random: () => number;
  readonly document: Document;
}

/** What an engine is made with beyond its host: the settings of the motions that have one. */
interface EngineSettings {
  readonly cloudWords: number;
}

/** The motions that have an engine, and how each is made. */
const ENGINES: Partial<
  Record<NeatTextMotion, (deps: MotionHost, settings: EngineSettings) => MotionEngine>
> = {
  decrypt: (deps) => new DecryptEngine(deps),
  'reverse-explosion': (deps) => new ExplosionEngine(deps),
  'word-cloud': (deps, { cloudWords }) => new CloudEngine(deps, cloudWords),
};

/**
 * Runs the engine of the chosen motion over the host of the component that calls it, in an
 * injection context. The engine is made after the first render and again when `motion` changes,
 * or its settings change, the old one destroyed first, outside the zone and never under reduced
 * motion; it hears of every
 * render that `changes` reports, and goes with the component.
 */
export function runMotionEngine(
  motion: Signal<NeatTextMotion>,
  streaming: Signal<boolean>,
  changes: Signal<unknown>,
  cloudWords: Signal<number>,
): void {
  const zone = inject(NgZone);
  const deps: MotionHost = {
    host: inject<ElementRef<HTMLElement>>(ElementRef).nativeElement,
    clock: inject(MOTION_CLOCK),
    random: Math.random,
    document: inject(DOCUMENT),
  };
  let engine: MotionEngine | null = null;
  let made: NeatTextMotion | null = null;
  let madeWith: EngineSettings | null = null;

  afterRenderEffect({
    read: () => {
      const chosen = motion();
      const settings: EngineSettings = { cloudWords: cloudWords() };
      const live = streaming();
      changes();
      zone.runOutsideAngular(() => {
        if (chosen !== made || settings.cloudWords !== madeWith?.cloudWords) {
          engine?.destroy();
          made = chosen;
          madeWith = settings;
          const make = ENGINES[chosen];
          engine = make && !ɵreducedMotion() ? make(deps, settings) : null;
        }
        engine?.rendered(live);
      });
    },
  });
  inject(DestroyRef).onDestroy(() => engine?.destroy());
}
