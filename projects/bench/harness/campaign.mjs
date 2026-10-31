// A campaign (design 4.1): everything one `run.mjs` call does, in order: serve the bench or find
// it, open the browser (here, over CDP, or started on the board), check the kit and vflow draw
// the same picture, run every page load of the schedule with probes and cool-downs between,
// trace if asked, map the long frames' scripts to source, and write the one result file.
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { openBrowser } from './browser.mjs';
import { fairnessReport, fairnessVerdict } from './fairness.mjs';
import { benchInfo, mergeRuns } from './merge.mjs';
import { runOnePage } from './page-run.mjs';
import {
  HOST_SCRIPT,
  parseHost,
  parseProbe,
  PROBE_SCRIPT,
  summarizeProbes,
  throttleWarning,
} from './probes.mjs';
import { startRemote } from './remote.mjs';
import { buildSchedule, traceSchedule } from './schedule.mjs';
import { serveDist } from './serve.mjs';
import { createMapper, mapSteps } from './sourcemaps.mjs';
import { sshRun } from './ssh.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const run = promisify(execFile);

const label = ({ ladder, renderer, repeat }) => `${renderer} ${ladder} r${repeat}`;

/** Safe in a file name: the machine label as typed, minus anything a path could mean. */
const slug = (text) => text.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'run';

/**
 * Runs the campaign `options` (`args.mjs`). Resolves with `{ file, run, failed, unfair }`;
 * `cleanups` collects what a signal handler must undo (the server, the board's browser).
 */
