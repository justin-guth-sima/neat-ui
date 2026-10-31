// The browser's own counters at the page's boundaries (design 1.4): `Performance.getMetrics` at
// each phase's start and end, diffed, gives every phase's script, style and layout cost for every
// frame, not only the long ones; at a step's end the DOM counters and heap. The page reports each
// boundary (`benchEvent`, `bench-bridge.ts`); the recorder samples there, one sample at a time and
// in the order the events came, so a slow answer never reorders the windows. A sample that
// fails costs that phase its numbers and a warning, never the run.

/** CDP's `[{ name, value }]` as a map. */
export function toMap(metrics) {
  return Object.fromEntries(metrics.map(({ name, value }) => [name, value]));
}

/**
 * A phase's cost from the samples at its two ends. `busyShare` is the main thread's task time over
 * the browser's own clock between them (`Timestamp`, seconds), so the harness's delay in asking
 * does not enter it; below the refresh limit every renderer shows full fps and this tells them apart.
 */
export function diffMetrics(before, after) {
  const wallS = after.Timestamp - before.Timestamp;
  const taskS = after.TaskDuration - before.TaskDuration;
  return {
    wallMs: wallS * 1000,
    taskMs: taskS * 1000,
    scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
    styleMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
    layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
    busyShare: wallS > 0 ? taskS / wallS : null,
    styleCount: after.RecalcStyleCount - before.RecalcStyleCount,
    layoutCount: after.LayoutCount - before.LayoutCount,
  };
}

const key = (step, phase) => `${step}/${phase}`;

/**
 * `sample()` gives the metrics as a map (`toMap`), `domCounters()` gives `{ nodes,
 * jsEventListeners }`. Feed it the page's events with `handle`, wait with `settle`, and lay the
 * numbers over the page's steps with `applyTo`.
 */
export function createBoundaryRecorder({ sample, domCounters }) {
  let queue = Promise.resolve();
  const open = new Map();
  const closed = new Map();
  const ends = new Map();
  const warnings = [];

  const take = async (what, work) => {
    try {
      return await work();
    } catch (error) {
      warnings.push(`CDP counters missing at ${what}: ${error.message}`);
      return null;
    }
  };

  const process = async (event) => {
    switch (event.type) {
      case 'phase-begin': {
        const at = await take(`phase-begin ${event.phase} (step ${event.step})`, sample);
        if (at) open.set(key(event.step, event.phase), at);
        break;
      }
      case 'phase-end': {
        const at = await take(`phase-end ${event.phase} (step ${event.step})`, sample);
        const k = key(event.step, event.phase);
        const from = open.get(k);
        open.delete(k);
        if (at && from) closed.set(k, diffMetrics(from, at));
        break;
      }
      case 'step-end': {
        const at = await take(`step-end (step ${event.step})`, sample);
        const dom = await take(`step-end DOM counters (step ${event.step})`, domCounters);
        if (at) {
          // A phase still open here was cut short by the step's abort.
          for (const [k, from] of [...open]) {
            if (!k.startsWith(`${event.step}/`)) continue;
            open.delete(k);
            closed.set(k, { ...diffMetrics(from, at), partial: true });
          }
        }
        if (at || dom) ends.set(event.step, { at, dom });
        break;
      }
      default:
        break;
    }
  };

  return {
    /** Queues the event's sample; the returned promise is the whole queue's. */
    handle(event) {
      queue = queue.then(() => process(event));
      return queue;
    },
    settle: () => queue,
    get warnings() {
      return warnings;
    },
    /** The steps with `cdp` on each phase that has both ends, and the step's DOM and heap. */
    applyTo(steps) {
      return steps.map((step) => {
        const phases = Object.fromEntries(
          Object.entries(step.phases).map(([name, result]) => {
            const cdp = closed.get(key(step.step, name));
            return [name, cdp ? { ...result, cdp } : result];
          }),
        );
        const end = ends.get(step.step);
        const out = { ...step, phases };
        if (end?.dom) {
          out.dom = { ...step.dom, cdpNodes: end.dom.nodes, listeners: end.dom.jsEventListeners };
        }
        if (end?.at) out.heapBytes = end.at.JSHeapUsedSize;
        return out;
      });
    },
  };
}
