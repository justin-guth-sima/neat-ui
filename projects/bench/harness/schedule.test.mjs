import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSchedule, pageUrl, runOrder, traceSchedule } from './schedule.mjs';

test('alternates the renderer order each repeat: K V, V K, K V', () => {
  assert.deepEqual(runOrder(['kit', 'vflow'], 0), ['kit', 'vflow']);
  assert.deepEqual(runOrder(['kit', 'vflow'], 1), ['vflow', 'kit']);
  assert.deepEqual(runOrder(['kit', 'vflow'], 2), ['kit', 'vflow']);
});

test('reverses a longer list the same way, so no renderer is always last', () => {
  assert.deepEqual(runOrder(['kit', 'vflow', 'none'], 1), ['none', 'vflow', 'kit']);
});

test('does not change the list it was given', () => {
  const renderers = ['kit', 'vflow'];
  runOrder(renderers, 1);
  assert.deepEqual(renderers, ['kit', 'vflow']);
});

test('lists runs by ladder, then repeat, then renderer: K V V K K V', () => {
  const { runs } = buildSchedule({ ladders: ['A'], renderers: ['kit', 'vflow'], repeats: 3 });
  assert.deepEqual(
    runs.map((run) => `${run.renderer[0]}${run.repeat}`),
    ['k0', 'v0', 'v1', 'k1', 'k2', 'v2'],
  );
  assert.ok(runs.every((run) => run.ladder === 'A'));
});

test('keeps every ladder’s runs together, so a ladder is one stretch of the board’s day', () => {
  const { runs } = buildSchedule({ ladders: ['A', 'B'], renderers: ['kit'], repeats: 2 });
  assert.deepEqual(
    runs.map((run) => `${run.ladder}${run.repeat}`),
    ['A0', 'A1', 'B0', 'B1'],
  );
});

test('runs the soak on the kit only and says what it left out', () => {
  const { runs, skipped } = buildSchedule({
    ladders: ['E'],
    renderers: ['vflow', 'kit', 'none'],
    repeats: 1,
  });
  assert.deepEqual(
    runs.map((run) => run.renderer),
    ['kit'],
  );
  assert.deepEqual(
    skipped.map((entry) => [entry.ladder, entry.renderer]),
    [
      ['E', 'vflow'],
      ['E', 'none'],
    ],
  );
  assert.match(skipped[0].reason, /kit only/);
});

test('gives each traced run one level-capped run per renderer and ladder, never repeats', () => {
  const runs = traceSchedule({ ladders: ['A', 'E'], renderers: ['kit', 'vflow'] });
  assert.deepEqual(
    runs.map((run) => `${run.ladder}-${run.renderer}`),
    ['A-kit', 'A-vflow', 'E-kit'],
  );
});

test('builds the page’s address from the run’s settings, as its query reads them', () => {
  const url = pageUrl('http://127.0.0.1:4300/', {
    host: 'vflow',
    ladder: 'B',
    seed: 7,
    steps: 3,
    machine: 'modalix devkit',
    refine: true,
    input: 'cdp',
    repeat: 2,
  });
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'http://127.0.0.1:4300/');
  assert.deepEqual(Object.fromEntries(parsed.searchParams), {
    auto: '1',
    host: 'vflow',
    ladder: 'B',
    seed: '7',
    steps: '3',
    machine: 'modalix devkit',
    refine: '1',
    input: 'cdp',
    repeat: '2',
  });
});

test('leaves out what is not set: every step, no refinement, the page’s own input', () => {
  const url = new URL(
    pageUrl('http://127.0.0.1:4300/', {
      host: 'kit',
      ladder: 'A',
      seed: 1,
      steps: undefined,
      machine: 'rig',
      refine: false,
      input: 'page',
      repeat: 0,
    }),
  );
  assert.equal(url.searchParams.has('steps'), false);
  assert.equal(url.searchParams.has('refine'), false);
  assert.equal(url.searchParams.get('input'), 'page');
});
