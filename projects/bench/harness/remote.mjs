// A Chromium started on the board for the harness to drive (design 4.1, "Board display" and the
// board recon): `--remote-debugging-port=0` on the board's 127.0.0.1 with a profile of its own
// (Chrome 136 ignores the port on the default profile; port 0 lets the browser take a free one,
// which it writes to `DevToolsActivePort` in that profile, so a browser somebody else left on a
// fixed port is never the one driven), reached through an ssh tunnel, and stopped and deleted
// afterwards. The harness changes the board in two ways only: this browser and one
// directory, `/tmp/neat-bench-<run>/`, holding its profile, log and pid file. (What Chromium
// writes by itself, `~/.pki/nssdb` and font caches in the board user's home, is its own and not
// removed here; `board-x.mjs` says the same of Xorg.) The stop is by
// the pid file, checked against that pid's command line (so a recycled pid is never killed) and
// then by the browser's own process group, which is exactly its children. No `pkill`, no pattern
// matching over the process table. The scripts are built here and run with `sh -s` over ssh; their
// parts are validated first, because they are shell.
//
// Two options add to what the board is changed by: `--remote-display bare` (a bare X server in
// place of LightDM for the run, `board-x.mjs`) and `--serve board` (the bench's files and a static
// server in the run's directory, `board-server.mjs`). A run with a bare display is torn down by
// the board's guard (`board-teardown.mjs`), which this side only asks and waits for, since the
// board must get its login screen back even when this side cannot finish; other runs keep the
// plain stop script. Only `bare` runs heal themselves, then: a run with `--remote-display :0` or
// `--serve board` alone is cleaned up by this laptop's stop and nothing else, so a killed node, a
// closed lid or a dropped link leaves its browser, server and directory on the board. Either way nothing is started on the board while
// a stop is under way, and a stop waits for a start script that is still running there.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { DEFAULT_MODE, parseXStart, xStartScript } from './board-x.mjs';
import { browserFlagProblem } from './browser-flags.mjs';
import {
  copySite,
  parseServerStart,
  prepareScript,
  serverStartScript,
  serverStopFragment,
  siteManifest,
} from './board-server.mjs';
import {
  bareStartChecksFragment,
  browserStopFragment,
  dirGuard,
  GUARD,
  guardInstallFragment,
  parseGuard,
  startHeartbeat,
  TEARDOWN_SSH_MS,
  teardownWaitScript,
} from './board-teardown.mjs';
import {
  DEFAULT_PARENTS,
  assertRemoteDir,
  remoteDirFor,
  startLockFragment,
} from './remote-dir.mjs';
import { spawnSsh, sshRun } from './ssh.mjs';

export { assertRemoteDir, remoteDirFor };

const DEV_PORTS = [4200, 9900];
const DEVTOOLS_MS = 30_000;
/** The plain stop's waits (the browser 12 s, the server 5.5 s) and the connect, with room. */
const PLAIN_STOP_MS = 60_000;
/** The bare X start's ssh timeout: stopping LightDM, a free display, Xorg's answer, the mode. */
const X_START_MS = 60_000;
/**
 * How long a stop waits for a start step's ssh still on its way: above the longest step's
 * timeout, which ends that ssh. The step's script on the board may outlive it; the guard's wait
 * for `start.lock` covers that.
 */
const STEP_WAIT_MS = 75_000;

/**
 * The browser's arguments: loopback debugging, its own profile, headless or kiosk, and where
 * `window` ({ w, h }) is given, its position and size, then the campaign's `extraFlags`.
 */
export function browserFlags(dir, { headless, display, window, extraFlags = [] }) {
  const flags = [
    '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${dir}/profile`,
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-precise-memory-info',
  ];
  if (display || !headless) {
    flags.push(
      '--kiosk',
      '--noerrdialogs',
      '--disable-session-crashed-bubble',
      '--disable-features=Translate',
    );
  } else {
    flags.push('--headless=new');
  }
  // With no window manager (a bare X server) nothing sizes the window: it gets the screen's.
  if (window) {
    flags.push('--window-position=0,0', `--window-size=${window.w},${window.h}`);
  }
  // Last, so that a variant's flag is the one the browser reads where it repeats one of ours.
  return [...flags, ...extraFlags];
}

