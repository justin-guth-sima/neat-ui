import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import {
  copySite,
  parseServerStart,
  prepareScript,
  serverStartScript,
  serverStopFragment,
  siteManifest,
  verifyScript,
} from './board-server.mjs';
import { parseStopReport, stopScript } from './remote.mjs';

const work = mkdtempSync(join(tmpdir(), 'bench-server-'));
const parents = [work];
const spare = [];
after(() => {
  for (const child of spare) child.kill('SIGKILL');
  rmSync(work, { recursive: true, force: true });
});

const sh = (script) => spawnSync('sh', ['-s'], { input: script, encoding: 'utf8' });

const dist = join(work, 'dist');
mkdirSync(join(dist, 'media'), { recursive: true });
writeFileSync(join(dist, 'index.html'), '<!doctype html><title>bench</title>');
writeFileSync(join(dist, 'main-ABC123.js'), 'console.log(1)');
writeFileSync(join(dist, 'media', 'font.woff2'), 'x'.repeat(100));

// The copy and the check, run here: `sh -c` takes the place of ssh.
const here = {
  pipe: ({ dist: from, command }) =>
    new Promise((resolve, reject) => {
      const pack = spawn('tar', ['-C', from, '-cf', '-', '.'], {
        stdio: ['ignore', 'pipe', 'inherit'],
      });
      const unpack = spawn('sh', ['-c', command], { stdio: ['pipe', 'inherit', 'inherit'] });
      pack.stdout.pipe(unpack.stdin);
      unpack.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`untar ${code}`))));
    }),
  sshRun: async (host, script) => {
    const { status, stdout, stderr } = sh(script);
    return { code: status, stdout, stderr };
  },
};

test('lists the build’s files with their sizes, and wants an index.html', async () => {
  const entries = await siteManifest(dist);
  assert.deepEqual(
    entries.map((e) => e.path),
    ['index.html', 'main-ABC123.js', 'media/font.woff2'],
  );
  assert.equal(entries[2].size, 100);
  const empty = join(work, 'empty');
  mkdirSync(empty);
  await assert.rejects(siteManifest(empty), /index\.html/);
});

test('refuses a file name that would have to be quoted for the shell', async () => {
  const odd = join(work, 'odd');
  mkdirSync(odd);
  writeFileSync(join(odd, 'index.html'), 'x');
  writeFileSync(join(odd, 'a b;id.js'), 'x');
  await assert.rejects(siteManifest(odd), /unusual name/);
  assert.throws(() => verifyScript('/tmp/neat-bench-x', [{ path: '$(id)', size: 1 }]), /bad entry/);
});

test('refuses a bind that is not an address, and a directory that is not a run’s', () => {
  for (const bind of ['', 'localhost', '1.2.3', '1.2.3.4;id', '999.1.1.1', '$(id)']) {
    assert.throws(() => serverStartScript('/tmp/neat-bench-x', { bind }), /bind/, bind);
  }
  assert.throws(() => serverStartScript('/tmp', { bind: '127.0.0.1' }), /directory/);
  assert.throws(() => prepareScript('/home/sima'), /directory/);
});

test('never takes 4200 or 9900 and starts nothing but the one server', () => {
  const script = serverStartScript('/tmp/neat-bench-x', { bind: '127.0.0.1' });
  assert.match(script, /4200, 9900/);
  assert.doesNotMatch(script, /\b(pkill|killall|sudo|systemctl|apt)\b/);
  assert.match(script, /--bind "\$bind" --directory "\$dir\/site"/);
});

test('copies the build into the run’s site folder and checks it arrived', async () => {
  const dir = join(work, 'neat-bench-c1');
  assert.equal(sh(prepareScript(dir, parents)).status, 0);
  const entries = await siteManifest(dist);
  const n = await copySite({ ssh: 'x', dist, dir, entries, parents, io: here });
  assert.equal(n, 3);
  assert.ok(existsSync(join(dir, 'site', 'media', 'font.woff2')));
  sh(stopScript(dir, parents));
});

