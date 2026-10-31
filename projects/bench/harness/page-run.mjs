// One page load, one run (a renderer on a ladder, one repeat): opens a page, listens to the
// page's boundary events (`window.benchEvent`), reads the browser's counters at them, bounds every
// wait with the watchdog, and returns the run as the result file will hold it, whether it finished
// or not: a failed run keeps the steps the page reported as they ended.
import { gzipSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createInputBridge } from './input-bridge.mjs';
import { createBoundaryRecorder, toMap } from './metrics.mjs';
import { pageUrl } from './schedule.mjs';
import { createWatchdog, runLimitMs, stepLimitMs, withTimeout } from './watchdog.mjs';

/** Loading the page, calibrating and routing to the host, before the page says it will climb. */
const START_MS = 60_000;
const LIMITS = { startMs: START_MS, stepMs: stepLimitMs, runMs: runLimitMs };
const CDP_MS = 15_000;
const TRACE_CATEGORIES = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'blink.user_timing',
  'viz',
];

/** A promise that resolves with `value` after `ms`, and a way to stop its timer (a pending one would keep the process up). */
function after(ms, value) {
  let timer;
  const promise = new Promise((resolve) => (timer = setTimeout(() => resolve(value), ms)));
  return { promise, cancel: () => clearTimeout(timer) };
}

/**
 * Runs `schedule` ({ ladder, renderer, repeat }) on `session` (`browser.mjs`), at `base`. Options:
 * the campaign's (`machine`, `seed`, `refine`, `input`, `screenshots`), `steps`, and `files`
 * (where a screenshot or trace is saved, or null), `trace`, `inspect(page)` (read something from
 * the page before it closes), `probe()` (the board's counters; may be null), and `limits` (the watchdog's, for the specs).
 */
export async function runOnePage({
  session,
  base,
  schedule,
  options,
  steps,
  files,
  trace,
  inspect,
  probe,
  limits = LIMITS,
}) {
  const run = { schedule, notes: [] };
  const { page, context } = session;
  const dead = new Promise((resolve) => {
    page.once('crash', () => resolve('the page crashed'));
    page.once('close', () => resolve('the page closed'));
  });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && pageErrors.length < 5) pageErrors.push(message.text());
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const recorder = createBoundaryRecorder({
    sample: async () =>
      toMap(
        (await withTimeout(cdp.send('Performance.getMetrics'), CDP_MS, 'Performance.getMetrics'))
          .metrics,
      ),
    domCounters: async () =>
      withTimeout(cdp.send('Memory.getDOMCounters'), CDP_MS, 'Memory.getDOMCounters'),
  });

  // The page's events: counters at the boundary, the watchdog's clock, and where a run ends.
  let begin = null;
  let dog = null;
  const stepResults = new Map();
  let resolveBegin;
  let resolveEnd;
  const began = new Promise((resolve) => (resolveBegin = resolve));
  const ended = new Promise((resolve) => (resolveEnd = resolve));
  const onEvent = (event) => {
    recorder.handle(event);
    switch (event.type) {
      case 'run-begin':
        begin = event;
        dog = createWatchdog({ runMs: limits.runMs(event) });
        resolveBegin(event);
        break;
      case 'step-begin':
        dog?.step(limits.stepMs(begin.plannedStepMs), `step ${event.step} (level ${event.level})`);
        break;
      case 'step-end':
        dog?.stepDone();
        stepResults.set(event.step, event.result);
        break;
      case 'run-end':
        resolveEnd({ ok: true });
        break;
      case 'run-failed':
        resolveEnd({ ok: false, error: event.message });
        break;
      default:
        break;
    }
  };
  session.listener.current = { onEvent, onInput: null };

  let bridge = null;
  if (options.input === 'cdp') {
    bridge = createInputBridge(page.mouse);
    session.listener.current.onInput = (event) => bridge.push(event);
  }

  const started = Date.now();
  let tracing = false;
  try {
    if (trace && files) {
      await session.browser.startTracing(page, { categories: TRACE_CATEGORIES });
      tracing = true;
    }
    if (probe) run.before = await probe();
    const url = pageUrl(base, {
      host: schedule.renderer,
      ladder: schedule.ladder,
      seed: options.seed,
      steps,
      machine: options.machine,
      refine: options.refine,
      input: options.input,
      repeat: schedule.repeat,
    });
    await page.goto(url, { waitUntil: 'load', timeout: limits.startMs });

    const late = after(limits.startMs, `the page did not start a run in ${limits.startMs} ms`);
    const startup = await Promise.race([began.then(() => null), dead, late.promise]);
    late.cancel();
    if (startup) throw new Error(startup);

    const outcome = await Promise.race([
      ended,
      dog.expired.then((e) => ({
        ok: false,
        error: `watchdog: ${e.scope === 'run' ? 'the run' : e.label} did not finish in ${e.ms} ms`,
      })),
      dead.then((error) => ({ ok: false, error })),
    ]);
    if (!outcome.ok) throw new Error(outcome.error);

    const result = await withTimeout(
      page.evaluate(() => window.benchResult),
      CDP_MS,
      'read result',
    );
    if (!result || result.error) throw new Error(result?.error ?? 'the page left no result');
    run.result = result;
    if (bridge) await withTimeout(bridge.settle(), CDP_MS, 'input replay');
    await withTimeout(recorder.settle(), CDP_MS * 2, 'counters').catch((e) =>
      run.notes.push(e.message),
    );
    if (probe) run.after = await probe();
    if (inspect) run.inspected = await inspect(page);
    run.steps = recorder.applyTo(result.steps);

    if (files?.screenshot && run.steps.length > 0) {
      await mkdir(dirname(files.screenshot), { recursive: true });
      // After the last step, never between: the result panel is hidden so the picture is the diagram.
      await page.screenshot({
        path: files.screenshot,
        style: '.result { display: none !important }',
      });
      const last = run.steps.length - 1;
      run.steps[last] = { ...run.steps[last], screenshot: files.screenshotName };
      run.screenshot = files.screenshotName;
    }
    run.ok = true;
  } catch (error) {
    run.ok = false;
    run.error =
      error.message + (pageErrors.length ? ` (page errors: ${pageErrors.join(' | ')})` : '');
    await withTimeout(recorder.settle(), CDP_MS, 'counters').catch(() => undefined);
    run.steps = recorder.applyTo([...stepResults.values()].sort((a, b) => a.step - b.step));
    if (probe && !run.after) run.after = await probe().catch(() => undefined);
  } finally {
    dog?.stop();
    if (tracing) {
      try {
        const raw = await withTimeout(session.browser.stopTracing(), 60_000, 'stop tracing');
        await mkdir(dirname(files.trace), { recursive: true });
        await writeFile(files.trace, gzipSync(raw));
        run.trace = files.traceName;
      } catch (error) {
        run.notes.push(`trace not saved: ${error.message}`);
      }
    }
    session.listener.current = null;
    if (bridge) {
      if (bridge.errors.length > 0) {
        run.notes.push(
          `${bridge.errors.length} pointer actions were refused by the browser (${bridge.errors[0]})`,
        );
      }
      run.input = { played: bridge.played, coalesced: bridge.coalesced };
    }
    run.notes.push(...recorder.warnings);
    run.wallMs = Date.now() - started;
  }
  return run;
}
