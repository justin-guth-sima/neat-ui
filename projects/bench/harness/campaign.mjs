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
import { verifyBuild } from './build-stamp.mjs';
import { fairnessReport, fairnessVerdict } from './fairness.mjs';
import { benchInfo, mergeRuns } from './merge.mjs';
import { modeWarnings } from './mode.mjs';
import { runOnePage } from './page-run.mjs';
import {
  hostScript,
  parseHost,
  parseProbe,
  PROBE_SCRIPT,
  summarizeProbes,
  throttleWarning,
} from './probes.mjs';
import { remoteDirFor, startRemote } from './remote.mjs';
import { buildSchedule, traceSchedule } from './schedule.mjs';
import { serveDist } from './serve.mjs';
import { createMapper, mapSteps } from './sourcemaps.mjs';
import { sshRun } from './ssh.mjs';
import { withTimeout } from './watchdog.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const run = promisify(execFile);
/** A page for a run: a context's page opening is a browser call that may never answer. */
const SESSION_MS = 30_000;

/** The recorder check's outcome in a line of the log. */
function checkSummary({ ok, worstPct, compared, skipped, unreadable = 0 }) {
  if (skipped) return `recorder against trace: not checked (${skipped})`;
  const unread = unreadable > 0 ? `; trace unreadable for ${unreadable} phases` : '';
  if (ok === null) return `recorder against trace: nothing to compare${unread}`;
  return (
    `recorder against trace: ${ok ? 'within' : 'OUTSIDE'} 3 % over ${compared} phases ` +
    `(worst ${worstPct.toFixed(1)} %)${unread}`
  );
}

/**
 * What the board's teardown says of the bare display, for the result and the log: `{ ok, text }`,
 * or null where the run had no bare display (nothing to say) or the stop has not ended.
 */
export function displayRestore(stopped) {
  if (!stopped) return null;
  if (stopped.error) {
    const guard = stopped.guard
      ? `; the board's guard (pid ${stopped.guard}) restores it by itself`
      : '';
    return {
      ok: false,
      text: `display not confirmed: ${stopped.error.message}${guard}`,
    };
  }
  const shown = stopped.report?.display;
  // The guard says nothing of the display only where the run never recorded LightDM's state,
  // which it does before it stops it: LightDM was never touched.
  if (!shown)
    return { ok: true, text: 'display untouched: the run ended before LightDM was stopped' };
  if (shown.state === 'restored') return { ok: true, text: 'display restored' };
  return {
    ok: shown.state === 'unchanged',
    text: `display ${shown.state.replace('-', ' ')}${shown.why ? `: ${shown.why}` : ''}`,
  };
}

const label = ({ ladder, renderer, repeat }) => `${renderer} ${ladder} r${repeat}`;

/** Safe in a file name: the machine label as typed, minus anything a path could mean. */
const slug = (text) => text.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'run';

/** What the page loads of the campaign say they were built from: one commit, a mix, or nothing. */
function builtFrom(pageRuns) {
  const stamps = new Set(
    pageRuns.filter((r) => r.ok && r.purpose !== 'trace').map((r) => r.result.bench?.gitSha),
  );
  stamps.delete(undefined);
  if (stamps.size === 0) return { sha: null, mixed: [] };
  return stamps.size === 1
    ? { sha: [...stamps][0], mixed: [] }
    : { sha: 'unknown', mixed: [...stamps] };
}

/**
 * Runs the campaign `options` (`args.mjs`). Resolves with `{ file, run, failed, unfair }`;
 * `cleanups` collects what a signal handler must undo (the server, the board's browser, and the
 * writing of what the campaign has so far). `deps` swaps the browser, the page run and the
 * server for the specs.
 *
 * The result file is written after every run and again however the campaign ends (an error, a
 * signal), saying in its warnings that it is not complete; a run that fails for any reason is a
 * failed run in it, never the end of the campaign. `signal` (an AbortSignal) is the user's stop:
 * no run starts after it, and the file says `complete: false` even where the run under way
 * ended. `board.guard` is set to the board's guard's pid once it is up.
 */