test('says so where a file of the copy is not the build’s', async () => {
  const dir = join(work, 'neat-bench-c2');
  sh(prepareScript(dir, parents));
  const entries = await siteManifest(dist);
  await copySite({ ssh: 'x', dist, dir, entries, parents, io: here });
  truncateSync(join(dir, 'site', 'main-ABC123.js'), 3);
  const checked = sh(verifyScript(dir, entries, parents));
  assert.equal(checked.status, 1);
  assert.match(checked.stdout, /note main-ABC123\.js: 3 bytes, expected 14/);
  sh(stopScript(dir, parents));
});

test('does not start a server where nothing was copied', () => {
  const dir = join(work, 'neat-bench-c3');
  sh(prepareScript(dir, parents));
  const started = sh(serverStartScript(dir, { bind: '127.0.0.1' }, parents));
  assert.equal(started.status, 1);
  assert.match(started.stdout, /note no site/);
  sh(stopScript(dir, parents));
});

const get = async (url) => {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1000) })).status;
  } catch {
    return null;
  }
};

test('serves the copy on a free port, and the stop ends it, with the directory', async () => {
  const dir = join(work, 'neat-bench-s1');
  sh(prepareScript(dir, parents));
  await copySite({ ssh: 'x', dist, dir, entries: await siteManifest(dist), parents, io: here });
  const started = sh(serverStartScript(dir, { bind: '127.0.0.1' }, parents));
  assert.equal(started.status, 0, started.stderr + started.stdout);
  const served = parseServerStart(started.stdout);
  assert.ok(served.port >= 1024 && ![4200, 9900].includes(served.port));
  assert.equal(served.url, `http://127.0.0.1:${served.port}/`);
  assert.equal(await get(served.url), 200);
  assert.equal(await get(`${served.url}media/font.woff2`), 200);

  const stopped = sh(stopScript(dir, parents, { server: true }));
  assert.equal(stopped.status, 0, stopped.stderr);
  const report = parseStopReport(stopped.stdout);
  assert.equal(report.server, 'stopped');
  assert.equal(report.removed, true);
  assert.equal(existsSync(dir), false);
  assert.equal(await get(served.url), null, 'nothing answers any more');
});

test('leaves a pid alone that is not its server, and still removes the directory', () => {
  const dir = join(work, 'neat-bench-s2');
  const innocent = spawn('sleep', ['300'], { stdio: 'ignore' });
  spare.push(innocent);
  sh(`mkdir -m 700 '${dir}' && echo ${innocent.pid} >'${dir}/server.pid'`);
  const report = parseStopReport(sh(stopScript(dir, parents, { server: true })).stdout);
  assert.equal(report.server, undefined);
  assert.match(report.notes.join(' '), /not this run's server/);
  assert.equal(report.removed, true);
  assert.doesNotThrow(() => process.kill(innocent.pid, 0));
});

test('does not mistake a process of the same program for its server: the folder must be its own', () => {
  const dir = join(work, 'neat-bench-s3');
  const other = join(work, 'elsewhere');
  mkdirSync(other);
  const foreign = spawn(
    'python3',
    ['-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', other],
    {
      stdio: 'ignore',
    },
  );
  spare.push(foreign);
  sh(`mkdir -m 700 '${dir}' && echo ${foreign.pid} >'${dir}/server.pid'`);
  const report = parseStopReport(sh(stopScript(dir, parents, { server: true })).stdout);
  assert.match(report.notes.join(' '), /not this run's server/);
  assert.doesNotThrow(() => process.kill(foreign.pid, 0));
});

test('the stop only kills a pid after it has checked its command line', () => {
  const fragment = serverStopFragment();
  const check = fragment.indexOf('if is_our_server; then');
  for (const match of fragment.matchAll(/kill -(TERM|KILL)/g)) assert.ok(match.index > check);
});

test('reads the server’s address from the start’s printout, and nothing odd', () => {
  assert.deepEqual(parseServerStart('port 40213\npid 9\nurl http://10.42.0.68:40213/\n'), {
    port: 40213,
    url: 'http://10.42.0.68:40213/',
  });
  for (const text of [
    '',
    'port 80\nurl http://1.2.3.4:80/\n',
    'port 40213\nurl http://x;id:40213/\n',
  ]) {
    assert.equal(parseServerStart(text), null, text);
  }
});
