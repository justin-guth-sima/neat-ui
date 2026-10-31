import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkRecorderAgainstTrace,
  compareRecorder,
  recorderCheckWarning,
  drawTimes,
  tracedPhases,
} from './trace-check.mjs';

/** The display compositor's draw at `s` seconds, as Chromium writes it (µs). */
const draw = (s, pid = 7) => ({ name: 'Display::DrawAndSwap', ph: 'X', ts: s * 1e6, dur: 90, pid });
/** `n` draws evenly over [from, to). */
const draws = (from, to, n) =>
  Array.from({ length: n }, (_, i) => draw(from + ((to - from) * i) / n));

const phase = (over = {}) => ({
  step: 0,
  level: 1,
  phase: 'pan',
  fps: 60,
  fromS: 100,
  toS: 103,
  ...over,
});

test('takes the display compositor’s draws, in seconds, and nothing else', () => {
  const times = drawTimes([
    draw(5),
    { name: 'Commit', ph: 'X', ts: 6e6 },
    draw(4),
    { name: 'Display::DrawAndSwap', ph: 'E', ts: 9e6 },
  ]);
  assert.deepEqual(Array.from(times), [4, 5]);
});

test('passes a phase whose draws match the recorder within 3 %', () => {
  // 3 s at 60 fps is 180 frames: 176 draws is 58.7 fps, 2.2 % under.
  const check = compareRecorder(drawTimes(draws(100, 103, 176)), [phase()]);
  assert.equal(check.ok, true);
  assert.equal(check.compared, 1);
  assert.ok(Math.abs(check.rows[0].diffPct + 2.2) < 0.1, `${check.rows[0].diffPct}`);
  assert.ok(Math.abs(check.rows[0].traceFps - 58.67) < 0.01);
});

test('fails a phase the display drew 10 % fewer frames than the recorder counted', () => {
  const check = compareRecorder(drawTimes(draws(100, 103, 162)), [phase()]);
  assert.equal(check.ok, false);
  assert.ok(Math.abs(check.worstPct + 10) < 0.1);
  assert.equal(check.rows[0].ok, false);
});

test('fails on more draws than frames too: the recorder missed frames', () => {
  const check = compareRecorder(drawTimes(draws(100, 103, 200)), [phase()]);
  assert.equal(check.ok, false);
  assert.ok(check.worstPct > 3);
});

test('counts the draws inside the window only', () => {
  const events = [...draws(90, 100, 600), ...draws(100, 103, 180), ...draws(103, 110, 420)];
  const check = compareRecorder(drawTimes(events), [phase()]);
  assert.equal(check.rows[0].traceFps, 60);
  assert.equal(check.ok, true);
});

test('compares the gesture phases only: a still phase has nothing to draw', () => {
  const check = compareRecorder(drawTimes(draws(100, 103, 180)), [
    phase({ phase: 'idle' }),
    phase({ phase: 'zoomed-out' }),
    phase({ phase: 'soak-3' }),
    phase({ phase: 'zoom', fromS: 100, toS: 103 }),
  ]);
  assert.deepEqual(
    check.rows.map((row) => row.phase),
    ['zoom'],
  );
});

test('leaves out a phase with no window or only part of one', () => {
  const check = compareRecorder(drawTimes(draws(100, 103, 180)), [
    phase({ fromS: undefined, toS: undefined }),
    phase({ partial: true }),
    phase(),
  ]);
  assert.equal(check.compared, 1);
});

test('says nothing was checked, rather than passing, where no phase could be compared', () => {
  const check = compareRecorder(drawTimes([]), [phase({ phase: 'idle' })]);
  assert.equal(check.ok, null);
  assert.equal(check.compared, 0);
});

test('fails a phase in which the display drew nothing', () => {
  const check = compareRecorder(drawTimes([]), [phase()]);
  assert.equal(check.ok, false);
  assert.equal(check.rows[0].traceFps, 0);
});

test('takes the tolerance from the caller', () => {
  const times = drawTimes(draws(100, 103, 176));
  assert.equal(compareRecorder(times, [phase()], 0.01).ok, false);
  assert.equal(compareRecorder(times, [phase()], 0.05).ok, true);
});

test('lists the phases of the steps a traced run measured, with their windows', () => {
  const steps = [
    {
      step: 0,
      level: 1,
      phases: {
        idle: { fps: 60, cdp: { fromS: 1, toS: 4 } },
        pan: { fps: 59, cdp: { fromS: 4, toS: 7 }, partial: true },
        zoom: { fps: 58 },
      },
    },
  ];
  assert.deepEqual(tracedPhases(steps), [
    { step: 0, level: 1, phase: 'idle', fps: 60, fromS: 1, toS: 4 },
    { step: 0, level: 1, phase: 'pan', fps: 59, fromS: 4, toS: 7, partial: true },
    { step: 0, level: 1, phase: 'zoom', fps: 58, fromS: undefined, toS: undefined },
  ]);
});

test('reads the trace as the browser hands it over, a JSON string or a buffer of one', () => {
  const trace = JSON.stringify({ traceEvents: draws(100, 103, 180) });
  for (const raw of [trace, Buffer.from(trace)]) {
    const check = checkRecorderAgainstTrace(raw, [phase()]);
    assert.equal(check.ok, true);
  }
  const bare = JSON.stringify(draws(100, 103, 180));
  assert.equal(checkRecorderAgainstTrace(bare, [phase()]).ok, true);
});

test('says a trace it cannot read, instead of passing it', () => {
  assert.throws(() => checkRecorderAgainstTrace('{', [phase()]), /trace/i);
  assert.throws(() => checkRecorderAgainstTrace('{"x":1}', [phase()]), /trace events/i);
});

test('says nothing of a run that passed, and names the worst phase of one that did not', () => {
  const passed = compareRecorder(drawTimes(draws(100, 103, 180)), [phase()]);
  assert.equal(recorderCheckWarning('kit A r0', passed), null);

  const failed = compareRecorder(drawTimes(draws(100, 103, 162)), [phase({ step: 2 })]);
  const warning = recorderCheckWarning('kit A r0', failed);
  assert.match(warning, /^kit A r0: the recorder and the trace disagree by more than 3 %/);
  assert.match(warning, /step 2 pan, 60\.0 fps recorded against 54\.0 drawn/);
});

test('calls a check that compared nothing unvalidated, not passed', () => {
  const none = compareRecorder(drawTimes([]), []);
  assert.match(recorderCheckWarning('kit A r0', none), /could not be checked.*unvalidated/);
});
