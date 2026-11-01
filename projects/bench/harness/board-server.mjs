// The built bench served from the board itself (`--serve board`), so the tunnel's latency never
// enters a campaign: the page's files are copied into `<run dir>/site` and a static server
// (`python3 -m http.server`, which every board has) serves them on a port chosen on the board,
// never a dev server's 4200 or 9900. Everything stays inside the run's directory, the server is
// stopped by its pid file and only where that pid's command line is this run's server (the same
// rule as the browser's), and the one teardown in `remote.mjs` stops it before the directory is
// removed. The server binds 127.0.0.1 or one of the board's own addresses (checked there, never
// `0.0.0.0`): `--serve board:<bind>` with `--target local` is the mode where the board serves the
// laptop's browser. Scripts are built here and run with `sh -s` over ssh; their parts are validated first.
import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { assertRemoteDir, startLockFragment } from './remote-dir.mjs';
import { spawnSsh, sshRun } from './ssh.mjs';

const BIND = /^\d{1,3}(?:\.\d{1,3}){3}$/;
/** What a file under the build may be called, for it goes into a shell script. */
const FILE_NAME = /^[A-Za-z0-9_.@+=,-]+(?:\/[A-Za-z0-9_.@+=,-]+)*$/;

function assertBind(bind) {
  if (!BIND.test(bind) || bind.split('.').some((part) => Number(part) > 255)) {
    throw new Error(`bind address "${bind}" is not an IPv4 address`);
  }
}

/**
 * Makes the run's directory and its `site` folder: the first thing the board is changed by.
 * `then` is more of the same script, run once the directory is there (the guard's install, for a
 * run with a bare display: `board-teardown.mjs`).
 */
export function prepareScript(dir, parents, { then = '' } = {}) {
  assertRemoteDir(dir, parents);
  return `set -e
dir='${dir}'
mkdir -m 700 "$dir"
mkdir "$dir/site"
${then}`;
}

/**
 * Every file of the build as `{ path, size }`, relative to `dist`, sorted. A name that is not
 * plain characters is an error: it would have to go into a shell script.
 */
export async function siteManifest(dist) {
  const entries = [];
  const walk = async (relative) => {
    for (const item of await readdir(join(dist, relative), { withFileTypes: true })) {
      const path = posix.join(relative, item.name);
      if (item.isDirectory()) await walk(path);
      else if (item.isFile()) {
        if (!FILE_NAME.test(path)) throw new Error(`"${path}" in the build has an unusual name`);
        entries.push({ path, size: (await stat(join(dist, path))).size });
      }
    }
  };
  await walk('');
  if (!entries.some((entry) => entry.path === 'index.html')) {
    throw new Error(`no index.html in ${dist}: run \`npm run bench:build\``);
  }
  return entries.sort((a, b) => (a.path < b.path ? -1 : 1));
}

/**
 * Checks the copy on the board against the build: every file there with the size it has here (the
 * build's own stamp is inside its bundle, which the page reports; a file of another size would be
 * a different build). Prints `site ok N files` or `note ...` lines and exits 1.
 */
export function verifyScript(dir, entries, parents) {
  assertRemoteDir(dir, parents);
  for (const { path, size } of entries) {
    if (!FILE_NAME.test(path) || !Number.isInteger(size)) throw new Error(`bad entry "${path}"`);
  }
  const list = entries.map(({ path, size }) => `${size} ${path}`).join('\n');
  return `dir='${dir}/site'
bad=0
while read -r size path; do
  have=$(wc -c 2>/dev/null <"$dir/$path" || echo missing)
  if [ "$(echo $have)" != "$size" ]; then echo "note $path: $have bytes, expected $size"; bad=1; fi
done <<'LIST'
${list}
LIST
[ "$bad" = 0 ] || exit 1
echo "site ok ${entries.length} files"
`;
}

/**
 * Starts the static server detached, with a pid file, on a free port of `bind` (a port bound and
 * released again on the board, so one in use is never taken, and never 4200 or 9900), and waits
 * until it answers. Prints `port N`, `pid N` and `url http://<bind>:N/`. The bind must be loopback
 * or one of the board's own addresses (checked there): the bench is served to this laptop over the
 * USB link at most, never on every interface. `guarded` takes the guard's start lock.
 */
