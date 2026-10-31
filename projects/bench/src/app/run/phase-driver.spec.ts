import { DotProbeBuffer } from '../measure/dot-probe';
import { FakeFrames } from '../measure/fake-frames.testing';
import { FrameRecorder } from '../measure/frame-recorder';
import type { LoafSummary } from '../measure/loaf-collector';
import { frameStats } from '../measure/stats';
import {
  gestureFor,
  type DriverHost,
  frameCapacity,
  type GesturePlayerPort,
  type LoafPort,
  PhaseDriver,
} from './phase-driver';
import type { LadderPlan } from './step-machine';

const HZ60 = 1000 / 60;
const REFRESH = { hz: 60, intervalMs: HZ60, measuredMs: HZ60 };
const MAX_DOTS = 5000;
/** Half a frame of slack, so a start 'n frames on' is not missed by float accumulation. */
const SLACK_MS = 1;

const PLAN: LadderPlan = {
  levels: [1, 2, 3],
  phases: [
    { name: 'idle', ms: 200 },
    { name: 'pan', ms: 200 },
  ],
  warmupMs: 100,
  refine: false,
  stopFps: 15,
};

const NO_LOAF: LoafSummary = {
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
};

/** Everything the driver touches, as fakes that keep a log of what happened, in order. */
function rig(plan: LadderPlan = PLAN, options: { buildFrames?: number; fitFrames?: number } = {}) {
  const frames = new FakeFrames();
  const log: string[] = [];
  /** The clock time from which the fake view shows its start transform. */
  let startAt = 0;
  const buildDelay = (options.buildFrames ?? 2) * HZ60;
  const fitDelay = (options.fitFrames ?? 3) * HZ60;

  const player: GesturePlayerPort = {
    begin: (phase, now, ms) => log.push(`begin ${phase} ${ms}`),
    frame: () => undefined,
    end: () => log.push('end'),
  };
  const host: DriverHost = {
    apply: (level) => {
      log.push(`apply ${level}`);
      startAt = frames.now + buildDelay - SLACK_MS;
    },
    atStart: () => frames.now >= startAt,
    fit: () => {
      log.push('fit');
      startAt = frames.now + fitDelay - SLACK_MS;
    },
    player: () => player,
    params: (level) => ({ blocks: 30 * level, edges: 36 * level, notes: 8, msgsPerSec: 100 }),
    transform: () => ({ k: 0.8, x: 1, y: 2 }),
    domNodes: () => 1234,
  };
  const loaf: LoafPort = {
    source: 'long-animation-frame',
    lost: 0,
    reset: () => log.push('loaf reset'),
    summarize: (from, to) => {
      log.push(`loaf ${Math.round(to - from)}`);
      return NO_LOAF;
    },
  };
  const probe = new DotProbeBuffer(1024);
  const recorder = new FrameRecorder({
    scheduler: frames,
    capacity: frameCapacity(plan),
    onFrame: (t) => driver.frame(t),
  });
  const driver: PhaseDriver = new PhaseDriver({
    plan,
    ladder: 'B',
    renderer: 'kit',
    repeat: 0,
    recorder,
    loaf,
    probe,
    maxDots: MAX_DOTS,
    refresh: REFRESH,
    host,
    clock: () => frames.now,
    settleFrames: 30,
  });
  const start = () => {
    recorder.start();
    driver.start(frames.now);
  };
  /** Frames of `ms` until the driver is done, or `limit` frames have passed. */
  const finish = (ms = HZ60, limit = 20000) => {
    for (let i = 0; i < limit && !driver.finished; i++) frames.frame(ms);
  };
  return { frames, log, recorder, driver, probe, start, finish, host };
}

