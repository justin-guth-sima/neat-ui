import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseArgs, USAGE, UsageError } from './args.mjs';

const BASE = ['--machine', 'rig'];

test('has defaults that make a laptop run of the kit against vflow on ladder A', () => {
  const o = parseArgs(BASE);
  assert.equal(o.machine, 'rig');
  assert.deepEqual(o.ladders, ['A']);
  assert.deepEqual(o.renderers, ['kit', 'vflow']);
  assert.equal(o.repeats, 3);
  assert.equal(o.seed, 1);
  assert.equal(o.steps, undefined);
  assert.equal(o.input, 'page');
  assert.deepEqual(o.target, { kind: 'local' });
  assert.equal(o.dpr, '1');
  assert.deepEqual(o.viewport, { w: 1920, h: 1080 });
  assert.equal(o.refine, false);
  assert.equal(o.trace, false);
  assert.equal(o.screenshots, true);
  assert.equal(o.headless, false);
  assert.equal(o.allowUnfair, false);
  assert.equal(o.url, undefined);
  assert.equal(o.ssh, undefined);
});

test('needs a machine label, which every result is filed under', () => {
  assert.throws(() => parseArgs([]), /--machine/);
});

test('reads lists, numbers, flags and both spellings of a value', () => {
  const o = parseArgs([
    ...BASE,
    '--ladders=A,b,C',
    '--renderers',
    'vflow,kit',
    '--repeats=2',
    '--steps',
    '3',
    '--seed=9',
    '--refine',
    '--trace',
    '--trace-steps=2',
    '--input=cdp',
    '--out',
    'somewhere',
    '--no-screenshots',
  ]);
  assert.deepEqual(o.ladders, ['A', 'B', 'C']);
  assert.deepEqual(o.renderers, ['vflow', 'kit']);
  assert.equal(o.repeats, 2);
  assert.equal(o.steps, 3);
  assert.equal(o.seed, 9);
  assert.equal(o.refine, true);
  assert.equal(o.trace, true);
  assert.equal(o.traceSteps, 2);
  assert.equal(o.input, 'cdp');
  assert.equal(o.out, 'somewhere');
  assert.equal(o.screenshots, false);
});

test('traces every step with --trace alone, which is the board default', () => {
  // No count means the whole climb (as far as --steps goes): the presented rate decides tiers, so
  // a step the trace does not cover is judged by the recorder alone.
  assert.equal(parseArgs([...BASE, '--trace']).traceSteps, undefined);
  assert.equal(parseArgs([...BASE, '--trace', '--trace-steps', 'all']).traceSteps, undefined);
  assert.equal(parseArgs([...BASE, '--trace', '--trace-steps', '4']).traceSteps, 4);
  assert.throws(() => parseArgs([...BASE, '--trace', '--trace-steps', 'most']), /trace-steps/);
  assert.throws(() => parseArgs([...BASE, '--trace', '--trace-steps', '0']), /trace-steps/);
});

test('refuses a ladder, renderer, input or number that is not one, saying which', () => {
  assert.throws(() => parseArgs([...BASE, '--ladders', 'A,F']), /ladder.*F/);
  assert.throws(() => parseArgs([...BASE, '--renderers', 'kit,svelte']), /renderer.*svelte/);
  assert.throws(() => parseArgs([...BASE, '--input', 'touch']), /input.*page, cdp/);
  assert.throws(() => parseArgs([...BASE, '--repeats', '0']), /repeats/);
  assert.throws(() => parseArgs([...BASE, '--repeats', '2.5']), /repeats/);
  assert.throws(() => parseArgs([...BASE, '--steps', 'x']), /steps/);
  assert.throws(() => parseArgs([...BASE, '--frobnicate']), UsageError);
});

test('says vflow-virt is not built, as the page does', () => {
  assert.throws(() => parseArgs([...BASE, '--renderers', 'kit,vflow-virt']), /not built yet/);
});

test('refuses the browser’s input on the floor host, which has no zoom box', () => {
  assert.throws(() => parseArgs([...BASE, '--renderers', 'none', '--input=cdp']), /none/);
});

