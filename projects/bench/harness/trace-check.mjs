// The recorder against the browser's own account of what it drew (design 1.4, "validate the
// recorder"): a traced run's frame rate in the pan and zoom phases, from the display compositor's
// draws in the trace, against the rAF-derived rate the page's recorder reported for the same
// window. Pure.
//
// Why `Display::DrawAndSwap` and not the trace's `PipelineReporter` states: the reporter's verdict
// (presented, dropped) needs presentation feedback from the windowing system, and a headed
// Chromium on Wayland ends every renderer frame as "dropped" while the display draws each of
// them. The display's draws are the frames that reached the screen, whatever the platform says
// about them. Why only the gesture phases: the display draws a frame only where something
// changed, and in an idle or held phase a page may change nothing for many frames, so fewer draws
// than rAF frames would say nothing about the recorder. A pan or a zoom changes the view in every
// frame, so there each rAF frame must have been drawn.
//
// The same draws give the presented rate: what the display showed per second in such a phase,
// which is what a user sees. The results take the lower of it and the recorder's rate, since a
// frame the page produced and the display never drew was not seen. It is laid over every repeat of
// the same load, and the results view shows both rates and marks the steps it decided. On the
// laptop the check holds for the kit and not for vflow, whose recorded fps reads above what the
// display draws, which is why what the user sees decides.

/** The design's bound: the two rates may differ by this share of the recorder's. */
export const CHECK_TOLERANCE = 0.03;

/** The phases whose every frame changes the view (`phase-driver.ts`): the ones compared. */
const COMPARED_PHASES = new Set(['pan', 'zoom']);

const DRAW = 'Display::DrawAndSwap';

/** The seconds at which the display drew, ascending, from a trace's events (µs there). */
export function drawTimes(events) {
  const times = [];
  for (const event of events) {
    // A complete event (`X`) or the beginning of a pair (`B`): the draw's start.
    if (event.name === DRAW && (event.ph === 'X' || event.ph === 'B')) times.push(event.ts / 1e6);
  }
  return Float64Array.from(times).sort();
}

/** The index of the first of `sorted` at or after `value`. */
function lowerBound(sorted, value) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * The traced run's phases with the browser-clock window each was measured over (`cdp.fromS` and
 * `toS`, `metrics.mjs`) and the recorder's rate: what `compareRecorder` needs of a run's steps.
 */
export function tracedPhases(steps) {
  return steps.flatMap((step) =>
    Object.entries(step.phases).map(([phase, result]) => ({
      step: step.step,
      level: step.level,
      phase,
      fps: result.fps,
      fromS: result.cdp?.fromS,
      toS: result.cdp?.toS,
      // Messages in flight move their dots in every frame of every phase of the step.
      moving: (step.params?.msgsPerSec ?? 0) > 0,
      ...(result.partial ? { partial: true } : {}),
    })),
  );
}

/** Whether `phase` has a window the trace can be laid against. */
const hasWindow = ({ fromS, toS, partial }) =>
  !partial && Number.isFinite(fromS) && Number.isFinite(toS) && toS > fromS;

/** The draws in a phase's window. */
const drawsIn = (drawsS, { fromS, toS }) => lowerBound(drawsS, toS) - lowerBound(drawsS, fromS);

/**
 * The recorder's rate against the display's, per compared phase: `drawsS` from `drawTimes`,
 * `phases` from `tracedPhases`. `ok` is true when every compared phase is within its bound, false
 * when one is not, and null when none could be compared (nothing was checked, which is not a pass).
 * `diffPct` is the display's rate over the recorder's, minus one, as a percentage. The bound is
 * `tolerance` or one draw over the phase's window, whichever is larger: the count over a window
 * is only good to a draw, and one is more than 3 % of a short phase at a low rate. A phase in
 * which the display drew nothing is `unreadable`: a trace without the event (another Chromium, a
 * missing category) would read as a recorder that is 100 % wrong, which says nothing about the
 * recorder.
 */
export function compareRecorder(drawsS, phases, tolerance = CHECK_TOLERANCE) {
  const rows = [];
  for (const phase of phases) {
    // A phase cut short by an aborted step covers part of its window; one without a window had its
    // counters missing. Neither can be laid against the trace.
    if (!COMPARED_PHASES.has(phase.phase) || !hasWindow(phase)) continue;
    const { fromS, toS } = phase;
    const draws = drawsIn(drawsS, phase);
    const row = {
      step: phase.step,
      level: phase.level,
      phase: phase.phase,
      recorderFps: phase.fps,
    };
    if (draws === 0) {
      rows.push({ ...row, unreadable: true });
      continue;
    }
    const traceFps = draws / (toS - fromS);
    const diffPct = (traceFps / phase.fps - 1) * 100;
    const allowedPct = Math.max(tolerance * 100, 100 / (toS - fromS) / phase.fps);
    rows.push({ ...row, traceFps, diffPct, allowedPct, ok: Math.abs(diffPct) <= allowedPct });
  }
  const readable = rows.filter((row) => !row.unreadable);
  const worstPct = readable.reduce(
    (worst, row) => (Math.abs(row.diffPct) > Math.abs(worst) ? row.diffPct : worst),
    0,
  );
  return {
    ok: readable.length === 0 ? null : readable.every((row) => row.ok),
    tolerance,
    compared: readable.length,
    unreadable: rows.length - readable.length,
    worstPct,
    rows,
  };
}

