import type { DotProbeStats } from '../measure/dot-probe';
import type { Refresh } from '../measure/frame-recorder';
import type { LoafSummary } from '../measure/loaf-collector';
import type { FrameStats } from '../measure/stats';
import {
  BUILD_DEFINITION,
  compileRun,
  type CompileInput,
  dotsResult,
  loafLimits,
  loafResult,
  NOT_COMPARABLE,
  phaseResult,
  refreshWarning,
  type StepResult,
} from './result';

const STATS: FrameStats = {
  frames: 600,
  fps: 60,
  p50: 16.7,
  p95: 17.5,
  p99: 20,
  worst: 33,
  dropped: 3,
  droppedPct: 0.5,
  janks: 1,
  stalls: 0,
};

const LOAF: LoafSummary = {
  source: 'long-animation-frame',
  frames: 2,
  totalMs: 180,
  largestMs: 120,
  blockingTotalMs: 130,
  blockingLargestMs: 70,
  scriptMs: 100,
  styleLayoutMs: 60,
  styleLayoutShare: 0.375,
  scripts: [
    {
      invoker: 'DIV.onclick',
      invokerType: 'event-listener',
      sourceURL: 'http://x/chunk-kit.js',
      sourceFunctionName: 'draw',
      sourceCharPosition: 42,
      count: 2,
      durationMs: 90,
      forcedStyleAndLayoutMs: 10,
    },
  ],
};

describe('phaseResult', () => {
  it('is the frame statistics as they are, with the long frames beside them', () => {
    expect(phaseResult(STATS, LOAF)).toEqual({ ...STATS, loaf: loafResult(LOAF) });
  });

  it('has no loaf entry for a window without a collector', () => {
    expect(phaseResult(STATS, undefined)).toEqual(STATS);
  });
});

describe('loafResult', () => {
  it('names the source, counts frames and totals, and keys the scripts by where they came from', () => {
    expect(loafResult(LOAF)).toEqual({
      source: 'long-animation-frame',
      count: 2,
      totalMs: 180,
      worstMs: 120,
      blockingMs: 130,
      styleLayoutMs: 60,
      topScripts: [{ key: 'draw http://x/chunk-kit.js:42', ms: 90 }],
    });
  });

  it('keeps what a long-task source cannot tell as null, never as 0 ms', () => {
    const result = loafResult({
      ...LOAF,
      source: 'longtask',
      blockingTotalMs: null,
      blockingLargestMs: null,
      scriptMs: null,
      styleLayoutMs: null,
      styleLayoutShare: null,
      scripts: [],
    });
    expect(result.blockingMs).toBeNull();
    expect(result.styleLayoutMs).toBeNull();
    expect(result.topScripts).toEqual([]);
  });

  it('keys an anonymous script by its invoker', () => {
    const [script] = LOAF.scripts;
    const result = loafResult({
      ...LOAF,
      scripts: [{ ...script, sourceFunctionName: '', sourceURL: '' }],
    });
    expect(result.topScripts[0].key).toBe('DIV.onclick');
  });
});

describe('dotsResult', () => {
  const draws = (over: Partial<DotProbeStats>): DotProbeStats => ({
    draws: 100,
    drawP50Ms: 1,
    drawP95Ms: 2,
    drawWorstMs: 5,
    dotsP50: 300,
    dotsMax: 400,
    capped: false,
    ...over,
  });

  it('is each statistic’s maximum over the phases, which need not come from the same phase', () => {
    expect(
      dotsResult([
        draws({ drawP50Ms: 3, dotsMax: 400 }),
        draws({ drawP50Ms: 1, dotsMax: 900 }),
      ]),
    ).toMatchObject({ drawP50: 3, drawnMax: 900 });
  });

  it('takes the busiest values, so quiet phases do not flatter a step', () => {
    expect(
      dotsResult([
        draws({}),
        draws({ drawP50Ms: 3, drawP95Ms: 4, drawWorstMs: 9, dotsP50: 500, dotsMax: 600 }),
      ]),
    ).toEqual({
      drawP50: 3,
      drawP95: 4,
      drawWorst: 9,
      drawnP50: 500,
      drawnMax: 600,
      capped: false,
    });
  });

  it('marks a step capped when any phase was', () => {
    expect(dotsResult([draws({}), draws({ capped: true })])?.capped).toBe(true);
  });

  it('has none when the layer drew nothing (no messages, or none drawn yet)', () => {
    const none = draws({
      draws: 0,
      drawP50Ms: null,
      drawP95Ms: null,
      drawWorstMs: null,
      dotsP50: null,
      dotsMax: null,
    });
    expect(dotsResult([none, none])).toBeUndefined();
  });
});

describe('refreshWarning', () => {
  const refresh = (measuredMs: number, hz: number): Refresh => ({
    hz,
    intervalMs: 1000 / hz,
    measuredMs,
  });

  it('is quiet where the measured interval is the snapped one, give or take the 59.94', () => {
    expect(refreshWarning(refresh(16.683, 60))).toBeNull();
    expect(refreshWarning(refresh(1000 / 30, 30))).toBeNull();
  });

  it('flags a measured refresh that the snap moved by more than 5 % of an interval', () => {
    const warning = refreshWarning(refresh(1000 / 45, 50));
    expect(warning).toMatch(/45\.0 Hz/);
    expect(warning).toMatch(/50 Hz/);
  });
});

