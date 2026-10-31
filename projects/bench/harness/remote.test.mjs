import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import {
  assertRemoteDir,
  browserFlags,
  launchScript,
  launchedPid,
  parseDevToolsPort,
  parseStopReport,
  readPortScript,
  remoteDirFor,
  startRemote,
  stopScript,
} from './remote.mjs';

const OPTIONS = { chromium: 'chromium', headless: true, display: undefined };

// The scripts' real runs below happen in a folder of their own, which they are told is theirs.
const work = mkdtempSync(join(tmpdir(), 'bench-remote-'));
const parents = [work];

test('names a run’s directory under /tmp, unique to the run', () => {
  assert.equal(remoteDirFor('abc123-kit'), '/tmp/neat-bench-abc123-kit');
  assert.throws(() => remoteDirFor('a b'), /run id/);
  assert.throws(() => remoteDirFor('../x'), /run id/);
  assert.throws(() => remoteDirFor(''), /run id/);
});

test('accepts only a directory this harness made, where the stop script may delete', () => {
  assertRemoteDir('/tmp/neat-bench-ok1');
  for (const dir of [
    '/tmp',
    '/',
    '/home/sima',
    '/tmp/neat-bench-',
    '/tmp/other-ok1',
    '/tmp/neat-bench-a/b',
    '/tmp/neat-bench-a b',
    '/tmp/neat-bench-a;rm -rf /',
    '/tmp/neat-bench-$(id)',
    '/etc/neat-bench-x',
    'neat-bench-x',
  ]) {
    assert.throws(() => assertRemoteDir(dir), /directory/, dir);
  }
});

test('starts the browser on the board’s loopback with a profile of its own', () => {
  const flags = browserFlags('/tmp/neat-bench-x', OPTIONS);
  // Port 0: the browser takes a free one and says which in its profile, so a foreign browser
  // already listening on a fixed port is never the one driven.
  assert.ok(flags.includes('--remote-debugging-port=0'));
  assert.ok(flags.includes('--remote-debugging-address=127.0.0.1'));
  assert.ok(flags.includes('--user-data-dir=/tmp/neat-bench-x/profile'));
  assert.ok(flags.includes('--headless=new'));
  assert.ok(flags.includes('--enable-precise-memory-info'));
  assert.ok(!flags.some((flag) => flag.startsWith('--kiosk')));
});

test('shows on the board’s display, kiosk, when given one, and is not headless then', () => {
  const flags = browserFlags('/tmp/neat-bench-x', { ...OPTIONS, headless: false, display: ':0' });
  assert.ok(flags.includes('--kiosk'));
  assert.ok(!flags.some((flag) => flag.startsWith('--headless')));
});

test('refuses a browser name, display or Xauthority file that could carry a command', () => {
  const dir = '/tmp/neat-bench-x';
  assert.throws(() => launchScript(dir, { ...OPTIONS, chromium: 'chromium; id' }), /browser/);
  assert.throws(
    () => launchScript(dir, { ...OPTIONS, display: ':0; id', headless: false }),
    /display/,
  );
  for (const xauthority of ['/home/a; id', 'relative/.Xauthority', '/home/$(id)/x', "/a'b"]) {
    assert.throws(
      () => launchScript(dir, { ...OPTIONS, display: ':0', headless: false, xauthority }),
      /Xauthority/,
      xauthority,
    );
  }
});

test('gives a headed browser the Xauthority file asked for, else the board user’s own', () => {
  const dir = '/tmp/neat-bench-x';
  const headed = { ...OPTIONS, display: ':0', headless: false };
  assert.match(launchScript(dir, headed), /DISPLAY=:0 XAUTHORITY="\$HOME\/\.Xauthority" /);
  const asked = launchScript(dir, { ...headed, xauthority: '/run/user/1000/gdm/Xauthority' });
  assert.match(asked, /XAUTHORITY='\/run\/user\/1000\/gdm\/Xauthority' /);
  assert.doesNotMatch(launchScript(dir, OPTIONS), /XAUTHORITY/);
});

test('reads the port the browser chose from its profile, and ignores half a file', () => {
  assert.equal(parseDevToolsPort('41234\n/devtools/browser/abc\n'), 41234);
  assert.equal(parseDevToolsPort('41234'), 41234);
  for (const text of ['', '\n', 'x\n', '0\n', '70000\n', '12.5\n', '4\n']) {
    assert.equal(parseDevToolsPort(text), null, JSON.stringify(text));
  }
  assert.equal(launchedPid('pid 4242\n'), 4242);
  assert.equal(launchedPid('nothing'), null);
  assert.throws(() => readPortScript('/tmp/other'), /directory/);
  assert.match(readPortScript('/tmp/neat-bench-x'), /neat-bench-x\/profile\/DevToolsActivePort/);
});

