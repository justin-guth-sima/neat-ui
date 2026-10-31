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
const X_OUT = 'lightdm active\ndisplay :0\nvt 7\nmode 1920x1080\nxpid 777\n';
const SERVER_OUT = 'port 40213\npid 888\nurl http://127.0.0.1:40213/\n';
const BARE_STOP = 'stopped\nleftover 0\nserver stopped\nxorg stopped\nremoved\ndisplay restored\n';

function rig({
  port = '41234\n/devtools/browser/x\n',
  stopOut = 'stopped\nleftover 0\nremoved\n',
  xOut = { code: 0, stdout: X_OUT },
  serverOut = { code: 0, stdout: SERVER_OUT },
} = {}) {
  const calls = [];
  const scripts = {};
  const gate = {};
  gate.launch = new Promise((resolve) => (gate.release = resolve));
  const tunnels = [];
  const io = {
    sshRun: async (host, script) => {
      if (script.includes('rm -rf')) {
        calls.push('stop');
        scripts.stop = script;
        if (stopOut instanceof Error) throw stopOut;
        return { code: 0, stdout: stopOut, stderr: '' };
      }
      if (script.includes('DevToolsActivePort')) {
        calls.push('read-port');
        return { code: 0, stdout: port, stderr: '' };
      }
      if (script.includes('>"$dir/chromium.pid"')) {
        calls.push('launch');
        scripts.launch = script;
        await gate.launch;
        return { code: 0, stdout: 'pid 4242\n', stderr: '' };
      }
      if (script.includes('mkdir "$dir/site"')) {
        calls.push('prepare');
        return { code: 0, stdout: '', stderr: '' };
      }
      if (script.includes('http.server')) {
        calls.push('server');
        return { stderr: '', ...serverOut };
      }
      if (script.includes('xset q')) {
        calls.push('x');
        return { stderr: '', ...xOut };
      }
      throw new Error(`unexpected script: ${script.slice(0, 60)}`);
    },
    copySite: async () => {
      calls.push('copy');
      return 3;
    },
    siteManifest: async () => [{ path: 'index.html', size: 1 }],
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
  return { calls, scripts, gate, tunnels, lines, base };
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

test('puts a window on the screen where no window manager sizes it, and not otherwise', () => {
  const flags = browserFlags('/tmp/neat-bench-x', {
    ...OPTIONS,
    headless: false,
    display: ':0',
    window: { w: 3840, h: 2160 },
  });
  assert.ok(flags.includes('--window-position=0,0'));
  assert.ok(flags.includes('--window-size=3840,2160'));
  assert.ok(!browserFlags('/tmp/neat-bench-x', OPTIONS).some((f) => f.startsWith('--window-')));
});

test('launches into a directory another script of the run made, and not into a foreign one', () => {
  const made = launchScript('/tmp/neat-bench-x', { ...OPTIONS, existing: true });
  assert.match(made, /\[ -d "\$dir" \]/);
  assert.doesNotMatch(made, /mkdir -m 700/);
  assert.match(made, /mkdir "\$dir\/profile"/, 'still refuses a profile that is already there');
});

const BARE = { chromium: 'chromium', servePort: 4390, display: 'bare' };

test('runs headed on the bare X server it started: its display, its cookie, the screen’s size', async () => {
  const r = rig({ stopOut: BARE_STOP });
  r.gate.release();
  const remote = await startRemote({
    ...r.base,
    remote: BARE,
    headless: false,
    serverPort: undefined,
    cleanups: [],
  });
  assert.deepEqual(r.calls.slice(0, 3), ['prepare', 'x', 'launch']);
  assert.match(r.scripts.launch, /DISPLAY=:0 XAUTHORITY='\/tmp\/neat-bench-r1\/Xauthority' /);
  assert.match(r.scripts.launch, /--window-position=0,0 --window-size=1920,1080/);
  assert.match(r.scripts.launch, /--kiosk/);
  assert.doesNotMatch(r.scripts.launch, /--headless/);
  assert.deepEqual(remote.display, {
    kind: 'bare',
    name: ':0',
    vt: 7,
    mode: { w: 1920, h: 1080 },
    lightdm: 'active',
  });
  assert.match(r.lines.join('\n'), /bare X server :0 on vt7, mode 1920x1080/);
});

test('serves from the board: copy, then the server, and the browser loads the board’s address', async () => {
  const r = rig({ stopOut: BARE_STOP });
  r.gate.release();
  const remote = await startRemote({
    ...r.base,
    remote: BARE,
    headless: false,
    serve: { bind: '127.0.0.1', dist: '/x/dist' },
    serverPort: undefined,
    cleanups: [],
  });
  assert.deepEqual(r.calls.slice(0, 5), ['prepare', 'copy', 'server', 'x', 'launch']);
  assert.equal(remote.pageBase, 'http://127.0.0.1:40213/');
  assert.ok(!r.tunnels[0].args.includes('-R'), 'no reverse tunnel: the laptop serves nothing');
  await remote.stop();
  assert.match(r.scripts.stop, /http\.server/, 'its stop knows the server');
  assert.match(r.scripts.stop, /systemctl start lightdm/, 'and the display');
});

test('keeps the laptop’s reverse tunnel when the board does not serve', async () => {
  const r = rig();
  r.gate.release();
  const remote = await startRemote({ ...r.base, cleanups: [] });
  assert.ok(r.tunnels[0].args.includes('127.0.0.1:4390:127.0.0.1:4300'));
  assert.deepEqual(r.calls.slice(0, 2), ['launch', 'read-port'], 'no prepare, no server, no X');
  await remote.stop();
  assert.doesNotMatch(r.scripts.stop, /sudo|systemctl|http\.server/);
});

test('serves a laptop browser from the board with no browser of its own on the board', async () => {
  const r = rig({
    stopOut: 'removed\nserver stopped\nleftover 0\n',
    serverOut: { code: 0, stdout: 'port 40213\npid 888\nurl http://10.42.0.68:40213/\n' },
  });
  const remote = await startRemote({
    ...r.base,
    remote: { chromium: 'chromium', servePort: 4390 },
    browser: false,
    serve: { bind: '10.42.0.68', dist: '/x/dist' },
    serverPort: undefined,
    cleanups: [],
  });
  assert.deepEqual(r.calls, ['prepare', 'copy', 'server']);
  assert.equal(remote.pageBase, 'http://10.42.0.68:40213/');
  assert.equal(r.tunnels.length, 0);
  await remote.stop();
});

test('registers the stop before the board is touched, and a stop during the X start waits for it', async () => {
  const r = rig({ stopOut: BARE_STOP });
  let release;
  const held = new Promise((resolve) => (release = resolve));
  const slow = r.base.io.sshRun;
  r.base.io.sshRun = async (host, script) => {
    if (script.includes('xset q')) {
      r.calls.push('x');
      await held;
      return { code: 0, stdout: X_OUT, stderr: '' };
    }
    return slow(host, script);
  };
  const cleanups = [];
  const starting = startRemote({
    ...r.base,
    remote: BARE,
    headless: false,
    serverPort: undefined,
    cleanups,
  }).catch((error) => error);
  assert.equal(cleanups.length, 1, 'registered synchronously, ahead of the first script');
  await sleepMs(20);
  assert.deepEqual(r.calls, ['prepare', 'x']);
  const stopping = cleanups[0]();
  await sleepMs(20);
  assert.ok(!r.calls.includes('stop'), 'the stop waits for the X start');
  release();
  await stopping;
  assert.deepEqual(r.calls, ['prepare', 'x', 'stop']);
  assert.match((await starting).message, /stopped before/);
  assert.ok(!r.calls.includes('launch'), 'no browser starts after the stop was asked for');
});

test('stops, and says why, when the bare X server did not come up', async () => {
  const r = rig({
    stopOut: 'removed\ndisplay restored\nleftover 0\n',
    xOut: { code: 1, stdout: 'lightdm active\nnote Xorg did not answer in 20 s\n' },
  });
  await assert.rejects(
    startRemote({ ...r.base, remote: BARE, headless: false, cleanups: [] }),
    /bare X server.*Xorg did not answer/,
  );
  assert.ok(r.calls.includes('stop'), 'LightDM is put back after a failed start');
  assert.ok(!r.calls.includes('launch'));
});

test('is not clean until LightDM is back: the stop rejects, tells how, and reports what it saw', async () => {
  const r = rig({
    stopOut:
      'stopped\nleftover 0\nxorg stopped\nremoved\ndisplay not restored: lightdm is failed\n',
  });
  r.gate.release();
  const stopped = [];
  const remote = await startRemote({
    ...r.base,
    remote: BARE,
    headless: false,
    onStopped: (what) => stopped.push(what),
    cleanups: [],
  });
  await assert.rejects(remote.stop(), /display was not restored.*systemctl start lightdm/);
  assert.match(r.lines.join('\n'), /display not restored: lightdm is failed/);
  assert.equal(stopped[0].report.display.state, 'not-restored');
});

test('is not clean where the Xorg or the server it started is still there', async () => {
  for (const left of ['xorg left', 'server left']) {
    const r = rig({
      stopOut: `stopped\nleftover 0\n${left}\nremoved\ndisplay restored\n`,
    });
    r.gate.release();
    const remote = await startRemote({ ...r.base, remote: BARE, headless: false, cleanups: [] });
    await assert.rejects(remote.stop(), /not cleaned up/, left);
  }
});

test('hears the report of a clean stop, restored display included', async () => {
  const r = rig({ stopOut: BARE_STOP });
  r.gate.release();
  const stopped = [];
  const remote = await startRemote({
    ...r.base,
    remote: BARE,
    headless: false,
    onStopped: (what) => stopped.push(what),
    cleanups: [],
  });
  await remote.stop();
  await remote.stop();
  assert.equal(stopped.length, 1);
  assert.equal(stopped[0].report.display.state, 'restored');
  assert.match(r.lines.join('\n'), /board: display restored/);
});
