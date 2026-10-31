import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkRecorderAgainstTrace,
  compareRecorder,
  recorderCheckWarning,
  drawTimes,
  presentedRates,
  tracedPhases,
  withPresentedFps,
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

test('calls a phase in which the display drew nothing unreadable, not a recorder failure', () => {
  // A Chromium that renamed the event, or a trace without `viz`, would otherwise read as -100 %.
  const check = compareRecorder(drawTimes(draws(100, 103, 180)), [
    phase(),
    phase({ step: 1, fromS: 200, toS: 203 }),
  ]);

  assert.equal(check.ok, true);
  assert.equal(check.compared, 1);
  assert.equal(check.unreadable, 1);
  assert.deepEqual(
    check.rows.map((row) => [row.step, row.unreadable ?? false]),
    [
      [0, false],
      [1, true],
    ],
  );
  assert.equal(check.worstPct, 0);
});

test('checks nothing, rather than failing, where the trace holds no display draw at all', () => {
  const check = compareRecorder(drawTimes([]), [phase(), phase({ phase: 'zoom' })]);

  assert.equal(check.ok, null);
  assert.equal(check.compared, 0);
  assert.equal(check.unreadable, 2);
  assert.match(recorderCheckWarning('kit A r0', check), /no display draws.*2 gesture phases/);
  assert.doesNotMatch(recorderCheckWarning('kit A r0', check), /disagree/);
});

test('allows a short phase one draw either way, which is more than 3 % of it', () => {
  // 2 s at 12 fps is 24 frames: one draw is 4.2 %.
  const short = phase({ fps: 12, fromS: 100, toS: 102 });
  const oneShort = compareRecorder(drawTimes(draws(100, 102, 23)), [short]);
  const twoShort = compareRecorder(drawTimes(draws(100, 102, 22)), [short]);

  assert.equal(oneShort.ok, true);
  assert.equal(twoShort.ok, false);
  assert.ok(Math.abs(oneShort.rows[0].allowedPct - 100 / 24) < 0.01);
});

test('keeps the 3 % bound where one draw is less than that', () => {
  const check = compareRecorder(drawTimes(draws(100, 103, 180)), [phase()]);
  assert.equal(check.rows[0].allowedPct, 3);
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
      params: { msgsPerSec: 0 },
      phases: {
        idle: { fps: 60, cdp: { fromS: 1, toS: 4 } },
        pan: { fps: 59, cdp: { fromS: 4, toS: 7 }, partial: true },
        zoom: { fps: 58 },
      },
    },
  ];
  assert.deepEqual(tracedPhases(steps), [
    { step: 0, level: 1, phase: 'idle', fps: 60, fromS: 1, toS: 4, moving: false },
    { step: 0, level: 1, phase: 'pan', fps: 59, fromS: 4, toS: 7, moving: false, partial: true },
    { step: 0, level: 1, phase: 'zoom', fps: 58, fromS: undefined, toS: undefined, moving: false },
  ]);
});

test('marks every phase of a step with messages in flight as one whose view changes', () => {
  const steps = [
    { step: 2, level: 800, params: { msgsPerSec: 800 }, phases: { idle: { fps: 60 } } },
  ];
  assert.equal(tracedPhases(steps)[0].moving, true);
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

test('does not check the none host: it draws nothing the gestures move', () => {
  const trace = JSON.stringify({ traceEvents: [] });

  const check = checkRecorderAgainstTrace(trace, [phase()], { renderer: 'none' });

  assert.equal(check.ok, null);
  assert.equal(check.compared, 0);
  assert.match(check.skipped, /none host.*draws nothing/);
  assert.equal(recorderCheckWarning('none A r0', check), null);
});

test('checks the renderers that draw, with a tolerance if one is given', () => {
  const trace = JSON.stringify({ traceEvents: draws(100, 103, 176) });

  assert.equal(checkRecorderAgainstTrace(trace, [phase()], { renderer: 'kit' }).ok, true);
  assert.equal(
    checkRecorderAgainstTrace(trace, [phase()], { renderer: 'vflow', tolerance: 0.01 }).ok,
    false,
  );
});

test('gives the presented rate of the phases whose view changes every frame', () => {
  // idle has no messages here, so the display may rightly draw nothing in it.
  const times = drawTimes([...draws(100, 103, 150), ...draws(103, 106, 90)]);
  const phases = [
    phase({ phase: 'pan' }),
    phase({ phase: 'zoom', fromS: 103, toS: 106 }),
    phase({ phase: 'idle', fromS: 106, toS: 109 }),
  ];

  const { rates, unreadable } = presentedRates(times, phases, { renderer: 'vflow' });

  assert.deepEqual(rates, [
    { step: 0, phase: 'pan', presentedFps: 50 },
    { step: 0, phase: 'zoom', presentedFps: 30 },
  ]);
  assert.equal(unreadable, 0);
});

test('gives every phase of a step with messages in flight a presented rate, the none host too', () => {
  const times = drawTimes(draws(100, 109, 400));
  const phases = [
    phase({ phase: 'idle', moving: true, fromS: 100, toS: 103 }),
    phase({ phase: 'pan', moving: true, fromS: 103, toS: 106 }),
    phase({ phase: 'soak-1', moving: true, fromS: 106, toS: 109 }),
  ];

  for (const renderer of ['kit', 'none']) {
    const { rates } = presentedRates(times, phases, { renderer });
    // The none host draws no gesture, but its dots move: only the phases with messages count.
    assert.deepEqual(
      rates.map((rate) => rate.phase),
      ['idle', 'pan', 'soak-1'],
    );
  }
});

test('takes no presented rate of the none host’s gestures where nothing is in flight', () => {
  const times = drawTimes(draws(100, 103, 180));
  const { rates } = presentedRates(times, [phase()], { renderer: 'none' });
  assert.deepEqual(rates, []);
});

test('gives no presented rate where the display drew nothing in the phase or it was cut short', () => {
  const times = drawTimes(draws(100, 103, 180));
  const { rates, unreadable } = presentedRates(
    times,
    [
      phase({ phase: 'pan', fromS: 200, toS: 203 }),
      phase({ phase: 'zoom', partial: true }),
      phase({ phase: 'zoom', fromS: undefined, toS: undefined }),
    ],
    { renderer: 'kit' },
  );

  assert.deepEqual(rates, []);
  // One phase had a window and no draw; the cut short and the unwindowed are not the trace's fault.
  assert.equal(unreadable, 1);
});

test('lays the presented rates over the steps’ phases, by step and phase, and nothing else', () => {
  const steps = [
    { step: 0, level: 1, phases: { pan: { fps: 60 }, idle: { fps: 60 } } },
    { step: 1, level: 2, phases: { pan: { fps: 55 } } },
  ];

  const out = withPresentedFps(steps, [
    { step: 0, phase: 'pan', presentedFps: 58.5 },
    { step: 1, phase: 'pan', presentedFps: 41 },
  ]);

  assert.deepEqual(out[0].phases, { pan: { fps: 60, presentedFps: 58.5 }, idle: { fps: 60 } });
  assert.equal(out[1].phases.pan.presentedFps, 41);
  assert.equal(steps[0].phases.pan.presentedFps, undefined, 'the steps given are not changed');
});
