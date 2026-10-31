import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runOnePage } from './page-run.mjs';

const SCHEDULE = { ladder: 'A', renderer: 'kit', repeat: 0 };
const OPTIONS = { machine: 'rig', seed: 1, refine: false, input: 'page', screenshots: false };
// A run with a step that may take 60 ms and a start that may take 60 ms, so a hang is found fast.
const LIMITS = { startMs: 60, stepMs: () => 60, runMs: () => 5000, setupMs: 60 };

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
function fake({ script, benchResult, sample = 0, newCDPSession, startTracing, stopTracing }) {
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
    browser: { startTracing, stopTracing: stopTracing ?? (async () => '{}') },
    listener: { current: null },
    context: {
      newCDPSession:
        newCDPSession ??
        (async () => ({
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
        })),
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
  // The step that ended, and the one the watchdog gave up on (below).
  assert.deepEqual(
    out.steps.map((s) => s.step),
    [0, 1],
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

const never = () => new Promise(() => undefined);

test('fails a run whose CDP session never opens, recording it instead of waiting for ever', async () => {
  const out = await run(
    fake({ benchResult: undefined, newCDPSession: never, script: () => undefined }),
  );
  assert.equal(out.ok, false);
  assert.match(out.error, /CDP session: no answer in 60 ms/);
  assert.deepEqual(out.steps, []);
});

test('fails a run whose Performance domain never enables', async () => {
  const out = await run(
    fake({
      benchResult: undefined,
      newCDPSession: async () => ({ send: never }),
      script: () => undefined,
    }),
  );
  assert.equal(out.ok, false);
  assert.match(out.error, /Performance\.enable: no answer in 60 ms/);
});

test('fails a traced run whose tracing never starts', async () => {
  const out = await run(
    fake({ benchResult: undefined, startTracing: never, script: () => undefined }),
    {
      trace: true,
      files: { trace: '/nonexistent/x.gz', traceName: 'x.gz' },
    },
  );
  assert.equal(out.ok, false);
  assert.match(out.error, /start tracing: no answer in 60 ms/);
});

/** A traced run of one step whose `phase` (pan) the page recorded at 60 fps. */
function traced(draws, { phase = 'pan', msgsPerSec = 0 } = {}) {
  const result = {
    steps: [
      stepResult(0, { params: { msgsPerSec }, phases: { [phase]: { fps: 60, frames: 60 } } }),
    ],
    warnings: [],
    runId: 'p1',
  };
  return fake({
    benchResult: result,
    startTracing: async () => undefined,
    // The fake browser's clock counts a second per sample: the pan phase is seconds 1 to 2.
    stopTracing: async () =>
      JSON.stringify({
        traceEvents: Array.from({ length: draws }, (_, i) => ({
          name: 'Display::DrawAndSwap',
          ph: 'X',
          ts: 1e6 + (i * 1e6) / draws,
        })),
      }),
    script: async (emit) => {
      emit(BEGIN);
      emit({ type: 'step-begin', step: 0, level: 1 });
      emit({ type: 'phase-begin', step: 0, phase });
      emit({ type: 'phase-end', step: 0, phase });
      emit({ type: 'step-end', step: 0, result: result.steps[0] });
      emit({ type: 'run-end' });
    },
  });
}

test('checks a traced run’s recorder against its own trace', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bench-trace-'));
  try {
    const files = { trace: join(dir, 'x.gz'), traceName: 'x.gz' };
    const good = await run(traced(60), { trace: true, files });
    assert.equal(good.ok, true);
    assert.equal(good.recorderCheck.ok, true);
    assert.equal(good.recorderCheck.compared, 1);

    const bad = await run(traced(45), { trace: true, files });
    assert.equal(bad.recorderCheck.ok, false);
    assert.equal(bad.ok, true, 'a disagreement is a warning, not a failed run');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('records the display’s presented rate in the phases whose view changes every frame', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bench-trace-'));
  try {
    const files = { trace: join(dir, 'x.gz'), traceName: 'x.gz' };
    const pan = await run(traced(54), { trace: true, files });
    assert.equal(pan.steps[0].phases.pan.presentedFps, 54);
    assert.equal(pan.steps[0].phases.pan.fps, 60, 'the recorder’s rate stays beside it');

    // Messages in flight move the dots in a phase with no gesture, so it is counted too.
    const moving = await run(traced(48, { phase: 'idle', msgsPerSec: 800 }), {
      trace: true,
      files,
    });
    assert.equal(moving.steps[0].phases.idle.presentedFps, 48);

    // An idle phase of a step with nothing in flight may rightly draw nothing: no rate.
    const still = await run(traced(48, { phase: 'idle' }), { trace: true, files });
    assert.equal(still.steps[0].phases.idle.presentedFps, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('gives no presented rate, and says so, where a trace shows no draw in a moving phase', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bench-trace-'));
  try {
    const out = await run(traced(0, { phase: 'idle', msgsPerSec: 800 }), {
      trace: true,
      files: { trace: join(dir, 'x.gz'), traceName: 'x.gz' },
    });
    assert.equal(out.ok, true);
    assert.equal(out.steps[0].phases.idle.presentedFps, undefined);
    assert.ok(
      out.notes.some((note) => /no presented rate.*1 phase/.test(note)),
      out.notes.join('|'),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('leaves the none host’s trace unchecked, and says so without a warning of its own', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bench-trace-'));
  try {
    const out = await run(traced(0), {
      trace: true,
      schedule: { ladder: 'A', renderer: 'none', repeat: 0 },
      files: { trace: join(dir, 'x.gz'), traceName: 'x.gz' },
    });
    assert.equal(out.ok, true);
    assert.equal(out.recorderCheck.ok, null);
    assert.match(out.recorderCheck.skipped, /none host/);
    assert.deepEqual(out.notes, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('notes a trace it cannot read instead of failing the run', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bench-trace-'));
  try {
    const rig = traced(60);
    rig.session.browser.stopTracing = async () => 'not json';
    const out = await run(rig, {
      trace: true,
      files: { trace: join(dir, 'x.gz'), traceName: 'x.gz' },
    });
    assert.equal(out.ok, true);
    assert.equal(out.recorderCheck, undefined);
    assert.ok(
      out.notes.some((note) => /recorder check.*not JSON/.test(note)),
      out.notes.join('|'),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('fails a run whose page cannot be inspected, instead of waiting for ever', async () => {
  const rig = fake({
    benchResult: { steps: [], warnings: [], runId: 'p' },
    script: async (emit) => {
      emit(BEGIN);
      emit({ type: 'run-end' });
    },
  });
  const out = await run(rig, { inspect: never });
  assert.equal(out.ok, false);
  assert.match(out.error, /inspect page: no answer in 60 ms/);
});

test('says why a page that ends before it began a run did, at once and not after the start limit', async () => {
  const rig = fake({
    benchResult: { error: 'ladder X is not a ladder' },
    script: async (emit) => emit({ type: 'run-failed', message: 'ladder X is not a ladder' }),
  });
  const began = Date.now();
  const out = await run(rig, { limits: { ...LIMITS, startMs: 5000 } });
  assert.equal(out.ok, false);
  assert.match(out.error, /ladder X is not a ladder/);
  assert.ok(Date.now() - began < 2000, 'did not wait out the 5 s start limit');
});

test('records the step the watchdog killed, so the level it was at is not lost', async () => {
  const rig = fake({
    benchResult: undefined,
    script: async (emit) => {
      emit(BEGIN);
      emit({ type: 'step-begin', step: 0, level: 1 });
      emit({ type: 'step-end', step: 0, result: stepResult(0) });
      emit({ type: 'step-begin', step: 1, level: 2 });
    },
  });
  const out = await run(rig);
  assert.equal(out.ok, false);
  assert.deepEqual(
    out.steps.map((s) => [s.step, s.level, s.aborted]),
    [
      [0, 1, undefined],
      [1, 2, 'watchdog'],
    ],
  );
  const killed = out.steps[1];
  assert.equal(killed.renderer, 'kit');
  assert.equal(killed.ladder, 'A');
  assert.equal(killed.repeat, 0);
  assert.deepEqual(killed.phases, {});
});

test('records the step in flight when the run limit, not the step limit, ran out', async () => {
  const rig = fake({
    benchResult: undefined,
    script: async (emit) => {
      emit(BEGIN);
      emit({ type: 'step-begin', step: 0, level: 1 });
    },
  });
  const out = await run(rig, { limits: { ...LIMITS, stepMs: () => 5000, runMs: () => 80 } });
  assert.match(out.error, /the run did not finish/);
  assert.equal(out.steps[0].aborted, 'watchdog');
});

test('does not invent a step where the page crashed between steps', async () => {
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
  assert.deepEqual(
    out.steps.map((s) => s.aborted),
    [undefined],
  );
});

test('names the page it listens to, so another page’s events are not this run’s', async () => {
  let listening;
  const rig = fake({
    benchResult: { steps: [], warnings: [], runId: 'p' },
    script: async (emit) => {
      listening = rig.session.listener.current;
      emit(BEGIN);
      emit({ type: 'run-end' });
    },
  });
  await run(rig);
  assert.equal(listening.page, rig.page);
});