test('starts nothing but the one browser: no other command, and no pattern kill, in its scripts', () => {
  const launch = launchScript('/tmp/neat-bench-x', OPTIONS);
  const stop = stopScript('/tmp/neat-bench-x');
  for (const script of [launch, stop]) {
    assert.doesNotMatch(script, /\b(pkill|killall|apt|systemctl|reboot|sudo)\b/);
  }
  assert.doesNotMatch(launch, /\b(python3?|node)\b/);
});

// The scripts, run for real against a stand-in browser that keeps a child process, as Chromium's
// renderers are.
const fake = join(work, 'fake-chromium');
writeFileSync(fake, `#!/bin/sh\nexec sh -c 'sleep 300 & wait' fake "$@"\n`);
chmodSync(fake, 0o755);
const spare = [];
after(() => {
  for (const child of spare) child.kill('SIGKILL');
  rmSync(work, { recursive: true, force: true });
});

const sh = (script) => spawnSync('sh', ['-s'], { input: script, encoding: 'utf8' });
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const members = (pgid) =>
  spawnSync('sh', ['-c', `ps -eo pid=,pgid= | awk '$2==${pgid} {print $1}'`], { encoding: 'utf8' })
    .stdout.split('\n')
    .filter(Boolean)
    .map(Number);

test('launches a detached browser with a pid file, and stops it, its children and its files', async () => {
  const dir = join(work, 'neat-bench-test-a');
  assertRemoteDir(dir, parents);
  const launched = sh(launchScript(dir, { ...OPTIONS, chromium: fake, parents }));
  assert.equal(launched.status, 0, launched.stderr);
  const pid = Number(readPid(dir));
  assert.ok(alive(pid));
  await sleepMs(300);
  assert.ok(members(pid).length >= 2, 'the browser and a child share one process group');
  assert.ok(existsSync(join(dir, 'profile')));

  const stopped = sh(stopScript(dir, parents));
  assert.equal(stopped.status, 0, stopped.stderr);
  assert.deepEqual(parseStopReport(stopped.stdout), {
    stopped: true,
    removed: true,
    leftover: 0,
    notes: [],
  });
  assert.equal(alive(pid), false);
  assert.deepEqual(members(pid), []);
  assert.equal(existsSync(dir), false);
});

function readPid(dir) {
  return spawnSync('cat', [join(dir, 'chromium.pid')], { encoding: 'utf8' }).stdout.trim();
}

test('does not launch into a directory that exists: it is another run’s', () => {
  const dir = join(work, 'neat-bench-test-b');
  const first = sh(launchScript(dir, { ...OPTIONS, chromium: fake, parents }));
  assert.equal(first.status, 0, first.stderr);
  const second = sh(launchScript(dir, { ...OPTIONS, chromium: fake, parents }));
  assert.notEqual(second.status, 0);
  sh(stopScript(dir, parents));
});

