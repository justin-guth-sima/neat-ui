// The harness's own clock on a page that may freeze (design 2.4: "a step that takes more than 3x
// its planned wall time is aborted"). The page aborts such a step itself, from its frames, but a
// page whose frames stopped cannot: this is the backstop, kept in the harness, which is not
// frozen. Per step and per run, so neither a single hung step nor a run of slow ones can leave a
// campaign waiting for ever.

export class WatchdogExpired extends Error {}

/** The page's abort is at three times a step's planned time; the rest is its settling and build. */
const ABORT_FACTOR = 3;
const STEP_MARGIN_MS = 30_000;
/** Loading the page, the 2 s calibration and the first route, before the first step. */
const RUN_START_MS = 60_000;
/** A step's build and the return of its view, beyond the planned time. */
const STEP_OVERHEAD_MS = 10_000;

export function stepLimitMs(plannedStepMs) {
  return ABORT_FACTOR * plannedStepMs + STEP_MARGIN_MS;
}

/** Every step as planned with its overhead, and room for the one step that may be aborted. */
export function runLimitMs({ plannedStepMs, maxSteps }) {
  return (
    RUN_START_MS + maxSteps * (plannedStepMs + STEP_OVERHEAD_MS) + ABORT_FACTOR * plannedStepMs
  );
}

/**
 * A watchdog over one run. `expired` resolves, once, with what ran out: a step (armed with
 * `step(ms, label)` and disarmed by `stepDone()`) or the run (`runMs` from now). `stop()` clears
 * both timers.
 */
export function createWatchdog({ runMs }) {
  let stepTimer = null;
  let runTimer = null;
  let resolveExpired = () => undefined;
  const expired = new Promise((resolve) => (resolveExpired = resolve));
  const arm = (ms, fire) => {
    const timer = globalThis.setTimeout(fire, ms);
    timer.unref?.();
    return timer;
  };
  runTimer = arm(runMs, () => {
    stepTimer && globalThis.clearTimeout(stepTimer);
    resolveExpired({ scope: 'run', label: 'run', ms: runMs });
  });
  const stepDone = () => {
    if (stepTimer) globalThis.clearTimeout(stepTimer);
    stepTimer = null;
  };
  return {
    expired,
    step(ms, label) {
      stepDone();
      stepTimer = arm(ms, () => resolveExpired({ scope: 'step', label, ms }));
    },
    stepDone,
    stop() {
      stepDone();
      if (runTimer) globalThis.clearTimeout(runTimer);
      runTimer = null;
    },
  };
}

/** `promise`, or a rejection saying what was waited for: a CDP call must not hang the harness. */
export function withTimeout(promise, ms, what) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = globalThis.setTimeout(
      () => reject(new WatchdogExpired(`${what}: no answer in ${ms} ms`)),
      ms,
    );
  });
  return Promise.race([promise, limit]).finally(() => globalThis.clearTimeout(timer));
}
