import assert from 'node:assert/strict';
import { test } from 'node:test';
import { benchInfo, compareStartTransforms, mergeRuns } from './merge.mjs';

const step = (over = {}) => ({
  renderer: 'kit',
  ladder: 'A',
  step: 0,
  level: 1,
  refining: false,
  repeat: 0,
  params: { blocks: 30, edges: 36, notes: 8, msgsPerSec: 0 },
  startTransform: { k: 0.8, x: 100, y: 50 },
  phases: { idle: { fps: 60 } },
  ...over,
});

const pageResult = (over = {}) => ({
  schema: 1,
  runId: 'page-run',
  startedAt: '2026-10-31T10:00:00.000Z',
  bench: { gitSha: 'unknown', kitVersion: 'unknown', vflowVersion: 'unknown', build: 'production' },
  machine: {
    label: 'rig',
    ua: 'Chrome',
    cores: 8,
    dpr: 1,
    screen: { w: 1920, h: 1080 },
    viewport: { w: 1920, h: 1080 },
    refreshHz: 60,
  },
  config: {
    seed: 1,
    ladders: ['A'],
    renderers: ['kit'],
    repeats: 1,
    warmupMs: 3000,
    phases: [{ name: 'idle', ms: 3000 }],
    input: 'page',
  },
  steps: [step()],
  warnings: [],
  end: 'cap',
  refineSkipped: null,
  measurement: {
    refresh: { measuredMs: 16.7, hz: 60, intervalMs: 16.67 },
    loaf: { source: 'long-animation-frame', lost: 0, limits: 'limits text' },
    build: 'build text',
  },
  notComparable: ['one', 'two'],
  ...over,
});

const ok = (schedule, over = {}) => ({
  ok: true,
  schedule,
  result: pageResult({
    config: { ...pageResult().config, renderers: [schedule.renderer], ladders: [schedule.ladder] },
  }),
  steps: [step({ renderer: schedule.renderer, ladder: schedule.ladder, repeat: schedule.repeat })],
  ...over,
});

const INPUT = {
  runId: 'r1',
  startedAt: '2026-10-31T09:59:00.000Z',
  bench: { gitSha: 'abc123', kitVersion: '0.23.0', vflowVersion: '2.7.0' },
  options: {
    machine: 'rig',
    seed: 1,
    ladders: ['A'],
    renderers: ['kit', 'vflow'],
    repeats: 2,
    steps: 1,
    input: 'page',
  },
  machineExtra: {},
  fairness: null,
  skipped: [],
  warnings: [],
};

const K0 = { ladder: 'A', renderer: 'kit', repeat: 0 };
const V0 = { ladder: 'A', renderer: 'vflow', repeat: 0 };

test('keeps every run’s steps in the order the runs ran, each filed under its repeat', () => {
  const run = mergeRuns({
    ...INPUT,
    pageRuns: [ok(K0), ok(V0), ok({ ladder: 'A', renderer: 'vflow', repeat: 1 })],
  });
  assert.deepEqual(
    run.steps.map((s) => `${s.renderer}${s.repeat}`),
    ['kit0', 'vflow0', 'vflow1'],
  );
  assert.equal(run.schema, 1);
  assert.equal(run.runId, 'r1');
});

test('fills what the page cannot know: the commit and the kit and vflow versions', () => {
  const run = mergeRuns({ ...INPUT, pageRuns: [ok(K0)] });
  assert.deepEqual(run.bench, {
    gitSha: 'abc123',
    kitVersion: '0.23.0',
    vflowVersion: '2.7.0',
    build: 'production',
  });
});

test('says the build is development if any run was, since that run’s numbers do not compare', () => {
  const dev = ok(V0);
  dev.result = pageResult({ bench: { ...pageResult().bench, build: 'development' } });
  assert.equal(mergeRuns({ ...INPUT, pageRuns: [ok(K0), dev] }).bench.build, 'development');
});

test('describes the campaign: ladders, renderers, repeats, input and the plan’s phases', () => {
  const run = mergeRuns({ ...INPUT, pageRuns: [ok(K0), ok(V0)] });
  assert.deepEqual(run.config, {
    seed: 1,
    ladders: ['A'],
    renderers: ['kit', 'vflow'],
    repeats: 2,
    warmupMs: 3000,
    phases: [{ name: 'idle', ms: 3000 }],
    input: 'page',
    steps: 1,
  });
});

test('adds what only the harness can see to the page’s machine, under the label it was run as', () => {
  const run = mergeRuns({
    ...INPUT,
    machineExtra: {
      gpu: {
        featureStatus: { gpu_compositing: 'disabled_software' },
        devices: [],
        driverBugWorkarounds: [],
      },
      host: { uname: 'Linux modalix', cpuModel: 'Cortex-A65', memMb: 5898, display: '' },
      launchArgs: ['--headless=new'],
    },
    pageRuns: [ok(K0)],
  });
  assert.equal(run.machine.label, 'rig');
  assert.equal(run.machine.refreshHz, 60);
  assert.equal(run.machine.gpu.featureStatus.gpu_compositing, 'disabled_software');
  assert.equal(run.machine.host.cpuModel, 'Cortex-A65');
  assert.deepEqual(run.machine.launchArgs, ['--headless=new']);
});