test('takes a target: local, an existing browser over CDP, or one started on the board', () => {
  assert.deepEqual(parseArgs([...BASE, '--target', 'local']).target, { kind: 'local' });
  assert.deepEqual(parseArgs([...BASE, '--target=cdp:http://127.0.0.1:9222']).target, {
    kind: 'cdp',
    endpoint: 'http://127.0.0.1:9222',
  });
  const remote = parseArgs([...BASE, '--target', 'remote', '--ssh', 'sima@10.42.0.68']);
  assert.deepEqual(remote.target, { kind: 'remote' });
  assert.equal(remote.ssh, 'sima@10.42.0.68');
  assert.throws(() => parseArgs([...BASE, '--target', 'elsewhere']), /target/);
  assert.throws(() => parseArgs([...BASE, '--target', 'cdp:']), /target/);
});

test('needs --ssh to start a browser on the board, and a host that cannot be an option', () => {
  assert.throws(() => parseArgs([...BASE, '--target', 'remote']), /--ssh/);
  assert.throws(() => parseArgs([...BASE, '--ssh', '-oProxyCommand=evil']), /--ssh/);
  assert.throws(() => parseArgs([...BASE, '--ssh', 'a b']), /--ssh/);
});

test('reads the viewport and the pixel ratio profile', () => {
  const o = parseArgs([...BASE, '--viewport', '1280x720', '--dpr', 'native']);
  assert.deepEqual(o.viewport, { w: 1280, h: 720 });
  assert.equal(o.dpr, 'native');
  assert.deepEqual(parseArgs([...BASE, '--viewport=native']).viewport, 'native');
  assert.throws(() => parseArgs([...BASE, '--viewport', '1920']), /viewport/);
  assert.throws(() => parseArgs([...BASE, '--dpr', '2']), /dpr/);
});

test('idles 20 s between runs on a board, none on a laptop, unless told', () => {
  assert.equal(parseArgs(BASE).cooldownMs, 0);
  assert.equal(parseArgs([...BASE, '--ssh', 'sima@board']).cooldownMs, 20_000);
  assert.equal(parseArgs([...BASE, '--target=cdp:http://127.0.0.1:9222']).cooldownMs, 20_000);
  assert.equal(parseArgs([...BASE, '--ssh', 'sima@board', '--cooldown', '5']).cooldownMs, 5000);
});

test('has the board’s serve port, browser and display as options, defaults away from the dev ports', () => {
  const o = parseArgs([...BASE, '--target', 'remote', '--ssh', 'sima@board']);
  assert.equal(o.remote.servePort, 4390);
  assert.equal(o.remote.xauthority, undefined);
  assert.equal(o.remote.chromium, 'chromium');
  assert.equal(o.remote.display, undefined);
  const custom = parseArgs([
    ...BASE,
    '--target=remote',
    '--ssh=sima@board',
    '--remote-serve-port=4391',
    '--remote-chromium=/usr/bin/chromium',
    '--remote-display=:0',
    '--remote-xauthority=/run/user/1000/gdm/Xauthority',
  ]);
  assert.equal(custom.remote.servePort, 4391);
  assert.equal(custom.remote.display, ':0');
  assert.equal(custom.remote.xauthority, '/run/user/1000/gdm/Xauthority');
  for (const port of [4200, 9900]) {
    assert.throws(() => parseArgs([...BASE, `--remote-serve-port=${port}`]), /port/);
  }
});

test('no longer takes a debugging port: the browser chooses its own', () => {
  assert.throws(() => parseArgs([...BASE, '--remote-debug-port=9444']), /remote-debug-port/);
});

test('takes the Xauthority file as an absolute path only, since the board’s shell reads it', () => {
  for (const file of ['relative/x', '/a b', '/a;id', '/$(id)', '']) {
    assert.throws(() => parseArgs([...BASE, `--remote-xauthority=${file}`]), /xauthority/, file);
  }
});

const BOARD = [...BASE, '--target', 'remote', '--ssh', 'sima@board'];

test('takes --remote-display bare for a headed run on a bare X server, on the board only', () => {
  const o = parseArgs([...BOARD, '--remote-display', 'bare']);
  assert.equal(o.remote.display, 'bare');
  assert.equal(o.headless, false);
  assert.throws(() => parseArgs([...BASE, '--remote-display=bare']), /--target remote/);
  assert.throws(
    () => parseArgs([...BASE, '--ssh', 'sima@board', '--remote-display=bare']),
    /--target remote/,
  );
  assert.throws(() => parseArgs([...BOARD, '--remote-display=bare', '--headless']), /headed/);
});

test('refuses --remote-xauthority with --remote-display bare: the harness makes the cookie', () => {
  assert.throws(
    () =>
      parseArgs([...BOARD, '--remote-display=bare', '--remote-xauthority=/home/sima/.Xauthority']),
    /xauthority.*bare|bare.*xauthority/i,
  );
});

