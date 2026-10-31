// A Chromium started on the board for the harness to drive (design 4.1, "Board display" and the
// board recon): `--remote-debugging-port=0` on the board's 127.0.0.1 with a profile of its own
// (Chrome 136 ignores the port on the default profile; port 0 lets the browser take a free one,
// which it writes to `DevToolsActivePort` in that profile, so a browser somebody else left on a
// fixed port is never the one driven), reached through an ssh tunnel, and stopped and deleted
// afterwards. The harness changes the board in two ways only: this browser and one
// directory, `/tmp/neat-bench-<run>/`, holding its profile, log and pid file. The stop is by
// the pid file, checked against that pid's command line (so a recycled pid is never killed) and
// then by the browser's own process group, which is exactly its children. No `pkill`, no pattern
// matching over the process table. The scripts are built here and run with `sh -s` over ssh; their
// parts are validated first, because they are shell.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { sshArgs, sshRun } from './ssh.mjs';

const DEFAULT_PARENTS = ['/tmp', '/var/tmp'];
const DEV_PORTS = [4200, 9900];
const DEVTOOLS_MS = 30_000;

export function remoteDirFor(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/.test(runId)) {
    throw new Error(`run id "${runId}" cannot name a directory`);
  }
  return `/tmp/neat-bench-${runId}`;
}

/** Throws unless `dir` is `<parent>/neat-bench-<id>`: the only kind of directory it may delete. */
export function assertRemoteDir(dir, parents = DEFAULT_PARENTS) {
  const match = /^(\/[A-Za-z0-9/_.-]*[A-Za-z0-9_.-])\/neat-bench-[A-Za-z0-9-]+$/.exec(dir);
  const parent = match?.[1];
  if (!parent || !parents.includes(parent) || parent.split('/').includes('..')) {
    throw new Error(`not a directory this harness makes: "${dir}"`);
  }
}

/** The browser's arguments: loopback debugging, its own profile, and headless or kiosk. */
export function browserFlags(dir, { headless, display }) {
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
  return flags;
}

/** Starts the browser detached in its own session, writing its pid; fails if `dir` exists. */
export function launchScript(
  dir,
  { chromium, headless, display, xauthority, parents = DEFAULT_PARENTS },
) {
  assertRemoteDir(dir, parents);
  if (!/^[\w./+-]+$/.test(chromium)) throw new Error(`browser "${chromium}" is not a name or path`);
  if (display !== undefined && !/^:\d{1,3}(\.\d{1,2})?$/.test(display)) {
    throw new Error(`display "${display}" is not an X display such as :0`);
  }
  if (xauthority !== undefined && !/^\/[\w./+-]+$/.test(xauthority)) {
    throw new Error(`Xauthority file "${xauthority}" is not an absolute path`);
  }
  // The board user's own file unless told otherwise: the board's `$HOME` is the board's.
  const auth = xauthority === undefined ? '"$HOME/.Xauthority"' : `'${xauthority}'`;
  const env = display ? `DISPLAY=${display} XAUTHORITY=${auth} ` : '';
  const flags = browserFlags(dir, { headless, display }).join(' ');
  return `set -e
dir='${dir}'
mkdir -m 700 "$dir"
mkdir "$dir/profile"
${env}setsid '${chromium}' ${flags} about:blank >"$dir/chromium.log" 2>&1 </dev/null &
echo $! >"$dir/chromium.pid"
echo "pid $!"
`;
}

/**
 * Stops what \`launchScript\` started and deletes its directory. It prints: \`stopped\` once the
 * browser's pid is gone (not printed where the pid file is missing or is not this browser's),
 * \`leftover N\` for processes of its group that survived, \`removed\`, and \`note ...\` lines.
 */
export function stopScript(dir, parents = DEFAULT_PARENTS) {
  assertRemoteDir(dir, parents);
  const guard = parents.map((parent) => `'${parent}'/neat-bench-*`).join('|');
  return `dir='${dir}'
case "$dir" in ${guard}) ;; *) echo "note refused $dir"; exit 2;; esac
pid=''
if [ -r "$dir/chromium.pid" ]; then
  pid=$(cat "$dir/chromium.pid")
  case "$pid" in ''|*[!0-9]*) echo "note bad pid file"; pid='';; esac
else
  echo "note no pid file"
fi
if [ -n "$pid" ]; then
  if [ -r "/proc/$pid/cmdline" ] && tr '\\0' ' ' <"/proc/$pid/cmdline" | grep -qF -- "--user-data-dir=$dir/profile"; then
    kill -TERM "$pid" 2>/dev/null
    n=0
    while kill -0 "$pid" 2>/dev/null && [ "$n" -lt 50 ]; do sleep 0.2; n=$((n+1)); done
    if kill -0 "$pid" 2>/dev/null; then kill -KILL "$pid" 2>/dev/null; echo "note had to kill"; sleep 0.5; fi
    echo stopped
    # Whatever of its process group is left: its children, and only they.
    left=$(ps -eo pid=,pgid= | awk -v g="$pid" '$2==g {print $1}')
    if [ -n "$left" ]; then kill -TERM $left 2>/dev/null; sleep 1; fi
    left=$(ps -eo pid=,pgid= | awk -v g="$pid" '$2==g {print $1}')
    if [ -n "$left" ]; then kill -KILL $left 2>/dev/null; sleep 0.5; fi
    echo "leftover $(ps -eo pid=,pgid= | awk -v g="$pid" '$2==g {n++} END {print n+0}')"
  else
    echo "note pid $pid is not this run's browser: left alone"
  fi
fi
rm -rf -- "$dir"
if [ ! -e "$dir" ]; then echo removed; fi
`;
}

