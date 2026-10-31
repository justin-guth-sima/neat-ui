// `npm run bench:build`: `ng build bench` with the checkout's commit stamped into the bundle as
// `BENCH_GIT_SHA` (`build-stamp.mjs`), so a result can say which sources it measured and the
// harness can warn where the build is not the checkout's. Anything after `--` goes to `ng build`.
import { execFile, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { buildArgs, describeCheckout } from './build-stamp.mjs';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ng = createRequire(import.meta.url).resolve('@angular/cli/bin/ng.js');

const stamp = await describeCheckout(
  async (args) => (await run('git', ['-C', root, ...args])).stdout,
);
console.error(`[bench:build] commit stamp: ${stamp}`);
if (stamp.endsWith('-dirty')) {
  console.error('[bench:build] the working tree has changes: the build is marked dirty');
}
const child = spawn(process.execPath, [ng, ...buildArgs(stamp, process.argv.slice(2))], {
  cwd: root,
  stdio: 'inherit',
});
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
