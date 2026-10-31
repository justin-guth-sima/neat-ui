import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBoundaryRecorder, diffMetrics, toMap } from './metrics.mjs';

const sample = (over = {}) => ({
  Timestamp: 100,
  TaskDuration: 1,
  ScriptDuration: 0.5,
  RecalcStyleDuration: 0.1,
  LayoutDuration: 0.2,
  RecalcStyleCount: 10,
  LayoutCount: 5,
  Nodes: 400,
  JSHeapUsedSize: 5_000_000,
  JSEventListeners: 60,
  ...over,
});

test('turns CDP’s list of name and value into a map', () => {
  assert.deepEqual(
    toMap([
      { name: 'Timestamp', value: 12.5 },
      { name: 'Nodes', value: 3 },
    ]),
    { Timestamp: 12.5, Nodes: 3 },
  );
});

test('diffs two samples into a phase’s script, style, layout and busy share', () => {
  const cdp = diffMetrics(
    sample(),
    sample({
      Timestamp: 103,
      TaskDuration: 2.5,
      ScriptDuration: 1.4,
      RecalcStyleDuration: 0.4,
      LayoutDuration: 0.5,
      RecalcStyleCount: 70,
      LayoutCount: 35,
    }),
  );
  assert.equal(cdp.wallMs, 3000);
  assert.equal(cdp.taskMs, 1500);
  assert.ok(Math.abs(cdp.scriptMs - 900) < 1e-9);
  assert.ok(Math.abs(cdp.styleMs - 300) < 1e-9);
  assert.ok(Math.abs(cdp.layoutMs - 300) < 1e-9);
  assert.equal(cdp.busyShare, 0.5);
  assert.equal(cdp.styleCount, 60);
  assert.equal(cdp.layoutCount, 30);
});

test('has no busy share where no time passed between the samples', () => {
  assert.equal(diffMetrics(sample(), sample()).busyShare, null);
});

/** A recorder over samples that count up, with the events of one two-phase step. */
function rig(options = {}) {
  let n = 0;
  const calls = [];
  const recorder = createBoundaryRecorder({
    sample: async () => {
      const mine = ++n;
      calls.push(`sample ${mine}`);
      // The first sample is slow: a later one must not be taken, or recorded, before it.
      if (mine === 1) await new Promise((resolve) => setTimeout(resolve, 15));
      if (options.failOn === mine) throw new Error('no answer');
      return sample({
        Timestamp: 100 + mine,
        TaskDuration: 1 + mine * 0.5,
        JSHeapUsedSize: 1000 * mine,
      });
    },
    domCounters: async () => ({ nodes: 321, jsEventListeners: 45 }),
  });
  return { recorder, calls };
}

const steps = () => [
  {
    step: 0,
    dom: { nodes: 400 },
    phases: { idle: { fps: 60 }, pan: { fps: 59 } },
  },
];

test('samples at each phase’s start and end, in the order the events came', async () => {
  const { recorder, calls } = rig();
  recorder.handle({ type: 'phase-begin', step: 0, phase: 'idle' });
  recorder.handle({ type: 'phase-end', step: 0, phase: 'idle' });
  recorder.handle({ type: 'phase-begin', step: 0, phase: 'pan' });
  recorder.handle({ type: 'phase-end', step: 0, phase: 'pan' });
  await recorder.settle();
  assert.deepEqual(calls, ['sample 1', 'sample 2', 'sample 3', 'sample 4']);

  const [step] = recorder.applyTo(steps());
  assert.equal(step.phases.idle.cdp.wallMs, 1000);
  assert.equal(step.phases.idle.cdp.taskMs, 500);
  assert.equal(step.phases.idle.cdp.busyShare, 0.5);
  assert.equal(step.phases.pan.cdp.wallMs, 1000);
  assert.equal(step.phases.idle.fps, 60);
});

test('adds the step’s DOM counters and heap at its end, beside the page’s own count', async () => {
  const { recorder } = rig();
  recorder.handle({ type: 'step-end', step: 0, result: { step: 0 } });
  await recorder.settle();
  const [step] = recorder.applyTo(steps());
  assert.deepEqual(step.dom, { nodes: 400, cdpNodes: 321, listeners: 45 });
  assert.equal(step.heapBytes, 1000);
});

test('ends a phase an abort cut short at the step’s end and says it is partial', async () => {
  const { recorder } = rig();
  recorder.handle({ type: 'phase-begin', step: 0, phase: 'idle' });
  recorder.handle({ type: 'phase-end', step: 0, phase: 'idle' });
  recorder.handle({ type: 'phase-begin', step: 0, phase: 'pan' });
  recorder.handle({ type: 'step-end', step: 0, result: { step: 0, aborted: 'unresponsive' } });
  await recorder.settle();
  const [step] = recorder.applyTo(steps());
  assert.ok(step.phases.pan.cdp);
  assert.equal(step.phases.pan.cdp.partial, true);
  assert.equal(step.phases.idle.cdp.partial, undefined);
});

test('leaves a phase without CDP numbers where its sample failed, and says so, without stopping', async () => {
  const { recorder } = rig({ failOn: 2 });
  recorder.handle({ type: 'phase-begin', step: 0, phase: 'idle' });
  recorder.handle({ type: 'phase-end', step: 0, phase: 'idle' });
  recorder.handle({ type: 'phase-begin', step: 0, phase: 'pan' });
  recorder.handle({ type: 'phase-end', step: 0, phase: 'pan' });
  await recorder.settle();
  const [step] = recorder.applyTo(steps());
  assert.equal(step.phases.idle.cdp, undefined);
  assert.ok(step.phases.pan.cdp);
  assert.equal(recorder.warnings.length, 1);
  assert.match(recorder.warnings[0], /phase-end.*idle.*no answer/);
});

test('ignores the events it has no use for', async () => {
  const { recorder, calls } = rig();
  recorder.handle({ type: 'run-begin' });
  recorder.handle({ type: 'step-begin', step: 0, level: 1 });
  recorder.handle({ type: 'run-end' });
  await recorder.settle();
  assert.deepEqual(calls, []);
});

test('keeps what it recorded for a step whose result the page never delivered', async () => {
  const { recorder } = rig();
  recorder.handle({ type: 'phase-begin', step: 4, phase: 'idle' });
  recorder.handle({ type: 'phase-end', step: 4, phase: 'idle' });
  await recorder.settle();
  const out = recorder.applyTo([{ step: 0, phases: {} }]);
  assert.deepEqual(out, [{ step: 0, phases: {} }]);
});
