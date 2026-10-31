import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { runOnePage } from './page-run.mjs';

const SCHEDULE = { ladder: 'A', renderer: 'kit', repeat: 0 };
const OPTIONS = { machine: 'rig', seed: 1, refine: false, input: 'page', screenshots: false };
// A run with a step that may take 60 ms and a start that may take 60 ms, so a hang is found fast.
const LIMITS = { startMs: 60, stepMs: () => 60, runMs: () => 5000 };

const stepResult = (step, over = {}) => ({
  renderer: 'kit',
  ladder: 'A',
  step,
  level: step + 1,
  repeat: 0,
  phases: { idle: { fps: 60 } },
  ...over,
});

const BEGIN = {
  type: 'run-begin',
  host: 'kit',
  ladder: 'A',
  repeat: 0,
  plannedStepMs: 10,
  maxSteps: 2,
};

/**
 * A session over a fake page. `script(emit, session)` runs when the page is opened at its address
 * and says what the page does; `benchResult` is what `window.benchResult` holds then.
 */
function fake({ script, benchResult, sample = 0 }) {
  const page = new EventEmitter();
  page.close = async () => undefined;
  page.mouse = {
    move: async () => undefined,
    down: async () => undefined,
    up: async () => undefined,
    wheel: async () => undefined,
  };
  page.evaluate = async () => benchResult;
  page.screenshot = async () => undefined;
  const session = {
    page,
    browser: {},
    listener: { current: null },
    context: {
      newCDPSession: async () => ({
        send: async (method) => {
          if (method === 'Performance.getMetrics') {
            sample += 1;
            return {
              metrics: [
                { name: 'Timestamp', value: sample },
                { name: 'TaskDuration', value: sample * 0.25 },
              ],
            };
          }
          if (method === 'Memory.getDOMCounters') return { nodes: 9, jsEventListeners: 3 };
          return {};
        },
      }),
    },
  };
  const urls = [];
  page.goto = async (url) => {
    urls.push(url);
    setImmediate(() => script((event) => session.listener.current?.onEvent(event), page));
  };
  return { session, page, urls };
}

const run = (rig, extra = {}) =>
  runOnePage({
    session: rig.session,
    base: 'http://127.0.0.1:1/',
    schedule: SCHEDULE,
    options: OPTIONS,
    steps: 2,
    files: null,
    limits: LIMITS,
    log: () => undefined,
    ...extra,
  });

test('returns the page’s result with the browser’s counters laid over each phase', async () => {
  const result = { steps: [stepResult(0)], warnings: [], runId: 'p1' };
  const rig = fake({
    benchResult: result,
    script: async (emit) => {
      emit(BEGIN);
      emit({ type: 'step-begin', step: 0, level: 1 });
      emit({ type: 'phase-begin', step: 0, phase: 'idle' });
      emit({ type: 'phase-end', step: 0, phase: 'idle' });
      emit({ type: 'step-end', step: 0, result: result.steps[0] });
      emit({ type: 'run-end' });
    },
  });
  const out = await run(rig);
  assert.equal(out.ok, true);
  assert.equal(out.result, result);
  assert.equal(out.steps.length, 1);
  assert.equal(out.steps[0].phases.idle.cdp.wallMs, 1000);
  assert.deepEqual(out.steps[0].dom, { cdpNodes: 9, listeners: 3 });
  assert.equal(new URL(rig.urls[0]).searchParams.get('host'), 'kit');
  assert.equal(new URL(rig.urls[0]).searchParams.get('steps'), '2');
});

test('fails a step that never ends, naming it, and keeps the steps that did end', async () => {
  const rig = fake({
    benchResult: undefined,
    script: async (emit) => {
      emit(BEGIN);
      emit({ type: 'step-begin', step: 0, level: 1 });
      emit({ type: 'step-end', step: 0, result: stepResult(0) });
      emit({ type: 'step-begin', step: 1, level: 2 });
      // The page freezes in step 1: no more events.
    },
  });
  const out = await run(rig);
  assert.equal(out.ok, false);
  assert.match(out.error, /watchdog: step 1 \(level 2\) did not finish in 60 ms/);
  assert.deepEqual(
    out.steps.map((s) => s.step),
    [0],
  );
});