/**
 * Starts the browser detached in its own session, writing its pid; fails if `dir` exists, unless
 * `existing` says another script of this run made it (then it must be there, without a profile).
 * `guarded` takes the guard's start lock (a run with a bare display).
 */
export function launchScript(
  dir,
  {
    chromium,
    headless,
    display,
    xauthority,
    window,
    extraFlags = [],
    existing,
    guarded = false,
    parents = DEFAULT_PARENTS,
  },
) {
  assertRemoteDir(dir, parents);
  if (!/^[\w./+-]+$/.test(chromium)) throw new Error(`browser "${chromium}" is not a name or path`);
  if (display !== undefined && !/^:\d{1,3}(\.\d{1,2})?$/.test(display)) {
    throw new Error(`display "${display}" is not an X display such as :0`);
  }
  if (xauthority !== undefined && !/^\/[\w./+-]+$/.test(xauthority)) {
    throw new Error(`Xauthority file "${xauthority}" is not an absolute path`);
  }
  // This script runs on the board in a shell: a flag is plain characters or it does not start.
  for (const flag of extraFlags) {
    const problem = browserFlagProblem(flag);
    if (problem) throw new Error(`browser flag ${problem}`);
  }
  // The board user's own file unless told otherwise: the board's `$HOME` is the board's.
  const auth = xauthority === undefined ? '"$HOME/.Xauthority"' : `'${xauthority}'`;
  const env = display ? `DISPLAY=${display} XAUTHORITY=${auth} ` : '';
  const flags = browserFlags(dir, { headless, display, window, extraFlags }).join(' ');
  const make = existing ? '[ -d "$dir" ]' : 'mkdir -m 700 "$dir"';
  return `set -e
dir='${dir}'
${make}
${guarded ? startLockFragment() : ''}mkdir "$dir/profile"
${env}setsid '${chromium}' ${flags} about:blank >"$dir/chromium.log" 2>&1 </dev/null &
echo $! >"$dir/chromium.pid"
echo "pid $!"
`;
}

/**
 * Stops what \`launchScript\` started and deletes its directory: the stop of a run without a bare
 * display (that one is the guard's, \`board-teardown.mjs\`). It prints: \`stopped\` once the
 * browser's pid is gone (not printed where the pid file is missing or is not this browser's),
 * \`leftover N\` for processes of its group that survived, \`removed\`, and \`note ...\` lines.
 * With \`server\` it also stops the board's static server (\`server stopped\`). Where a process of
 * the run survived, the directory and its pid files are kept for another attempt.
 */
export function stopScript(dir, parents = DEFAULT_PARENTS, { server = false } = {}) {
  assertRemoteDir(dir, parents);
  return `dir='${dir}'
${dirGuard(parents)}${browserStopFragment()}${server ? serverStopFragment() : ''}\
if [ -z "$bleft$sleft" ]; then
  rm -rf -- "$dir"
  if [ ! -e "$dir" ]; then echo removed; fi
else
  echo "note kept $dir: a process of the run is still running"
fi
`;
}

/**
 * The stop script's or the guard's printout as `{ stopped, removed, leftover, notes }`, with
 * `server` and `xorg` (`stopped` or `left`) and `display` (`{ state: 'restored' | 'not-restored'
 * | 'unchanged', why }`) where the script says them, and `gone: true` where the guard had already
 * removed the run's directory.
 */
