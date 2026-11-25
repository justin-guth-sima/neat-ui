import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatMatrix, chatTable, passes, runUrl } from './chat-budget.mjs';

const TEXT = [
  'plain',
  'focus',
  'heat-trail',
  'decrypt',
  'reverse-explosion',
  'token-flash',
  'drop-in',
  'word-cloud',
];
const PICTURES = ['coming-into-focus', 'beam-and-patches', 'viewfinder', 'patches-into-model'];
const GLOWS = ['comet', 'ring', 'aurora', 'sheen'];

test('the matrix holds every variant at throttle 1 and 4', () => {
  const matrix = chatMatrix();
  const at = (throttle) => matrix.filter((run) => run.throttle === throttle);
  assert.equal(at(1).length, at(4).length);
  assert.equal(matrix.length, at(1).length + at(4).length);
  for (const throttle of [1, 4]) {
    const runs = at(throttle);
    for (const text of TEXT) {
      assert.ok(
        runs.some(
          (r) => r.query.text === text && r.query.glow === 'comet' && r.query.picture === 'none',
        ),
        `text ${text} at ${throttle}`,
      );
    }
    for (const glow of GLOWS) {
      assert.ok(
        runs.some((r) => r.query.glow === glow && r.query.text === 'plain'),
        `glow ${glow} at ${throttle}`,
      );
    }
    for (const picture of PICTURES) {
      assert.ok(
        runs.some((r) => r.query.picture === picture && r.query.wait === 3000),
        `picture ${picture} at ${throttle}`,
      );
    }
    assert.ok(
      runs.some(
        (r) => r.query.reply === 'code' && r.query.text === 'plain' && r.query.glow === 'comet',
      ),
    );
    for (const run of runs) assert.equal(run.query.rate, 50);
  }
  // Every run is named once.
  assert.equal(new Set(matrix.map((run) => `${run.name} ${run.throttle}`)).size, matrix.length);
});

test("a run's page address carries its query and measures", () => {
  const url = runUrl('http://127.0.0.1:5000/', { text: 'decrypt', glow: 'comet', rate: 50 });
  assert.equal(url, 'http://127.0.0.1:5000/#/chat?text=decrypt&glow=comet&rate=50&measure=1');
});

const phase = (tier, p95 = 17, dropped = 0) => ({
  frames: { fps: 60, p95, droppedPct: dropped, dropped: 0 },
  tier,
  script: { p50: 1, p95: 2, worst: 3 },
});

test('a run passes only when both phases are smooth', () => {
  assert.equal(passes({ waiting: phase('smooth'), streaming: phase('smooth') }), true);
  assert.equal(passes({ waiting: phase('usable'), streaming: phase('smooth') }), false);
  assert.equal(passes({ waiting: phase('smooth'), streaming: phase('failing') }), false);
});

test('the table names each run and its numbers', () => {
  const table = chatTable([
    {
      name: 'text decrypt',
      throttle: 4,
      result: {
        hz: 60,
        waiting: phase('smooth', 16.9),
        streaming: { ...phase('usable', 25.4, 7.5), loafs: { frames: 3, largestMs: 81.2 } },
      },
    },
  ]);
  const lines = table.split('\n');
  assert.match(lines[0], /^\| Run \| CPU \|/);
  assert.match(lines[1], /^\|( ?-+ ?\|)+$/);
  assert.match(table, /\| text decrypt \| 4× \|/);
  assert.match(table, /16\.9/);
  assert.match(table, /25\.4/);
  assert.match(table, /7\.5 %/);
  assert.match(table, /usable/);
  assert.match(table, /81\.2/);
  assert.match(table, /\| fail \|/);
});
