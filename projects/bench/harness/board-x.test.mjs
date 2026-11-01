import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { LINUX_ONLY, stubEnv, writeStubs } from './board-stubs.mjs';
import {
  DEFAULT_MODE,
  graphicalSessionFragment,
  lightdmRestoreFragment,
  parseXStart,
  xStartScript,
  xStopFragment,
} from './board-x.mjs';
import { parseStopReport, stopScript } from './remote.mjs';

const work = mkdtempSync(join(tmpdir(), 'bench-x-'));
const parents = [work];
const spare = [];
after(() => {
  for (const child of spare) child.kill('SIGKILL');
  rmSync(work, { recursive: true, force: true });
});
const stubs = writeStubs(join(work, 'stubs'));
const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

test('starts Xorg privately: no TCP, its own cookie, no reset, the screen kept awake', () => {
  const script = xStartScript('/tmp/neat-bench-x');
  assert.match(script, /-nolisten tcp/);
  assert.match(script, /-auth "\$auth"/);
  assert.match(script, /-noreset/);
  assert.match(script, /xauth -f "\$auth" add ":\$d" \. "\$\(mcookie\)"/);
  assert.match(script, /xset s off -dpms s noblank/);
  assert.match(script, /auth="\$dir\/Xauthority"/);
  assert.match(script, /xset q/, 'waits until the server answers');
  assert.match(script, /-logfile "\$dir\/Xorg\.log"/, 'its log is in the run’s directory too');
});

test('only stops LightDM, never disables it, and leaves /etc and the process table alone', () => {
  const scripts = [xStartScript('/tmp/neat-bench-x'), xStopFragment(), lightdmRestoreFragment()];
  for (const script of scripts) {
    assert.doesNotMatch(script, /\b(disable|mask|enable|pkill|killall|reboot|apt)\b/);
    assert.doesNotMatch(script, /\/etc\b/);
  }
  assert.match(scripts[0], /sudo -n systemctl stop lightdm/);
});

test('records whether LightDM was active, and checks it can start at all, before it stops it', () => {
  const script = xStartScript('/tmp/neat-bench-x');
  const stop = script.indexOf('systemctl stop lightdm');
  for (const before of [
    'lightdm.state',
    'command -v fuser',
    'sudo -n true',
    'loginctl list-sessions',
    'start.lock',
  ]) {
    const at = script.indexOf(before);
    assert.ok(at > 0 && at < stop, before);
  }
});

test('refuses a directory that is not a run’s, and a mode or lock folder that is not one', () => {
  assert.throws(() => xStartScript('/tmp'), /directory/);
  assert.throws(() => xStartScript('/home/sima/neat-bench-x'), /directory/);
  assert.throws(() => xStartScript('/tmp/neat-bench-x', { mode: { w: '1;id', h: 1 } }), /mode/);
  assert.throws(() => xStartScript('/tmp/neat-bench-x', { lockDir: "/tmp'; id" }), /lock/);
  assert.throws(() => xStopFragment({ lockDir: '$(id)' }), /lock/);
});

test('reads what the start printed, and not a display, output or mode that is not one', () => {
  assert.deepEqual(
    parseXStart(
      'lightdm active\ndisplay :0\nvt 7\noutput HDMI-1\nmode 1920x1080\nrate 60.00\nxpid 4242\n',
    ),
    {
      lightdm: 'active',
      display: ':0',
      vt: 7,
      output: 'HDMI-1',
      mode: { w: 1920, h: 1080 },
      rateHz: 60,
      xpid: 4242,
    },
  );
  const odd = parseXStart('display ;id\noutput a;b\nmode big\nrate x\nxpid x\n');
  assert.equal(odd.display, null);
  assert.equal(odd.output, null);
  assert.equal(odd.mode, null);
  assert.equal(odd.rateHz, null);
  assert.equal(odd.xpid, null);
  assert.equal(odd.lightdm, 'unknown');
});

test('every sudo kill of Xorg is behind the command-line check, in the same command', () => {
  const fragment = xStopFragment();
  const kills = [...fragment.matchAll(/sudo -n kill/g)];
  assert.equal(kills.length, 2);
  for (const line of fragment.split('\n').filter((l) => l.includes('sudo -n kill'))) {
    assert.match(line, /^\s*is_our_xorg && sudo -n kill -(TERM|KILL) "\$xpid"/, line);
  }
  assert.match(fragment, /-auth \$dir\/Xauthority/);
  assert.match(lightdmRestoreFragment(), /if \[ "\$was" = active \] && \[ -n "\$xleft" \]/);
});