export function parseStopReport(text) {
  const lines = text.split('\n').map((line) => line.trim());
  const left = lines.find((line) => line.startsWith('leftover '));
  const word = (name) =>
    lines
      .find((line) => /^(server|xorg) (stopped|left)$/.test(line) && line.startsWith(name))
      ?.split(' ')[1];
  const display = lines.find((line) => line.startsWith('display '));
  const shown = /^display (restored|not restored|unchanged)(?:: (.*))?$/.exec(display ?? '');
  return {
    stopped: lines.includes('stopped'),
    removed: lines.includes('removed'),
    leftover: left ? Number(left.slice('leftover '.length)) : 0,
    notes: lines.filter((line) => line.startsWith('note ')).map((line) => line.slice(5)),
    ...(word('server') && { server: word('server') }),
    ...(word('xorg') && { xorg: word('xorg') }),
    ...(shown && { display: { state: shown[1].replace(' ', '-'), why: shown[2] } }),
    ...(lines.includes('gone') && { gone: true }),
  };
}

/** The script that prints the port the browser chose (nothing yet, if it has not written it). */
export function readPortScript(dir, parents = DEFAULT_PARENTS) {
  assertRemoteDir(dir, parents);
  return `cat '${dir}/profile/DevToolsActivePort' 2>/dev/null || true\n`;
}

/** The port on the first line of Chromium's `DevToolsActivePort`, or null while it is not there. */
export function parseDevToolsPort(text) {
  const first = text.split('\n')[0].trim();
  const port = /^\d+$/.test(first) ? Number(first) : 0;
  return port >= 1024 && port <= 65535 ? port : null;
}

/** The browser's pid from the launch script's `pid N` line, or null. */
export function launchedPid(text) {
  const match = /^pid (\d+)$/m.exec(text);
  return match ? Number(match[1]) : null;
}

/** A free local port, never a dev server's. */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => (DEV_PORTS.includes(port) ? resolve(freePort()) : resolve(port)));
    });
  });
}

