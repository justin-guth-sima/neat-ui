import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildArgs, describeCheckout, isDirty, verifyBuild } from './build-stamp.mjs';

const SHA = 'a'.repeat(40);

test('is dirty where a tracked file changed, anywhere in the checkout', () => {
  assert.equal(isDirty(''), false);
  assert.equal(isDirty(' M package.json\n'), true);
  assert.equal(isDirty('A  projects/bench/src/new.ts\n'), true);
  assert.equal(isDirty('R  old.ts -> projects/neat-ui/new.ts\n'), true);
});

test('is dirty where an untracked file sits under the bench or the kit’s sources', () => {
  assert.equal(isDirty('?? projects/bench/src/app/scratch.ts\n'), true);
  assert.equal(isDirty('?? projects/neat-ui/diagram/src/new.ts\n'), true);
  assert.equal(isDirty('?? "projects/bench/src/with space.ts"\n'), true);
});

test('does not count an untracked file elsewhere: notes and scratch are not the build', () => {
  assert.equal(isDirty('?? notes.txt\n?? docs/draft.md\n'), false);
  assert.equal(isDirty('?? projects/benchmark-notes/x\n?? projects/bench-other/x\n'), false);
});

test('says the commit, marked dirty where the sources are not exactly it', async () => {
  const git = (status) => async (args) => (args[0] === 'rev-parse' ? `${SHA}\n` : status);
  assert.equal(await describeCheckout(git('')), SHA);
  assert.equal(await describeCheckout(git('?? projects/bench/x.ts\n')), `${SHA}-dirty`);
  assert.equal(await describeCheckout(git('?? other.txt\n')), SHA);
});

test('asks git for the untracked files too, so a new file is seen', async () => {
  const seen = [];
  await describeCheckout(async (args) => {
    seen.push(args.join(' '));
    return args[0] === 'rev-parse' ? `${SHA}\n` : '';
  });
  assert.ok(
    seen.some((line) => /status --porcelain --untracked-files=all/.test(line)),
    seen.join('|'),
  );
});

test('says unknown where there is no git to ask', async () => {
  assert.equal(
    await describeCheckout(async () => {
      throw new Error('not a repository');
    }),
    'unknown',
  );
});

test('passes the build’s commit to the Angular build as a constant, and the rest through', () => {
  assert.deepEqual(buildArgs(SHA, []), ['build', 'bench', `--define=BENCH_GIT_SHA="${SHA}"`]);
  assert.deepEqual(buildArgs(`${SHA}-dirty`, ['-c', 'development']), [
    'build',
    'bench',
    `--define=BENCH_GIT_SHA="${SHA}-dirty"`,
    '-c',
    'development',
  ]);
  assert.deepEqual(buildArgs('unknown', [])[2], '--define=BENCH_GIT_SHA="unknown"');
});

test('refuses a stamp that is not a commit, since it is written into the bundle', () => {
  assert.throws(() => buildArgs('x"; process.exit()', []), /stamp/);
});

test('has nothing to say where the build is the checkout', () => {
  assert.deepEqual(verifyBuild({ built: SHA, checkout: SHA }), []);
});

test('warns of a build made without the stamp, and says why --url makes it matter', () => {
  const [local] = verifyBuild({ built: 'unknown', checkout: SHA });
  assert.match(local, /npm run bench:build/);
  const [served] = verifyBuild({ built: 'unknown', checkout: SHA, url: 'http://board:4300/' });
  assert.match(served, /--url/);
  assert.match(served, /unverified/);
});

test('warns of a build from a dirty tree, which is not the commit’s', () => {
  const warnings = verifyBuild({ built: `${SHA}-dirty`, checkout: `${SHA}-dirty` });
  assert.match(warnings.join('\n'), /uncommitted/);
});

test('warns where the build and the checkout are different commits, or one was edited since', () => {
  const other = 'b'.repeat(40);
  const [mismatch] = verifyBuild({ built: other, checkout: SHA });
  assert.match(mismatch, new RegExp(`${other.slice(0, 12)}.*${SHA.slice(0, 12)}`));
  assert.match(verifyBuild({ built: SHA, checkout: `${SHA}-dirty` }).join('\n'), /changed since/);
});

test('cannot compare with a checkout that is not one, and says so', () => {
  assert.match(verifyBuild({ built: SHA, checkout: 'unknown' }).join('\n'), /cannot be checked/);
});
