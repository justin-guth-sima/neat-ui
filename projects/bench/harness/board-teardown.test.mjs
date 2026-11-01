import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { stubEnv, writeStubs } from './board-stubs.mjs';
import { prepareScript, serverStartScript } from './board-server.mjs';
import {
  bareStartChecksFragment,
  GUARD,
  GUARD_WORST_S,
  guardInstallFragment,
  guardScript,
  heartbeatCommand,
  parseGuard,
  startHeartbeat,
  TEARDOWN_SSH_MS,
  TEARDOWN_WAIT_S,
  teardownWaitScript,
} from './board-teardown.mjs';
import { launchScript, parseStopReport } from './remote.mjs';

const work = mkdtempSync(join(tmpdir(), 'bench-guard-'));
const parents = [work];
const spare = [];
after(() => {
  for (const pid of spare) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already gone.
    }
  }
  rmSync(work, { recursive: true, force: true });
});
const stubs = writeStubs(join(work, 'stubs'));
const fake = join(work, 'fake-chromium');
writeFileSync(fake, `#!/bin/sh\nexec sh -c 'sleep 300 & wait' fake "$@"\n`, { mode: 0o755 });
const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const until = async (check, ms, what) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleepMs(100);
  }
};
/** A script run with `sh -s`, without holding up the event loop (the stand-ins are its children). */
const sh = (script, env) =>
  new Promise((resolve) => {
    const child = spawn('sh', ['-s'], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
    child.stdin.end(script);
  });

// Fast timings for the specs; the campaign's are GUARD's.
const FAST = { staleS: 2, tickS: 1, startWaitS: 3, restoreS: 2, ackS: 2 };

test('times the laptop’s wait above everything the guard may spend before it answers', () => {
  assert.equal(GUARD.heartbeatS, 5);
  assert.equal(GUARD.staleS, 20);
  assert.equal(GUARD.restoreS, 15);
  assert.ok(TEARDOWN_WAIT_S > GUARD_WORST_S, `${TEARDOWN_WAIT_S} > ${GUARD_WORST_S}`);
  assert.ok(TEARDOWN_SSH_MS > (TEARDOWN_WAIT_S + GUARD.ackS + 5) * 1000 + 10_000);
});

test('the guard writes its pid before anything, and removes the directory only when all is back', () => {
  const script = guardScript('/tmp/neat-bench-x');
  const lines = script.split('\n');
  assert.match(
    lines.find((line) => line.startsWith('echo $$')),
    /guard\.pid/,
  );
  assert.ok(script.indexOf('guard.pid') < script.indexOf('while :'));
  const keep = script.indexOf('[ -z "$keep" ] || exit 1');
  assert.ok(keep > 0 && keep < script.indexOf('rm -rf -- "$dir.removing"'));
  assert.equal(script.match(/rm -rf/g).length, 1);
  assert.match(script, /case "\$dir" in '\/tmp'\/neat-bench-\*\|'\/var\/tmp'\/neat-bench-\*\) ;;/);
  assert.doesNotMatch(script, /\b(disable|mask|pkill|killall|reboot)\b|\/etc\b/);
  assert.match(script, /-gt 20 \]/, 'a heartbeat older than 20 s');
  assert.match(script, /sudo -n systemctl --no-block start lightdm/);
});

test('installs and starts the guard detached, with a heartbeat, in the run’s first script', () => {
  const install = guardInstallFragment('/tmp/neat-bench-x');
  assert.match(
    install,
    /setsid nohup sh "\$dir\/guard\.sh" <\/dev\/null >>"\$dir\/guard\.log" 2>&1 &/,
  );
  assert.ok(install.indexOf(': >"$dir/heartbeat"') < install.indexOf('setsid nohup'));
  assert.equal(parseGuard('guard 4242\n'), 4242);
  assert.equal(parseGuard('note the guard did not start\n'), null);
  assert.throws(() => guardScript('/tmp/other'), /directory/);
  assert.throws(() => guardScript('/tmp/neat-bench-x', { staleS: '1; id' }), /seconds/);
});