test('leaves a process alone whose id is in the pid file but is not its browser, and still cleans up', async () => {
  const dir = join(work, 'neat-bench-test-c');
  const innocent = spawn('sleep', ['300'], { stdio: 'ignore' });
  spare.push(innocent);
  const made = sh(`mkdir -m 700 '${dir}' && echo ${innocent.pid} > '${dir}/chromium.pid'`);
  assert.equal(made.status, 0, made.stderr);

  const stopped = sh(stopScript(dir, parents));
  assert.equal(stopped.status, 0, stopped.stderr);
  const report = parseStopReport(stopped.stdout);
  assert.equal(report.stopped, false);
  assert.equal(report.removed, true);
  assert.match(report.notes.join(' '), /not this run's browser/);
  assert.ok(alive(innocent.pid), 'the unrelated process is still running');
  assert.equal(existsSync(dir), false);
});

test('cleans up after a browser that never started: no pid file, just the directory', () => {
  const dir = join(work, 'neat-bench-test-d');
  sh(`mkdir -m 700 '${dir}'`);
  const report = parseStopReport(sh(stopScript(dir, parents)).stdout);
  assert.deepEqual(report, { stopped: false, removed: true, leftover: 0, notes: ['no pid file'] });
});

test('refuses to delete a directory that is not one of its own', () => {
  assert.throws(() => stopScript('/tmp'), /directory/);
  assert.throws(() => stopScript('/home/sima'), /directory/);
});

test('reads a stop report, and says unclean where the files or processes remain', () => {
  assert.deepEqual(parseStopReport('stopped\nleftover 0\nremoved\n'), {
    stopped: true,
    removed: true,
    leftover: 0,
    notes: [],
  });
  const dirty = parseStopReport('stopped\nleftover 2\nnote something odd\n');
  assert.equal(dirty.removed, false);
  assert.equal(dirty.leftover, 2);
  assert.deepEqual(dirty.notes, ['something odd']);
});

// startRemote over stand-ins for ssh, the tunnel and the board's DevTools.
function rig({
  port = '41234\n/devtools/browser/x\n',
  stopOut = 'stopped\nleftover 0\nremoved\n',
} = {}) {
  const calls = [];
  const gate = {};
  gate.launch = new Promise((resolve) => (gate.release = resolve));
  const tunnels = [];
  const io = {
    sshRun: async (host, script) => {
      if (script.includes('mkdir -m 700')) {
        calls.push('launch');
        await gate.launch;
        return { code: 0, stdout: 'pid 4242\n', stderr: '' };
      }
      if (script.includes('DevToolsActivePort')) {
        calls.push('read-port');
        return { code: 0, stdout: port, stderr: '' };
      }
      calls.push('stop');
      if (stopOut instanceof Error) throw stopOut;
      return { code: 0, stdout: stopOut, stderr: '' };
    },
    spawn: (command, args) => {
      const tunnel = { args, exitCode: null, stderr: { on: () => undefined } };
      tunnel.kill = () => {
        calls.push('tunnel-kill');
        tunnel.exitCode = 0;
      };
      tunnels.push(tunnel);
      return tunnel;
    },
    fetch: async () => ({ ok: true, json: async () => ({ Browser: 'Chrome/1' }) }),
    freePort: async () => 55555,
    sleep: async () => undefined,
  };
  const lines = [];
  const base = {
    ssh: 'sima@board',
    runId: 'r1',
    remote: { chromium: 'chromium', servePort: 4390 },
    headless: true,
    serverPort: 4300,
    log: (line) => lines.push(line),
    io,
  };
  return { calls, gate, tunnels, lines, base };
}

test('has its stop registered before the browser is launched, and a stop then waits for the launch', async () => {
  const r = rig();
  const cleanups = [];
  const starting = startRemote({ ...r.base, cleanups }).catch((error) => error);
  assert.equal(cleanups.length, 1, 'registered synchronously, ahead of the launch');
  // A signal while the launch is still in flight: the stop must not run ahead of it.
  const stopping = cleanups[0]();
  await sleepMs(20);
  assert.deepEqual(r.calls, ['launch']);
  r.gate.release();
  await stopping;
  assert.deepEqual(r.calls.slice(0, 2), ['launch', 'stop']);
  await starting;
  assert.equal(r.calls.filter((call) => call === 'stop').length, 1, 'stopped once');
});

test('drives the port the browser chose, read from its profile, through the tunnel', async () => {
  const r = rig();
  r.gate.release();
  const remote = await startRemote({ ...r.base, cleanups: [] });
  assert.equal(remote.endpoint, 'http://127.0.0.1:55555');
  assert.deepEqual(r.calls.slice(0, 2), ['launch', 'read-port']);
  assert.ok(r.tunnels[0].args.includes('127.0.0.1:55555:127.0.0.1:41234'));
  assert.equal(remote.pageBase, 'http://127.0.0.1:4390/');
});

test('stops once however often it is asked, killing the tunnel first', async () => {
  const r = rig();
  r.gate.release();
  const remote = await startRemote({ ...r.base, cleanups: [] });
  await Promise.all([remote.stop(), remote.stop()]);
  await remote.stop();
  assert.deepEqual(r.calls.slice(-2), ['tunnel-kill', 'stop']);
  assert.equal(r.calls.filter((call) => call === 'stop').length, 1);
});

test('says what is left on the board, and how to remove it, when the stop did not clean up', async () => {
  const r = rig({ stopOut: 'stopped\nleftover 3\nnote had to kill\n' });
  r.gate.release();
  const remote = await startRemote({ ...r.base, cleanups: [] });
  await assert.rejects(remote.stop(), /\/tmp\/neat-bench-r1.*4242|4242.*\/tmp\/neat-bench-r1/s);
  const text = r.lines.join('\n');
  assert.match(text, /NOT removed/);
  assert.match(text, /ssh sima@board 'kill -TERM -- -4242; rm -rf \/tmp\/neat-bench-r1'/);
});

test('says the same where the board could not be reached to stop the browser', async () => {
  const r = rig({ stopOut: new Error('ssh sima@board: no answer in 30000 ms') });
  r.gate.release();
  const remote = await startRemote({ ...r.base, cleanups: [] });
  await assert.rejects(remote.stop(), /no answer/);
  assert.match(r.lines.join('\n'), /rm -rf \/tmp\/neat-bench-r1/);
});

test('gives up, and stops the browser, when the browser never writes its port', async () => {
  const r = rig({ port: '' });
  r.gate.release();
  await assert.rejects(
    startRemote({ ...r.base, cleanups: [], devtoolsMs: 500 }),
    /did not (open|answer)/,
  );
  assert.ok(r.calls.includes('stop'));
});