export async function runCampaign(options, { log, cleanups }) {
  const runId = Date.now().toString(36);
  const startedAt = new Date().toISOString();
  const outDir = resolve(ROOT, options.out);
  const baseName = `${startedAt.slice(0, 10)}-${slug(options.machine)}-${runId}`;
  const warnings = [];
  const { runs: schedule, skipped } = buildSchedule(options);
  for (const entry of skipped)
    log(`skipped ${entry.renderer} on ladder ${entry.ladder}: ${entry.reason}`);
  if (schedule.length === 0) throw new Error('nothing to run');

  // Where the page comes from: a server of ours, or an address the user gave.
  const dist = resolve(ROOT, options.dist);
  let server = null;
  if (!options.url) {
    if (options.target.kind === 'cdp') {
      throw new Error(
        '--target cdp:<endpoint> needs --url: the address the browser there loads the bench from',
      );
    }
    try {
      await readFile(join(dist, 'index.html'));
    } catch {
      throw new Error(
        `no built bench in ${dist}: run \`npm run bench:build\` first (or pass --url)`,
      );
    }
    server = await serveDist(dist);
    cleanups.push(() => server.close());
    log(`serving ${dist} at ${server.url}`);
  }

  let target = options.target;
  let base = options.url ?? server?.url;
  if (target.kind === 'remote') {
    const remote = await startRemote({
      ssh: options.ssh,
      runId,
      remote: options.remote,
      headless: options.headless || !options.remote.display,
      serverPort: options.url ? undefined : server.port,
      log,
      // Registered by `startRemote` itself, before it launches anything.
      cleanups,
    });
    target = { kind: 'cdp', endpoint: remote.endpoint };
    base = options.url ?? remote.pageBase;
    log(`the board's browser loads the bench from ${base}`);
  }
  if (options.headless) {
    warnings.push(
      'Headless run: Chromium composites and paces frames differently without a window, so these ' +
        'numbers show that the harness works, not how the renderers perform (design 4.1: headed only).',
    );
  }

  const opened = await openBrowser({
    target,
    headless: options.headless,
    viewport: options.viewport,
    dpr: options.dpr,
  });
  cleanups.push(() => opened.close());
  const facts = await opened.facts();
  log(
    `browser ${facts.version}; GPU compositing ${facts.gpu.featureStatus.gpu_compositing ?? 'unknown'}`,
  );

  const machineExtra = { gpu: facts.gpu, launchArgs: facts.launchArgs };
  let probe = null;
  if (options.ssh) {
    try {
      const host = await sshRun(options.ssh, HOST_SCRIPT);
      machineExtra.host = parseHost(host.stdout);
    } catch (error) {
      warnings.push(`The host's identity could not be read over ssh: ${error.message}`);
    }
    probe = async () => parseProbe((await sshRun(options.ssh, PROBE_SCRIPT)).stdout);
    const first = await probe();
    if (first.freqMhz.length === 0) {
      warnings.push(
        'The board exposes no CPU frequency (no cpufreq files): throttling can be judged by ' +
          'temperature only, which is recorded per run.',
      );
    }
    if (first.loadavg[0] > 1) {
      warnings.push(
        `The board was busy before the campaign (1 min load average ${first.loadavg[0]}): ` +
          'stop what else runs on it for a measurement.',
      );
    }
  }

  const bench = await benchInfo({
    root: ROOT,
    git: async (args) => (await run('git', ['-C', ROOT, ...args])).stdout,
    readFile: (path) => readFile(path, 'utf8'),
  });

  const attempt = async (entry, extra = {}) => {
    let session;
    try {
      session = await opened.session();
    } catch (error) {
      // No page to run on is that run's failure, recorded like any other, not the campaign's end.
      log(`FAILED ${label(entry)}: ${error.message}`);
      return { ok: false, schedule: entry, error: error.message, steps: [], notes: [] };
    }
    try {
      const files = fileNames(outDir, baseName, entry, extra.trace);
      const started = Date.now();
      const result = await runOnePage({
        session,
        base,
        schedule: entry,
        options,
        steps: extra.steps ?? options.steps,
        files: {
          ...files,
          screenshot:
            options.screenshots && !extra.trace && !extra.preflight ? files.screenshot : null,
        },
        trace: extra.trace ?? false,
        inspect: extra.inspect,
        probe,
      });
      if (result.before && result.after) {
        result.thermal = summarizeProbes(result.before, result.after);
        result.throttleWarning =
          throttleWarning(result.before, result.after, label(entry)) ?? undefined;
      }
      if (extra.trace) result.purpose = 'trace';
      log(
        `${result.ok ? 'ok    ' : 'FAILED'} ${label(entry)}${extra.trace ? ' (traced)' : ''}: ` +
          `${result.steps.length} steps, ${((Date.now() - started) / 1000).toFixed(0)} s` +
          (result.ok ? `, ended ${result.result.end}` : ` - ${result.error}`),
      );
      return result;
    } finally {
      await session.release();
    }
  };

  // The kit and vflow must draw the same picture before their frames are compared (design 3.2).
  let fairness = null;
  if (options.renderers.includes('kit') && options.renderers.includes('vflow')) {
    log('fairness check: the first step of ladder A on the kit and on vflow');
    const kit = await attempt(
      { ladder: 'A', renderer: 'kit', repeat: 0 },
      { steps: 1, inspect: (page) => page.evaluate(() => window.benchFairness()), preflight: true },
    );
    const vflow = kit.ok
      ? await attempt(
          { ladder: 'A', renderer: 'vflow', repeat: 0 },
          {
            steps: 1,
            inspect: (page) =>
              page.evaluate(
                (fingerprint) => window.benchCompare(fingerprint, window.benchFairness()),
                kit.inspected,
              ),
            preflight: true,
          },
        )
      : null;
    fairness = fairnessReport(kit, vflow);
    const verdict = fairnessVerdict(fairness, options.allowUnfair);
    for (const line of verdict.lines) log(line);
    if (verdict.stop) {
      const file = join(outDir, `${baseName}-fairness.json`);
      await mkdir(outDir, { recursive: true });
      await writeFile(file, JSON.stringify(fairness, null, 2));
      log(`the report is in ${file}`);
      return { file, unfair: true, failed: 0 };
    }
  }

  const pageRuns = [];
  const all = [
    ...schedule.map((entry) => ({ entry })),
    ...(options.trace ? traceSchedule(options).map((entry) => ({ entry, trace: true })) : []),
  ];
  let first = true;
  for (const { entry, trace } of all) {
    if (!first && options.cooldownMs > 0) {
      log(`idle ${options.cooldownMs / 1000} s`);
      await sleep(options.cooldownMs);
    }
    first = false;
    pageRuns.push(await attempt(entry, trace ? { trace: true, steps: options.traceSteps } : {}));
  }

  // Map the long frames' scripts to source, where the build's maps are at hand.
  const mapper = await createMapper({ distDir: dist, readFile: (path) => readFile(path, 'utf8') });
  for (const pageRun of pageRuns) {
    pageRun.steps = await mapSteps(pageRun.steps, mapper);
  }
  mapper.close();

  const merged = mergeRuns({
    runId,
    startedAt,
    bench,
    options,
    machineExtra,
    fairness,
    skipped,
    warnings,
    pageRuns,
    extra: {
      harness: {
        node: process.version,
        target: options.target.kind,
        headless: options.headless,
        viewport: options.viewport,
        dpr: options.dpr,
        cooldownMs: options.cooldownMs,
        browserVersion: facts.version,
        pageBase: base,
      },
    },
  });
  const file = join(outDir, `${baseName}.json`);
  await mkdir(outDir, { recursive: true });
  await writeFile(file, JSON.stringify(merged, null, 2));
  return {
    file,
    run: merged,
    failed: pageRuns.filter((r) => !r.ok).length,
    unfair: false,
  };
}

/** Where a run's screenshot and trace go: beside the result file, named by the run. */
function fileNames(outDir, baseName, entry, traced) {
  const stem = `${baseName}-${entry.renderer}-${entry.ladder}-r${entry.repeat}`;
  return {
    screenshot: join(outDir, `${stem}.png`),
    screenshotName: `${stem}.png`,
    trace: traced ? join(outDir, `${stem}.trace.json.gz`) : null,
    traceName: `${stem}.trace.json.gz`,
  };
}