test('records a failed run and keeps the steps it finished, marked, instead of dropping it', () => {
  const failed = {
    ok: false,
    schedule: V0,
    error: 'step 3: no answer in 60000 ms',
    steps: [step({ renderer: 'vflow', step: 0 }), step({ renderer: 'vflow', step: 1, level: 2 })],
  };
  const run = mergeRuns({ ...INPUT, pageRuns: [ok(K0), failed] });
  const entry = run.runs.find((r) => r.status === 'failed');
  assert.deepEqual(
    { renderer: entry.renderer, ladder: entry.ladder, repeat: entry.repeat, error: entry.error },
    { renderer: 'vflow', ladder: 'A', repeat: 0, error: 'step 3: no answer in 60000 ms' },
  );
  assert.equal(entry.steps, 2);
  const kept = run.steps.filter((s) => s.renderer === 'vflow');
  assert.equal(kept.length, 2);
  assert.ok(kept.every((s) => s.failedRun === true));
  assert.equal(run.steps.find((s) => s.renderer === 'kit').failedRun, undefined);
  assert.match(run.warnings.join('\n'), /vflow A r0 failed: step 3: no answer/);
});

test('lists each run with how it ended, its long-frame source and what the board read', () => {
  const thermal = { cpuMhzMin: 1200, tempMaxC: 61 };
  const run = mergeRuns({
    ...INPUT,
    pageRuns: [ok(K0, { thermal, screenshot: 'a.png', trace: 'a.trace.json.gz' })],
  });
  assert.deepEqual(run.runs[0], {
    ladder: 'A',
    renderer: 'kit',
    repeat: 0,
    status: 'ok',
    pageRunId: 'page-run',
    end: 'cap',
    refineSkipped: null,
    steps: 1,
    loaf: { source: 'long-animation-frame', lost: 0 },
    thermal,
    screenshot: 'a.png',
    trace: 'a.trace.json.gz',
  });
});

test('says how many pointer actions the harness replayed for a run, and how long the run took', () => {
  const run = mergeRuns({
    ...INPUT,
    pageRuns: [ok(K0, { input: { played: 120, coalesced: 4 }, wallMs: 16500 })],
  });
  assert.deepEqual(run.runs[0].input, { played: 120, coalesced: 4 });
  assert.equal(run.runs[0].wallMs, 16500);
});

test('says a warning once with the runs it came from, not once per run', () => {
  const a = ok(K0);
  const b = ok(V0);
  a.result = pageResult({ warnings: ['same text', 'only kit'] });
  b.result = pageResult({ warnings: ['same text'] });
  const run = mergeRuns({ ...INPUT, pageRuns: [a, b] });
  const same = run.warnings.filter((w) => w.includes('same text'));
  assert.equal(same.length, 1);
  assert.match(same[0], /^\[kit A r0, vflow A r0\] same text/);
  assert.ok(run.warnings.some((w) => w === '[kit A r0] only kit'));
});

test('prefixes what the harness noted about one run with that run', () => {
  const run = mergeRuns({
    ...INPUT,
    pageRuns: [ok(K0, { notes: ['3 pointer actions were refused'] })],
  });
  assert.ok(run.warnings.includes('kit A r0: 3 pointer actions were refused'));
});

test('lists a traced run but keeps its steps out of the measurements: tracing costs too much', () => {
  const traced = ok(
    { ladder: 'A', renderer: 'kit', repeat: 0 },
    { purpose: 'trace', trace: 'kit-A.trace.json.gz' },
  );
  traced.result = pageResult({ warnings: ['only in the traced run'] });
  const run = mergeRuns({ ...INPUT, pageRuns: [ok(K0), ok(V0), traced] });
  assert.equal(run.steps.length, 2);
  assert.equal(run.runs.length, 3);
  assert.deepEqual(
    run.runs.map((r) => r.purpose),
    [undefined, undefined, 'trace'],
  );
  assert.equal(run.runs[2].trace, 'kit-A.trace.json.gz');
  assert.ok(!run.warnings.some((w) => w.includes('only in the traced run')));
});

test('carries the harness’s own warnings first, unprefixed', () => {
  const run = mergeRuns({ ...INPUT, warnings: ['headless run'], pageRuns: [ok(K0)] });
  assert.equal(run.warnings[0], 'headless run');
});

