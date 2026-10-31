import { TestBed } from '@angular/core/testing';
import type { DiagramTransform } from '@bench/diagram-seam';
import type { BenchHost } from '../hosts/bench-host';
import { BenchLoad } from '../hosts/bench-load';
import { DotProbeBuffer } from '../measure/dot-probe';
import { FakeFrames } from '../measure/fake-frames.testing';
import { type AutoDeps, runAuto } from './auto-run';
import type { LoafPort } from './phase-driver';
import { readMachine } from './machine-info';

const HZ60 = 1000 / 60;
const START: DiagramTransform = { k: 0.8, x: 100, y: 50 };

function deps(over: Partial<AutoDeps> = {}) {
  const frames = new FakeFrames();
  const log: string[] = [];
  const host: BenchHost = {
    id: 'kit',
    gestures: {
      rect: () => ({ left: 0, top: 0, width: 1920, height: 1080 }),
      transform: () => START,
      press: () => undefined,
      drag: () => undefined,
      release: () => undefined,
      wheel: () => undefined,
    },
    startTransform: () => START,
    fit: () => undefined,
  };
  const loaf: LoafPort & { start(): void; stop(): void } = {
    source: 'long-animation-frame',
    lost: 0,
    start: () => log.push('loaf start'),
    stop: () => log.push('loaf stop'),
    reset: () => undefined,
    summarize: () => ({
      source: 'long-animation-frame',
      frames: 0,
      totalMs: 0,
      largestMs: 0,
      blockingTotalMs: 0,
      blockingLargestMs: 0,
      scriptMs: 0,
      styleLayoutMs: 0,
      styleLayoutShare: null,
      scripts: [],
    }),
  };
  const all: AutoDeps = {
    params: {
      host: 'kit',
      ladder: 'B',
      seed: 3,
      steps: 2,
      machine: 'test-rig',
      refine: false,
    },
    scheduler: frames,
    loaf,
    probe: new DotProbeBuffer(1024),
    maxDots: 5000,
    load: TestBed.inject(BenchLoad),
    showHost: async (id) => {
      log.push(`show ${id}`);
      return host;
    },
    machine: (hz) => readMachine('test-rig', hz),
    clock: () => frames.now,
    now: () => new Date('2026-10-31T10:00:00.000Z'),
    ...over,
  };
  return { all, frames, log };
}

/** Runs frames until the promise settles (the run is driven by the frames the test supplies). */
async function drive<T>(frames: FakeFrames, run: Promise<T>, ms = HZ60): Promise<T> {
  let settled = false;
  const watched = run.finally(() => (settled = true));
  for (let i = 0; i < 200000 && !settled; i++) {
    frames.frame(ms);
    // Let the run's continuations (the calibration, the host, the machine) take their turn.
    await Promise.resolve();
    await Promise.resolve();
  }
  return watched;
}

describe('runAuto', () => {
  it('calibrates on the empty page, shows the host, climbs the steps and compiles the run', async () => {
    const { all, frames, log } = deps();
    const run = await drive(frames, runAuto(all));

    // The page was empty while it calibrated: the host is shown after, and the layer was watching
    // from the start.
    expect(log.indexOf('loaf start')).toBeLessThan(log.indexOf('show kit'));
    expect(log).toContain('loaf stop');
    expect(run.schema).toBe(1);
    expect(run.runId).toMatch(/kit-B/);
    expect(run.startedAt).toBe('2026-10-31T10:00:00.000Z');
    expect(run.machine).toMatchObject({ label: 'test-rig', refreshHz: 60 });
    expect(run.measurement.refresh.hz).toBe(60);
    expect(run.config).toMatchObject({
      seed: 3,
      ladders: ['B'],
      renderers: ['kit'],
      input: 'page',
    });
    expect(run.steps.map((step) => [step.level, step.step])).toEqual([
      [50, 0],
      [100, 1],
    ]);
    expect(run.end).toBe('cap');
    for (const step of run.steps) {
      expect(Object.keys(step.phases)).toEqual(['idle', 'pan', 'zoom', 'zoomed-out']);
      expect(step.outcome?.tier).toBe('smooth');
      expect(step.phases['idle'].fps).toBeCloseTo(60, 0);
    }
  });

  it('says it ran as a development build, which is what the specs are, and warns of it', async () => {
    const { all, frames } = deps();
    const run = await drive(frames, runAuto(all));
    expect(run.bench.build).toBe('development');
    expect(run.warnings.join('\n')).toMatch(/development build/);
  });

  it('has a result that is JSON as it stands', async () => {
    const { all, frames } = deps();
    const run = await drive(frames, runAuto(all));
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });

  it('measures at the refresh it calibrated, not at 60 Hz', async () => {
    const { all, frames } = deps();
    const run = await drive(frames, runAuto(all), 1000 / 30);
    expect(run.measurement.refresh.hz).toBe(30);
    expect(run.machine.refreshHz).toBe(30);
    // A 30 Hz display delivering every frame is smooth, not 50 % dropped.
    expect(run.steps[0].outcome?.tier).toBe('smooth');
  });

  it('refuses ladder E on a host other than the kit, before it touches the page', async () => {
    const { all, log } = deps();
    await expect(
      runAuto({ ...all, params: { ...all.params, ladder: 'E', host: 'vflow' } }),
    ).rejects.toThrow(/kit only/);
    expect(log).toEqual([]);
  });

  it('refuses to measure a page whose frames are too few to calibrate on', async () => {
    const { all, frames } = deps();
    // One long frame covers the whole calibration window: the tab is throttled or hidden.
    const run = runAuto(all);
    const settled = run.then(
      () => 'ran',
      (error: Error) => error.message,
    );
    frames.frame(HZ60);
    frames.frame(2500);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    await expect(settled).resolves.toMatch(/cannot calibrate/);
  });
});