export function serverStartScript(dir, { bind, guarded = false }, parents) {
  assertRemoteDir(dir, parents);
  assertBind(bind);
  return `set -e
dir='${dir}'
bind='${bind}'
[ -f "$dir/site/index.html" ] || { echo "note no site in $dir"; exit 1; }
${guarded ? startLockFragment() : ''}case "$bind" in
  127.*) ;;
  *)
    ip -o -4 addr show 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | grep -qxF -- "$bind" || {
      echo "note $bind is not an address of this board: bind loopback or one of its own addresses"
      exit 1
    };;
esac
port=$(python3 -c 'import socket, sys
for _ in range(50):
    s = socket.socket()
    s.bind((sys.argv[1], 0))
    port = s.getsockname()[1]
    s.close()
    if port not in (4200, 9900):
        print(port)
        break' "$bind")
case "$port" in ''|*[!0-9]*) echo "note no free port on $bind"; exit 1;; esac
${guarded ? 'not_stopping' : ''}
setsid python3 -m http.server "$port" --bind "$bind" --directory "$dir/site" \\
  >"$dir/server.log" 2>&1 </dev/null &
echo $! >"$dir/server.pid"
n=0
until python3 -c 'import sys, urllib.request
urllib.request.urlopen("http://%s:%s/index.html" % (sys.argv[1], sys.argv[2]), timeout=2)' \\
  "$bind" "$port" >/dev/null 2>&1; do
  n=$((n+1))
  if [ "$n" -ge 50 ]; then echo "note the server did not answer in 10 s"; exit 1; fi
  sleep 0.2
done
echo "port $port"
echo "pid $(cat "$dir/server.pid")"
echo "url http://$bind:$port/"
`;
}

/** The server's port and address from `serverStartScript`'s printout, or null. */
export function parseServerStart(text) {
  const port = /^port (\d+)$/m.exec(text);
  const url = /^url (http:\/\/[\d.]+:\d+\/)$/m.exec(text);
  const number = port ? Number(port[1]) : 0;
  return number >= 1024 && number <= 65535 && url ? { port: number, url: url[1] } : null;
}

/**
 * The part of the stop script that stops the server: by its pid file, and only where that pid's
 * command line serves this run's `site` folder. Prints `server stopped`, `server left` (and sets
 * `$sleft`) or a `note`.
 */
export function serverStopFragment() {
  return `spid=''
sleft=''
if [ -r "$dir/server.pid" ]; then
  spid=$(cat "$dir/server.pid")
  case "$spid" in ''|*[!0-9]*) echo "note bad server pid file"; spid='';; esac
fi
is_our_server() {
  [ -r "/proc/$spid/cmdline" ] &&
    tr '\\0' ' ' <"/proc/$spid/cmdline" | grep -qF -- "http.server" &&
    tr '\\0' ' ' <"/proc/$spid/cmdline" | grep -qF -- "--directory $dir/site"
}
if [ -n "$spid" ]; then
  if is_our_server; then
    kill -TERM "$spid" 2>/dev/null
    n=0
    while is_our_server && [ "$n" -lt 25 ]; do sleep 0.2; n=$((n+1)); done
    if is_our_server; then
      kill -KILL "$spid" 2>/dev/null; echo "note had to kill the server"; sleep 0.5
    fi
    if is_our_server; then echo "server left"; sleft=1; else echo "server stopped"; fi
  else
    echo "note pid $spid is not this run's server: left alone"
  fi
fi
`;
}

/**
 * Copies the build into `<dir>/site` on the board: `tar` here into `tar` there over one ssh
 * connection, then the sizes are checked against the manifest. Resolves with the number of files;
 * rejects with what is wrong. `io` swaps the pipe and the check for the specs.
 */
export async function copySite({ ssh, dist, dir, entries, parents, io = {} }) {
  assertRemoteDir(dir, parents);
  const pipe = io.pipe ?? tarOverSsh;
  const run = io.sshRun ?? sshRun;
  await pipe({ ssh, dist, command: `tar -C '${dir}/site' -xf -` });
  const checked = await run(ssh, verifyScript(dir, entries, parents), { timeoutMs: 60_000 });
  if (checked.code !== 0) {
    throw new Error(
      `the copy on ${ssh} is not the build: ${checked.stdout.trim() || checked.stderr.trim()}`,
    );
  }
  return entries.length;
}

/** `tar -cf - .` in `dist` into `command` on the board, over ssh; rejects where either fails. */
function tarOverSsh({ ssh, dist, command }) {
  return new Promise((resolve, reject) => {
    const pack = spawn('tar', ['-C', dist, '-cf', '-', '.'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const unpack = spawnSsh(ssh, { command, stdio: ['pipe', 'ignore', 'pipe'] });
    let errors = '';
    for (const child of [pack, unpack]) child.stderr.on('data', (chunk) => (errors += chunk));
    // An ssh that ends early closes the pipe; its own exit says why.
    unpack.stdin.on('error', () => undefined);
    pack.stdout.pipe(unpack.stdin);
    const codes = {};
    const finish = (name, code) => {
      codes[name] = code;
      if (codes.pack === undefined || codes.unpack === undefined) return;
      if (codes.pack === 0 && codes.unpack === 0) resolve();
      else
        reject(
          new Error(
            `copying the build to ${ssh} failed: ${errors.trim() || JSON.stringify(codes)}`,
          ),
        );
    };
    for (const [name, child] of [
      ['pack', pack],
      ['unpack', unpack],
    ]) {
      child.on('error', (error) => reject(error));
      child.on('close', (code) => finish(name, code));
    }
  });
}
