import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fairnessReport, fairnessVerdict } from './fairness.mjs';

const GOOD = {
  ok: true,
  problems: [],
  dom: { kit: 1200, vflow: 900 },
  drawn: { kit: { nodes: 34, notes: 8, edges: 36 }, vflow: { nodes: 34, notes: 8, edges: 36 } },
};
const BAD = { ...GOOD, ok: false, problems: ['edge e3 differs', 'note n1 is 12 px narrower'] };

test('takes the page’s judgment of the two fingerprints as the report', () => {
  assert.equal(
    fairnessReport({ ok: true, inspected: undefined }, { ok: true, inspected: GOOD }),
    GOOD,
  );
  assert.equal(fairnessReport({ ok: true }, { ok: true, inspected: BAD }), BAD);
});

test('is a failed report where a fairness run itself failed, naming which', () => {
  const kitFailed = fairnessReport({ ok: false, error: 'page crashed' }, null);
  assert.equal(kitFailed.ok, false);
  assert.match(kitFailed.problems[0], /kit.*page crashed/);
  const vflowFailed = fairnessReport({ ok: true }, { ok: false, error: 'timeout' });
  assert.equal(vflowFailed.ok, false);
  assert.match(vflowFailed.problems[0], /vflow.*timeout/);
});

test('lets a fair pair through, saying what was compared', () => {
  const verdict = fairnessVerdict(GOOD, false);
  assert.equal(verdict.stop, false);
  assert.match(verdict.lines.join('\n'), /passed.*34 blocks.*36 edges/);
});

test('stops the campaign before it measures on an unfair pair, listing every problem', () => {
  const verdict = fairnessVerdict(BAD, false);
  assert.equal(verdict.stop, true);
  const text = verdict.lines.join('\n');
  assert.match(text, /FAILED/);
  assert.match(text, /edge e3 differs/);
  assert.match(text, /note n1 is 12 px narrower/);
  assert.match(text, /--allow-unfair/);
});

test('goes on past an unfair pair only when told to, and still says so', () => {
  const verdict = fairnessVerdict(BAD, true);
  assert.equal(verdict.stop, false);
  assert.match(verdict.lines.join('\n'), /FAILED/);
});