/** The stop script's printout as `{ stopped, removed, leftover, notes }`. */
export function parseStopReport(text) {
  const lines = text.split('\n').map((line) => line.trim());
  const left = lines.find((line) => line.startsWith('leftover '));
  return {
    stopped: lines.includes('stopped'),
    removed: lines.includes('removed'),
    leftover: left ? Number(left.slice('leftover '.length)) : 0,
    notes: lines.filter((line) => line.startsWith('note ')).map((line) => line.slice(5)),
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

/**
 * Starts the board's browser and the tunnel to it and waits for DevTools. `serverPort`, where
 * given, is a local port the board's browser reaches through a reverse tunnel on `servePort`.
 * Resolves with the DevTools endpoint on this machine, the address the board's browser loads the
 * bench from (when served from here) and `stop()`, which is safe to call twice.
 *
 * The stop is pushed on `cleanups` before anything is launched, so a signal at any point after
 * that (the browser may take 30 s to answer) still removes the browser and its directory; a stop
 * that arrives while the launch is in flight waits for it, and ends the start. `stop()` rejects,
 * after saying what is left and how to remove it by hand, where the board is not clean.
 * `io` swaps the ssh, tunnel and DevTools calls for the specs.
 */
export async function startRemote({
  ssh,
  runId,
  remote,
  headless,
  serverPort,
  log = () => undefined,
  cleanups = [],
  devtoolsMs = DEVTOOLS_MS,
  io = {},
}) {
  const run = io.sshRun ?? sshRun;
  const start = io.spawn ?? spawn;
  const get = io.fetch ?? fetch;
  const pickPort = io.freePort ?? freePort;
  const wait = io.sleep ?? sleep;
  const dir = remoteDirFor(runId);

  let launching = null;
  let pid = null;
  let tunnel = null;
  let stopped = null;
  let stopRequested = false;
  const manualCleanup = () => `ssh ${ssh} '${pid ? `kill -TERM -- -${pid}; ` : ''}rm -rf ${dir}'`;
  const stop = () => {
    stopRequested = true;
    stopped ??= (async () => {
      if (tunnel && tunnel.exitCode === null) tunnel.kill('SIGTERM');
      // The launch may still be on its way: stopping ahead of it would leave its browser behind.
      if (launching) await launching.catch(() => undefined);
      let report;
      try {
        report = parseStopReport((await run(ssh, stopScript(dir))).stdout);
      } catch (error) {
        log(`board: could not stop the browser: ${error.message}`);
        log(
          `board: ${dir}${pid ? ` and the browser (pid ${pid})` : ''} may be left; remove by hand: ${manualCleanup()}`,
        );
        throw new Error(`the board was not cleaned up (${dir}): ${error.message}`);
      }
      log(
        `board: browser ${report.stopped ? 'stopped' : 'not stopped'}, ` +
          `files ${report.removed ? 'removed' : 'NOT removed'}, ${report.leftover} processes left` +
          (report.notes.length ? ` (${report.notes.join('; ')})` : ''),
      );
      if (!report.removed || report.leftover > 0) {
        log(
          `board: ${dir}${pid ? ` and the browser (pid ${pid})` : ''} are left; remove by hand: ${manualCleanup()}`,
        );
        throw new Error(`the board was not cleaned up (${dir}): ${manualCleanup()}`);
      }
      return report;
    })();
    return stopped;
  };
  cleanups.push(stop);

  const aborted = () => {
    if (stopRequested) throw new Error('stopped before the board’s browser was ready');
  };

  try {
    launching = run(
      ssh,
      launchScript(dir, {
        chromium: remote.chromium,
        headless,
        display: remote.display,
        xauthority: remote.xauthority,
      }),
    );
    const launched = await launching;
    pid = launchedPid(launched.stdout);
    if (launched.code !== 0) {
      throw new Error(
        `could not start the browser on ${ssh}: ${launched.stderr.trim() || launched.stdout.trim()}`,
      );
    }
    aborted();
    log(`board: browser started (${launched.stdout.trim()}), profile in ${dir}`);

    // The browser says which port it took, in its profile.
    const began = Date.now();
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
    if (serverPort !== undefined) {
      forwards.push('-R', `127.0.0.1:${remote.servePort}:127.0.0.1:${serverPort}`);
    }
    tunnel = start(
      'ssh',
      [...sshArgs(ssh, ['-N', '-o', 'ExitOnForwardFailure=yes', ...forwards])],
      {
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );
    let tunnelError = '';
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
    return {
      endpoint,
      pageBase: serverPort !== undefined ? `http://127.0.0.1:${remote.servePort}/` : undefined,
      stop,
    };
  } catch (error) {
    // The cleanup list has the stop too: a failed stop is reported there, not in place of this.
    await stop().catch(() => undefined);
    throw error;
  }
}