export async function runCampaign(options, { log, cleanups, deps = {}, signal, board }) {
  const d = {
    openBrowser,
    startRemote,
    runOnePage,
    serveDist,
    sshRun,
    sessionMs: SESSION_MS,
    ...deps,
  };
  const runId = Date.now().toString(36);
  const startedAt = new Date().toISOString();
  const outDir = resolve(ROOT, options.out);
  const baseName = `${startedAt.slice(0, 10)}-${slug(options.machine)}-${runId}`;
  const warnings = [];
  const { runs: schedule, skipped } = buildSchedule(options);
  for (const entry of skipped)
    log(`skipped ${entry.renderer} on ladder ${entry.ladder}: ${entry.reason}`);
  if (schedule.length === 0) throw new Error('nothing to run');

  // How the board's teardown ended, for the result: it runs after the file's last write on a
  // normal end, so a cleanup registered first (run last) rewrites the file with it.
  let boardStopped = null;
  let rewrite = null;
  cleanups.push(async () => {
    if (boardStopped && rewrite) await rewrite();
  });

  // Where the page comes from: a server of ours, the board's, or an address the user gave.
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
    if (!options.serve) {
      server = await d.serveDist(dist);
      cleanups.push(() => server.close());
      log(`serving ${dist} at ${server.url}`);
    }
  }

  let target = options.target;
  let base = options.url ?? server?.url;
  let display = null;
  if (target.kind === 'remote' || options.serve) {
    const remote = await d.startRemote({
      ssh: options.ssh,
      runId,
      remote: options.remote,
      headless: options.headless || !options.remote.display,
      // A laptop browser loading what the board serves has no browser on the board to start.
      browser: target.kind === 'remote',
      serve: options.serve && { bind: options.serve.bind, dist },
      serverPort: options.url || options.serve ? undefined : server.port,
      log,
      onStopped: (stopped) => (boardStopped = stopped),
      onGuard: (pid) => {
        if (board) board.guard = pid;
      },
      // Registered by `startRemote` itself, before it launches anything.
      cleanups,
    });
    display = remote.display ?? null;
    if (target.kind === 'remote') target = { kind: 'cdp', endpoint: remote.endpoint };
    base = options.url ?? remote.pageBase;
    log(`the browser loads the bench from ${base}`);
  }

  const opened = await d.openBrowser({
    target,
    headless: options.headless,
    viewport: options.viewport,
    dpr: options.dpr,
  });
  cleanups.push(() => opened.close());
  const facts = await opened.facts();
  // What the browser is, not what was asked: a remote start without a display is headless, and
  // so is a CDP target somebody left that way.
  const mode = opened.mode;
  warnings.push(...modeWarnings({ headless: mode.headless, target: options.target, options }));
  log(
    `browser ${facts.version}; ` +
      `GPU compositing ${facts.gpu.featureStatus.gpu_compositing ?? 'unknown'}`,
  );

  const machineExtra = { gpu: facts.gpu, launchArgs: facts.launchArgs };
  let probe = null;
  if (options.ssh) {
    try {
      const host = await d.sshRun(
        options.ssh,
        hostScript(
          display && { name: display.name, xauthority: `${remoteDirFor(runId)}/Xauthority` },
        ),
      );
      machineExtra.host = parseHost(host.stdout);
    } catch (error) {
      warnings.push(`The host's identity could not be read over ssh: ${error.message}`);
    }
    probe = async () => parseProbe((await d.sshRun(options.ssh, PROBE_SCRIPT)).stdout);
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

  const failedRun = (entry, message) => {
    log(`FAILED ${label(entry)}: ${message}`);
    return { ok: false, schedule: entry, error: message, steps: [], notes: [] };
  };

  // The run on its page. Anything that goes wrong in it, even what was not foreseen, is that
  // run's failure, recorded like any other: no page to run on, a browser that stopped answering.
  let inProgress = null;
  const attempt = async (entry, extra = {}) => {
    inProgress = label(entry);
    try {
      return await attemptOnce(entry, extra);
    } catch (error) {
      return failedRun(entry, error.message);
    } finally {
      inProgress = null;
    }
  };
  const attemptOnce = async (entry, extra) => {
    const session = await withTimeout(opened.session(), d.sessionMs, 'open a page');
    try {
      const files = fileNames(outDir, baseName, entry, extra.trace);
      const started = Date.now();
      const result = await d.runOnePage({
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
          (result.ok ? `, ended ${result.result.end}` : ` - ${result.error}`) +
          (result.recorderCheck ? `; ${checkSummary(result.recorderCheck)}` : ''),
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
  const mapper = await createMapper({ distDir: dist, readFile: (path) => readFile(path, 'utf8') });
  const file = join(outDir, `${baseName}.json`);

  // What the file says when the campaign did not reach its end, and the one write at a time.
  // Until the loop says otherwise, a file that is written is of a campaign that was cut off.
  let unfinished = 'interrupted';
  let merged = null;
  let writing = Promise.resolve();
  const compose = () => {
    const incomplete = [];
    // A stop by the user ends the campaign even where the run under way ended "normally".
    const cut = signal?.aborted ? `interrupted by ${signal.reason}` : unfinished;
    if (cut) {
      incomplete.push(
        `The campaign did not finish (${cut}): ${pageRuns.length} of ${all.length} runs ` +
          `are in this file${inProgress ? `, and ${inProgress} was under way and is not` : ''}.`,
      );
    }
    const restore = display ? displayRestore(boardStopped) : null;
    if (restore && !restore.ok) {
      incomplete.push(`The board's display was not put back: ${restore.text}.`);
    }
    const built = builtFrom(pageRuns);
    const checkout = bench.gitSha;
    const verification = [];
    if (built.mixed.length > 0) {
      verification.push(
        'The page loads of this campaign were built from different commits ' +
          `(${built.mixed.join(', ')}).`,
      );
    } else if (built.sha !== null) {
      verification.push(...verifyBuild({ built: built.sha, checkout, url: options.url }));
    }
    return mergeRuns({
      runId,
      startedAt,
      // The measured build's own commit where the page says it; the checkout's is kept beside it.
      bench: { ...bench, gitSha: built.sha ?? 'unknown', checkoutSha: checkout },
      options,
      machineExtra,
      fairness,
      skipped,
      warnings: [...incomplete, ...warnings, ...verification],
      pageRuns,
      extra: {
        harness: {
          node: process.version,
          target: options.target.kind,
          headless: mode.headless,
          viewport: mode.viewport,
          dpr: options.dpr,
          cooldownMs: options.cooldownMs,
          browserVersion: facts.version,
          pageBase: base,
          ...(options.serve && { servedFrom: `board ${options.serve.bind}` }),
          ...(display && {
            display: {
              ...display,
              restore: restore?.text ?? 'LightDM stopped for the run; not yet restored',
            },
          }),
          complete: !cut,
        },
      },
    });
  };
  const write = () => {
    writing = writing.then(async () => {
      try {
        merged = compose();
        await mkdir(outDir, { recursive: true });
        await writeFile(file, JSON.stringify(merged, null, 2));
      } catch (error) {
        log(`could not write ${file}: ${error.message}`);
      }
    });
    return writing;
  };
  rewrite = write;
  // A signal gets what there is so far into the file before the browser is closed.
  let done = false;
  cleanups.push(async () => {
    if (done) return;
    await write();
  });

  try {
    let first = true;
    for (const { entry, trace } of all) {
      if (signal?.aborted) break;
      if (!first && options.cooldownMs > 0) {
        log(`idle ${options.cooldownMs / 1000} s`);
        await sleep(options.cooldownMs);
      }
      first = false;
      const pageRun = await attempt(entry, trace ? { trace: true, steps: options.traceSteps } : {});
      // The long frames' scripts to source, where the build's maps are at hand.
      try {
        pageRun.steps = await mapSteps(pageRun.steps, mapper);
      } catch (error) {
        pageRun.notes.push(`source mapping failed: ${error.message}`);
      }
      pageRuns.push(pageRun);
      await write();
    }
    unfinished = null;
  } catch (error) {
    unfinished = `stopped by an error: ${error.message}`;
    throw error;
  } finally {
    done = true;
    mapper.close();
    await write();
  }
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