describe('PhaseDriver', () => {
  it('climbs every level in order, each judged once, and ends at the cap', () => {
    const { driver, start, finish, log } = rig();
    start();
    finish();

    expect(driver.finished).toBe(true);
    expect(driver.end).toBe('cap');
    expect(driver.steps.map((step) => [step.step, step.level])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ]);
    expect(log.filter((line) => line.startsWith('apply'))).toEqual([
      'apply 1',
      'apply 2',
      'apply 3',
    ]);
  });

  it('measures the build from the frame that applies the step to the frame after the start is seen', () => {
    const { driver, start, finish } = rig(PLAN, { buildFrames: 3 });
    start();
    finish();

    // Applied on the first frame; the view shows its start 3 frames later, that frame sees it and
    // the one after it ends the build: 4 frames. Every step builds the same way here.
    for (const step of driver.steps) expect(step.buildMs).toBeCloseTo(4 * HZ60, 6);
  });

  it('applies each step once', () => {
    const { host, start, finish } = rig();
    const apply = vi.spyOn(host, 'apply');
    start();
    finish();
    expect(apply.mock.calls).toEqual([[1], [2], [3]]);
  });

  it('records the transform the step started at, and the page’s size', () => {
    const { driver, start, finish } = rig();
    start();
    finish();
    for (const step of driver.steps) {
      expect(step.startTransform).toEqual({ k: 0.8, x: 1, y: 2 });
      expect(step.dom).toEqual({ nodes: 1234 });
    }
    expect(driver.steps[1].params).toEqual({ blocks: 60, edges: 72, notes: 8, msgsPerSec: 100 });
    expect(driver.steps[0]).toMatchObject({ renderer: 'kit', ladder: 'B', repeat: 0 });
  });

  it('starts each phase on the frame that ends the one before and plays its gesture', () => {
    const { driver, start, finish, log } = rig();
    start();
    finish();

    const first = log.slice(log.indexOf('apply 1'), log.indexOf('apply 2'));
    expect(first.filter((line) => line.startsWith('begin') || line === 'end')).toEqual([
      'begin idle 200',
      'end',
      'begin pan 200',
      'end',
    ]);
    expect(Object.keys(driver.steps[0].phases)).toEqual(['idle', 'pan']);
  });

  it('puts the step’s view back at its start before the next step is applied', () => {
    const { start, finish, log } = rig();
    start();
    finish();

    const between = log.slice(
      log.indexOf('end', log.indexOf('begin pan 200')),
      log.indexOf('apply 2'),
    );
    expect(between).toContain('fit');
  });

  it('takes each phase’s statistics over its real window, not its planned time', () => {
    const { driver, start, frames, recorder } = rig();
    start();
    // Level 1: a long frame inside the idle phase stretches it.
    let stretched = false;
    for (let i = 0; i < 20000 && !driver.finished; i++) {
      const inIdle = driver.stage === 'phase:idle' && driver.steps.length === 0;
      if (inIdle && !stretched && recorder.frames > 5) {
        frames.frame(300);
        stretched = true;
      } else {
        frames.frame(HZ60);
      }
    }
    expect(stretched).toBe(true);

    const idle = driver.steps[0].phases['idle'];
    // The phase ran past its 200 ms by the 300 ms frame; its fps is its frames over that span.
    expect(idle.worst).toBeCloseTo(300, 6);
    const planned = frameStats([...Array(idle.frames).fill(HZ60)], 200, HZ60).fps;
    expect(idle.fps).toBeLessThan(planned);
    expect(idle.fps).toBeCloseTo((idle.frames * 1000) / ((idle.frames - 1) * HZ60 + 300), 0);
  });

  it('summarises the long frames of each phase over the phase’s own window', () => {
    const { driver, start, finish, log } = rig();
    start();
    finish();
    const loafs = log.filter((line) => line.startsWith('loaf ') && line !== 'loaf reset');
    // Two phases per step, three steps, each window about the phase's 200 ms.
    expect(loafs).toHaveLength(6);
    for (const line of loafs) expect(Number(line.slice(5))).toBeGreaterThanOrEqual(200);
    expect(driver.steps[0].phases['idle'].loaf?.count).toBe(0);
  });

  it('reports the dots each phase drew, the step keeping the busiest phase’s numbers', () => {
    const { driver, start, frames, probe } = rig();
    start();
    // The layer draws once a frame: more dots in the later phase.
    const draw = () => probe.record(1.5, driver.stage === 'phase:pan' ? 800 : 300);
    for (let i = 0; i < 20000 && !driver.finished; i++) {
      draw();
      frames.frame(HZ60);
    }
    expect(driver.steps[0].dots).toMatchObject({ drawnMax: 800, drawP50: 1.5, capped: false });
  });

  it('marks a step capped when the layer drew as many dots as it ever does', () => {
    const { driver, start, frames, probe } = rig();
    start();
    for (let i = 0; i < 20000 && !driver.finished; i++) {
      probe.record(2, MAX_DOTS);
      frames.frame(HZ60);
    }
    expect(driver.steps[0].dots?.capped).toBe(true);
  });

  it('gives each step an outcome the stop rule can judge', () => {
    const { driver, start, finish } = rig();
    start();
    finish();
    expect(driver.steps[0].outcome?.tier).toBe('smooth');
    expect(driver.steps[0].outcome?.meanFps).toBeCloseTo(60, 0);
  });

  it('stops the climb on a step under the stop fps, and records that step', () => {
    const { driver, start, finish } = rig(PLAN);
    start();
    // 8 fps frames throughout (125 ms): the median frame is over 100 ms.
    finish(125);
    expect(driver.end).toBe('stop-rule');
    expect(driver.steps).toHaveLength(1);
  });

  it('aborts a step whose view never reaches its start, and ends there', () => {
    const { driver, start, finish, host } = rig();
    host.atStart = () => false;
    start();
    finish();

    expect(driver.end).toBe('unresponsive');
    expect(driver.steps).toHaveLength(1);
    expect(driver.steps[0]).toMatchObject({ aborted: 'unresponsive', phases: {} });
    expect(driver.steps[0].buildMs).toBeUndefined();
  });

  it('goes on after a step’s view fails to come back, with a warning, and does not wait forever', () => {
    const { driver, start, finish, host, frames } = rig();
    // It comes to its start when a step is applied, never when asked to fit.
    let startAt = 0;
    host.apply = () => (startAt = frames.now + 2 * HZ60 - SLACK_MS);
    host.fit = () => (startAt = Infinity);
    host.atStart = () => frames.now >= startAt;
    start();
    finish();

    expect(driver.end).toBe('cap');
    expect(driver.steps).toHaveLength(3);
    expect(driver.warnings.join('\n')).toMatch(/step 0.*start/i);
  });

  it('does not run the host’s gestures for a phase it has no gesture for', () => {
    expect(gestureFor('idle')).toBe('idle');
    expect(gestureFor('pan')).toBe('pan');
    expect(gestureFor('zoom')).toBe('zoom');
    expect(gestureFor('zoomed-out')).toBe('zoomed-out');
    expect(gestureFor('soak-7')).toBe('idle');
    expect(() => gestureFor('swirl')).toThrow(/swirl/);
  });

  it('holds a step’s frames in a buffer sized for the step and its abort limit', () => {
    // 13 s planned, aborted at 3×, at the fastest displays: far under the recorder's default.
    expect(frameCapacity(PLAN)).toBeGreaterThan((3 * 500 * 144) / 1000);
    const soak: LadderPlan = { ...PLAN, phases: [{ name: 'soak-1', ms: 600_000 }] };
    expect(frameCapacity(soak)).toBeGreaterThan(3 * 600 * 144);
  });

  it('is told once to start, and says when it is done', () => {
    const { driver, start, finish } = rig();
    start();
    expect(() => driver.start(0)).toThrow();
    finish();
    expect(driver.finished).toBe(true);
  });
});