// A run's directory on the stand-in board, as the start leaves it: the guard installed and
// running, the browser, an Xorg of the run's, LightDM stopped after being active, and LightDM's
// own Xorg ready to come back with it.
let counter = 0;
async function board({
  timing = FAST,
  startFails = false,
  lightdm = 'active',
  heartbeat = true,
} = {}) {
  counter += 1;
  const root = join(work, `board${counter}`);
  const dir = join(work, `neat-bench-g${counter}`);
  const lightdmX = spawn(
    'sh',
    ['-c', 'sleep 300', 'Xorg', ':0', '-auth', '/var/run/lightdm/root/:0'],
    {
      stdio: 'ignore',
    },
  );
  spare.push(lightdmX.pid);
  const env = stubEnv({
    stubs,
    root,
    extra: {
      STUB_LIGHTDM_XPID: String(lightdmX.pid),
      ...(startFails && { STUB_START_FAILS: '1' }),
    },
  });
  writeFileSync(env.STUB_LOG, '');
  writeFileSync(env.STUB_STATE, 'inactive\n');
  const options = { parents, lockDir: env.STUB_LOCKS, ...timing };
  const prepared = await sh(
    prepareScript(dir, parents, { then: guardInstallFragment(dir, options) }),
    env,
  );
  assert.equal(prepared.status, 0, prepared.stdout + prepared.stderr);
  const guard = parseGuard(prepared.stdout);
  spare.push(guard);
  // Kept fresh by the "laptop" unless a spec wants it to go quiet.
  const touch = () => {
    try {
      writeFileSync(join(dir, 'heartbeat'), '');
    } catch {
      // The guard removed the directory.
    }
  };
  const beat = heartbeat ? setInterval(touch, 300) : null;
  writeFileSync(join(dir, 'lightdm.state'), `${lightdm}\n`);
  const launched = await sh(
    launchScript(dir, { chromium: fake, headless: true, existing: true, guarded: true, parents }),
    env,
  );
  assert.equal(launched.status, 0, launched.stdout + launched.stderr);
  const browser = Number(readFileSync(join(dir, 'chromium.pid'), 'utf8'));
  spare.push(browser);
  const xorg = spawn('sh', ['-c', 'sleep 300', 'fake-Xorg', ':1', '-auth', `${dir}/Xauthority`], {
    stdio: 'ignore',
  });
  spare.push(xorg.pid);
  writeFileSync(join(dir, 'xorg.pid'), `${xorg.pid}\n`);
  await sleepMs(200);
  return {
    dir,
    env,
    guard,
    browser,
    xorg: xorg.pid,
    quiet: () => clearInterval(beat),
    wait: () => sh(teardownWaitScript(dir, { parents, waitS: 30, ackS: timing.ackS }), env),
    calls: () => readFileSync(env.STUB_LOG, 'utf8'),
  };
}

test('tears down by itself when the heartbeat goes quiet: all stopped, LightDM back, directory gone', async () => {
  const b = await board();
  assert.ok(alive(b.guard));
  await sleepMs(3000);
  assert.ok(existsSync(b.dir), 'a fresh heartbeat keeps the run going');
  b.quiet();
  await until(() => !existsSync(b.dir), 20_000, 'the guard to remove the directory');
  await sleepMs(200);
  assert.equal(alive(b.browser), false);
  assert.equal(alive(b.xorg), false);
  assert.equal(alive(b.guard), false, 'the guard exits when done');
  assert.equal(existsSync(`${b.dir}.removing`), false, 'and leaves nothing of the rename');
  assert.match(b.calls(), /sudo kill -TERM/);
  assert.match(b.calls(), /systemctl --no-block start lightdm/);
});

test('tears down when asked: the laptop’s wait hears the whole report, then the directory goes', async () => {
  const b = await board({ timing: { ...FAST, staleS: 60 } });
  const out = await b.wait();
  b.quiet();
  assert.equal(out.status, 0, out.stdout + out.stderr);
  const report = parseStopReport(out.stdout);
  assert.equal(report.stopped, true);
  assert.equal(report.leftover, 0);
  assert.equal(report.xorg, 'stopped');
  assert.deepEqual(report.display, { state: 'restored', why: undefined });
  assert.equal(report.removed, true);
  assert.equal(existsSync(b.dir), false);
  await sleepMs(200);
  assert.equal(alive(b.browser), false);
  assert.equal(alive(b.guard), false);
});

test('keeps the directory and its pid files when the display does not come back, for another try', async () => {
  const b = await board({ timing: { ...FAST, staleS: 60 }, startFails: true });
  const out = await b.wait();
  b.quiet();
  const report = parseStopReport(out.stdout);
  assert.equal(report.display.state, 'not-restored');
  assert.equal(report.removed, false);
  assert.match(report.notes.join(' '), /kept .* for another teardown: sh .*\/guard\.sh/);
  assert.ok(existsSync(join(b.dir, 'lightdm.state')), 'what a second attempt needs is still there');
  assert.ok(existsSync(join(b.dir, 'chromium.pid')));
  await sleepMs(200);
  assert.equal(alive(b.guard), false, 'and the guard is done');
  // The second attempt, as the log tells a person to run it, now that LightDM can start.
  const again = spawnSync('sh', [join(b.dir, 'guard.sh')], {
    encoding: 'utf8',
    env: { ...b.env, STUB_START_FAILS: '' },
    timeout: 30_000,
  });
  assert.match(again.stdout, /^display restored$/m, again.stdout + again.stderr);
  assert.equal(existsSync(b.dir), false);
});

