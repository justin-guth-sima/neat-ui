import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import {
  createWatchdog,
  stepLimitMs,
  runLimitMs,
  withTimeout,
  WatchdogExpired,
} from './watchdog.mjs';

test('allows a step three times its planned time and a margin for what the page cannot count', () => {
  assert.equal(stepLimitMs(13_000), 3 * 13_000 + 30_000);
});

test('allows a run its load and calibration, each step as planned with a margin, and one abort', () => {
  const planned = 13_000;
  const limit = runLimitMs({ plannedStepMs: planned, maxSteps: 6 });
  // Every step can take its planned time and 10 s of build and settling...
  assert.ok(limit >= 60_000 + 6 * (planned + 10_000));
  // ...but a run is bounded: it never waits more than one aborted step beyond that.
  assert.ok(limit <= 60_000 + 6 * (planned + 10_000) + 3 * planned);
});

test('grows with a soak’s ten minutes, which a fixed bound would cut short', () => {
  assert.ok(runLimitMs({ plannedStepMs: 603_000, maxSteps: 1 }) > 603_000);
});

test('expires when a step does not finish in its time, naming the step', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const dog = createWatchdog({ runMs: 1_000_000 });
    dog.step(5000, 'step 2');
    mock.timers.tick(4999);
    let expired = null;
    dog.expired.then((e) => (expired = e));
    await Promise.resolve();
    assert.equal(expired, null);
    mock.timers.tick(1);
    await Promise.resolve();
    assert.deepEqual(expired, { scope: 'step', label: 'step 2', ms: 5000 });
  } finally {
    mock.timers.reset();
  }
});

test('does not expire a step that finished, and a new step starts its own time', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const dog = createWatchdog({ runMs: 1_000_000 });
    let expired = null;
    dog.expired.then((e) => (expired = e));
    dog.step(5000, 'step 0');
    mock.timers.tick(4000);
    dog.stepDone();
    mock.timers.tick(10_000);
    dog.step(5000, 'step 1');
    mock.timers.tick(4000);
    await Promise.resolve();
    assert.equal(expired, null);
    mock.timers.tick(1000);
    await Promise.resolve();
    assert.equal(expired?.label, 'step 1');
  } finally {
    mock.timers.reset();
  }
});

test('expires the run at its limit whatever the steps do', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const dog = createWatchdog({ runMs: 8000 });
    let expired = null;
    dog.expired.then((e) => (expired = e));
    dog.step(5000, 'step 0');
    mock.timers.tick(5000 - 1);
    dog.step(5000, 'step 1');
    mock.timers.tick(3001);
    await Promise.resolve();
    assert.deepEqual(expired, { scope: 'run', label: 'run', ms: 8000 });
  } finally {
    mock.timers.reset();
  }
});

test('stops cleanly: nothing fires after, so the process can exit', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const dog = createWatchdog({ runMs: 100 });
    dog.step(50, 'step 0');
    dog.stop();
    let expired = null;
    dog.expired.then((e) => (expired = e));
    mock.timers.tick(1000);
    await Promise.resolve();
    assert.equal(expired, null);
  } finally {
    mock.timers.reset();
  }
});

test('bounds a promise: it passes the value, or rejects naming what it waited for', async () => {
  assert.equal(await withTimeout(Promise.resolve(3), 50, 'sample'), 3);
  await assert.rejects(
    withTimeout(new Promise(() => undefined), 20, 'CDP sample'),
    (error) => error instanceof WatchdogExpired && /CDP sample/.test(error.message),
  );
  await assert.rejects(withTimeout(Promise.reject(new Error('boom')), 50, 'x'), /boom/);
});
