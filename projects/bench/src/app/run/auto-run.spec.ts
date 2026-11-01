import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { DiagramTransform } from '@bench/diagram-seam';
import type { BenchHost } from '../hosts/bench-host';
import { BenchLoad, feedMessages, type MessageLayer } from '../hosts/bench-load';
import { DotProbeBuffer } from '../measure/dot-probe';
import { FakeFrames } from '../measure/fake-frames.testing';
import { type AutoDeps, runAuto } from './auto-run';
import { ladderStep } from './ladders';
import type { BenchEvent } from './bench-bridge';
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
      input: 'page',
      repeat: 0,
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

/** Counts what the host's dot layer is asked to draw. */
class CountingLayer implements MessageLayer {
  pushed = 0;
  push(): void {
    this.pushed++;
  }
}

@Component({ template: '' })
class Feeding {
  readonly layer = signal<MessageLayer | undefined>(undefined);
  constructor() {
    feedMessages(this.layer);
  }
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

  it('tells the harness what it will climb before it calibrates, then each boundary', async () => {
    const events: BenchEvent[] = [];
    const { all, frames } = deps({ events: (event) => events.push(event) });
    await drive(frames, runAuto(all));

    expect(events[0]).toEqual({
      type: 'run-begin',
      host: 'kit',
      ladder: 'B',
      repeat: 0,
      plannedStepMs: 13000,
      maxSteps: 2,
    });
    expect(events.filter((event) => event.type === 'step-end')).toHaveLength(2);
    expect(events.at(-1)?.type).toBe('step-end');
  });

  it('files the run under its repeat and the input that played its gestures', async () => {
    const { all, frames } = deps();
    const run = await drive(
      frames,
      runAuto({
        ...all,
        input: () => undefined,
        params: { ...all.params, repeat: 2, input: 'cdp' },
      }),
    );
    expect(run.config.input).toBe('cdp');
    expect(run.runId).toMatch(/kit-B-r2$/);
    expect(new Set(run.steps.map((step) => step.repeat))).toEqual(new Set([2]));
  });

  it('refuses input=cdp where nothing listens for the input, before it touches the page', async () => {
    const { all, log } = deps();
    await expect(runAuto({ ...all, params: { ...all.params, input: 'cdp' } })).rejects.toThrow(
      /needs the harness/,
    );
    expect(log).toEqual([]);
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

  describe('the start load (no host renders a load before the first step is applied)', () => {
    // Only the feed's interval is faked, as in the feed's own specs.
    beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }));
    afterEach(() => vi.useRealTimers());

    /**
     * Runs a climb with a real message feed behind a counting dot layer, created when the host is
     * shown as the page does; the feed's timer runs a second and a half at every boundary event.
     */
    async function runFed(ladder: 'A' | 'D', steps: number) {
      const { all, frames } = deps();
      const layer = new CountingLayer();
      const seen: { first: unknown; pushedAtShow: number }[] = [];
      let fixture: ReturnType<typeof TestBed.createComponent<Feeding>> | undefined;
      const run = await drive(
        frames,
        runAuto({
          ...all,
          params: { ...all.params, ladder, steps },
          showHost: async () => {
            fixture = TestBed.createComponent(Feeding);
            fixture.componentInstance.layer.set(layer);
            fixture.detectChanges();
            seen.push({ first: all.load.step(), pushedAtShow: layer.pushed });
            return (await all.showHost('kit')) as BenchHost;
          },
          events: () => {
            fixture?.detectChanges();
            vi.advanceTimersByTime(1500);
          },
        }),
      );
      fixture?.detectChanges();
      return { run, seen: seen[0], layer, load: all.load };
    }

    it('shows the host at the run’s first step, not at the default load', async () => {
      const { seen, run } = await runFed('A', 2);

      expect(seen.first).toEqual(ladderStep('A', run.steps[0].level, 3));
      expect(seen.first).toMatchObject({ msgsPerSec: 0 });
      expect(run.steps[0].level).toBe(0.125);
    });

    it('spawns no dot before or during the idle phase of a run whose first step has 0 msg/s', async () => {
      const { seen, layer, run } = await runFed('A', 2);

      expect(seen.pushedAtShow).toBe(0);
      expect(layer.pushed).toBe(0);
      expect(run.steps).toHaveLength(2);
    });

    it('does draw dots where the first step has messages (the feed is live in this test)', async () => {
      const { seen, layer } = await runFed('D', 1);

      expect(seen.first).toMatchObject({ msgsPerSec: 50 });
      expect(layer.pushed).toBeGreaterThan(0);
    });
  });
});