test('starts the guard again where it is not running, and still tears down', async () => {
  const b = await board({ timing: { ...FAST, staleS: 60 } });
  process.kill(b.guard, 'SIGKILL');
  await sleepMs(200);
  const out = await b.wait();
  b.quiet();
  assert.match(out.stdout, /note the guard was not running: started it again/);
  const report = parseStopReport(out.stdout);
  assert.equal(report.display.state, 'restored');
  assert.equal(report.removed, true);
});

test('waits for a start script still on the board before it tears down', async () => {
  const b = await board({ timing: { ...FAST, staleS: 60, startWaitS: 10 } });
  const start = spawn('sleep', ['2'], { stdio: 'ignore' });
  writeFileSync(join(b.dir, 'start.lock'), `${start.pid}\n`);
  const began = Date.now();
  const out = await b.wait();
  b.quiet();
  assert.ok(Date.now() - began >= 1800, 'not before the start ended');
  assert.equal(parseStopReport(out.stdout).removed, true);
});

test('starts nothing once the teardown has asked for a stop', async () => {
  const b = await board({ timing: { ...FAST, staleS: 60 } });
  writeFileSync(join(b.dir, 'site', 'index.html'), 'x');
  // Hold the guard off with a start lock of our own while the start scripts try.
  const hold = spawn('sleep', ['3'], { stdio: 'ignore' });
  writeFileSync(join(b.dir, 'start.lock'), `${hold.pid}\n`);
  writeFileSync(join(b.dir, 'stop'), '');
  const served = await sh(
    serverStartScript(b.dir, { bind: '127.0.0.1', guarded: true }, parents),
    b.env,
  );
  assert.equal(served.status, 1);
  assert.match(served.stdout, /note the run is being torn down/);
  assert.equal(existsSync(join(b.dir, 'server.pid')), false);
  const out = await b.wait();
  b.quiet();
  assert.equal(parseStopReport(out.stdout).removed, true);
});

test('says gone where the guard already tore the run down, and removes a directory with no guard', async () => {
  const gone = await sh(
    teardownWaitScript(join(work, 'neat-bench-none'), { parents }),
    process.env,
  );
  assert.equal(parseStopReport(gone.stdout).gone, true);
  const bare = join(work, 'neat-bench-bare');
  await sh(prepareScript(bare, parents), process.env);
  const out = await sh(teardownWaitScript(bare, { parents }), process.env);
  assert.match(out.stdout, /note no guard in .*: nothing had been started/);
  assert.equal(parseStopReport(out.stdout).removed, true);
  assert.equal(existsSync(bare), false);
});

test('the guard renames the directory before it removes it, so a teardown sees it whole or gone', () => {
  const script = guardScript('/tmp/neat-bench-x');
  const rename = script.indexOf('mv -- "$dir" "$dir.removing"');
  assert.ok(rename > script.indexOf('[ -z "$keep" ] || exit 1'));
  assert.ok(rename > 0 && rename < script.indexOf('rm -rf -- "$dir.removing"'));
  assert.match(script, /mv -- "\$dir" "\$dir\.removing" && rm -rf -- "\$dir\.removing"/);
});

test('a teardown that lands while the guard removes the directory says gone, not "nothing started"', async () => {
  // The rename done, the removal under way: the directory is gone, `.removing` is what is left.
  const dir = join(work, 'neat-bench-removing');
  mkdirSync(`${dir}.removing`);
  writeFileSync(join(`${dir}.removing`, 'lightdm.state'), 'active\n');
  const out = await sh(teardownWaitScript(dir, { parents }), process.env);
  assert.equal(out.status, 0, out.stderr);
  assert.doesNotMatch(out.stdout, /nothing had been started/);
  const report = parseStopReport(out.stdout);
  assert.equal(report.gone, true);
  assert.equal(report.display, undefined, 'it says nothing of the display itself');
});