test('warns of a throttled run, naming it, and of runs at different refresh rates', () => {
  const slow = ok(K0, { throttleWarning: 'kit A r0: the CPU fell from 3600 MHz to 2000 MHz' });
  const other = ok(V0);
  other.result = pageResult({
    machine: { ...pageResult().machine, refreshHz: 30 },
    measurement: {
      ...pageResult().measurement,
      refresh: { measuredMs: 33, hz: 30, intervalMs: 33.3 },
    },
  });
  const run = mergeRuns({ ...INPUT, pageRuns: [slow, other] });
  assert.match(run.warnings.join('\n'), /CPU fell from 3600 MHz/);
  assert.match(run.warnings.join('\n'), /refresh rates differ.*60.*30/);
});

test('writes down the fairness report and warns with each problem where the run went on', () => {
  const run = mergeRuns({
    ...INPUT,
    fairness: { ok: false, problems: ['edge e3 differs'], dom: { kit: 1, vflow: 2 }, drawn: {} },
    pageRuns: [ok(K0)],
  });
  assert.equal(run.fairness.ok, false);
  assert.match(run.warnings.join('\n'), /fairness check .*failed.*edge e3 differs/s);
});

test('keeps the page’s notes on how it measured and what the renderers do not share', () => {
  const run = mergeRuns({ ...INPUT, pageRuns: [ok(K0)] });
  assert.equal(run.measurement.build, 'build text');
  assert.deepEqual(run.notComparable, ['one', 'two']);
});

test('lists what it left out and why', () => {
  const skipped = [{ ladder: 'E', renderer: 'vflow', reason: 'kit only' }];
  assert.deepEqual(mergeRuns({ ...INPUT, skipped, pageRuns: [ok(K0)] }).skipped, skipped);
});

test('is JSON as it stands, and has a result even where every run failed', () => {
  const run = mergeRuns({
    ...INPUT,
    pageRuns: [{ ok: false, schedule: K0, error: 'x', steps: [] }],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(run)), run);
  assert.equal(run.steps.length, 0);
  assert.equal(run.machine.label, 'rig');
  assert.equal(run.bench.build, 'production');
});

test('finds the kit and vflow starting at different transforms, run for run and level for level', () => {
  const steps = [
    step({ renderer: 'kit', level: 1, startTransform: { k: 0.8, x: 100, y: 50 } }),
    step({ renderer: 'vflow', level: 1, startTransform: { k: 0.805, x: 101, y: 51 } }),
    step({ renderer: 'kit', level: 2, startTransform: { k: 0.5, x: 10, y: 10 } }),
    step({ renderer: 'vflow', level: 2, startTransform: { k: 0.52, x: 10, y: 10 } }),
    step({ renderer: 'kit', level: 4, repeat: 1, startTransform: { k: 0.4, x: 0, y: 0 } }),
    step({ renderer: 'vflow', level: 4, repeat: 1, startTransform: { k: 0.4, x: 3, y: 0 } }),
  ];
  const warnings = compareStartTransforms(steps);
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /ladder A level 2 repeat 0/);
  assert.match(warnings[0], /scale/);
  assert.match(warnings[1], /ladder A level 4 repeat 1/);
  assert.match(warnings[1], /3 px/);
});

test('compares only steps both renderers reached, and only where both have a start', () => {
  assert.deepEqual(
    compareStartTransforms([
      step({ renderer: 'kit', level: 1 }),
      step({ renderer: 'vflow', level: 2 }),
      step({ renderer: 'kit', level: 3, startTransform: undefined }),
      step({ renderer: 'vflow', level: 3 }),
    ]),
    [],
  );
});

test('reads the commit, marking a tree with changes, and the versions of the kit and vflow', async () => {
  const files = {
    '/repo/projects/neat-ui/package.json': JSON.stringify({ version: '0.23.0' }),
    '/repo/node_modules/ngx-vflow/package.json': JSON.stringify({ version: '2.7.0' }),
  };
  const info = await benchInfo({
    root: '/repo',
    git: async (args) => (args[0] === 'rev-parse' ? 'abc1234567\n' : ' M file.ts\n'),
    readFile: async (path) => files[path],
  });
  assert.deepEqual(info, {
    gitSha: 'abc1234567-dirty',
    kitVersion: '0.23.0',
    vflowVersion: '2.7.0',
  });

  const clean = await benchInfo({
    root: '/repo',
    git: async (args) => (args[0] === 'rev-parse' ? 'abc1234567\n' : ''),
    readFile: async (path) => files[path],
  });
  assert.equal(clean.gitSha, 'abc1234567');
});

test('says unknown, not nothing, where the commit or a version cannot be read', async () => {
  const info = await benchInfo({
    root: '/repo',
    git: async () => {
      throw new Error('not a repository');
    },
    readFile: async () => {
      throw new Error('ENOENT');
    },
  });
  assert.deepEqual(info, { gitSha: 'unknown', kitVersion: 'unknown', vflowVersion: 'unknown' });
});
