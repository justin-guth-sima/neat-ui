// The bench reaches the diagram's bench seam through a path alias that only its own tsconfig
// declares (AGENTS.md "The rendering bench"). TypeScript replaces `paths` wholesale in a config
// that extends another, so the bench's tsconfig repeats the workspace's entry-point paths beside
// the alias. These tests keep the copy whole and the alias the bench's alone.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SEAM_ALIAS = '@bench/diagram-seam';
const SEAM_FILE = resolve(ROOT, 'projects/neat-ui/diagram/src/bench-seam.ts');

/** A tsconfig's `paths` as it reads them, each target resolved against the config's folder. */
function pathsOf(config) {
  const file = resolve(ROOT, config);
  const { config: json, error } = ts.parseConfigFileTextToJson(file, readFileSync(file, 'utf8'));
  assert.equal(error, undefined, config);
  const parsed = ts.parseJsonConfigFileContent(json, ts.sys, dirname(file), undefined, file);
  return Object.fromEntries(
    Object.entries(parsed.options.paths ?? {}).map(([alias, targets]) => [
      alias,
      targets.map((target) => resolve(parsed.options.pathsBasePath ?? dirname(file), target)),
    ]),
  );
}

test('the bench’s tsconfigs have the workspace’s paths and the seam’s alias', () => {
  const workspace = pathsOf('tsconfig.json');
  for (const config of ['projects/bench/tsconfig.app.json', 'projects/bench/tsconfig.spec.json']) {
    assert.deepEqual(pathsOf(config), { ...workspace, [SEAM_ALIAS]: [SEAM_FILE] }, config);
  }
});

test('no tsconfig but the bench’s declares the seam’s alias', () => {
  for (const config of [
    'tsconfig.json',
    'projects/neat-ui/tsconfig.lib.json',
    'projects/neat-ui/tsconfig.spec.json',
    'projects/showcase/tsconfig.app.json',
    'projects/showcase/tsconfig.spec.json',
  ]) {
    assert.equal(pathsOf(config)[SEAM_ALIAS], undefined, config);
  }
});