test('sets the bare display to 1920x1080 unless --remote-mode says otherwise, and only that one', () => {
  assert.deepEqual(parseArgs([...BOARD, '--remote-display=bare']).remote.mode, {
    w: 1920,
    h: 1080,
  });
  assert.deepEqual(
    parseArgs([...BOARD, '--remote-display=bare', '--remote-mode=1280x720']).remote.mode,
    { w: 1280, h: 720 },
  );
  assert.equal(parseArgs(BOARD).remote.mode, undefined);
  assert.throws(() => parseArgs([...BOARD, '--remote-mode=1280x720']), /--remote-display bare/);
  for (const mode of ['4k', '1920', '1920x1080@60', '1920x1080;id']) {
    assert.throws(
      () => parseArgs([...BOARD, '--remote-display=bare', `--remote-mode=${mode}`]),
      /--remote-mode is WxH/,
      mode,
    );
  }
});

test('never serves on every interface of the board', () => {
  assert.throws(() => parseArgs([...BOARD, '--serve=board:0.0.0.0']), /every interface/);
});

test('serves the bench from the board with --serve board, loopback unless a bind is given', () => {
  assert.equal(parseArgs(BOARD).serve, undefined);
  assert.deepEqual(parseArgs([...BOARD, '--serve', 'board']).serve, {
    where: 'board',
    bind: '127.0.0.1',
  });
  assert.deepEqual(parseArgs([...BOARD, '--serve=board:10.42.0.68']).serve, {
    where: 'board',
    bind: '10.42.0.68',
  });
});

test('judges --serve before anything runs: value, host, target and page address', () => {
  for (const value of [
    'laptop',
    'board:',
    'board:host',
    'board:1.2.3',
    'board:1.2.3.4.5',
    'board:999.1.1.1',
    'board:1.2.3.4;id',
    'board:0.0.0.0',
    'x',
  ]) {
    assert.throws(() => parseArgs([...BOARD, `--serve=${value}`]), /--serve/, value);
  }
  assert.throws(() => parseArgs([...BASE, '--serve=board']), /--ssh/);
  assert.throws(() => parseArgs([...BOARD, '--serve=board', '--url=http://x:4300/']), /--url/);
  assert.throws(
    () =>
      parseArgs([
        ...BASE,
        '--ssh=sima@board',
        '--target=cdp:http://127.0.0.1:9222',
        '--serve=board',
      ]),
    /--target/,
  );
  // A laptop browser cannot reach the board's loopback.
  assert.throws(() => parseArgs([...BASE, '--ssh=sima@board', '--serve=board']), /loopback|bind/);
  const laptop = parseArgs([...BASE, '--ssh=sima@board', '--serve=board:10.42.0.68']);
  assert.equal(laptop.serve.bind, '10.42.0.68');
});

test('documents every option it reads', () => {
  for (const name of [
    '--url',
    '--dist',
    '--target',
    '--machine',
    '--ladders',
    '--renderers',
    '--repeats',
    '--steps',
    '--refine',
    '--trace',
    '--input',
    '--ssh',
    '--out',
    '--headless',
    '--viewport',
    '--dpr',
    '--cooldown',
    '--allow-unfair',
    '--no-screenshots',
    '--remote-xauthority',
    '--serve',
    '--remote-mode',
    'bare',
  ]) {
    assert.ok(USAGE.includes(name), name);
  }
});

test('reads --browser-flags as a list, and has none by default', () => {
  assert.deepEqual(parseArgs(BASE).browserFlags, []);
  assert.deepEqual(parseArgs([...BASE, '--browser-flags', '--disable-gpu']).browserFlags, [
    '--disable-gpu',
  ]);
  assert.deepEqual(
    parseArgs([...BASE, '--browser-flags=--num-raster-threads=4 --disable-gpu']).browserFlags,
    ['--num-raster-threads=4', '--disable-gpu'],
  );
});

test('refuses --browser-flags that are not flags, as a usage error', () => {
  assert.throws(() => parseArgs([...BASE, '--browser-flags', 'x;id']), UsageError);
  assert.throws(() => parseArgs([...BASE, '--browser-flags', '--kiosk']), UsageError);
});

test('says what --browser-flags is in the usage', () => {
  assert.match(USAGE, /--browser-flags/);
});