/**
 * The display's presented rate in each phase whose view changes in every frame: a pan or a zoom
 * (not of the `none` host, which an empty box no gesture moves) and every phase of a step with
 * messages in flight. `rates` is `[{ step, phase, presentedFps }]` for the phases the trace can
 * speak of; `unreadable` counts the ones that should have drawn and show no draw, which get no
 * rate (the recorder's alone judges them, with the check saying why).
 */
export function presentedRates(drawsS, phases, { renderer } = {}) {
  const rates = [];
  let unreadable = 0;
  for (const phase of phases) {
    const gesture = COMPARED_PHASES.has(phase.phase) && !UNMOVED.has(renderer);
    if (!(gesture || phase.moving) || !hasWindow(phase)) continue;
    const draws = drawsIn(drawsS, phase);
    if (draws === 0) {
      unreadable++;
      continue;
    }
    rates.push({
      step: phase.step,
      phase: phase.phase,
      presentedFps: draws / (phase.toS - phase.fromS),
    });
  }
  return { rates, unreadable };
}

/** `steps` with each phase's `presentedFps` from `rates` (`presentedRates`); the input is kept. */
export function withPresentedFps(steps, rates) {
  const byPhase = new Map(rates.map((rate) => [`${rate.step}/${rate.phase}`, rate.presentedFps]));
  return steps.map((step) => ({
    ...step,
    phases: Object.fromEntries(
      Object.entries(step.phases).map(([name, result]) => {
        const presentedFps = byPhase.get(`${step.step}/${name}`);
        return [name, presentedFps === undefined ? result : { ...result, presentedFps }];
      }),
    ),
  }));
}

/** A trace as `Tracing` returns it: JSON text, or a buffer of it, with `traceEvents` or bare. */
export function readTraceEvents(raw) {
  let parsed;
  try {
    parsed = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'));
  } catch (error) {
    throw new Error(`the trace is not JSON: ${error.message}`);
  }
  const events = Array.isArray(parsed) ? parsed : parsed?.traceEvents;
  if (!Array.isArray(events)) throw new Error('the trace has no trace events');
  return events;
}

/**
 * The renderers whose gestures move nothing the display draws: the `none` host is an empty box,
 * so a pan or a zoom changes no pixel and the display draws no frame to count (its dots, where
 * the ladder has messages, move on their own).
 */
const UNMOVED = new Set(['none']);

/**
 * The check of a traced run of `renderer`: its raw trace against its phases (`tracedPhases`). A
 * renderer the gestures move nothing in is left out, saying why in `skipped`.
 */
export function checkRecorderAgainstTrace(raw, phases, options = {}) {
  return checkDraws(drawTimes(readTraceEvents(raw)), phases, options);
}

/** `checkRecorderAgainstTrace` for a trace already read (`drawTimes`). */
export function checkDraws(drawsS, phases, { renderer, tolerance = CHECK_TOLERANCE } = {}) {
  if (UNMOVED.has(renderer)) {
    return {
      ok: null,
      tolerance,
      compared: 0,
      unreadable: 0,
      worstPct: 0,
      rows: [],
      skipped:
        `the ${renderer} host draws nothing the gestures move, so the display draws no frame ` +
        'to count',
    };
  }
  return compareRecorder(drawsS, phases, tolerance);
}

/**
 * The warning a run's check earns, or null where it passed: the recorder's numbers for the machine
 * are then to be read with it (design 1.4). Said once per traced run.
 */
export function recorderCheckWarning(label, check) {
  if (check.skipped) return null;
  const unreadable =
    check.unreadable > 0
      ? `the trace holds no display draws in ${check.unreadable} gesture phases, which are ` +
        'therefore not checked (trace unreadable for them)'
      : null;
  if (check.ok === true) return unreadable && `${label}: ${unreadable}.`;
  if (check.ok === null) {
    return unreadable
      ? `${label}: the recorder could not be checked: ${unreadable}, so its numbers on this ` +
          'machine are unvalidated.'
      : `${label}: the recorder could not be checked against the trace (no pan or zoom phase ` +
          'with a window), so its numbers on this machine are unvalidated.';
  }
  const failed = check.rows.filter((row) => row.ok === false);
  const worst = failed.reduce((a, b) => (Math.abs(b.diffPct) > Math.abs(a.diffPct) ? b : a));
  return (
    `${label}: the recorder and the trace disagree by more than ${check.tolerance * 100} % ` +
    `(and one draw, in a short phase; ${failed.length} of ${check.compared} gesture phases; ` +
    `worst: step ${worst.step} ${worst.phase}, ${worst.recorderFps.toFixed(1)} fps recorded ` +
    `against ${worst.traceFps.toFixed(1)} drawn). Read the recorder's numbers for this machine ` +
    `with care.${unreadable ? ` Also: ${unreadable}.` : ''}`
  );
}