/** `promise`, or nothing after `ms`: whichever comes first; the timer never outlives it. */
async function within(promise, ms) {
  let timer;
  const late = new Promise((resolve) => (timer = setTimeout(resolve, ms)));
  try {
    await Promise.race([promise.catch(() => undefined), late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Starts what a campaign needs on the board and waits until it is ready: the browser and the
 * tunnel to it (unless `browser` is false: a laptop browser loading a page the board serves),
 * the board's static server (`serve: { bind, dist }`, else `serverPort` is a local port the
 * board's browser reaches through a reverse tunnel on `servePort`) and, for \`remote.display ===
 * 'bare'\`, the guard and its heartbeat, then a bare X server in place of LightDM, set to
 * \`remote.mode\` at 60 Hz. Resolves with the DevTools endpoint on this machine, the address the
 * board's browser loads the bench from, the display it got (\`{ name, mode, rateHz, ... }\`) and
 * \`stop()\`, which is safe to call twice. \`onGuard(pid)\` hears that the guard is up.
 *
 * The stop is pushed on `cleanups` before anything is launched, so a signal at any point after
 * that (the browser may take 30 s to answer) still removes what was started and puts LightDM
 * back. A stop that arrives while a step is on its way waits for that step's ssh (at most
 * `stepWaitMs`; every ssh is detached from the terminal, so a Ctrl-C does not end it early) and
 * ends the start. `stop()` rejects, after saying what is left and what to do, where the board is
 * not clean (a process left, files left, LightDM not back); it never prints a kill of a pid it
 * has not checked. `onStopped({ report, error, guard })` hears how the stop ended, for the result
 * file. `io` swaps the ssh, tunnel, heartbeat, copy and DevTools calls for the specs.
 */
export async function startRemote({
  ssh,
  runId,
  remote,
  headless,
  browserFlags: extraFlags = [],
  browser = true,
  serve,
  serverPort,
  log = () => undefined,
  cleanups = [],
  onStopped = () => undefined,
  onGuard = () => undefined,
  devtoolsMs = DEVTOOLS_MS,
  stepWaitMs = STEP_WAIT_MS,
  io = {},
}) {
  const run = io.sshRun ?? sshRun;
  const start = io.spawn ?? spawn;
  const get = io.fetch ?? fetch;
  const pickPort = io.freePort ?? freePort;
  const wait = io.sleep ?? sleep;
  const copy = io.copySite ?? copySite;
  const manifest = io.siteManifest ?? siteManifest;
  const beat = io.startHeartbeat ?? startHeartbeat;
  const dir = remoteDirFor(runId);
  const bare = remote.display === 'bare';

  let launching = null;
  let pid = null;
  let tunnel = null;
  let stopped = null;
  let stopRequested = false;
  let display = null;
  let guardPid = null;
  let heartbeat = null;
  // A kill only behind the check that the pid is still this run's browser: a pid printed in a
  // log may belong to anything by the time somebody acts on it.
  const manualCleanup = () => {
    const kill = pid
      ? `grep -qF -- --user-data-dir=${dir}/profile /proc/${pid}/cmdline && kill -TERM -- -${pid}; `
      : '';
    return `ssh ${ssh} '${kill}rm -rf ${dir}'`;
  };
  const rerun = `ssh ${ssh} sh ${dir}/guard.sh`;
  const selfHeal = () =>
    `the board restores its display by itself within ~30 s (guard pid ${guardPid ?? 'unknown'}); ` +
    `check with \`ssh ${ssh} systemctl is-active lightdm\``;

  /** What the stop printed, said in the log, the same for both kinds of stop. */
  const say = (report) => {
    log(
      `board: browser ${report.stopped ? 'stopped' : 'not stopped'}, ` +
        `files ${report.removed ? 'removed' : 'NOT removed'}, ${report.leftover} processes left` +
        (report.notes.length ? ` (${report.notes.join('; ')})` : ''),
    );
    if (report.server) log(`board: static server ${report.server}`);
    if (report.xorg) log(`board: Xorg ${report.xorg}`);
    if (report.display) {
      log(
        `board: display ${report.display.state.replace('-', ' ')}` +
          (report.display.why ? `: ${report.display.why}` : ''),
      );
    }
  };
  const unclean = (report) =>
    !report.removed || report.leftover > 0 || report.server === 'left' || report.xorg === 'left';

  /** The plain stop: one script over ssh, which this side must see through. */
  const stopPlain = async () => {
    let result;
    try {
      result = await run(ssh, stopScript(dir, undefined, { server: Boolean(serve) }), {
        timeoutMs: PLAIN_STOP_MS,
      });
    } catch (error) {
      log(`board: could not stop what was started: ${error.message}`);
      log(`board: ${dir} and what it started may be left; remove by hand: ${manualCleanup()}`);
      onStopped({ error });
      throw new Error(`the board was not cleaned up (${dir}): ${error.message}`);
    }
    const report = parseStopReport(result.stdout);
    if (result.code !== 0) {
      // ssh's own failure (255) or a script cut short: what it printed is not the whole story.
      const why = result.stderr.trim() || `exit ${result.code}`;
      log(`board: the stop did not finish on ${ssh}: ${why}`);
      log(`board: ${dir} and what it started may be left; remove by hand: ${manualCleanup()}`);
      const error = new Error(`the board's stop did not finish (${why})`);
      onStopped({ error });
      throw error;
    }
    onStopped({ report });
    say(report);
    if (unclean(report)) {
      log(`board: ${dir} and what it started are left; remove by hand: ${manualCleanup()}`);
      throw new Error(`the board was not cleaned up (${dir}): ${manualCleanup()}`);
    }
    return report;
  };

  /** The guarded stop: ask the board's guard, wait for its word, and say it. */
  const stopGuarded = async () => {
    let result;
    let failure = null;
    try {
      result = await run(ssh, teardownWaitScript(dir), { timeoutMs: TEARDOWN_SSH_MS });
      if (result.code === 255) failure = result.stderr.trim() || 'ssh exit 255';
    } catch (error) {
      failure = error.message;
    }
    // Whatever happened, the heartbeat ends here: a guard that did not hear the stop hears this.
    heartbeat?.stop();
    if (failure !== null) {
      log(`board: the teardown could not reach ${ssh}: ${failure}`);
      log(`board: ${selfHeal()}`);
      const error = new Error(`the board's teardown was not confirmed (${failure})`);
      onStopped({ error, guard: guardPid });
      throw error;
    }
    const report = parseStopReport(result.stdout);
    if (report.gone && guardPid !== null) {
      // Torn down before this stop: the guard removes the directory only once the display is back.
      report.removed = true;
      report.display ??= {
        state: 'restored',
        why: 'by the board’s guard, before this teardown (it heard no heartbeat)',
      };
    } else if (report.gone) {
      report.removed = true;
    }
    if (result.code !== 0) {
      const why = report.notes.join('; ') || result.stderr.trim() || `exit ${result.code}`;
      log(`board: the guard did not report: ${why}`);
      log(`board: ${selfHeal()}; or run its teardown again: ${rerun}`);
      const error = new Error(`the board's teardown was not confirmed (${why})`);
      onStopped({ error, guard: guardPid });
      throw error;
    }
    onStopped({ report, guard: guardPid });
    say(report);
    const notBack = report.display?.state === 'not-restored';
    if (unclean(report) || notBack) {
      log(
        `board: ${dir} is kept with its pid files; run its teardown again: ${rerun} ` +
          '(a reboot also brings the login screen back: LightDM is stopped, never disabled)',
      );
      throw new Error(
        notBack
          ? `the board's display was not restored: ${report.display.why ?? ''} (${rerun})`
          : `the board was not cleaned up (${dir}): ${rerun}`,
      );
    }
    return report;
  };

  const stop = () => {
    stopRequested = true;
    stopped ??= (async () => {
      if (tunnel && tunnel.exitCode === null) tunnel.kill('SIGTERM');
      // A step may still be on its way: stopping ahead of it would leave what it starts behind.
      // Waiting for its ssh (which its timeout ends) is as far as this side can wait.
      if (launching) await within(launching, stepWaitMs);
      return bare ? stopGuarded() : stopPlain();
    })();
    return stopped;
  };
  cleanups.push(stop);

  const aborted = () => {
    if (stopRequested) throw new Error('stopped before the board’s browser was ready');
  };
  /** One step on the board; a stop that comes meanwhile waits for it. */
  const step = async (promise) => {
    launching = promise;
    return promise;
  };
  const fails = (what, result) => {
    if (result.code === 0) return;
    const notes = (result.stdout.match(/^note .*$/gm) ?? []).join('; ');
    throw new Error(
      `${what} on ${ssh}: ${notes || result.stderr.trim() || result.stdout.trim() || result.code}`,
    );
  };

  try {
    let pageBase = serverPort !== undefined ? `http://127.0.0.1:${remote.servePort}/` : undefined;
    if (bare || serve) {
      aborted();
      // With a bare display this first script checks that the board is free to take (no other
      // run, nobody logged in on it), then installs and starts the guard, before anything else is
      // started, and the heartbeat follows at once.
      // Read inside the step, so a stop waiting for it knows the guard (and starts no heartbeat
      // after it asked the guard to finish).
      const prepared = await step(
        run(
          ssh,
          prepareScript(dir, undefined, {
            then: bare ? bareStartChecksFragment() + guardInstallFragment(dir) : '',
          }),
        ).then((result) => {
          guardPid = bare ? parseGuard(result.stdout) : null;
          if (guardPid !== null) {
            onGuard(guardPid);
            if (!stopRequested) heartbeat = beat({ ssh, dir, log, spawn: io.heartbeatSpawn });
          }
          return result;
        }),
      );
      if (guardPid !== null) {
        log(
          `board: guard ${guardPid} watches the run: it restores the display by itself if this ` +
            `laptop goes quiet for ${GUARD.staleS} s`,
        );
      }
      fails('could not make the run directory', prepared);
    }
    if (serve) {
      aborted();
      const entries = await manifest(serve.dist);
      aborted();
      await step(copy({ ssh, dist: serve.dist, dir, entries, io: io.copyIo }));
      aborted();
      const started = await step(
        run(ssh, serverStartScript(dir, { bind: serve.bind, guarded: bare })),
      );
      fails('could not start the static server', started);
      const served = parseServerStart(started.stdout);
      if (!served)
        throw new Error(`the board's static server printed no address: ${started.stdout}`);
      pageBase = served.url;
      log(`board: ${entries.length} files copied; serving them at ${served.url}`);
    }
    if (bare) {
      aborted();
      const started = await step(
        run(ssh, xStartScript(dir, { mode: remote.mode ?? DEFAULT_MODE }), {
          timeoutMs: X_START_MS,
        }),
      );
      const x = parseXStart(started.stdout);
      fails('could not start the bare X server', started);
      if (!x.display || !x.mode) {
        throw new Error(`the bare X server reported no display or mode: ${started.stdout}`);
      }
      display = {
        kind: 'bare',
        name: x.display,
        vt: x.vt,
        output: x.output,
        mode: x.mode,
        rateHz: x.rateHz,
        lightdm: x.lightdm,
      };
      log(
        `board: bare X server ${x.display} on vt${x.vt}, ${x.output} at ${x.mode.w}x${x.mode.h} ` +
          `${x.rateHz} Hz (LightDM was ${x.lightdm}; it is stopped for the run)`,
      );
    }
    if (!browser) return { pageBase, display, stop };

    aborted();
    const began = Date.now();
    const launched = await step(
      run(
        ssh,
        launchScript(dir, {
          chromium: remote.chromium,
          headless,
          display: bare ? display.name : remote.display,
          xauthority: bare ? `${dir}/Xauthority` : remote.xauthority,
          window: bare ? display.mode : undefined,
          extraFlags,
          existing: bare || Boolean(serve),
          guarded: bare,
        }),
      ),
    );
    pid = launchedPid(launched.stdout);
    if (launched.code !== 0) {
      throw new Error(
        `could not start the browser on ${ssh}: ` +
          (launched.stderr.trim() || launched.stdout.trim()),
      );
    }
    aborted();
    log(`board: browser started (${launched.stdout.trim()}), profile in ${dir}`);

    // The browser says which port it took, in its profile.
    let debugPort = null;
    while (debugPort === null) {
      aborted();
      debugPort = parseDevToolsPort((await run(ssh, readPortScript(dir))).stdout);
      if (debugPort !== null) break;
      if (Date.now() - began >= devtoolsMs) {
        throw new Error(`the board’s browser did not open DevTools in ${devtoolsMs / 1000} s`);
      }
      await wait(250);
    }
    aborted();

    const local = await pickPort();
    const forwards = ['-L', `127.0.0.1:${local}:127.0.0.1:${debugPort}`];
    if (serverPort !== undefined && !serve) {
      forwards.push('-R', `127.0.0.1:${remote.servePort}:127.0.0.1:${serverPort}`);
    }
    // The tunnel's remote side reads its stdin until it closes, so a tunnel whose node is gone
    // (killed, or quit by a third Ctrl-C: it is detached, nothing else ends it) ends by itself.
    tunnel = spawnSsh(ssh, {
      extra: ['-o', 'ExitOnForwardFailure=yes', ...forwards],
      command: 'cat >/dev/null',
      stdio: ['pipe', 'ignore', 'pipe'],
      spawn: start,
    });
    let tunnelError = '';
    tunnel.stdin?.on('error', () => undefined);
    tunnel.stderr.on('data', (chunk) => (tunnelError += chunk));
    const endpoint = `http://127.0.0.1:${local}`;
    for (;;) {
      aborted();
      if (tunnel.exitCode !== null)
        throw new Error(`the tunnel to ${ssh} ended: ${tunnelError.trim()}`);
      try {
        const response = await get(`${endpoint}/json/version`, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          const version = await response.json();
          log(`board: DevTools answers through the tunnel (${version.Browser})`);
          break;
        }
      } catch {
        // Not up yet.
      }
      if (Date.now() - began >= devtoolsMs) {
        throw new Error(`the board’s browser did not answer in ${devtoolsMs / 1000} s`);
      }
      await wait(250);
    }
    return { endpoint, pageBase, display, stop };
  } catch (error) {
    // The cleanup list has the stop too: a failed stop is reported there, not in place of this.
    await stop().catch(() => undefined);
    throw error;
  }
}
