import type { GestureTarget } from './gesture-player';
import type { StepResult } from './result';
import { type LadderPlan, REFINE_STEPS } from './step-machine';

/*
 * What the page tells a harness and takes from it (design 4.1, "page owns the timing, the harness
 * listens"). The page runs calibrate, steps and phases itself, the same code with or without a
 * harness; where the harness exposed `window.benchEvent` (`page.exposeBinding`) the page reports
 * each boundary through it, so the harness can read the browser's own counters there. Where it
 * did not (a board browser on its own), every sink below does nothing. `window.benchInput` is the
 * other way: the harness's replay of the gestures through the browser's real input pipeline
 * (`--input=cdp`), which takes the place of the synthetic events and leaves the path and its
 * timing the page's. Nothing here waits for the harness: a binding that is slow, closed or
 * throwing costs the run nothing but the report.
 */

export type BenchEvent =
  /** Before the calibration: what the run will climb, so the harness can bound its waits. */
  | {
      readonly type: 'run-begin';
      readonly host: string;
      readonly ladder: string;
      readonly repeat: number;
      readonly plannedStepMs: number;
      readonly maxSteps: number;
    }
  | { readonly type: 'step-begin'; readonly step: number; readonly level: number }
  | { readonly type: 'phase-begin'; readonly step: number; readonly phase: string }
  | { readonly type: 'phase-end'; readonly step: number; readonly phase: string }
  /** A step as the result will hold it, judged or aborted: a run that dies later keeps it. */
  | { readonly type: 'step-end'; readonly step: number; readonly result: StepResult }
  /** `window.benchResult` is the finished run. */
  | { readonly type: 'run-end' }
  | { readonly type: 'run-failed'; readonly message: string };

export type BenchEventSink = (event: BenchEvent) => void;

/** One pointer action of a gesture, in client px. `deltaY` is a wheel's. */
export interface InputEvent {
  readonly kind: 'press' | 'drag' | 'release' | 'wheel';
  readonly x: number;
  readonly y: number;
  readonly deltaY?: number;
}

export type InputSink = (event: InputEvent) => void;

declare global {
  interface Window {
    /** The harness's listener for the run's boundaries (`page.exposeBinding`). */
    benchEvent?: (event: BenchEvent) => unknown;
    /** The harness's replay of a gesture's pointer actions through the browser's input. */
    benchInput?: (event: InputEvent) => unknown;
  }
}

/** A call into a binding that never throws and never leaves a rejection unhandled. */
function notify(call: (() => unknown) | undefined): void {
  if (!call) return;
  try {
    const result = call();
    if (result instanceof Promise) result.catch(() => undefined);
  } catch {
    // The harness went away: the run is the page's, and goes on.
  }
}

export function windowEventSink(win: Window): BenchEventSink {
  return (event) => notify(win.benchEvent && (() => win.benchEvent?.(event)));
}

export function windowInputSink(win: Window): InputSink {
  return (event) => notify(win.benchInput && (() => win.benchInput?.(event)));
}

/** A step's planned wall time: its warm-up and phases, which the page aborts it at three times. */
export function plannedStepMs(plan: LadderPlan): number {
  return plan.warmupMs + plan.phases.reduce((sum, phase) => sum + phase.ms, 0);
}

/** The most steps a climb takes: the levels, and the knee's two bisections when asked for. */
export function maxSteps(plan: LadderPlan): number {
  return plan.levels.length + (plan.refine ? REFINE_STEPS : 0);
}

/**
 * The gestures with the pointer sent to `send` and not to the renderer: the box and the view are
 * the host's, so the player's path is the same, and the browser's own input delivers it.
 */
export function bridgeGestures(target: GestureTarget, send: InputSink): GestureTarget {
  return {
    rect: () => target.rect(),
    transform: () => target.transform(),
    press: (x, y) => send({ kind: 'press', x, y }),
    drag: (x, y) => send({ kind: 'drag', x, y }),
    release: (x, y) => send({ kind: 'release', x, y }),
    wheel: (x, y, deltaY) => send({ kind: 'wheel', x, y, deltaY }),
  };
}