test('fails a run that outlasts its limit even if its steps keep ending', async () => {
  const rig = fake({
    benchResult: undefined,
    script: async (emit) => {
      emit(BEGIN);
      for (let i = 0; i < 100; i++) {
        emit({ type: 'step-begin', step: i, level: i + 1 });
        emit({ type: 'step-end', step: i, result: stepResult(i) });
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    },
  });
  const out = await run(rig, { limits: { ...LIMITS, runMs: () => 80 } });
  assert.equal(out.ok, false);
  assert.match(out.error, /the run did not finish in 80 ms/);
  assert.ok(out.steps.length >= 1);
});

test('fails a page that never says it started a run', async () => {
  const out = await run(fake({ benchResult: undefined, script: async () => undefined }));
  assert.equal(out.ok, false);
  assert.match(out.error, /did not start a run/);
  assert.deepEqual(out.steps, []);
});

test('carries the page’s own failure, and the page errors it logged', async () => {
  const rig = fake({
    benchResult: undefined,
    script: async (emit, page) => {
      emit(BEGIN);
      page.emit('pageerror', new Error('boom in kit-host'));
      emit({ type: 'run-failed', message: 'ladder X is not a ladder' });
    },
  });
  const out = await run(rig);
  assert.equal(out.ok, false);
  assert.match(out.error, /ladder X is not a ladder/);
  assert.match(out.error, /boom in kit-host/);
});

test('fails a run whose result is the page’s error, though it said it ended', async () => {
  const rig = fake({
    benchResult: { error: 'cannot calibrate' },
    script: async (emit) => {
      emit(BEGIN);
      emit({ type: 'run-end' });
    },
  });
  const out = await run(rig);
  assert.equal(out.ok, false);
  assert.match(out.error, /cannot calibrate/);
});

test('fails a run whose page crashed, keeping the steps it had reported', async () => {
  const rig = fake({
    benchResult: undefined,
    script: async (emit, page) => {
      emit(BEGIN);
      emit({ type: 'step-begin', step: 0, level: 1 });
      emit({ type: 'step-end', step: 0, result: stepResult(0) });
      page.emit('crash');
    },
  });
  const out = await run(rig);
  assert.equal(out.ok, false);
  assert.match(out.error, /the page crashed/);
  assert.equal(out.steps.length, 1);
});

test('stops listening when the run is over, so a late event of this page reaches nobody', async () => {
  const rig = fake({
    benchResult: { steps: [], warnings: [], runId: 'p' },
    script: async (emit) => {
      emit(BEGIN);
      emit({ type: 'run-end' });
    },
  });
  await run(rig);
  assert.equal(rig.session.listener.current, null);
});

test('replays the page’s pointer actions through the browser’s mouse when asked to', async () => {
  const log = [];
  const rig = fake({
    benchResult: { steps: [], warnings: [], runId: 'p' },
    script: async (emit) => {
      emit(BEGIN);
      rig.session.listener.current.onInput({ kind: 'press', x: 5, y: 6 });
      rig.session.listener.current.onInput({ kind: 'release', x: 5, y: 6 });
      await new Promise((resolve) => setTimeout(resolve, 20));
      emit({ type: 'run-end' });
    },
  });
  rig.page.mouse.move = async (x, y) => log.push(`move ${x} ${y}`);
  rig.page.mouse.down = async () => log.push('down');
  rig.page.mouse.up = async () => log.push('up');
  const out = await run(rig, { options: { ...OPTIONS, input: 'cdp' } });
  assert.equal(out.ok, true);
  assert.deepEqual(log, ['move 5 6', 'down', 'move 5 6', 'up']);
  assert.equal(out.input.played, 2);
});