test('has no sudo, systemctl or Xorg in the stop of a run that did not ask for the bare display', () => {
  const stop = stopScript('/tmp/neat-bench-x');
  assert.doesNotMatch(stop, /\b(sudo|systemctl|Xorg|lightdm)\b/);
});

test('makes the cookie private, the pid file readable, and no pid file means no Xorg', () => {
  const script = xStartScript('/tmp/neat-bench-x');
  assert.match(script, /\(umask 077; xauth -f/);
  assert.match(script, /sh -c 'umask 022; echo \$\$ >"\$1" \|\| exit 1; shift; exec "\$@"'/);
});

test(
  'sets the mode at 60 Hz on the connected output, 1920x1080 unless told otherwise',
  LINUX_ONLY,
  () => {
    assert.deepEqual(DEFAULT_MODE, { w: 1920, h: 1080 });
    const script = xStartScript('/tmp/neat-bench-x');
    assert.match(script, /want='1920x1080'/);
    assert.match(script, /xrandr --output "\$output" --mode "\$want" --rate 60/);
    assert.match(
      xStartScript('/tmp/neat-bench-x', { mode: { w: 1280, h: 720 } }),
      /want='1280x720'/,
    );
  },
);

// The start, run for real on the stand-in board.
let counter = 0;
function startBoard({ lightdm = 'active', mode, omit = [], umask = '022', sessions } = {}) {
  counter += 1;
  const root = join(work, `start${counter}`);
  const dir = join(work, `neat-bench-s${counter}`);
  mkdirSync(root);
  mkdirSync(dir, { mode: 0o700 });
  const own = omit.length ? writeStubs(join(root, 'stubs'), { omit }) : stubs;
  const env = stubEnv({ stubs: own, root });
  // Only the stand-ins (and rm, for the start lock's trap) on the PATH where a tool must be
  // missing: `fuser` is installed here.
  if (omit.length) {
    const rm = spawnSync('sh', ['-c', 'command -v rm'], { encoding: 'utf8' }).stdout.trim();
    symlinkSync(rm, join(own, 'rm'));
    env.PATH = own;
  }
  writeFileSync(env.STUB_STATE, `${lightdm}\n`);
  writeFileSync(env.STUB_LOG, '');
  if (sessions) writeFileSync(env.STUB_SESSIONS, `${sessions.join('\n')}\n`);
  // LightDM's own server on :0, as on the board, until LightDM is stopped.
  if (lightdm === 'active') writeFileSync(join(env.STUB_LOCKS, '.X0-lock'), '      1234\n');
  const script = xStartScript(dir, { parents, mode, lockDir: env.STUB_LOCKS });
  const run = () =>
    spawnSync('/bin/sh', ['-c', `umask ${umask}; exec /bin/sh -s`], {
      input: script,
      encoding: 'utf8',
      env,
      timeout: 30_000,
    });
  const xorgPid = () => Number(readFileSync(join(dir, 'xorg.pid'), 'utf8'));
  return { dir, env, run, xorgPid, calls: () => readFileSync(env.STUB_LOG, 'utf8') };
}

test(
  'starts: stops LightDM, Xorg on the freed display, 1920x1080 at 60 Hz, all said',
  LINUX_ONLY,
  async () => {
    // umask 077 as the board's root shell had it: the pid file must still be readable.
    const b = startBoard({ umask: '077' });
    const out = b.run();
    assert.equal(out.status, 0, out.stdout + out.stderr);
    const x = parseXStart(out.stdout);
    spare.push({ kill: () => alive(x.xpid) && process.kill(x.xpid, 'SIGKILL') });
    assert.deepEqual(
      { ...x, xpid: undefined },
      {
        lightdm: 'active',
        display: ':0',
        vt: 7,
        output: 'HDMI-1',
        mode: { w: 1920, h: 1080 },
        rateHz: 60,
        xpid: undefined,
      },
    );
    assert.equal(x.xpid, b.xorgPid(), 'the pid file holds the pid it printed');
    assert.ok(alive(x.xpid), 'that pid is the running Xorg, not a shell that exited');
    assert.equal(statSync(join(b.dir, 'xorg.pid')).mode & 0o777, 0o644);
    assert.equal(statSync(join(b.dir, 'Xauthority')).mode & 0o777, 0o600);
    assert.equal(readFileSync(join(b.dir, 'lightdm.state'), 'utf8'), 'active\n');
    assert.equal(
      existsSync(join(b.dir, 'start.lock')),
      false,
      'the start lock goes with the script',
    );
    const calls = b.calls();
    assert.ok(calls.indexOf('systemctl stop lightdm') < calls.indexOf('Xorg :0 vt7'));
    assert.match(calls, /Xorg :0 vt7 -nolisten tcp -auth .*\/Xauthority -noreset/);
    assert.match(calls, /xset s off -dpms s noblank/);
    assert.match(calls, /xrandr --output HDMI-1 --mode 1920x1080 --rate 60/);
    process.kill(x.xpid, 'SIGTERM');
    await sleepMs(300);
  },
);

test(
  'stops before anything is measured where the output does not offer the mode at 60 Hz',
  LINUX_ONLY,
  async () => {
    const b = startBoard({ mode: { w: 3840, h: 2160 } });
    const out = b.run();
    assert.equal(out.status, 1);
    assert.match(
      out.stdout,
      /note HDMI-1 does not offer 3840x2160 at 60 Hz; it offers 1024x768 1920x1080/,
    );
    assert.doesNotMatch(b.calls(), /xrandr --output/);
    process.kill(b.xorgPid(), 'SIGTERM');
    await sleepMs(300);
  },
);

test('does not touch LightDM where fuser is missing: every VT would look free', LINUX_ONLY, () => {
  const b = startBoard({ omit: ['fuser'] });
  const out = b.run();
  assert.equal(out.status, 1);
  assert.match(out.stdout, /note fuser is missing/);
  assert.doesNotMatch(b.calls(), /systemctl/);
  assert.equal(existsSync(join(b.dir, 'lightdm.state')), false);
});

// The check for a graphical login, run for real on the stand-in board's loginctl. The board
// today has LightDM's greeter on seat0 and a tty login with no seat: both must pass.
const sessionCheck = (sessions, { omit } = {}) => {
  counter += 1;
  const root = join(work, `session${counter}`);
  mkdirSync(root);
  const own = omit ? writeStubs(join(root, 'stubs'), { omit }) : stubs;
  const env = stubEnv({ stubs: own, root });
  // Where loginctl must be missing, only the stand-ins and awk are on the PATH.
  if (omit) {
    const awk = spawnSync('sh', ['-c', 'command -v awk'], { encoding: 'utf8' }).stdout.trim();
    symlinkSync(awk, join(own, 'awk'));
    env.PATH = own;
  }
  if (sessions) writeFileSync(env.STUB_SESSIONS, `${sessions.join('\n')}\n`);
  return spawnSync('/bin/sh', ['-s'], {
    input: `${graphicalSessionFragment()}echo passed\n`,
    encoding: 'utf8',
    env,
  });
};

test(
  'lets the board as it is today through: a greeter on seat0, a tty login with no seat',
  LINUX_ONLY,
  () => {
    const out = sessionCheck();
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(out.stdout, /^passed$/m);
  },
);

test('lets a user session through that is not on seat0, or not graphical', LINUX_ONLY, () => {
  const out = sessionCheck([
    'c1 lightdm greeter x11 seat0',
    '4 sima user x11 -',
    '5 sima user tty seat0',
    '6 sima manager unspecified -',
  ]);
  assert.equal(out.status, 0, out.stdout + out.stderr);
});

for (const type of ['x11', 'wayland']) {
  test(
    `refuses where a user is logged in on seat0 under ${type}, naming the session and the user`,
    LINUX_ONLY,
    () => {
      const out = sessionCheck(['c1 lightdm greeter x11 seat0', `7 maria user ${type} seat0`]);
      assert.equal(out.status, 1);
      assert.match(
        out.stdout,
        new RegExp(`^note session 7 of maria \\(${type}\\) is logged in`, 'm'),
      );
      assert.match(out.stdout, /log it out first/);
      assert.doesNotMatch(out.stdout, /passed/);
    },
  );
}

test('refuses where it cannot tell, as loginctl is missing', LINUX_ONLY, () => {
  const out = sessionCheck(undefined, { omit: ['loginctl'] });
  assert.equal(out.status, 1);
  assert.match(out.stdout, /^note loginctl is missing/m);
});

test(
  'a start over a graphical login touches nothing: LightDM keeps running, nothing is made',
  LINUX_ONLY,
  () => {
    const b = startBoard({ sessions: ['c2 maria user x11 seat0'] });
    const out = b.run();
    assert.equal(out.status, 1);
    assert.match(out.stdout, /note session c2 of maria \(x11\) is logged in on seat0/);
    assert.doesNotMatch(b.calls(), /systemctl stop|Xorg|xauth/);
    assert.equal(existsSync(join(b.dir, 'lightdm.state')), false);
  },
);

test('starts no Xorg where its pid file cannot be written', LINUX_ONLY, () => {
  const b = startBoard({ lightdm: 'inactive' });
  // A directory where the pid file goes: the root shell's write fails, as on a full /tmp.
  mkdirSync(join(b.dir, 'xorg.pid'));
  const out = spawnSync('sh', ['-s'], {
    input: xStartScript(b.dir, { parents, lockDir: b.env.STUB_LOCKS }).replace(
      'n=0\nuntil xset q',
      // The answer wait is not what this spec is about: stop right after the launch.
      'sleep 0.5\nexit 0\nuntil xset q',
    ),
    encoding: 'utf8',
    env: b.env,
  });
  assert.equal(out.status, 0, out.stderr);
  assert.doesNotMatch(b.calls(), /^Xorg /m, 'Xorg was never executed');
});

test('refuses to start once the teardown has asked for a stop', LINUX_ONLY, () => {
  const b = startBoard();
  writeFileSync(join(b.dir, 'stop'), '');
  const out = b.run();
  assert.equal(out.status, 1);
  assert.match(out.stdout, /note the run is being torn down/);
  assert.doesNotMatch(b.calls(), /systemctl stop/);
});

// The stop and the restore, run for real with the stand-ins and processes that look like the
// run's Xorg and LightDM's to the command-line checks.
function teardownBoard({ was, xorg = 'ours', startFails = false, lightdmX = true }) {
  counter += 1;
  const root = join(work, `stop${counter}`);
  const dir = join(work, `neat-bench-x${counter}`);
  mkdirSync(root);
  mkdirSync(dir);
  const extra = {};
  if (startFails) extra.STUB_START_FAILS = '1';
  if (lightdmX) {
    const lightdm = spawn(
      'sh',
      ['-c', 'sleep 300', 'Xorg', ':0', '-auth', '/var/run/lightdm/root/:0'],
      {
        stdio: 'ignore',
      },
    );
    spare.push(lightdm);
    extra.STUB_LIGHTDM_XPID = String(lightdm.pid);
  }
  const env = stubEnv({ stubs, root, extra });
  writeFileSync(env.STUB_LOG, '');
  writeFileSync(env.STUB_STATE, 'inactive\n');
  if (was !== undefined) writeFileSync(join(dir, 'lightdm.state'), `${was}\n`);
  let child = null;
  if (xorg) {
    const named = xorg === 'ours' ? `${dir}/Xauthority` : '/elsewhere';
    child = spawn('sh', ['-c', 'sleep 300', 'fake-Xorg', ':9', '-auth', named], {
      stdio: 'ignore',
    });
    spare.push(child);
    writeFileSync(join(dir, 'xorg.pid'), `${child.pid}\n`);
  }
  const script = `dir='${dir}'
${xStopFragment({ lockDir: env.STUB_LOCKS })}${lightdmRestoreFragment({ lockDir: env.STUB_LOCKS, restoreS: 1 })}echo "xleft=$xleft dn=$dn"
`;
  const run = () => spawnSync('sh', ['-s'], { input: script, encoding: 'utf8', env });
  return { dir, env, child, run, calls: () => readFileSync(env.STUB_LOG, 'utf8') };
}

test(
  'stops its Xorg and starts LightDM again when it had been active: restored once its Xorg runs',
  LINUX_ONLY,
  async () => {
    const b = teardownBoard({ was: 'active' });
    const out = b.run();
    assert.equal(out.status, 0, out.stderr);
    const report = parseStopReport(out.stdout);
    assert.equal(report.xorg, 'stopped');
    assert.deepEqual(report.display, { state: 'restored', why: undefined });
    assert.match(out.stdout, /xleft= dn=$/m);
    await sleepMs(100);
    assert.equal(alive(b.child.pid), false);
    assert.match(b.calls(), /systemctl --no-block start lightdm/);
    assert.ok(b.calls().indexOf('sudo kill') < b.calls().indexOf('systemctl --no-block start'));
  },
);

test('does not start LightDM when it was not active before the run', LINUX_ONLY, () => {
  const b = teardownBoard({ was: 'inactive' });
  const report = parseStopReport(b.run().stdout);
  assert.equal(report.display.state, 'unchanged');
  assert.doesNotMatch(b.calls(), /systemctl .*start/);
  assert.equal(report.xorg, 'stopped');
});

test('says the display is not restored when LightDM does not come back', LINUX_ONLY, () => {
  const b = teardownBoard({ was: 'active', startFails: true });
  const out = b.run();
  const report = parseStopReport(out.stdout);
  assert.equal(report.display.state, 'not-restored');
  assert.match(report.display.why, /lightdm is inactive and its Xorg is not running/);
  assert.match(out.stdout, /dn=1$/m);
});

test('is not fooled by a LightDM that says active while its Xorg never came up', LINUX_ONLY, () => {
  const b = teardownBoard({ was: 'active', lightdmX: false });
  const report = parseStopReport(b.run().stdout);
  assert.equal(report.display.state, 'not-restored');
  assert.match(report.display.why, /lightdm is active and its Xorg is not running/);
});

test('leaves a pid alone that is not its Xorg, and still puts LightDM back', LINUX_ONLY, () => {
  const b = teardownBoard({ was: 'active', xorg: 'another' });
  const report = parseStopReport(b.run().stdout);
  assert.equal(report.xorg, undefined);
  assert.match(report.notes.join(' '), /not this run's Xorg/);
  assert.ok(alive(b.child.pid));
  assert.equal(report.display.state, 'restored');
  assert.doesNotMatch(b.calls(), /sudo kill/);
});

test(
  'a start that never got as far as recording LightDM starts nothing and says nothing',
  LINUX_ONLY,
  () => {
    const b = teardownBoard({ was: undefined, xorg: null });
    const out = b.run();
    assert.equal(parseStopReport(out.stdout).display, undefined);
    assert.doesNotMatch(b.calls(), /systemctl/);
  },
);

test(
  'finds its Xorg by the lock files where the pid file cannot be read, still checking it',
  LINUX_ONLY,
  async () => {
    const b = teardownBoard({ was: 'active' });
    // As in the first board smoke: a pid file sima cannot read. And its Xorg on another display.
    writeFileSync(join(b.env.STUB_LOCKS, '.X3-lock'), `${String(b.child.pid).padStart(10)}\n`);
    chmodSync(join(b.dir, 'xorg.pid'), 0o000);
    const out = b.run();
    assert.match(out.stdout, /^xorg stopped$/m, out.stderr);
    await sleepMs(100);
    assert.equal(alive(b.child.pid), false);
  },
);

test(
  'finds its Xorg by the lock files where the pid file was never written',
  LINUX_ONLY,
  async () => {
    const b = teardownBoard({ was: 'active' });
    rmSync(join(b.dir, 'xorg.pid'));
    writeFileSync(join(b.env.STUB_LOCKS, '.X5-lock'), `${String(b.child.pid).padStart(10)}\n`);
    const out = b.run();
    assert.match(out.stdout, /^xorg stopped$/m);
    await sleepMs(100);
    assert.equal(alive(b.child.pid), false);
  },
);

test('does not start LightDM under an Xorg it could not stop, and says so', LINUX_ONLY, () => {
  const script = `dir='/tmp/neat-bench-x'\nwas=active\nxleft=1\nxpid=4242\n${lightdmRestoreFragment()}`;
  const out = spawnSync('sh', ['-s'], { input: script, encoding: 'utf8' });
  assert.match(out.stdout, /display not restored: Xorg \(pid 4242\) is still running/);
  assert.equal(parseStopReport(out.stdout).display.state, 'not-restored');
});