describe('the notes a result carries', () => {
  it('defines the build time as the first frame after the start transform', () => {
    expect(BUILD_DEFINITION).toMatch(/first frame after the start transform/);
  });

  it('states the long-frame limits of the source the browser gave: long animation frames', () => {
    const text = loafLimits('long-animation-frame');
    expect(text).toMatch(/long animation frames/i);
    expect(text).toMatch(/50 ms/);
    expect(text).toMatch(/5 ms/);
    expect(text).not.toMatch(/longtask/i);
  });

  it('states them as long tasks where that is all the browser gave: no scripts, no split', () => {
    const text = loafLimits('longtask');
    expect(text).toMatch(/long tasks/i);
    expect(text).toMatch(/50 ms/);
    expect(text).toMatch(/no script/i);
  });

  it('says there is no long-frame data where the browser gave neither', () => {
    expect(loafLimits('none')).toMatch(/neither/i);
  });

  it('lists what the two renderers do not share, each item once', () => {
    expect(new Set(NOT_COMPARABLE).size).toBe(NOT_COMPARABLE.length);
    const all = NOT_COMPARABLE.join('\n').toLowerCase();
    for (const topic of [
      'z-order',
      'foreignobject',
      'resizeobserver',
      'one change-detection pass later',
      'handle',
      'hover',
      'hidden list',
    ]) {
      expect(all).toContain(topic);
    }
  });
});

describe('compileRun', () => {
  const step = (over: Partial<StepResult> = {}): StepResult => ({
    renderer: 'kit',
    ladder: 'B',
    step: 0,
    level: 50,
    refining: false,
    repeat: 0,
    params: { blocks: 30, edges: 36, notes: 8, msgsPerSec: 50 },
    buildMs: 40,
    startTransform: { k: 0.8, x: 1, y: 2 },
    phases: { idle: phaseResult(STATS, undefined) },
    ...over,
  });

  const input = (over: Partial<CompileInput> = {}): CompileInput => ({
    runId: 'r1',
    startedAt: '2026-10-31T10:00:00.000Z',
    machine: {
      label: 'laptop',
      ua: 'x',
      cores: 8,
      dpr: 1,
      screen: { w: 1920, h: 1080 },
      viewport: { w: 1920, h: 1080 },
      refreshHz: 60,
    },
    seed: 1,
    ladder: 'B',
    renderer: 'kit',
    plan: {
      levels: [50, 100],
      phases: [{ name: 'idle', ms: 3000 }],
      warmupMs: 3000,
      refine: false,
      stopFps: 15,
    },
    refresh: { hz: 60, intervalMs: 1000 / 60, measuredMs: 16.7 },
    loaf: { source: 'long-animation-frame', lost: 0 },
    steps: [step(), step({ step: 1, level: 100 })],
    end: 'cap',
    refineSkipped: null,
    driverWarnings: [],
    build: 'production',
    input: 'page',
    ...over,
  });

  it('is a schema 1 run of one ladder on one renderer, with its notes', () => {
    const run = compileRun(input());

    expect(run).toMatchObject({
      schema: 1,
      runId: 'r1',
      startedAt: '2026-10-31T10:00:00.000Z',
      bench: { build: 'production' },
      config: {
        seed: 1,
        ladders: ['B'],
        renderers: ['kit'],
        repeats: 1,
        warmupMs: 3000,
        phases: [{ name: 'idle', ms: 3000 }],
        input: 'page',
      },
      end: 'cap',
      refineSkipped: null,
    });
    expect(run.steps).toHaveLength(2);
    expect(run.measurement.build).toBe(BUILD_DEFINITION);
    expect(run.measurement.loaf).toEqual({
      source: 'long-animation-frame',
      lost: 0,
      limits: loafLimits('long-animation-frame'),
    });
    expect(run.measurement.refresh).toEqual({ measuredMs: 16.7, hz: 60, intervalMs: 1000 / 60 });
    expect(run.notComparable).toBe(NOT_COMPARABLE);
    expect(run.warnings).toEqual([]);
  });

  it('records the build the page runs as, and warns of a development build', () => {
    expect(compileRun(input()).bench.build).toBe('production');
    expect(compileRun(input()).warnings).toEqual([]);

    const dev = compileRun(input({ build: 'development' }));
    expect(dev.bench.build).toBe('development');
    expect(dev.warnings.join('\n')).toMatch(/development build.*not comparable|not.*production/i);
  });

  it('survives JSON, which is how it leaves the page', () => {
    const run = compileRun(input());
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });

  it('warns of a refresh the snap moved, lost long-frame entries and a missing source', () => {
    const run = compileRun(
      input({
        refresh: { hz: 50, intervalMs: 20, measuredMs: 1000 / 45 },
        loaf: { source: 'none', lost: 12 },
      }),
    );
    const warnings = run.warnings.join('\n');
    expect(warnings).toMatch(/45\.0 Hz/);
    expect(warnings).toMatch(/12 long-frame entries/);
    expect(warnings).toMatch(/some phases/);
    expect(warnings).toMatch(/no long-frame source/i);
  });

  it('warns of steps that hit the dot cap and steps that were aborted', () => {
    const run = compileRun(
      input({
        steps: [
          step({
            dots: {
              drawP50: 1,
              drawP95: 2,
              drawWorst: 3,
              drawnP50: 5000,
              drawnMax: 5000,
              capped: true,
            },
          }),
          step({ step: 1, level: 100, aborted: 'unresponsive', abortedIn: 'phase:pan' }),
        ],
        driverWarnings: ['step 0: the view was not back'],
      }),
    );
    const warnings = run.warnings.join('\n');
    expect(warnings).toMatch(/step 0.*cap/i);
    expect(warnings).toMatch(/step 1.*unresponsive.*phase:pan/i);
    expect(warnings).toMatch(/step 0: the view was not back/);
  });
});