test('the heartbeat touches the file once per line and ends with its input', async () => {
  const dir = join(work, 'neat-bench-hb');
  await sh(prepareScript(dir, parents), process.env);
  const hb = join(dir, 'heartbeat');
  const loop = spawn('sh', ['-c', heartbeatCommand(dir, parents)], {
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  loop.stdin.write('\n');
  await until(() => existsSync(hb), 2000, 'the first touch');
  const first = statSync(hb).mtimeMs;
  await sleepMs(50);
  loop.stdin.write('\n');
  await until(() => statSync(hb).mtimeMs > first, 2000, 'the second touch');
  const ended = new Promise((resolve) => loop.on('close', resolve));
  loop.stdin.end();
  assert.equal(await ended, 0, 'the loop ends when the laptop’s side closes');
});

/** A stand-in for spawn that records its calls and hands out controllable children. */
function fakeSpawn() {
  const calls = [];
  const spawnFake = (command, args, options) => {
    const child = new EventEmitter();
    child.writes = [];
    child.stdin = {
      writable: true,
      write: (data) => child.writes.push(data),
      end: () => {
        child.stdin.writable = false;
        child.ended = true;
      },
      on: () => undefined,
    };
    child.stderr = new EventEmitter();
    calls.push({ command, args, options, child });
    return child;
  };
  return { calls, spawn: spawnFake };
}

test('the laptop beats every interval over a detached ssh, opens it again when it drops, and stops', async () => {
  const f = fakeSpawn();
  const lines = [];
  const hb = startHeartbeat({
    ssh: 'sima@board',
    dir: '/tmp/neat-bench-x',
    log: (line) => lines.push(line),
    everyMs: 20,
    retryMs: 20,
    spawn: f.spawn,
  });
  assert.equal(f.calls[0].command, 'ssh');
  assert.equal(f.calls[0].options.detached, true);
  assert.match(f.calls[0].args.at(-1), /touch '\/tmp\/neat-bench-x\/heartbeat'/);
  await sleepMs(70);
  assert.ok(f.calls[0].child.writes.length >= 3, 'one line at once, then one per interval');
  f.calls[0].child.emit('close', 255);
  await sleepMs(50);
  assert.equal(f.calls.length, 2, 'opened again');
  assert.match(lines.join('\n'), /heartbeat link ended .* tears the run down after 20 s/);
  hb.stop();
  assert.equal(f.calls[1].child.ended, true);
  const writes = f.calls[1].child.writes.length;
  await sleepMs(60);
  assert.equal(f.calls[1].child.writes.length, writes, 'no beat after the stop');
  f.calls[1].child.emit('close', 0);
  await sleepMs(40);
  assert.equal(f.calls.length, 2, 'and not opened again');
});

// A second bare run on one board would record LightDM as stopped and never restore it. The
// checks run for real, in a parent folder of their own (the other specs leave guards about),
// against processes that look like another run's guard by their command line.
const parentFolder = () => mkdtempSync(join(work, 'parent-'));
const otherRun = (parent, id, { cmdline = 'guard' } = {}) => {
  const dir = join(parent, `neat-bench-${id}`);
  mkdirSync(dir);
  const named = cmdline === 'guard' ? `${dir}/guard.sh` : '/elsewhere/guard.sh.not';
  const other = spawn('sh', ['-c', 'sleep 300', 'sh', named], { stdio: 'ignore' });
  spare.push(other.pid);
  writeFileSync(join(dir, 'guard.pid'), `${other.pid}\n`);
  return { dir, pid: other.pid };
};
const checks = (parent, dir) => {
  counter += 1;
  const env = stubEnv({ stubs, root: join(work, `checks${counter}`) });
  return sh(`dir='${dir}'\n${bareStartChecksFragment([parent])}echo passed\n`, env);
};

test('refuses to start while another run’s guard is alive, naming its directory and pid', async () => {
  const parent = parentFolder();
  const other = otherRun(parent, 'o1');
  const out = await checks(parent, join(parent, 'neat-bench-mine'));
  assert.equal(out.status, 1);
  assert.ok(
    out.stdout.includes(
      `note another bench run is live on this board (${other.dir}, guard ${other.pid})`,
    ),
    out.stdout,
  );
  assert.doesNotMatch(out.stdout, /passed/);
});

test('starts where another run’s guard is gone, was never written, or is a recycled pid', async () => {
  const parent = parentFolder();
  const dead = otherRun(parent, 'o2');
  process.kill(dead.pid, 'SIGKILL');
  await until(() => !alive(dead.pid), 2000, 'the stand-in guard to end');
  mkdirSync(join(parent, 'neat-bench-o3'));
  otherRun(parent, 'o4', { cmdline: 'recycled' });
  const out = await checks(parent, join(parent, 'neat-bench-mine'));
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.match(out.stdout, /^passed$/m);
});

test('does not count the run’s own guard: a rerun of its teardown is not refused by it', async () => {
  const parent = parentFolder();
  const own = otherRun(parent, 'o5');
  const out = await checks(parent, own.dir);
  assert.equal(out.status, 0, out.stdout + out.stderr);
});

test('refuses over a graphical login too, the same fragment as the start’s', async () => {
  const parent = parentFolder();
  counter += 1;
  const root = join(work, `checks${counter}`);
  const env = stubEnv({ stubs, root });
  writeFileSync(env.STUB_SESSIONS, 'c2 maria user wayland seat0\n');
  const out = await sh(
    `dir='${join(parent, 'neat-bench-mine')}'\n${bareStartChecksFragment([parent])}echo passed\n`,
    env,
  );
  assert.equal(out.status, 1);
  assert.match(out.stdout, /^note session c2 of maria \(wayland\) is logged in on seat0/m);
});
