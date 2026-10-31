import { inject, Injectable, isDevMode, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MAX_DOTS } from '@bench/diagram-seam';
import { type BenchHost, BenchHosts } from '../hosts/bench-host';
import { BenchLoad } from '../hosts/bench-load';
import { DotProbeBuffer } from '../measure/dot-probe';
import { calibrateRefresh, FrameRecorder, type FrameScheduler } from '../measure/frame-recorder';
import { LoafCollector } from '../measure/loaf-collector';
import type { AutoHost, AutoParams } from './auto-params';
import { ladderPlan } from './ladders';
import { readMachine } from './machine-info';
import { pageDriverHost } from './page-host';
import { frameCapacity, type LoafPort, PhaseDriver } from './phase-driver';
import { type BenchRun, compileRun, type MachineInfo } from './result';

/*
 * The automatic mode (design 4.1, "Board, no harness"): the page calibrates the display's refresh
 * on its empty start page, shows the host, climbs the ladder with the phase driver and compiles
 * the result, which it leaves on `window.benchResult` for a harness and offers as a JSON download
 * for a board without one. `runAuto` is the orchestration with every page dependency passed in,
 * so the specs run a whole climb on a fake rAF; `AutoRun` wires it to the router and the DOM.
 */

/** Two seconds of an empty page (design 1.1) calibrate the refresh. */
const CALIBRATION_MS = 2000;

export interface AutoDeps {
  readonly params: AutoParams;
  /** The page's rAF by default; the specs' fake. */
  readonly scheduler?: FrameScheduler;
  readonly loaf: LoafPort & { start(): void; stop(): void };
  readonly probe: DotProbeBuffer;
  readonly maxDots: number;
  readonly load: BenchLoad;
  /** Shows the host's route and gives the host once it has rendered and registered. */
  readonly showHost: (host: AutoHost) => Promise<BenchHost>;
  readonly machine: (refreshHz: number) => Promise<MachineInfo>;
  readonly clock?: () => number;
  readonly now?: () => Date;
}

/** Calibrates, climbs and compiles. Rejects where the page cannot be measured (a hidden tab). */
export async function runAuto(deps: AutoDeps): Promise<BenchRun> {
  const { params, loaf } = deps;
  const clock = deps.clock ?? (() => performance.now());
  const now = deps.now ?? (() => new Date());
  const plan = ladderPlan(params.ladder, { steps: params.steps, refine: params.refine });
  const startedAt = now();

  // One hook per stage, called from the recorder's frame: the calibration's end, then the climb.
  let driver: PhaseDriver | null = null;
  let onFrame: (t: number) => void = () => undefined;
  const recorder = new FrameRecorder({
    scheduler: deps.scheduler,
    capacity: frameCapacity(plan),
    onFrame: (t) => onFrame(t),
  });

  loaf.start();
  recorder.start();
  try {
    await new Promise<void>((resolve) => {
      let began: number | null = null;
      onFrame = (t) => {
        began ??= t;
        if (t - began >= CALIBRATION_MS) resolve();
      };
    });
    const refresh = calibrateRefresh(recorder.between(0, recorder.mark()));

    onFrame = () => undefined;
    const host = await deps.showHost(params.host);
    const finished = new Promise<void>((resolve) => {
      onFrame = (t) => {
        driver?.frame(t);
        if (driver?.finished) resolve();
      };
    });
    const climb = new PhaseDriver({
      plan,
      ladder: params.ladder,
      renderer: params.host,
      repeat: 0,
      recorder,
      loaf,
      probe: deps.probe,
      maxDots: deps.maxDots,
      refresh,
      host: pageDriverHost(host, deps.load, params.ladder, params.seed),
      clock,
    });
    driver = climb;
    climb.start(clock());
    await finished;

    return compileRun({
      runId: `${startedAt.getTime().toString(36)}-${params.host}-${params.ladder}`,
      startedAt: startedAt.toISOString(),
      machine: await deps.machine(refresh.hz),
      seed: params.seed,
      ladder: params.ladder,
      renderer: params.host,
      plan,
      refresh,
      loaf: { source: loaf.source, lost: loaf.lost },
      steps: climb.steps,
      end: climb.end,
      refineSkipped: climb.refineSkipped,
      driverWarnings: climb.warnings,
      build: isDevMode() ? 'development' : 'production',
    });
  } finally {
    recorder.stop();
    loaf.stop();
  }
}

declare global {
  interface Window {
    /** The finished run, or `{ error }`: where a harness reads the result from. */
    benchResult?: BenchRun | { readonly error: string };
  }
}

export type AutoStatus = 'idle' | 'running' | 'done' | 'failed';

@Injectable({ providedIn: 'root' })
export class AutoRun {
  private readonly router = inject(Router);
  private readonly hosts = inject(BenchHosts);
  private readonly load = inject(BenchLoad);
  private readonly probe = inject(DotProbeBuffer);

  /** Changes only at the run's start and end, never during it: the measured page stays still. */
  readonly status = signal<AutoStatus>('idle');
  /** The failure, or what the run was saved as. */
  readonly message = signal('');
  readonly download = signal<{ readonly name: string; readonly url: string } | null>(null);

  /** Runs the climb the query asked for, once. */
  async start(params: AutoParams): Promise<void> {
    if (this.status() !== 'idle') throw new Error('an automatic run has already started');
    this.status.set('running');
    try {
      const run = await runAuto({
        params,
        loaf: new LoafCollector(),
        probe: this.probe,
        maxDots: MAX_DOTS,
        load: this.load,
        showHost: async (host) => {
          await this.router.navigateByUrl(`/${host}`);
          return this.hosts.whenHost();
        },
        machine: (hz) => readMachine(params.machine, hz),
      });
      window.benchResult = run;
      this.save(run);
      this.status.set('done');
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  /** Says the run cannot happen (a query that is not valid), where the harness looks. */
  fail(message: string): void {
    console.error(`bench: ${message}`);
    window.benchResult = { error: message };
    this.message.set(message);
    this.status.set('failed');
  }

  /** The JSON as a download: started at once, and left as a link for a browser that asks first. */
  private save(run: BenchRun): void {
    const date = run.startedAt.slice(0, 10);
    const name = `${date}-${run.machine.label}-${run.runId}.json`;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' }),
    );
    this.download.set({ name, url });
    this.message.set(name);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
  }
}
